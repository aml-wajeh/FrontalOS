"""
Analytics endpoints, replacing the hardcoded response in the original
GET /api/v1/analytics/progress/{patient_id} (which always returned the same
[65, 68, 70, 75, 78] trend and 0.82 correlation regardless of patient or
data). Every number below is computed from real CheckIn rows.

Where the current schema (database/models/clinical.py::CheckIn) doesn't
track something the old mock implied (e.g. a home-vs-school split, or
medication adherence / social engagement scores), this module returns
`null` for that field with a short note instead of inventing a plausible
number — same honesty standard as the AI layer's live/demo split.
"""
from datetime import datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from scipy import stats
from sqlalchemy.orm import Session

from database.models import CheckIn, Patient
from database.session import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _get_patient_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


def _recent_checkins(db: Session, patient_id: int, days: int) -> list[CheckIn]:
    since = datetime.utcnow() - timedelta(days=days)
    return (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id, CheckIn.created_at >= since)
        .order_by(CheckIn.created_at.asc())
        .all()
    )


@router.get("/progress/{patient_id}")
def get_progress_analytics(patient_id: int, db: Session = Depends(get_db)):
    _get_patient_or_404(db, patient_id)
    checkins = _recent_checkins(db, patient_id, days=30)

    if not checkins:
        return {
            "patient_id": patient_id,
            "window_days": 30,
            "checkin_count": 0,
            "overall_status": "insufficient_data",
            "attention_trend": [],
            "sleep_vs_attention": None,
            "ai_summary": "No check-ins recorded in the last 30 days — nothing to analyze yet.",
        }

    attention_trend = [
        {"date": c.created_at.date().isoformat(), "attention_score": c.attention_score}
        for c in checkins
        if c.attention_score is not None
    ]

    sleep_vs_attention = None
    pairs = [(c.sleep_hours, c.attention_score) for c in checkins if c.sleep_hours is not None and c.attention_score is not None]
    if len(pairs) >= 3:
        sleep_vals, attn_vals = zip(*pairs, strict=True)
        if np.std(sleep_vals) > 0 and np.std(attn_vals) > 0:
            corr, p_value = stats.pearsonr(sleep_vals, attn_vals)
            sleep_vs_attention = {
                "correlation": round(float(corr), 3),
                "p_value": round(float(p_value), 4),
                "n": len(pairs),
            }
        else:
            sleep_vs_attention = {"correlation": None, "note": "No variance in one of the series", "n": len(pairs)}
    else:
        sleep_vs_attention = {"correlation": None, "note": "Fewer than 3 paired data points", "n": len(pairs)}

    scores = [c.attention_score for c in checkins if c.attention_score is not None]
    overall_status = "insufficient_data"
    if len(scores) >= 2:
        delta = scores[-1] - scores[0]
        overall_status = "Improving" if delta > 2 else ("Declining" if delta < -2 else "Stable")

    ai_summary = (
        f"{len(checkins)} check-ins recorded over the last 30 days. "
        f"Attention trend is {overall_status.lower()}"
        + (f" ({scores[0]:.0f} -> {scores[-1]:.0f})." if len(scores) >= 2 else ".")
    )

    return {
        "patient_id": patient_id,
        "window_days": 30,
        "checkin_count": len(checkins),
        "overall_status": overall_status,
        "attention_trend": attention_trend,
        "home_vs_school": None,  # not tracked by CheckIn schema (no source field) — see note above
        "sleep_vs_attention": sleep_vs_attention,
        "ai_summary": ai_summary,
    }


@router.get("/forecast/{patient_id}")
def get_forecast(patient_id: int, db: Session = Depends(get_db)):
    """Simple, transparent forecast: linear regression of attention_score
    on (day index, sleep_hours) over the last 5-7 check-ins, predicting the
    next day's focus score. Not a deep model — deliberately auditable."""
    _get_patient_or_404(db, patient_id)
    checkins = _recent_checkins(db, patient_id, days=14)
    usable = [c for c in checkins if c.attention_score is not None][-7:]

    if len(usable) < 3:
        return {
            "patient_id": patient_id,
            "status": "insufficient_data",
            "message": f"Need at least 3 recent check-ins with attention scores, found {len(usable)}.",
            "predicted_next_day_focus_score": None,
            "confidence_pct": None,
            "top_contributing_feature": None,
        }

    from sklearn.linear_model import LinearRegression

    day_idx = np.arange(len(usable)).reshape(-1, 1).astype(float)
    sleep = np.array([c.sleep_hours if c.sleep_hours is not None else np.nan for c in usable])
    sleep_mean = np.nanmean(sleep) if np.any(~np.isnan(sleep)) else 7.0
    sleep = np.nan_to_num(sleep, nan=sleep_mean)
    y = np.array([c.attention_score for c in usable], dtype=float)

    X = np.column_stack([day_idx.ravel(), sleep])
    model = LinearRegression().fit(X, y)

    next_day_idx = float(len(usable))
    next_sleep = float(sleep[-1])  # assume similar sleep to the most recent night
    prediction = float(model.predict([[next_day_idx, next_sleep]])[0])
    prediction = float(np.clip(prediction, 0, 100))

    # R^2 on the training window as a (rough, honestly-labeled) confidence proxy
    r2 = float(model.score(X, y))
    confidence_pct = round(max(0.0, min(1.0, r2)) * 100, 1)

    coefs = {"day_trend": abs(model.coef_[0]), "sleep_hours": abs(model.coef_[1])}
    top_feature = max(coefs, key=coefs.get)
    top_feature_label = "recent trend" if top_feature == "day_trend" else "sleep duration"

    return {
        "patient_id": patient_id,
        "status": "ok",
        "method": "linear_regression(day_index, sleep_hours -> attention_score)",
        "data_points_used": len(usable),
        "predicted_next_day_focus_score": round(prediction, 1),
        "confidence_pct": confidence_pct,
        "confidence_note": "Confidence is the model's in-sample R^2 on the recent window, not a calibrated probability.",
        "top_contributing_feature": top_feature_label,
    }


@router.get("/radar/{patient_id}")
def get_radar(patient_id: int, db: Session = Depends(get_db)):
    """Normalized 0-100 scores across 5 axes plus an age-norm baseline of
    the same shape. Axes not derivable from the current schema (Medication
    Adherence, Social Engagement) are returned as null rather than faked —
    both would need dedicated tracking tables that don't exist yet."""
    _get_patient_or_404(db, patient_id)
    checkins = _recent_checkins(db, patient_id, days=30)

    axes = ["Focus", "Activity Level", "Sleep Quality", "Medication Adherence", "Social Engagement"]

    def _avg(vals: list[float | None]) -> float | None:
        vals = [v for v in vals if v is not None]
        return float(np.mean(vals)) if vals else None

    focus = _avg([c.attention_score for c in checkins])
    activity = _avg([c.hyperactivity_score for c in checkins])
    # Sleep Quality proxy: hours normalized against an 8-10hr pediatric target band
    sleep_hours_avg = _avg([c.sleep_hours for c in checkins])
    sleep_quality = None
    if sleep_hours_avg is not None:
        sleep_quality = float(np.clip((sleep_hours_avg / 9.0) * 100, 0, 100))

    patient_scores = [
        round(focus, 1) if focus is not None else None,
        round(activity, 1) if activity is not None else None,
        round(sleep_quality, 1) if sleep_quality is not None else None,
        None,  # Medication Adherence — not tracked by current schema
        None,  # Social Engagement — not tracked by current schema
    ]

    # Age-norm baseline: a documented reference band, not per-patient data.
    # These are illustrative population-average targets, not a clinical
    # dataset — replace with real normative data before any clinical use.
    age_norm_baseline = [70.0, 55.0, 75.0, 90.0, 65.0]

    return {
        "patient_id": patient_id,
        "axes": axes,
        "patient_scores": patient_scores,
        "age_norm_baseline": age_norm_baseline,
        "untracked_axes_note": (
            "Medication Adherence and Social Engagement are null because "
            "the current CheckIn schema has no fields for them yet."
        ),
        "checkin_count": len(checkins),
    }
