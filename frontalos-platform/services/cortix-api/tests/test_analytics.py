"""
Tests for api/v1/analytics.py — progress/forecast/radar endpoints.

Every assertion here checks the endpoint's math against CheckIn rows we
seed ourselves in the test, not against a live/opaque dataset — so each
test states the input and the exact expected output (or an explicit
tolerance for anything computed via numpy/scipy/sklearn).
"""
from datetime import datetime, timedelta

import pytest

from database.models import Patient, CheckIn


def _make_patient(db_session, **kwargs) -> Patient:
    patient = Patient(
        name=kwargs.pop("name", "Analytics Patient"),
        age=kwargs.pop("age", 9),
        gender=kwargs.pop("gender", "male"),
        **kwargs,
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient


def _seed_checkin(db_session, patient_id, *, days_ago, attention=None, hyperactivity=None, sleep=None):
    checkin = CheckIn(
        patient_id=patient_id,
        checkin_type="daily",
        attention_score=attention,
        hyperactivity_score=hyperactivity,
        sleep_hours=sleep,
        created_at=datetime.utcnow() - timedelta(days=days_ago),
    )
    db_session.add(checkin)
    db_session.commit()
    return checkin


# --- /analytics/progress ----------------------------------------------


def test_progress_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/progress/999999")
    assert resp.status_code == 404


def test_progress_no_checkins_returns_insufficient_data(client, db_session):
    patient = _make_patient(db_session)
    resp = client.get(f"/api/v1/analytics/progress/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["checkin_count"] == 0
    assert body["overall_status"] == "insufficient_data"
    assert body["attention_trend"] == []
    assert body["sleep_vs_attention"] is None


def test_progress_ignores_checkins_older_than_30_days(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=45, attention=50, sleep=7)
    resp = client.get(f"/api/v1/analytics/progress/{patient.id}")
    body = resp.json()
    assert body["checkin_count"] == 0
    assert body["overall_status"] == "insufficient_data"


def test_progress_trend_improving(client, db_session):
    patient = _make_patient(db_session)
    # Oldest first: score climbs from 60 -> 80, delta = 20 > 2 => Improving
    _seed_checkin(db_session, patient.id, days_ago=10, attention=60, sleep=7)
    _seed_checkin(db_session, patient.id, days_ago=5, attention=70, sleep=7.5)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=80, sleep=8)

    resp = client.get(f"/api/v1/analytics/progress/{patient.id}")
    body = resp.json()
    assert body["checkin_count"] == 3
    assert body["overall_status"] == "Improving"
    assert [pt["attention_score"] for pt in body["attention_trend"]] == [60, 70, 80]
    assert "Improving".lower() in body["ai_summary"].lower()


def test_progress_trend_declining(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=10, attention=80, sleep=8)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=60, sleep=6)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["overall_status"] == "Declining"


def test_progress_trend_stable_within_delta_of_2(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=10, attention=70, sleep=7)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=71.5, sleep=7)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["overall_status"] == "Stable"


def test_progress_sleep_correlation_needs_at_least_3_pairs(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=5, attention=60, sleep=6)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=70, sleep=8)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    assert body["sleep_vs_attention"]["correlation"] is None
    assert body["sleep_vs_attention"]["n"] == 2


def test_progress_sleep_correlation_perfect_positive(client, db_session):
    patient = _make_patient(db_session)
    # Perfectly linear: sleep and attention rise together => correlation ~= 1.0
    for i, (sleep, attn) in enumerate([(6, 50), (7, 60), (8, 70), (9, 80)]):
        _seed_checkin(db_session, patient.id, days_ago=4 - i, attention=attn, sleep=sleep)

    body = client.get(f"/api/v1/analytics/progress/{patient.id}").json()
    corr = body["sleep_vs_attention"]["correlation"]
    assert corr is not None
    assert corr == pytest.approx(1.0, abs=1e-6)
    assert body["sleep_vs_attention"]["n"] == 4


# --- /analytics/forecast -------------------------------------------------


def test_forecast_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/forecast/999999")
    assert resp.status_code == 404


def test_forecast_insufficient_data_below_3_points(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=60, sleep=7)
    _seed_checkin(db_session, patient.id, days_ago=2, attention=62, sleep=7)

    body = client.get(f"/api/v1/analytics/forecast/{patient.id}").json()
    assert body["status"] == "insufficient_data"
    assert body["predicted_next_day_focus_score"] is None


def test_forecast_predicts_continued_linear_trend(client, db_session):
    patient = _make_patient(db_session)
    # Perfectly linear +5/day trend with constant sleep: next value should
    # extrapolate to ~85 with a near-perfect in-sample fit (confidence ~100).
    for i, attn in enumerate([65, 70, 75, 80]):
        _seed_checkin(db_session, patient.id, days_ago=4 - i, attention=attn, sleep=8)

    resp = client.get(f"/api/v1/analytics/forecast/{patient.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["data_points_used"] == 4
    assert body["predicted_next_day_focus_score"] == pytest.approx(85.0, abs=0.5)
    assert body["confidence_pct"] > 95
    assert body["top_contributing_feature"] in ("recent trend", "sleep duration")


def test_forecast_clips_prediction_to_0_100(client, db_session):
    patient = _make_patient(db_session)
    # Steep downward trend that would extrapolate below 0 without clipping.
    for i, attn in enumerate([30, 15, 2]):
        _seed_checkin(db_session, patient.id, days_ago=2 - i, attention=attn, sleep=7)

    body = client.get(f"/api/v1/analytics/forecast/{patient.id}").json()
    assert body["status"] == "ok"
    assert 0.0 <= body["predicted_next_day_focus_score"] <= 100.0


def test_forecast_uses_only_last_14_days(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=20, attention=10, sleep=5)
    _seed_checkin(db_session, patient.id, days_ago=5, attention=60, sleep=7)
    _seed_checkin(db_session, patient.id, days_ago=3, attention=62, sleep=7)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=64, sleep=7)

    body = client.get(f"/api/v1/analytics/forecast/{patient.id}").json()
    assert body["data_points_used"] == 3


# --- /analytics/radar ------------------------------------------------------


def test_radar_unknown_patient_404s(client):
    resp = client.get("/api/v1/analytics/radar/999999")
    assert resp.status_code == 404


def test_radar_no_checkins_all_axes_null(client, db_session):
    patient = _make_patient(db_session)
    body = client.get(f"/api/v1/analytics/radar/{patient.id}").json()
    assert body["patient_scores"] == [None, None, None, None, None]
    assert body["checkin_count"] == 0
    assert len(body["axes"]) == 5
    assert len(body["age_norm_baseline"]) == 5


def test_radar_computes_focus_activity_sleep_averages(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=5, attention=60, hyperactivity=40, sleep=9)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=80, hyperactivity=60, sleep=9)

    body = client.get(f"/api/v1/analytics/radar/{patient.id}").json()
    focus, activity, sleep_quality, med_adherence, social = body["patient_scores"]

    assert focus == pytest.approx(70.0)
    assert activity == pytest.approx(50.0)
    # sleep_quality = clip((avg_sleep_hours / 9.0) * 100, 0, 100); avg sleep = 9 -> 100
    assert sleep_quality == pytest.approx(100.0)
    # Not tracked by the current schema — must stay null, never fabricated.
    assert med_adherence is None
    assert social is None
    assert body["checkin_count"] == 2


def test_radar_sleep_quality_clipped_at_100(client, db_session):
    patient = _make_patient(db_session)
    _seed_checkin(db_session, patient.id, days_ago=1, attention=50, hyperactivity=50, sleep=14)

    body = client.get(f"/api/v1/analytics/radar/{patient.id}").json()
    sleep_quality = body["patient_scores"][2]
    assert sleep_quality == pytest.approx(100.0)
