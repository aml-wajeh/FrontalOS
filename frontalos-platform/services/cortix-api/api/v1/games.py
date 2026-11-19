"""
POST /api/v1/games/metrics

Closes the gap in patientClient.ts's header: the Patient Portal's exercise
games already post a session summary to this exact path/shape, but nothing
in cortix-api persisted it — the request 404'd. This now writes a real
GameSessionRecord row and, per the integration task's "Dopamine Menu
trigger -> coin award persisted via CORTIX API -> Reward Wallet updates"
requirement, also writes a coin-earning RewardTransaction so the wallet
balance in api/v1/rewards.py reflects real completed sessions rather than
only the client-side optimistic add.

Coin formula: kept intentionally simple and transparent (10 coins per
completed session + up to 10 bonus for accuracy) rather than a black-box
score, since this directly affects a reward economy children see.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.models import GameSessionRecord, RewardTransaction
from database.session import get_db

router = APIRouter(prefix="/games", tags=["Games"])


class GameMetricsPayload(BaseModel):
    patient_id: int
    game_name: str
    accuracy: float = Field(ge=0, le=1)
    reaction_time: float
    mistakes: int = 0
    breaks: int = 0
    difficulty: str
    session_duration: float


def _coins_for_session(payload: GameMetricsPayload) -> int:
    base = 10
    accuracy_bonus = round(payload.accuracy * 10)
    return base + accuracy_bonus


@router.post("/metrics")
def post_game_metrics(payload: GameMetricsPayload, db: Session = Depends(get_db)):
    record = GameSessionRecord(
        patient_id=payload.patient_id,
        game_name=payload.game_name,
        accuracy=payload.accuracy,
        reaction_time=payload.reaction_time,
        mistakes=payload.mistakes,
        breaks=payload.breaks,
        difficulty=payload.difficulty,
        session_duration=payload.session_duration,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    coins = _coins_for_session(payload)
    db.add(
        RewardTransaction(
            patient_id=payload.patient_id,
            amount=coins,
            reason="game_session",
            reference_type="game_session",
            reference_id=record.id,
        )
    )
    db.commit()

    return {
        "status": "ok",
        "message": f"Session recorded, {coins} coins awarded",
        "data": payload.model_dump(),
        "coins_awarded": coins,
    }
