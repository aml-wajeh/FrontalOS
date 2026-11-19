"""
POST /api/v1/checkins

Closes the gap flagged in patientClient.ts's header: the `CheckIn` table
(database/models/clinical.py) and the read-side analytics that consume it
(api/v1/analytics.py) already existed, but there was no write endpoint, so
daily/weekly check-ins from the Patient Portal had nowhere to land.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import CheckIn
from database.session import get_db

router = APIRouter(prefix="/checkins", tags=["Checkins"])


class CheckinPayload(BaseModel):
    patient_id: int
    checkin_type: str  # "daily" | "weekly"
    mood: str | None = None
    attention_score: float | None = None
    hyperactivity_score: float | None = None
    sleep_hours: float | None = None
    notes: str | None = None


@router.post("")
def post_checkin(payload: CheckinPayload, db: Session = Depends(get_db)):
    checkin = CheckIn(
        patient_id=payload.patient_id,
        checkin_type=payload.checkin_type,
        mood=payload.mood,
        attention_score=payload.attention_score,
        hyperactivity_score=payload.hyperactivity_score,
        sleep_hours=payload.sleep_hours,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return {
        "id": checkin.id,
        "patient_id": checkin.patient_id,
        "checkin_type": checkin.checkin_type,
        "created_at": checkin.created_at.isoformat(),
    }
