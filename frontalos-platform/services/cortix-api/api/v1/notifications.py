"""
GET /api/v1/notifications, POST /api/v1/notifications/{id}/read

Closes the gap flagged in notificationsClient.ts's header: the
`Notification` table (database/models/patients.py) already models
user_id/title/message/is_read/created_at, but nothing mounted a router for
it, so NotificationsBell always rendered empty even when the table had
rows. Scoped to the caller (`user_id == current_user.id`) so one user can
never read or mark another user's notifications.

Real-time delivery here is intentionally simple polling (React Query's
`refetchInterval` on the frontend hitting this GET) rather than a
websocket/pub-sub channel — that matches the integration task's explicit
"simple polling ... is acceptable" allowance, and keeps one fewer moving
part in a system that already has a dedicated websocket service
(frontalos-engine) for the thing that actually needs low-latency push.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.security import get_current_user
from database.models import Notification, User
from database.session import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def create_notification(db: Session, user_id: int, title: str, message: str) -> None:
    """Shared helper other routers call right after committing the event
    that should notify someone (e.g. api/v1/ai.py after a new
    AIPrediction). Does its own commit so a notification failure never
    rolls back the caller's already-committed write; callers should not
    wrap this in their own transaction."""
    if user_id is None:
        return
    db.add(Notification(user_id=user_id, title=title, message=message))
    db.commit()


@router.get("")
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "isRead": n.is_read,
            "createdAt": n.created_at.isoformat(),
        }
        for n in rows
    ]


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"status": "ok"}
