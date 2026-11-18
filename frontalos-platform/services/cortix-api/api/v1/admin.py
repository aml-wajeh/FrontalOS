"""
api/v1/admin.py

Closes docs/AUDIT.md §6.5: "admin" existed as a registerable role with no
portal and no endpoints behind it. Every route here is gated by
`require_role("admin")` (core/security.py) — the first place in this
codebase that actually checks a caller's role rather than just their
identity/ownership (see that dependency's docstring).

Scope is deliberately MVP, matching what the staff audit recommended as
the minimum before a real admin console is useful:
  1. Users: list, deactivate/reactivate, change role.
  2. Audit log: read the AuditLog rows that auth/router.py and this file
     now actually write (previously modeled, never populated).
  3. System health: aggregate this API's own /health with
     services/frontalos-engine's /health into one response, so an admin
     doesn't need to know both service URLs to check platform status.
"""
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.audit import record_audit_event
from core.config import settings
from core.security import require_role
from database.session import get_db
from database.models import AuditLog, Role, User, UserRole

logger = logging.getLogger("cortix_api.admin")

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_ASSIGNABLE_ROLES = {"parent", "child", "doctor", "psychologist", "school", "admin"}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    roles: list[str]
    created_at: datetime


class UpdateUserRoleRequest(BaseModel):
    role: str


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_role("admin"))):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        AdminUserOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_verified=u.is_verified,
            roles=[ur.role.name for ur in u.roles],
            created_at=u.created_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    record_audit_event(
        db, "admin.user_deactivated", user_id=admin.id, details=f"target_user_id={user_id}"
    )
    return {"status": "success", "user_id": user_id, "is_active": False}


@router.patch("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    record_audit_event(
        db, "admin.user_reactivated", user_id=admin.id, details=f"target_user_id={user_id}"
    )
    return {"status": "success", "user_id": user_id, "is_active": True}


@router.put("/users/{user_id}/role")
def set_user_role(
    user_id: int,
    req: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Replaces the user's role set with a single role (this platform's
    UI only ever assigns one role per user at registration time — see
    auth/router.py's register() — so admin role changes follow the same
    single-role convention rather than introducing multi-role editing the
    rest of the app doesn't support yet)."""
    if req.role not in ADMIN_ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(ADMIN_ASSIGNABLE_ROLES)}")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.name == req.role).first()
    if role is None:
        role = Role(name=req.role, description=f"Auto-created role: {req.role}")
        db.add(role)
        db.flush()

    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role_id=role.id))
    db.commit()

    record_audit_event(
        db,
        "admin.user_role_changed",
        user_id=admin.id,
        details=f"target_user_id={user_id} new_role={req.role}",
    )
    return {"status": "success", "user_id": user_id, "role": req.role}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None
    user_email: str | None
    action: str
    ip_address: str | None
    details: str | None
    created_at: datetime


@router.get("/audit-log", response_model=list[AuditLogOut])
def list_audit_log(
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    limit = max(1, min(limit, 500))
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        AuditLogOut(
            id=r.id,
            user_id=r.user_id,
            user_email=r.user.email if r.user else None,
            action=r.action,
            ip_address=r.ip_address,
            details=r.details,
            created_at=r.created_at,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# System health — aggregates cortix-api's own /health with
# frontalos-engine's /health so an admin checks one screen instead of two
# service URLs. Best-effort: a service being unreachable is reported as a
# down/unreachable entry, not a 500 for the whole admin dashboard.
# ---------------------------------------------------------------------------


class ServiceHealthOut(BaseModel):
    name: str
    reachable: bool
    detail: dict | None = None
    error: str | None = None


@router.get("/system-health", response_model=list[ServiceHealthOut])
def system_health(_admin: User = Depends(require_role("admin"))):
    results: list[ServiceHealthOut] = []

    # cortix-api's own health — call the logic directly rather than
    # round-tripping an HTTP request to itself.
    try:
        from core.ai.tabular_service import tabular_service
        from core.ai.imaging_service import imaging_service
        from database.session import USING_SQLITE_FALLBACK

        results.append(
            ServiceHealthOut(
                name="cortix-api",
                reachable=True,
                detail={
                    "database": "sqlite-fallback" if USING_SQLITE_FALLBACK else "configured",
                    "ai_models": {"tabular": tabular_service.mode, "imaging": imaging_service.mode},
                    "ai_model_load_errors": {
                        "tabular": tabular_service.load_error,
                        "imaging": imaging_service.load_error,
                    },
                    "jwt_secret_is_default": settings.JWT_SECRET_KEY_IS_DEFAULT,
                },
            )
        )
    except Exception as e:  # noqa: BLE001 — this endpoint must never itself 500
        results.append(ServiceHealthOut(name="cortix-api", reachable=False, error=str(e)))

    engine_url = settings.FRONTALOS_ENGINE_HEALTH_URL
    try:
        resp = httpx.get(engine_url, timeout=3.0)
        resp.raise_for_status()
        results.append(ServiceHealthOut(name="frontalos-engine", reachable=True, detail=resp.json()))
    except Exception as e:  # noqa: BLE001 — network errors, timeouts, non-2xx, etc.
        results.append(ServiceHealthOut(name="frontalos-engine", reachable=False, error=str(e)))

    return results