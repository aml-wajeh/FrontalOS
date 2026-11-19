"""
Real password hashing + JWT issuance/verification, replacing the mocked
auth documented in docs/AUDIT.md §1. No credential check is skipped and no
secret is hardcoded — JWT_SECRET_KEY comes from core.config.settings, which
reads it from the environment.
"""
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.config import settings
from database.models import User
from database.session import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    to_encode = {"sub": subject, "type": "access"}
    if extra_claims:
        to_encode.update(extra_claims)
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    to_encode = {
        "sub": subject,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decodes the caller's real bearer token and loads the matching User
    row from the database. Replaces the old GET /auth/me, which returned a
    hardcoded fake user regardless of who was asking (AUDIT.md §1)."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


def require_role(required_role: str):
    """
    Dependency factory for role-gated endpoints — added alongside the admin
    router (docs/AUDIT.md §6.5). Nothing in the original auth layer checked
    a caller's role server-side; every existing router (patients.py, etc.)
    only scopes data by ownership (doctor_id == current_user.id), not by
    role. Admin endpoints are the first ones that actually need "is this
    caller allowed to call this at all", so this is intentionally new
    rather than reusing an existing (nonexistent) check.

    Usage: `current_user: User = Depends(require_role("admin"))`.
    """

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        role_names = {ur.role.name for ur in current_user.roles}
        if required_role not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{required_role}' role",
            )
        return current_user

    return _dependency


def get_current_user_optional(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but returns None instead of raising when no
    token is supplied. Used by endpoints that personalize output when
    authenticated but still work for anonymous/demo calls (e.g. AI endpoints
    used by role-based test flows before frontend auth is fully wired)."""
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None