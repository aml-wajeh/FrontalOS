# =============================================================================
# services/cortix-api/Dockerfile — FastAPI backend
# =============================================================================
# Two targets sharing one base:
#   - `dev`  : uvicorn --reload, source mounted as a volume by docker-compose
#              (the compose `web`/`cortix-api` service targets this by
#              default so code edits on the host take effect immediately).
#   - `prod` : gunicorn managing uvicorn workers, no reload, runs as a
#              non-root user, code baked into the image (no bind mount).
#
# Build a specific target with: docker build --target prod .
# docker-compose.yml builds `dev` for local `up`; swap to `prod` for any
# real deployment (see docs/RUNBOOK.md).

FROM python:3.11-slim AS base
WORKDIR /app

# psycopg2-binary needs libpq at runtime; build-essential covers packages
# (xgboost/tensorflow deps) that occasionally need to compile on install.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- dev --------------------------------------------------------------------
FROM base AS dev
# Source is bind-mounted by docker-compose in dev; this COPY just means
# `docker run` on this image works standalone too (e.g. in CI) without the
# mount. Runs as root in dev for bind-mount write permissions across hosts.
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---- prod ---------------------------------------------------------------
FROM base AS prod
RUN groupadd --system --gid 1001 cortix && \
    useradd --system --uid 1001 --gid cortix cortix
RUN pip install --no-cache-dir gunicorn==22.0.0

COPY . .
RUN chown -R cortix:cortix /app
USER cortix

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fs http://localhost:8000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
# 4 workers is a reasonable default for a small deployment; override with
# GUNICORN_WORKERS if the host has more cores to spare.
CMD ["sh", "-c", "gunicorn main:app -k uvicorn.workers.UvicornWorker -w ${GUNICORN_WORKERS:-4} -b 0.0.0.0:8000 --access-logfile - --error-logfile -"]
