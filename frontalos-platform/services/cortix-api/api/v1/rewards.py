"""
GET  /api/v1/rewards/wallet/{patient_id}
POST /api/v1/rewards/wallet/{patient_id}/spend

Server-side backing for the Reward Wallet card (see
apps/web/src/lib/rewards/rewardWallet.ts). Earning already happens in
api/v1/games.py, which writes a positive RewardTransaction row per
completed game/exercise session. This router adds the read side (balance
= SUM(amount) for a patient) and the spend side (redeeming a reward from
the Dopamine Menu), so the ledger in `reward_transactions` is the single
source of truth instead of a number sitting only in localStorage.

Balance is computed on read rather than cached in a mutable column, so it
can never drift from the transaction history.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import RewardTransaction
from database.session import get_db

router = APIRouter(prefix="/rewards", tags=["Rewards"])


def _balance_for(patient_id: int, db: Session) -> int:
    total = (
        db.query(func.coalesce(func.sum(RewardTransaction.amount), 0))
        .filter(RewardTransaction.patient_id == patient_id)
        .scalar()
    )
    return int(total or 0)


class WalletBalanceOut(BaseModel):
    patient_id: int
    balance: int


class SpendPayload(BaseModel):
    amount: int = Field(gt=0, description="Coin cost of the reward, always positive")
    reason: str = "dopamine_menu_redeem"
    reference_type: str | None = None
    reference_id: int | None = None


class SpendResponse(BaseModel):
    patient_id: int
    balance: int
    spent: int


@router.get("/wallet/{patient_id}", response_model=WalletBalanceOut)
def get_wallet_balance(patient_id: int, db: Session = Depends(get_db)):
    return WalletBalanceOut(patient_id=patient_id, balance=_balance_for(patient_id, db))


@router.post("/wallet/{patient_id}/spend", response_model=SpendResponse)
def spend_wallet_coins(patient_id: int, payload: SpendPayload, db: Session = Depends(get_db)):
    current_balance = _balance_for(patient_id, db)
    if payload.amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance: have {current_balance}, need {payload.amount}",
        )

    db.add(
        RewardTransaction(
            patient_id=patient_id,
            amount=-payload.amount,
            reason=payload.reason,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
        )
    )
    db.commit()

    new_balance = current_balance - payload.amount
    return SpendResponse(patient_id=patient_id, balance=new_balance, spent=payload.amount)
