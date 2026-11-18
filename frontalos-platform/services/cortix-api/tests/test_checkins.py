"""
Full-path tests: POST /api/v1/checkins -> GET /api/v1/analytics/{progress,
forecast,radar}/{patient_id}.

These verify actual computed numbers against seeded check-in data, not
just "200 OK with some JSON" — e.g. that the reported checkin_count
matches what was posted, that overall_status correctly reflects an
improving vs declining trend, and that the insufficient-data branches
return null/insufficient_data rather than a fabricated number (analytics.py
is explicit that it never invents a number for a field the schema can't
back).
"""
from database.models import Patient


def _make_patient(db_session, **kwargs):
    patient = Patient(name=kwargs.pop("name", "Analytics Patient"), age=kwargs.pop("age", 9), gender=kwargs.pop("gender", "male"), **kwargs)
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient


def _post_checkin(client, patient_id, attention_score=None, sleep_hours=None, hyperactivity_score=None):
    resp = client.post(
        "/api/v1/checkins",
        json={
            "patient_id": patient_id,
            "checkin_type": "daily",
            "mood": "okay",
            "attention_score": attention_score,
            "hyperactivity_score": hyperactivity_score,
            "sleep_hours": sleep_hours,
            "notes": None,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_checkin_is_persisted_and_returned(client, db_session):
    patient = _make_patient(db_session)
    body = _post_checkin(client, patient.id, attention_score=72.0, sleep_hours=8.0)
    assert body["patient_id"] == patient.id
    assert body["checkin_type"] == "daily"
    assert "id" in body and "created_at" in body


def test_progress_analytics_with_no_checkins_is_honest_about_it(client, db_session):
    patient = _make_patient(db_session)
    resp = client.get(f"/api/v1/analytics/progress/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["checkin_count"] == 0
    assert body["overall_status"] == "insufficient_data"
    assert body["attention_trend"] == []


def test_progress_analytics_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/progress/999999")
    assert resp.status_code == 404


def test_progress_analytics_reflects_improving_trend(client, db_session):
    patient = _make_patient(db_session)
    # Rising attention scores over time -> overall_status should be "Improving"
    # (analytics.py: delta > 2 -> Improving).
    for score in [50.0, 55.0, 60.0, 70.0]:
        _post_checkin(client, patient.id, attention_score=score, sleep_hours=7.5)

    resp = client.get(f"/api/v1/analytics/progress/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["checkin_count"] == 4
    assert body["overall_status"] == "Improving"
    assert len(body["attention_trend"]) == 4


def test_progress_analytics_reflects_declining_trend(client, db_session):
    patient = _make_patient(db_session)
    for score in [80.0, 70.0, 60.0, 50.0]:
        _post_checkin(client, patient.id, attention_score=score, sleep_hours=6.0)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["overall_status"] == "Declining"


def test_progress_analytics_stable_when_delta_is_small(client, db_session):
    patient = _make_patient(db_session)
    for score in [60.0, 61.0, 59.0, 60.5]:
        _post_checkin(client, patient.id, attention_score=score, sleep_hours=7.0)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["overall_status"] == "Stable"


def test_progress_analytics_sleep_correlation_needs_at_least_three_pairs(client, db_session):
    patient = _make_patient(db_session)
    _post_checkin(client, patient.id, attention_score=60.0, sleep_hours=7.0)
    _post_checkin(client, patient.id, attention_score=65.0, sleep_hours=7.5)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["sleep_vs_attention"]["correlation"] is None
    assert body["sleep_vs_attention"]["n"] == 2


def test_forecast_insufficient_data_below_three_checkins(client, db_session):
    patient = _make_patient(db_session)
    _post_checkin(client, patient.id, attention_score=60.0, sleep_hours=7.0)

    resp = client.get(f"/api/v1/analytics/forecast/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "insufficient_data"
    assert body["predicted_next_day_focus_score"] is None


def test_forecast_returns_a_bounded_prediction_with_enough_data(client, db_session):
    patient = _make_patient(db_session)
    for score in [50.0, 55.0, 60.0, 65.0, 70.0]:
        _post_checkin(client, patient.id, attention_score=score, sleep_hours=8.0)

    resp = client.get(f"/api/v1/analytics/forecast/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["predicted_next_day_focus_score"] is not None
    # analytics.py clips the prediction into [0, 100]
    assert 0 <= body["predicted_next_day_focus_score"] <= 100
    assert body["top_contributing_feature"] in ("recent trend", "sleep duration")


def test_forecast_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/forecast/999999")
    assert resp.status_code == 404


def test_radar_nulls_untracked_axes_instead_of_fabricating(client, db_session):
    patient = _make_patient(db_session)
    _post_checkin(client, patient.id, attention_score=70.0, sleep_hours=8.0, hyperactivity_score=30.0)

    resp = client.get(f"/api/v1/analytics/radar/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["axes"] == ["Focus", "Activity Level", "Sleep Quality", "Medication Adherence", "Social Engagement"]
    # Medication Adherence and Social Engagement have no backing schema field
    # -> must be null, not an invented number.
    assert body["patient_scores"][3] is None
    assert body["patient_scores"][4] is None
    assert body["patient_scores"][0] is not None  # Focus is derivable from attention_score
    assert len(body["age_norm_baseline"]) == 5


def test_radar_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/radar/999999")
    assert resp.status_code == 404