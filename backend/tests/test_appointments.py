import datetime


def _create_department_and_doctor(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    dept = client.post("/admin/departments", json={"name": "Cardiology", "description": "Heart care"}, headers=headers)
    dept_id = dept.json()["id"]

    doctor = client.post("/admin/doctors", json={
        "email": "doc@example.com", "password": "docpass123", "full_name": "Dr. Rao",
        "department_id": dept_id, "specialization": "Cardiologist", "license_number": "LIC-001",
        "years_experience": 10, "consultation_fee": 500,
    }, headers=headers)
    return doctor.json()["id"]


def _set_availability(client, admin_token, doctor_id):
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Monday=0 ... make available every day for simplicity in tests by using today's weekday
    today = datetime.date.today()
    client.post(f"/doctors/{doctor_id}/availability", json={
        "day_of_week": today.weekday(), "start_time": "09:00:00", "end_time": "12:00:00",
        "slot_duration_minutes": 30,
    }, headers=headers)


def test_book_appointment_flow(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)

    today = datetime.date.today().isoformat()
    resp = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:00:00",
        "reason": "routine checkup",
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "scheduled"
    assert body["category"] == "routine_checkup"
    # Regression: the no-show model must actually run at booking time —
    # this used to silently stay null forever (dead AI feature).
    assert body["no_show_risk_score"] is not None
    assert 0.0 <= body["no_show_risk_score"] <= 1.0


def test_double_booking_same_slot_rejected(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    headers = {"Authorization": f"Bearer {patient_token}"}

    client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:30:00",
    }, headers=headers)
    resp = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:30:00",
    }, headers=headers)
    assert resp.status_code == 409


def test_cancel_appointment(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    headers = {"Authorization": f"Bearer {patient_token}"}

    created = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "10:00:00",
    }, headers=headers).json()

    resp = client.put(f"/appointments/{created['id']}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_patient_cannot_update_appointment_status(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    headers = {"Authorization": f"Bearer {patient_token}"}

    created = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "10:30:00",
    }, headers=headers).json()

    resp = client.put(f"/appointments/{created['id']}/status", json={"status": "completed"}, headers=headers)
    assert resp.status_code == 403


def test_available_slots_excludes_booked(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    headers = {"Authorization": f"Bearer {patient_token}"}

    client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "11:00:00",
    }, headers=headers)

    resp = client.get(f"/doctors/{doctor_id}/available-slots", params={"for_date": today})
    times = [slot["time"] for slot in resp.json()]
    assert "11:00:00" not in times


def test_doctor_can_delete_own_availability_block(client, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(f"/doctors/{doctor_id}/availability", json={
        "day_of_week": 0, "start_time": "09:00:00", "end_time": "12:00:00", "slot_duration_minutes": 30,
    }, headers=headers)
    slot_id = created.json()["id"]

    before = client.get(f"/doctors/{doctor_id}/availability")
    assert len(before.json()) == 1

    resp = client.delete(f"/doctors/{doctor_id}/availability/{slot_id}", headers=headers)
    assert resp.status_code == 204

    after = client.get(f"/doctors/{doctor_id}/availability")
    assert len(after.json()) == 0


def test_patient_cannot_delete_doctor_availability(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(f"/doctors/{doctor_id}/availability", json={
        "day_of_week": 0, "start_time": "09:00:00", "end_time": "12:00:00", "slot_duration_minutes": 30,
    }, headers=admin_headers)
    slot_id = created.json()["id"]

    resp = client.delete(
        f"/doctors/{doctor_id}/availability/{slot_id}",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 403


def test_unrelated_doctor_cannot_view_patient_chart(client, patient_token, admin_token):
    """A doctor who has never treated this patient must not be able to
    pull up their profile, medical records, or prescriptions just by
    knowing the patient_id."""
    doctor_id = _create_department_and_doctor(client, admin_token)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # A second, unrelated doctor who has never had an appointment with this patient
    other_doc = client.post("/admin/doctors", json={
        "email": "unrelated.doc@example.com", "password": "docpass123", "full_name": "Dr. Unrelated",
        "specialization": "Dermatologist", "license_number": "LIC-UNRELATED",
    }, headers=admin_headers)
    other_doc_login = client.post("/auth/login", json={"email": "unrelated.doc@example.com", "password": "docpass123"})
    other_doc_token = other_doc_login.json()["access_token"]

    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    appt = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:00:00",
    }, headers={"Authorization": f"Bearer {patient_token}"}).json()
    patient_id = appt["patient_id"]

    other_headers = {"Authorization": f"Bearer {other_doc_token}"}
    assert client.get(f"/patients/{patient_id}", headers=other_headers).status_code == 403
    assert client.get(f"/medical-records/{patient_id}", headers=other_headers).status_code == 403
    assert client.get(f"/prescriptions/patient/{patient_id}", headers=other_headers).status_code == 403


def test_treating_doctor_can_view_patient_chart(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    appt = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:00:00",
    }, headers={"Authorization": f"Bearer {patient_token}"}).json()
    patient_id = appt["patient_id"]

    doc_login = client.post("/auth/login", json={"email": "doc@example.com", "password": "docpass123"})
    doc_token = doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    assert client.get(f"/patients/{patient_id}", headers=doc_headers).status_code == 200
    assert client.get(f"/medical-records/{patient_id}", headers=doc_headers).status_code == 200
    assert client.get(f"/prescriptions/patient/{patient_id}", headers=doc_headers).status_code == 200


def test_treating_doctor_can_add_medical_record(client, patient_token, admin_token):
    doctor_id = _create_department_and_doctor(client, admin_token)
    _set_availability(client, admin_token, doctor_id)
    today = datetime.date.today().isoformat()
    appt = client.post("/appointments", json={
        "doctor_id": doctor_id, "appointment_date": today, "appointment_time": "09:00:00",
    }, headers={"Authorization": f"Bearer {patient_token}"}).json()
    patient_id = appt["patient_id"]

    doc_login = client.post("/auth/login", json={"email": "doc@example.com", "password": "docpass123"})
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    resp = client.post("/medical-records", json={
        "patient_id": patient_id, "record_type": "consultation_summary", "notes": "Patient reports mild fatigue.",
    }, headers=doc_headers)
    assert resp.status_code == 201

    records = client.get(f"/medical-records/{patient_id}", headers=doc_headers).json()
    assert len(records) == 1
    assert records[0]["notes"] == "Patient reports mild fatigue."
