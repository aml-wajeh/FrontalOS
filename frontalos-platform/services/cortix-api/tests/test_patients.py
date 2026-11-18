"""
Tests for api/v1/patients.py — GET /patients, /patients/me/children,
/patients/me/students.

Each endpoint is scoped to the calling user (doctor_id / guardian_id /
school_id == current_user.id). The main risk these guard against is a
roster leak: one doctor/parent/school seeing another's patients. There's
no endpoint to create a Patient row (by design — see patients.py header),
so these tests seed Patient rows directly via the db_session fixture,
matching how the app itself would have real rows land in that table.
"""
from database.models import Patient


def _make_patient(db_session, **kwargs):
    patient = Patient(name=kwargs.pop("name", "Test Patient"), age=kwargs.pop("age", 9), gender=kwargs.pop("gender", "female"), **kwargs)
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient


def test_doctor_sees_only_their_own_roster(client, db_session, register_and_login):
    doctor_id, _token, headers = register_and_login(
        client, email="doc1@example.com", password="correcthorse1", full_name="Dr. One", role="doctor"
    )
    other_doctor_id, _t2, _h2 = register_and_login(
        client, email="doc2@example.com", password="correcthorse1", full_name="Dr. Two", role="doctor"
    )

    _make_patient(db_session, name="Mine", age=8, doctor_id=doctor_id)
    _make_patient(db_session, name="NotMine", age=10, doctor_id=other_doctor_id)

    resp = client.get("/api/v1/patients", headers=headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert names == ["Mine"]


def test_doctor_roster_requires_auth(client):
    resp = client.get("/api/v1/patients")
    assert resp.status_code == 401


def test_doctor_roster_empty_when_no_patients_assigned(client, register_and_login):
    _doctor_id, _token, headers = register_and_login(
        client, email="doc3@example.com", password="correcthorse1", full_name="Dr. Three", role="doctor"
    )
    resp = client.get("/api/v1/patients", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_parent_sees_only_their_linked_children(client, db_session, register_and_login):
    parent_id, _token, headers = register_and_login(
        client, email="parent1@example.com", password="correcthorse1", full_name="Parent One", role="parent"
    )
    other_parent_id, _t2, _h2 = register_and_login(
        client, email="parent2@example.com", password="correcthorse1", full_name="Parent Two", role="parent"
    )

    _make_patient(db_session, name="MyKid", age=7, guardian_id=parent_id)
    _make_patient(db_session, name="OtherKid", age=6, guardian_id=other_parent_id)

    resp = client.get("/api/v1/patients/me/children", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["name"] == "MyKid"
    assert "gender" in body[0]


def test_school_sees_only_their_linked_students(client, db_session, register_and_login):
    school_id, _token, headers = register_and_login(
        client, email="school1@example.com", password="correcthorse1", full_name="School One", role="school"
    )
    other_school_id, _t2, _h2 = register_and_login(
        client, email="school2@example.com", password="correcthorse1", full_name="School Two", role="school"
    )

    _make_patient(db_session, name="MyStudent", age=11, school_id=school_id)
    _make_patient(db_session, name="OtherStudent", age=12, school_id=other_school_id)

    resp = client.get("/api/v1/patients/me/students", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["name"] == "MyStudent"
    # Status is honestly "unknown" rather than a fabricated on_track/needs_attention
    # value — see patients.py header for why.
    assert body[0]["status"] == "unknown"


def test_children_and_students_endpoints_require_auth(client):
    assert client.get("/api/v1/patients/me/children").status_code == 401
    assert client.get("/api/v1/patients/me/students").status_code == 401