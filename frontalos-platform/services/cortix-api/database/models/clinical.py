"""
Clinical/patient data models.

Moved from `backend/database/models.py`. The duplicate `User` class that
used to live in this file was removed — the canonical `User` now lives in
`database/models/auth.py` (see the merge note there). Everything else in
this file is unchanged from the original.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from database.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    guardian_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    school_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    guardian = relationship("User", back_populates="patients", foreign_keys=[guardian_id])
    predictions = relationship("AIPrediction", back_populates="patient")
    timelines = relationship("TimelineEvent", back_populates="patient")
    goals = relationship("Goal", back_populates="patient")
    checkins = relationship("CheckIn", back_populates="patient")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    model_type = Column(String, nullable=False)  # tabular or mri
    prediction_result = Column(JSON, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="predictions")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    title = Column(String, nullable=False)
    description = Column(Text)
    event_type = Column(String, nullable=False)  # medical, behavior, school, milestone
    timestamp = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="timelines")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    title = Column(String, nullable=False)
    description = Column(Text)
    target_date = Column(String)
    status = Column(String, default="in_progress")  # in_progress, completed
    progress_percentage = Column(Float, default=0.0)

    patient = relationship("Patient", back_populates="goals")


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    checkin_type = Column(String, nullable=False)  # daily or weekly
    mood = Column(String)
    attention_score = Column(Float)
    hyperactivity_score = Column(Float)
    sleep_hours = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="checkins")
