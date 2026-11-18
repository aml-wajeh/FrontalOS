# services/cortix-api/core/audit.py
"""
Thin write-helper for the `AuditLog` table (database/models/auth.py).

BUG FIX (staff audit follow-up): `auth/router.py` and `api/v1/admin.py`
both did `from core.audit import record_audit_event` already, but this
module never actually existed anywhere in the tree — so importing either
of those files raised `ModuleNotFoundError` at process startup and the API
could not boot at all. This file is the missing piece, not a redesign:
it's written to match exactly how both call sites already invoke it.

Deliberately a single small function rather than a class/service: every
call site already has its own `Session` (from `Depends(get_db)`), so this
just centralizes "build an AuditLog row correctly" instead of repeating
the same four-line insert in auth/router.py, api/v1/admin.py, and any
future router that needs to record an action.

This never raises past a failed audit write — logging an action failing
must not turn an otherwise-successful request (login, role change, etc.)
into a 500. The caller's `db.commit()` for the audit row happens inline
here so callers don't need a second commit, but if that commit fails for
any reason (e.g. a mid-transaction issue) it's caught and logged instead
of propagating.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database.models import AuditLog

logger = logging.getLogger("cortix_api.audit")


def record_audit_event(
    db: Session,
    action: str,
    *,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[str] = None,
) -> None:
    """Writes one AuditLog row. See module docstring for why this exists
    and why it never raises back into the caller's request handler."""
    try:
        db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                ip_address=ip_address,
                details=details,
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 — an audit-write failure must never fail the caller's request
        db.rollback()
        logger.exception("Failed to record audit event action=%s user_id=%s", action, user_id)
