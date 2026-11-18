"""
Tests for auth/router.py + core/security.py.

Until this session, none of this was actually runnable: core/security.py
did `import jwt` (PyJWT's import name) while requirements.txt only listed
python-jose, so `import main` failed at collection time with
`ModuleNotFoundError: No module named 'jwt'` before a single test could
run. See REMAINING_STEPS.md for that fix. This file is the first real
exercise of the auth flow the fix unblocked.
"""


def test_register_creates_user(client):
    resp = client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "correcthorse1", "full_name": "Alice A", "role": "parent"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "success"
    assert body["email"] == "alice@example.com"
    assert body["role"] == "parent"
    assert isinstance(body["user_id"], int)


def test_register_rejects_invalid_role(client):
    resp = client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "correcthorse1", "full_name": "Bob B", "role": "wizard"},
    )
    assert resp.status_code == 400


def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "correcthorse1", "full_name": "Dup", "role": "parent"}
    first = client.post("/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/auth/register", json=payload)
    assert second.status_code == 409


def test_login_succeeds_with_correct_password(client):
    client.post(
        "/auth/register",
        json={"email": "carol@example.com", "password": "correcthorse1", "full_name": "Carol C", "role": "doctor"},
    )
    resp = client.post("/auth/login", json={"email": "carol@example.com", "password": "correcthorse1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    # Access and refresh tokens must be distinct JWTs, not the same string
    # reused for both purposes.
    assert body["access_token"] != body["refresh_token"]


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={"email": "dave@example.com", "password": "correcthorse1", "full_name": "Dave D", "role": "parent"},
    )
    resp = client.post("/auth/login", json={"email": "dave@example.com", "password": "wrong-password"})
    assert resp.status_code == 401


def test_login_rejects_unknown_email(client):
    resp = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever123"})
    assert resp.status_code == 401


def test_me_requires_authentication(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_returns_the_real_calling_user(client, register_and_login):
    user_id, _token, headers = register_and_login(
        client, email="erin@example.com", password="correcthorse1", full_name="Erin E", role="school"
    )
    resp = client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == user_id
    assert body["email"] == "erin@example.com"
    assert body["full_name"] == "Erin E"
    assert body["roles"] == ["school"]


def test_me_rejects_garbage_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_refresh_issues_new_tokens(client):
    client.post(
        "/auth/register",
        json={"email": "frank@example.com", "password": "correcthorse1", "full_name": "Frank F", "role": "parent"},
    )
    login = client.post("/auth/login", json={"email": "frank@example.com", "password": "correcthorse1"})
    refresh_token = login.json()["refresh_token"]

    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_refresh_rejects_an_access_token(client, register_and_login):
    """A refresh-token-typed endpoint must not accept an access token —
    otherwise a leaked access token could be used to mint fresh tokens
    indefinitely instead of expiring on schedule."""
    _user_id, access_token, _headers = register_and_login(
        client, email="grace@example.com", password="correcthorse1", full_name="Grace G", role="parent"
    )
    resp = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


def test_logout_requires_authentication(client):
    resp = client.post("/auth/logout")
    assert resp.status_code == 401


def test_logout_succeeds_when_authenticated(client, register_and_login):
    _user_id, _token, headers = register_and_login(
        client, email="heidi@example.com", password="correcthorse1", full_name="Heidi H", role="parent"
    )
    resp = client.post("/auth/logout", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"