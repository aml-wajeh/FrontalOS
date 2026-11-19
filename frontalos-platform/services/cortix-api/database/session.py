"""
Database engine / session factory.

Reads DATABASE_URL from the environment. If it isn't set, this falls back to
a local SQLite file (./cortix_dev.db) instead of raising at request time —
that fallback exists purely so `get_db` is always safe to depend on in dev/
demo environments without a Postgres instance running. In any real
deployment, set DATABASE_URL to a Postgres URL and the fallback is never
used.

`get_db` IS wired into the auth and AI routers (see auth/router.py,
api/v1/ai.py, api/v1/analytics.py). This resolves the gap documented in
docs/AUDIT.md §2.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
USING_SQLITE_FALLBACK = False

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./cortix_dev.db"
    USING_SQLITE_FALLBACK = True

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency yielding a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist. Safe to call on every startup —
    it's a no-op for tables that already exist, and it never drops data.
    Real deployments should still prefer Alembic migrations for schema
    changes; this is a dev-friendly bootstrap, not a migration system."""
    from database import models  # noqa: F401 (registers models with Base)
    from database.base import Base

    Base.metadata.create_all(bind=engine)
