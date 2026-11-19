"""
POST /chat/query — role-aware templated response engine built on the
patient's real data, replacing the old endpoint that echoed the query back
inside a static string regardless of what was asked or who the patient was.

No external LLM API key is assumed to be available. A clearly marked
integration point is left below for dropping in a real LLM call later
without needing to refactor the request/response shape or the router
wiring.
"""
import re
from datetime import datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from database.models import AIPrediction, CheckIn, Patient
from database.session import get_db

router = APIRouter(prefix="/chat", tags=["Chat"])

VALID_ROLES = {"parent", "child", "doctor", "psychologist", "school", "admin"}


class ChatQueryRequest(BaseModel):
    role: str
    query: str
    patient_id: int


class ChatQueryResponse(BaseModel):
    role: str
    query: str
    response: str
    safe: bool
    data_grounded: bool


def _get_patient_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


def _recent_checkins(db: Session, patient_id: int, n_days: int = 30) -> list[CheckIn]:
    since = datetime.utcnow() - timedelta(days=n_days)
    return (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id, CheckIn.created_at >= since)
        .order_by(CheckIn.created_at.asc())
        .all()
    )


def _trend_phrase(scores: list[float]) -> str:
    if len(scores) < 2:
        return "there isn't enough recent data to describe a trend yet"
    delta_pct = ((scores[-1] - scores[0]) / max(abs(scores[0]), 1e-6)) * 100
    direction = "up" if delta_pct > 1 else ("down" if delta_pct < -1 else "roughly flat")
    return f"focus trended {direction} {abs(delta_pct):.0f}% over the last {len(scores)} check-ins"


# --- Intent handlers, cheapest match wins (checked in order) -----------------

def _handle_focus_trend(patient: Patient, checkins: list[CheckIn]) -> str:
    scores = [c.attention_score for c in checkins if c.attention_score is not None]
    return f"Based on {patient.name}'s last {len(checkins)} check-ins, {_trend_phrase(scores)}."


def _handle_sleep(patient: Patient, checkins: list[CheckIn]) -> str:
    sleep_vals = [c.sleep_hours for c in checkins if c.sleep_hours is not None]
    if not sleep_vals:
        return f"No sleep data has been logged for {patient.name} in the last 30 days."
    avg_sleep = float(np.mean(sleep_vals))
    return (
        f"{patient.name} has averaged {avg_sleep:.1f} hours of sleep per night over the "
        f"last {len(sleep_vals)} logged nights."
    )


def _handle_predictions(patient: Patient, db: Session) -> str:
    latest = (
        db.query(AIPrediction)
        .filter(AIPrediction.patient_id == patient.id)
        .order_by(AIPrediction.created_at.desc())
        .first()
    )
    if latest is None:
        return f"No AI predictions have been generated for {patient.name} yet."
    result = latest.prediction_result or {}
    mode = result.get("inference_mode", "unknown")
    mode_note = " (DEMO mode — placeholder, not a real model output)" if mode == "demo" else ""
    if latest.model_type == "tabular":
        detail = f"risk level {result.get('risk_level', 'unknown')}"
    else:
        detail = f"ADHD probability {result.get('adhd_probability_pct', 'unknown')}%"
    return (
        f"The most recent AI prediction for {patient.name} ({latest.model_type}, "
        f"{latest.created_at.strftime('%Y-%m-%d')}) showed {detail}, "
        f"confidence {latest.confidence:.2f}{mode_note}."
    )


def _handle_general(patient: Patient, checkins: list[CheckIn]) -> str:
    if not checkins:
        return f"There's no recent check-in data for {patient.name} yet — encourage a daily check-in to start building a picture."
    return (
        f"{patient.name} has {len(checkins)} check-ins logged in the last 30 days. "
        f"Ask about focus trend, sleep, or the latest AI prediction for more detail."
    )


def _build_response(role: str, query: str, patient: Patient, db: Session) -> tuple[str, bool]:
    """Returns (response_text, data_grounded)."""
    q = query.lower()
    checkins = _recent_checkins(db, patient.id)

    if re.search(r"\bfocus|attention|concentrat", q):
        return _handle_focus_trend(patient, checkins), True
    if re.search(r"\bsleep\b", q):
        return _handle_sleep(patient, checkins), True
    if re.search(r"\bpredict|risk|probability|diagnos", q):
        return _handle_predictions(patient, db), True

    # TODO: swap with real LLM call, e.g. Anthropic/OpenAI API using
    # CHAT_LLM_API_KEY from .env, for open-ended questions this templated
    # engine can't confidently answer from structured data alone. Keep the
    # role/query/patient context above as the prompt input so this becomes
    # a drop-in replacement for _handle_general without touching the router.
    if settings.CHAT_LLM_API_KEY:
        pass  # intentionally not implemented — no LLM call is made today

    return _handle_general(patient, checkins), False


@router.post("/query", response_model=ChatQueryResponse)
def chat_query(req: ChatQueryRequest, db: Session = Depends(get_db)):
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    patient = _get_patient_or_404(db, req.patient_id)
    response_text, grounded = _build_response(req.role, req.query, patient, db)

    prefix = "(Note: AI does not provide a direct medical diagnosis.) " if req.role in ("parent", "child") else ""

    return ChatQueryResponse(
        role=req.role,
        query=req.query,
        response=prefix + response_text,
        safe=True,
        data_grounded=grounded,
    )
