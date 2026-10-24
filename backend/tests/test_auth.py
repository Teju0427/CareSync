def test_register_patient(client):
    resp = client.post("/auth/register", json={
        "email": "newpatient@example.com", "password": "password123",
        "full_name": "New Patient", "role": "patient",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "patient"
    assert "access_token" in body


def test_register_duplicate_email_rejected(client):
    payload = {"email": "dup@example.com", "password": "password123", "full_name": "Dup", "role": "patient"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_admin_cannot_self_register(client):
    resp = client.post("/auth/register", json={
        "email": "fakeadmin@example.com", "password": "password123",
        "full_name": "Fake Admin", "role": "admin",
    })
    assert resp.status_code == 403


def test_login_success(client, patient_token):
    assert patient_token is not None


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "email": "loginuser@example.com", "password": "password123",
        "full_name": "Login User", "role": "patient",
    })
    resp = client.post("/auth/login", json={"email": "loginuser@example.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_with_token(client, patient_token):
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "patient"


def test_patient_can_fetch_own_profile_with_no_appointments(client, patient_token):
    """Regression test: a brand-new patient with zero appointments must
    still be able to load their own profile via /patients/me."""
    resp = client.get("/patients/me", headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "patient@example.com"


def test_doctor_can_fetch_own_profile(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post("/admin/departments", json={"name": "Neurology"}, headers=headers)
    doc_resp = client.post("/admin/doctors", json={
        "email": "selfcheck@example.com", "password": "docpass123", "full_name": "Dr. Self",
        "specialization": "Neurologist", "license_number": "LIC-SELF-1",
    }, headers=headers)
    assert doc_resp.status_code == 201

    login = client.post("/auth/login", json={"email": "selfcheck@example.com", "password": "docpass123"})
    doctor_token = login.json()["access_token"]

    resp = client.get("/doctors/me", headers={"Authorization": f"Bearer {doctor_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "selfcheck@example.com"


def test_change_password_flow(client, patient_token):
    h = {"Authorization": f"Bearer {patient_token}"}
    bad = client.post("/auth/change-password", json={"current_password": "wrong-pass", "new_password": "newpassword1"}, headers=h)
    assert bad.status_code == 400
    same = client.post("/auth/change-password", json={"current_password": "password123", "new_password": "password123"}, headers=h)
    assert same.status_code == 400
    ok = client.post("/auth/change-password", json={"current_password": "password123", "new_password": "newpassword1"}, headers=h)
    assert ok.status_code == 204
    assert client.post("/auth/login", json={"email": "patient@example.com", "password": "password123"}).status_code == 401
    assert client.post("/auth/login", json={"email": "patient@example.com", "password": "newpassword1"}).status_code == 200


def test_legacy_local_email_does_not_break_responses(client, db_session_direct):
    """Regression: a stored .local email must not 500 an endpoint."""
    from app.core.security import hash_password
    from app.models.models import User, UserRole
    db_session_direct.add(User(email="old.admin@caresync.local", hashed_password=hash_password("adminpass123"),
                               full_name="Legacy Admin", role=UserRole.admin))
    db_session_direct.commit()
    token = client.post("/auth/login", json={"email": "old.admin@caresync.local", "password": "adminpass123"}).json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "old.admin@caresync.local"
