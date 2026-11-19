"""
Patient-adjacent models: profile, appointments, messages, notifications,
game session records.

Moved from `backend/patients/models.py`. Only the `Base` import path was
changed (now points at the single canonical `database.base`); everything
else is unchanged from the original.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database.base import Base


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"))
    medical_history = Column(Text)
    family_history = Column(Text)
    behavior_assessment = Column(Text)
    sleep_history = Column(Text)
    medication_history = Column(Text)
    clinical_notes = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="profile")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    scheduled_time = Column(DateTime, nullable=False)
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GameSessionRecord(Base):
    __tablename__ = "game_sessions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"))
    game_name = Column(String, nullable=False)
    accuracy = Column(Float, nullable=False)
    reaction_time = Column(Float, nullable=False)
    mistakes = Column(Integer, default=0)
    breaks = Column(Integer, default=0)
    difficulty = Column(String, default="normal")
    session_duration = Column(Float, nullable=False)  # seconds
    created_at = Column(DateTime, default=datetime.utcnow)


class RewardTransaction(Base):
    """
    Added during the integration pass (see api/v1/rewards.py). The Patient
    Portal's Dopamine Menu previously only wrote coin balances to
    localStorage (lib/rewards/rewardWallet.ts) — nothing was persisted
    server-side, so a coin balance earned on one device/browser never
    followed the patient anywhere else. Each row is one earn or spend
    event; the wallet balance is the running SUM(amount) for a patient,
    computed on read rather than duplicated in a mutable balance column,
    so the ledger itself is always the source of truth.
    """
    __tablename__ = "reward_transactions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # positive = earn, negative = spend
    reason = Column(String, nullable=False)  # e.g. "game_session", "dopamine_menu_redeem"
    reference_type = Column(String, nullable=True)  # e.g. "game_session", "checkin"
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
