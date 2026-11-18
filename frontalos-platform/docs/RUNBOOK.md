# RUNBOOK — Running FrontalOS Platform

This is the practical, tested path to get the whole platform running. For
what's actually implemented vs. still mocked in `cortix-api`, see
`docs/AUDIT.md`. For AI model weight files, see
`services/cortix-api/docs/MODELS_README.md`.

## 1. Prerequisites

- **Docker Desktop** (macOS/Windows) or **Docker Engine + Compose v2**
  (Linux). Check with:
  ```bash
  docker --version
  docker compose version   # must be v2 (the `docker compose` subcommand,
                            # not the standalone `docker-compose` v1 binary)
  ```
- ~4 GB free disk for images + the bundled model weights (~12 MB, already
  in the repo — no 15 GB training dataset download required).

## 2. First-time setup

```bash
cp .env.example .env
```

Open `.env` and change:

| Variable | Why it must change |
|---|---|
| `JWT_SECRET_KEY` | **Required.** Leaving it blank runs the API with an insecure default; `GET /health` will report `jwt_secret_is_default: true` as a visible warning. Generate one with `python3 -c "import secrets; print(secrets.token_hex(32))"`. |

Everything else in `.env` (`DATABASE_URL`, `REDIS_URL`, model paths, the
`NEXT_PUBLIC_*` URLs) can stay at its default for local dev — the defaults
already match `docker-compose.yml`'s service names and ports.

## 3. Run it

```bash
docker compose up --build
```

First run builds three images and pulls `postgres:15-alpine`,
`redis:7-alpine`, and `nginx:1.27-alpine` — expect a few minutes. Every
run after that is fast (Docker layer cache).

On every container start, `cortix-api`'s entrypoint automatically:
1. Creates any missing database tables (safe/idempotent).
2. Seeds 4 demo accounts + 1 linked demo patient (skipped if they already
   exist — see step 5 for credentials).
3. Starts the API server.

So a fresh `docker compose up --build` gives you a fully working,
pre-populated demo with no manual steps.

### Service URLs

| Service | URL |
|---|---|
| Web app (all portals) | http://localhost:3000 |
| API docs (Swagger UI) | http://localhost:8000/docs |
| API health check | http://localhost:8000/health |
| FrontalOS Engine health | http://localhost:8001/health |
| Everything via nginx (single entry point) | http://localhost |

Postgres (`5432`) and Redis (`6379`) are also published to the host for
local inspection with a DB client, but nothing outside Docker needs to
talk to them for the app itself to work.

## 4. Verify it worked

1. Open http://localhost:3000 — you should land on the marketing page,
   then reach **http://localhost:3000/login**.
2. Log in with a seeded demo account:

   | Role | Email | Password |
   |---|---|---|
   | Doctor | `doctor.demo@frontalos.dev` | `Password123!` |
   | Parent | `parent.demo@frontalos.dev` | `Password123!` |
   | Patient (child) | `patient.demo@frontalos.dev` | `Password123!` |
   | School | `school.demo@frontalos.dev` | `Password123!` |

3. The Doctor dashboard should show one patient ("Youssef Hassan") already
   linked — that's the seeded demo patient, confirming the database,
   auth, and API wiring all actually work end-to-end.
4. Open http://localhost:8000/health — `ai_models` should show
   `"tabular": "demo"` and `"imaging": "demo"` (no model weight files
   present yet — expected, see step 6).

If you see the login page and can log in as any of the four demo accounts,
the platform is working correctly.

## 5. Demo credentials, again

All four accounts share the password `Password123!`. They're created by
`services/cortix-api/db/seed.py`, run automatically by the container
entrypoint. To re-run it manually (e.g. after wiping the database volume):

```bash
docker compose exec cortix-api python -m db.seed
```

## 6. Switching from demo mode to live AI mode

Every AI endpoint runs in `"inference_mode": "demo"` (deterministic
placeholder output) until real trained weight files are present. To go
live:

1. Get the three model files (not included in this repo — see
   `services/cortix-api/docs/MODELS_README.md` §4 for training-data
   provenance if you need to retrain them).
2. Drop them into `services/cortix-api/models/`:
   ```
   services/cortix-api/models/adhd_model_pca_no_outliers_tuned.pkl
   services/cortix-api/models/best_model.h5
   services/cortix-api/models/best_model_smote_female_adhd.h5
   ```
3. Restart: `docker compose restart cortix-api`.
4. Re-check `GET /health` — `ai_models.tabular` / `ai_models.imaging`
   should now say `"live"`.

The FrontalOS engagement engine (webcam attention detection) is different:
its real trained weights (`frontal_x3d_model.pth`) already ship inside the
repo and image — that service runs in live mode out of the box.

## 7. Running without Docker (local development)

Useful for fast iteration on one service at a time. Start Postgres/Redis
via Docker either way (no need to install them natively):

```bash
docker compose up postgres redis
```

Then, in separate terminals:

```bash
# apps/web
cd apps/web
npm install
npm run dev                     # http://localhost:3000

# services/cortix-api
cd services/cortix-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://frontalos:frontalos@localhost:5432/frontalos
export JWT_SECRET_KEY=dev-local-secret
uvicorn main:app --reload              # http://localhost:8000

# services/frontalos-engine
cd services/frontalos-engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Run the seed script manually once cortix-api's tables exist:
```bash
cd services/cortix-api && python -m db.seed
```

## 8. Troubleshooting

**"model not found — running in demo mode" in the logs**
Not an error. It means no weight file exists at the configured
`CORTIX_TABULAR_MODEL_PATH` / `CORTIX_MRI_MODEL_PATH*` — the API falls
back to deterministic demo responses instead of failing. See step 6 to go
live.

**Webcam permission issues in the browser**
The Patient Portal's live observer needs camera access, which browsers
only grant on `https://` or `http://localhost` origins. If you're
accessing the app from another device on your network (not `localhost`),
the webcam prompt will be blocked — use `localhost`/`127.0.0.1`, or put
the whole stack behind HTTPS for remote access.

**Port already in use (`3000`, `8000`, `8001`, `5432`, `6379`, or `80`)**
Something else on your machine is already bound to one of those ports.
Either stop that process, or edit the left-hand side of the matching
`ports:` entry in `docker-compose.yml` (e.g. `"3001:3000"`), then
`docker compose up --build` again.

**`docker compose up` fails immediately on `cortix-api` with a database
connection error**
Postgres usually just needs a few more seconds on first boot (initializing
its data directory). `cortix-api` won't start until Postgres's own
healthcheck (`pg_isready`) passes — if it's still failing after ~30
seconds, check `docker compose logs postgres` for a real error (e.g. a
stale, incompatible `postgres_data` volume from a much older Postgres
version — fix with `docker compose down -v` to drop the volume and start
fresh, **which deletes all local demo data**).

**`npx tsc` / `next build` fails trying to reach `fonts.googleapis.com`**
A network-restricted environment issue, not a code bug — see
`REMAINING_STEPS.md`'s environment notes. Doesn't affect the Docker build,
which doesn't need outbound access to Google Fonts to produce a working
image.
