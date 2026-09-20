def test_no_show_prediction_requires_staff_role(client, patient_token):
    resp = client.post("/ai/no-show-prediction", json={
        "patient_age": 45, "previous_appointments": 10, "previous_no_shows": 3,
        "previous_cancellations": 1, "lead_time_days": 20, "day_of_week": 4, "appointment_hour": 9,
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 403


def test_no_show_prediction_for_admin(client, admin_token):
    resp = client.post("/ai/no-show-prediction", json={
        "patient_age": 45, "previous_appointments": 10, "previous_no_shows": 3,
        "previous_cancellations": 1, "lead_time_days": 20, "day_of_week": 4, "appointment_hour": 9,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert 0.0 <= body["no_show_probability"] <= 1.0
    assert body["risk_level"] in ("Low", "Medium", "High")


def test_categorization_follow_up(client, patient_token):
    resp = client.post("/ai/categorize", json={"reason": "Follow-up on last week's visit"},
                        headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 200
    assert resp.json()["category"] == "follow_up"


def test_admin_dashboard_requires_admin(client, patient_token):
    resp = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 403


def test_admin_dashboard_ok(client, admin_token):
    resp = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "total_patients" in body
    assert "total_doctors" in body
