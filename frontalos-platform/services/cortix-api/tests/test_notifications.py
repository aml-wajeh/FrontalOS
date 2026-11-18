"""
Tests for api/v1/notifications.py.

The frontend's notificationsClient.ts header used to describe this route
as unmounted (a documented 404-is-empty-inbox gap). It's actually mounted
in main.py and backed by a real Notification table — these tests exercise
that real router, plus the cross-user isolation that matters most for a
shared notifications table (one user must never see or mark-read another
user's rows).
"""
from database.models import Notification


def test_notifications_requires_auth(client):
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 401


def test_empty_inbox_for_new_user(client, register_and_login):
    _uid, _t, headers = register_and_login(
        client, email="inbox1@example.com", password="correcthorse1", full_name="Inbox One", role="parent"
    )
    resp = client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_lists_only_the_calling_users_notifications(client, db_session, register_and_login):
    user_a_id, _t, headers_a = register_and_login(
        client, email="notifa@example.com", password="correcthorse1", full_name="A", role="parent"
    )
    user_b_id, _t2, headers_b = register_and_login(
        client, email="notifb@example.com", password="correcthorse1", full_name="B", role="parent"
    )

    db_session.add_all(
        [
            Notification(user_id=user_a_id, title="For A", message="hello A"),
            Notification(user_id=user_b_id, title="For B", message="hello B"),
        ]
    )
    db_session.commit()

    resp_a = client.get("/api/v1/notifications", headers=headers_a)
    titles_a = [n["title"] for n in resp_a.json()]
    assert titles_a == ["For A"]

    resp_b = client.get("/api/v1/notifications", headers=headers_b)
    titles_b = [n["title"] for n in resp_b.json()]
    assert titles_b == ["For B"]


def test_notifications_ordered_newest_first(client, db_session, register_and_login):
    user_id, _t, headers = register_and_login(
        client, email="notifc@example.com", password="correcthorse1", full_name="C", role="parent"
    )
    from datetime import datetime, timedelta

    older = Notification(
        user_id=user_id, title="Older", message="first", created_at=datetime.utcnow() - timedelta(hours=2)
    )
    newer = Notification(user_id=user_id, title="Newer", message="second", created_at=datetime.utcnow())
    db_session.add_all([older, newer])
    db_session.commit()

    resp = client.get("/api/v1/notifications", headers=headers)
    titles = [n["title"] for n in resp.json()]
    assert titles == ["Newer", "Older"]


def test_mark_read_updates_is_read(client, db_session, register_and_login):
    user_id, _t, headers = register_and_login(
        client, email="notifd@example.com", password="correcthorse1", full_name="D", role="parent"
    )
    notif = Notification(user_id=user_id, title="Mark me", message="please")
    db_session.add(notif)
    db_session.commit()
    db_session.refresh(notif)
    assert notif.is_read is False or notif.is_read is None

    resp = client.post(f"/api/v1/notifications/{notif.id}/read", headers=headers)
    assert resp.status_code == 200

    listed = client.get("/api/v1/notifications", headers=headers).json()
    assert listed[0]["isRead"] is True


def test_cannot_mark_read_another_users_notification(client, db_session, register_and_login):
    user_a_id, _t, headers_a = register_and_login(
        client, email="notife@example.com", password="correcthorse1", full_name="E", role="parent"
    )
    user_b_id, _t2, headers_b = register_and_login(
        client, email="notiff@example.com", password="correcthorse1", full_name="F", role="parent"
    )
    notif = Notification(user_id=user_b_id, title="B's notification", message="private to B")
    db_session.add(notif)
    db_session.commit()
    db_session.refresh(notif)

    resp = client.post(f"/api/v1/notifications/{notif.id}/read", headers=headers_a)
    assert resp.status_code == 404

    # And B's own copy must still be unread.
    still_unread = client.get("/api/v1/notifications", headers=headers_b).json()
    assert still_unread[0]["isRead"] is False


def test_mark_read_unknown_id_404s(client, register_and_login):
    _uid, _t, headers = register_and_login(
        client, email="notifg@example.com", password="correcthorse1", full_name="G", role="parent"
    )
    resp = client.post("/api/v1/notifications/999999/read", headers=headers)
    assert resp.status_code == 404