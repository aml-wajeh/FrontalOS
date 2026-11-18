"""
Identity & auth models.

MERGE NOTE (confirmed duplicate resolution — see CURRENT_STATE.md section 4):
Mindora previously had two separate `User` classes:

  1. `backend/auth/models.py::User` — used a many-to-many `roles` relationship
     via a `UserRole` join table, and had `refresh_tokens` / `audit_logs`
     relationships. Did NOT have a `patients` (guardian) relationship.
  2. `backend/database/models.py::User` — used a flat `role: String` column,
     and DID have a `patients` relationship (as `guardian`).

Both defined the same table name (`users`), which is the exact collision
your review flagged. This file keeps definition (1) — the role-table design
is strictly more capable than a flat string column and is what the
`Role`/`UserRole`/RBAC tables in this same file already depend on — and adds
back the `patients` relationship from definition (2) so that
`database/models/clinical.py::Patient.guardian` (existing, working code)
continues to resolve correctly. The flat `role` string column from
definition (2) was dropped as redundant now that `Role`/`UserRole` exist.

No new columns, tables, or behavior were invented beyond this reconciliation.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from database.base import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # parent, child, doctor, psychologist, school, admin
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("UserRole", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    roles = relationship("UserRole", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

    # Restored from the other duplicate User definition so that
    # Patient.guardian (database/models/clinical.py) keeps working.
    patients = relationship(
        "Patient", back_populates="guardian", foreign_keys="Patient.guardian_id"
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"))

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    ip_address = Column(String)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
