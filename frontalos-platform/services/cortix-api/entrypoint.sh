#!/bin/sh
# =============================================================================
# services/cortix-api/entrypoint.sh
# =============================================================================
# Runs on every container start, safe to run every time:
#   1. Create any missing tables.
#   2. Seed demo accounts (skipped automatically if they already exist).
#   3. exec the real CMD (uvicorn --reload in dev, gunicorn in prod) as PID 1.
#
# NOTE on schema migrations: this repo does not (yet) ship Alembic
# migrations -- there is no alembic.ini or migrations/versions/ directory,
# only the dependency in requirements.txt for when that's built out. The
# real, currently-implemented bootstrap is database.session.init_db(), an
# idempotent SQLAlchemy Base.metadata.create_all() (see database/session.py
# docstring). This entrypoint calls that rather than a nonexistent
# `alembic upgrade head` -- once real migrations exist, replace step 1 below
# with `alembic upgrade head` and this comment.
set -e

echo "[entrypoint] Waiting is handled by docker-compose's postgres healthcheck; bootstrapping schema..."
python -c "from database.session import init_db; init_db()"

echo "[entrypoint] Seeding demo data (idempotent)..."
python -m db.seed

echo "[entrypoint] Starting: $*"
exec "$@"
