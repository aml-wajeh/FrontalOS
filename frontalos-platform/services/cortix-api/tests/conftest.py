"""
Shared pytest fixtures for cortix-api.

Every test gets its own throwaway on-disk SQLite database (one file per
test, deleted afterward) rather than sharing ./cortix_dev.db or using
":memory:" — an in-memory DB would need a StaticPool to survive across the
multiple connections FastAPI's TestClient opens per request, and a shared
file DB would let tests leak state into each other. A fresh temp file per
test keeps tests both isolated and simple.

`client` overrides the app's `get_db` dependency to point at that DB, then
drives requests through FastAPI's TestClient (using the `with` form so the
app's startup event — init_db() — actually runs and creates tables).
"""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db_session_factory():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    from database import models  # noqa: F401 registers models with Base
    from database.base import Base

    Base.metadata.create_all(bind=engine)

    yield TestingSessionLocal

    engine.dispose()
    os.remove(path)


@pytest.fixture()
def client(db_session_factory):
    import main
    from database.session import get_db

    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    # Deliberately NOT using `with TestClient(...)` here: that form fires the
    # app's startup event, which calls init_db() against the real
    # database.session engine (creating cortix_dev.db as a side effect) even
    # though every request is routed to the overridden, per-test DB below.
    # Tables are already created against the temp DB by db_session_factory.
    main.app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(main.app)
    yield test_client
    main.app.dependency_overrides.clear()


@pytest.fixture()
def db_session(db_session_factory):
    """A direct DB session for tests that need to seed rows (e.g. a
    Patient linked to a specific doctor/guardian/school user id) that no
    endpoint exists to create — same underlying temp DB the `client`
    fixture's overridden get_db points requests at."""
    session = db_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def register_and_login():
    """Returns a helper `_do(client, email, password, full_name, role)` that
    registers a real user via POST /auth/register, logs in via POST
    /auth/login, and returns (user_id, access_token, headers) — headers
    already set to Authorization: Bearer <token> for convenience. Exercises
    the exact same code path the real frontend goes through, rather than
    reaching into core.security directly."""

    def _do(client, email="test@example.com", password="Sup3rSecret!", full_name="Test User", role="parent"):
        register_resp = client.post(
            "/auth/register",
            json={"email": email, "password": password, "full_name": full_name, "role": role},
        )
        assert register_resp.status_code == 201, register_resp.text
        user_id = register_resp.json()["user_id"]

        login_resp = client.post("/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        token = login_resp.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}
        return user_id, token, headers

    return _do