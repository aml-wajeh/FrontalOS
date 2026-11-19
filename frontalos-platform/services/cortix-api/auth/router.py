"""
Real auth router. Fixes docs/AUDIT.md §1 point by point:
  - /register now creates an actual User row (hashed password via bcrypt,
    duplicate-email check, real Role/UserRole link) instead of returning a
    canned success message for any payload.
  - /login now verifies the password hash against the stored User row and
    returns 401 for bad credentials, instead of accepting any email/password.
  - The JWT secret comes from core.config.settings (env-backed), not a
    hardcoded string literal.
  - /me decodes the caller's real token and returns their real User row,
    instead of a hardcoded "Dr. Sarah Jenkins" for every caller.
  - /refresh validates the refresh token is actually a refresh-typed token
    for a user that still exists.
"""
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from core.audit import record_audit_event
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database.models import PasswordResetToken, Role, User, UserRole
from database.session import get_db

logger = logging.getLogger("cortix_api.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])

VALID_ROLES = {"parent", "child", "doctor", "psychologist", "school", "admin"}

# "admin" is intentionally excluded from self-service registration — see
# docs/AUDIT.md §6.6. It stays a valid *role* (VALID_ROLES above, used by
# /login and the admin portal's role-assignment endpoint) so existing and
# future admin accounts keep working; it just can't be picked at /register.
SELF_REGISTERABLE_ROLES = VALID_ROLES - {"admin", "child"}

RESET_TOKEN_TTL_MINUTES = 30


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    roles: list[str]


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if req.role not in SELF_REGISTERABLE_ROLES:
        raise HTTPException(
            status_code=400, detail=f"role must be one of {sorted(SELF_REGISTERABLE_ROLES)}"
        )

    existing = db.query(User).filter(User.email == req.email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # get user.id before committing

    role = db.query(Role).filter(Role.name == req.role).first()
    if role is None:
        role = Role(name=req.role, description=f"Auto-created role: {req.role}")
        db.add(role)
        db.flush()

    db.add(UserRole(user_id=user.id, role_id=role.id))
    db.commit()
    db.refresh(user)

    record_audit_event(
        db,
        "user.register",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        details=f"role={req.role}",
    )

    return {
        "status": "success",
        "message": "User registered successfully.",
        "user_id": user.id,
        "email": user.email,
        "role": req.role,
    }


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user = db.query(User).filter(User.email == req.email).first()
    if user is None or not verify_password(req.password, user.hashed_password):
        # Logged with no user_id (we don't want to leak whether the email
        # exists via the audit trail either) — action + ip is enough to spot
        # a brute-force pattern.
        record_audit_event(db, "auth.login_failed", ip_address=ip, details=f"email={req.email}")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        record_audit_event(db, "auth.login_blocked_inactive", user_id=user.id, ip_address=ip)
        raise HTTPException(status_code=403, detail="Account is inactive")

    record_audit_event(db, "auth.login_success", user_id=user.id, ip_address=ip)

    return {
        "access_token": create_access_token(user.email),
        "refresh_token": create_refresh_token(user.email),
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return {
        "access_token": create_access_token(user.email),
        "refresh_token": create_refresh_token(user.email),
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWTs: real revocation would check RefreshToken.is_revoked
    # against a stored row. Table exists (database/models/auth.py) but
    # tracking issued refresh tokens there is left for a follow-up pass;
    # this endpoint at least requires a genuinely valid token to call.
    return {"status": "success", "message": f"{current_user.email} logged out."}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = [ur.role.name for ur in current_user.roles]
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        roles=roles,
    )


# ---------------------------------------------------------------------------
# Password reset — closes docs/AUDIT.md §6.4. `PasswordResetToken` has been
# modeled in database/models/auth.py since the original schema pass, but no
# endpoint ever used it; apps/web's forgot-password/reset-password proxy
# routes were honest stubs (generic-200 / 501) pointing at this exact gap.
# ---------------------------------------------------------------------------


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Always returns the same generic response whether or not the email is
    registered — never let this endpoint's response shape reveal account
    existence (this is a security requirement, not an oversight: an
    attacker enumerating registered emails via response differences is a
    real, well-known attack against forgot-password endpoints).

    Email delivery itself is out of scope for this pass (no SMTP/mail
    provider is configured anywhere in this repo yet) — the generated
    reset link is logged server-side via `logger.info` instead, which is
    enough to keep the demo/dev flow fully functional end-to-end. Swapping
    the `logger.info` call below for a real mail send is a one-function
    follow-up, not a redesign.
    """
    user = db.query(User).filter(User.email == req.email).first()
    if user is not None:
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token=token,
                expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
            )
        )
        db.commit()
        # TODO(follow-up, not this pass): send this via a real mail
        # provider instead of logging it. Logging it is what makes the
        # dev/demo flow actually work end-to-end without one configured.
        logger.info("Password reset link for %s: /reset-password/%s", user.email, token)

    return {
        "status": "success",
        "message": "If an account exists for that email, a reset link has been sent.",
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_row = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == req.token, PasswordResetToken.is_used.is_(False))
        .first()
    )
    if reset_row is None or reset_row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user = db.query(User).filter(User.id == reset_row.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user.hashed_password = hash_password(req.new_password)
    reset_row.is_used = True
    db.commit()

    record_audit_event(db, "auth.password_reset", user_id=user.id)

    return {"status": "success", "message": "Password updated. You can now log in."}