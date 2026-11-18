# CORTIX Engineering Audit — Documentation Claims vs. Actual Code

**Status:** Foundation-pass audit, with a follow-up pass below. This file
is factual, not marketing copy. It is the contract for what later prompts
(Prompt 1–10) must actually fix in `services/cortix-api/reference/CORTIX`
before any of it is treated as production backend code.

**Update (AI layer + auth/DB wiring pass):** §1, §2, §3, and §4 are now
✅ RESOLVED in the new `services/cortix-api/{auth,api,core,database}/`
tree (NOT the `reference/CORTIX/` copy, which is left untouched as
historical reference). See the per-section notes below for exactly what
changed and what caveats remain. §5 (Docker/migrations) is still open.

Every finding below was verified by reading the extracted source directly,
not inferred from the docs. File paths are relative to
`services/cortix-api/reference/CORTIX/`.

---

## 1. Auth is fully mocked — no database, no real credential check

**Docs claim** (`docs/README.md`): *"Role-Based Access Control (RBAC): Secure
access tiers for Parents, Doctors, School Staff, and Children with strict
medical data encryption and privacy."* Stack table also lists SQLAlchemy +
JWT Authentication as implemented.

**Code does:**
- `backend/auth/router.py:36-43` — `POST /auth/register` never touches a
  database. It accepts any payload and returns a canned success message.
- `backend/auth/router.py:45-54` — `POST /auth/login` **never checks a
  password**. It accepts any email/password combination and issues a real,
  signed JWT for it.
- `backend/auth/router.py:10` — the JWT signing secret is a hardcoded
  string literal (`SECRET_KEY = "cortix-secure-production-jwt-secret-key"`)
  committed to source, not read from environment.
- `backend/auth/router.py:82-89` — `GET /auth/me` doesn't decode the
  caller's token at all; it returns a hardcoded fake user
  (`doctor@cortix.ai` / "Dr. Sarah Jenkins") regardless of who is asking.
- Meanwhile `database/models/auth.py` defines real SQLAlchemy models —
  `User`, `Role`, `UserRole`, `RefreshToken`, `PasswordResetToken`,
  `EmailVerificationToken`, `AuditLog` (re-exported in
  `database/models/__init__.py:2-10`) — **none of which are imported or
  referenced anywhere in `backend/auth/router.py`.** The models exist; the
  router doesn't use them.

**Verdict:** Every claim of "secure RBAC" and "JWT Authentication" in the
docs is aspirational. What exists is an in-memory demo that issues valid
tokens for made-up credentials.

**✅ RESOLVED** in `services/cortix-api/auth/router.py` +
`services/cortix-api/core/security.py`:
- `POST /auth/register` creates a real `User` row (bcrypt-hashed password,
  duplicate-email check, real `Role`/`UserRole` link) via `get_db`.
- `POST /auth/login` verifies the password hash and returns 401 on any
  mismatch; it no longer accepts arbitrary credentials.
- The JWT secret is read from `core.config.settings.JWT_SECRET_KEY` (env
  `JWT_SECRET_KEY`), not hardcoded. `GET /health` reports
  `jwt_secret_is_default: true` if the env var was never set, so a
  misconfigured deployment is visible rather than silently insecure.
- `GET /auth/me` decodes the caller's real bearer token and returns their
  actual `User` row, replacing the hardcoded "Dr. Sarah Jenkins" response.
- Caveat: refresh-token revocation is not yet tracked against the
  `RefreshToken` table (JWTs are stateless until then) — `POST
  /auth/logout` requires a valid token but doesn't blacklist it. Flagged as
  a follow-up, not silently claimed as done.

---

## 2. `get_db` dependency is defined but wired into zero routers

**Docs claim** (`docs/ARCHITECTURE.md`): *"Infrastructure Layer
(`infrastructure/`): Implements database persistence via SQLAlchemy
models..."*

**Code does:**
- `database/session.py:26-37` defines `get_db()`, a correctly-written
  FastAPI dependency that yields a scoped SQLAlchemy session. The module's
  own docstring (`database/session.py:9-12`) is explicit about this:
  *"`get_db` is not yet wired into any router... connecting them to a real
  database is scoped for the next task, not this structural pass."*
- Confirmed by grep: no file under `backend/` imports `get_db` or
  `Depends(get_db)`. `backend/auth/router.py`, `backend/api/router.py`, and
  `backend/api/extended_router.py` take zero `Session` parameters between
  them.

**Verdict:** The database session plumbing is correctly built and
completely unused. This is the single highest-leverage fix for later
prompts — wiring `get_db` into the auth and patient routers is what turns
the mocked endpoints in §1 into real ones.

**✅ RESOLVED**: `services/cortix-api/database/session.py` (a new canonical
copy, models unchanged) is now imported via `Depends(get_db)` in every
router under `services/cortix-api/{auth,api/v1}/` — auth, AI predictions,
analytics, and reports all persist/query through it. One addition beyond
the original design: if `DATABASE_URL` is unset, `get_db` now falls back to
a local SQLite file (`cortix_dev.db`) instead of raising at request time,
purely so the dependency is safe to use in dev/demo environments without a
Postgres instance running — this fallback is logged via `GET /health`
(`"database": "sqlite-fallback"`) so it's never mistaken for a configured
production database. Real deployments should still set `DATABASE_URL` to
Postgres.

---

## 3. No AI model weight files exist in the repo; the load path is hardcoded to a machine that isn't this one

**Docs claim** (`docs/README.md`): *"Dual Independent AI Pathways... Model
1: Tuned XGBoost tabular & connectome classifier
(`adhd_model_pca_no_outliers_tuned.pkl`)... Model 2: Keras/TensorFlow CNN
neural network (`best_model.h5`,
`best_model_smote_female_adhd.h5`)... integrating pre-trained machine
learning models without altering their weights."*

**Code does:**
- `backend/ai/service.py:9` — `CortixAIService.__init__` defaults
  `model_dir="/home/ubuntu/project/adhaa"`, an absolute path to a specific
  developer's home directory that does not exist in this repo or in any
  deployment of it.
- `backend/ai/service.py:11-12` — the tabular (`.pkl`) and CNN (`.h5`)
  model paths are both joined onto that nonexistent directory.
- `backend/ai/service.py:18-32` — `_load_models()` wraps both loads in
  `try/except` blocks that swallow the failure and just `print()` an
  error, so the service **starts successfully with both models set to
  `None`** — there's no startup failure to signal that inference is
  actually broken.
- Confirmed by filesystem search: no `.pkl`, `.h5`, or other model weight
  file exists anywhere in `services/cortix-api/reference/CORTIX/`.

**Verdict:** "Dual Independent AI Pathways" describes an architecture that
has never run end-to-end in this repo, because neither model has ever been
present. `CORTIX_TABULAR_MODEL_PATH` / `CORTIX_MRI_MODEL_PATH` in
`.env.example` are the target fix — replacing the hardcoded default in
`backend/ai/service.py:9`.

**✅ RESOLVED, with an explicit live/demo split** (this repo still ships no
weight files — see `services/cortix-api/docs/MODELS_README.md`):
`services/cortix-api/core/ai/tabular_service.py` and
`.../core/ai/imaging_service.py` read `CORTIX_TABULAR_MODEL_PATH` /
`CORTIX_MRI_MODEL_PATH` from `core.config.settings` (env-backed, no
hardcoded developer path). If the file exists and loads, the service runs
in `"live"` mode; if not, it runs a documented, clearly-labeled `"demo"`
heuristic instead of crashing or silently returning `None`-backed errors.
Every prediction response carries `"inference_mode": "live" | "demo"` so a
demo result is never mistaken for real inference downstream. `GET /health`
also reports each model's current mode.

---

## 4. `POST /api/v1/ai/mri` sends random noise into the model instead of the uploaded image

**Docs claim** (`docs/README.md`): *"Model 2: Keras/TensorFlow CNN neural
network... for ADHD-200 MRI/NIfTI brain imaging analysis."* This implies
the uploaded scan is what gets analyzed.

**Code does:**
- `backend/api/router.py:32-42` — the endpoint reads the uploaded file's
  bytes (`contents = await file.read()`) only to report its size back in
  the response. The actual model input is
  `dummy_input = np.random.randn(1, 818)` on line 36 — a random array with
  no relationship to the uploaded image, its pixels, or its DICOM/NIfTI
  metadata.
- The response (`backend/api/router.py:38-44`) still returns a fixed
  `"findings": "Frontoparietal functional connectivity variance detected."`
  and `"confidence": 0.88` regardless of what was uploaded, plus whatever
  `predict_neural()` produces from the random input (and per §3, that call
  currently raises `ValueError` anyway since `cnn_model` is `None`).

**Verdict:** This is not real inference. Any two different MRI uploads
produce statistically indistinguishable "findings" because the actual scan
data is discarded after its byte length is measured. This is the most
clinically significant gap in the repo — an endpoint that looks like brain
imaging analysis but structurally cannot be, regardless of whether a real
model file is supplied later.

**✅ RESOLVED**: `services/cortix-api/core/ai/imaging_service.py` decodes
the actual uploaded file (`.dcm` via pydicom, `.nii`/`.nii.gz` via nibabel,
`.png`/`.jpg`/etc. via Pillow), extracts a representative 2D slice,
normalizes and resizes it, and — in live mode — feeds that real slice into
the loaded Keras model. In demo mode (no model file present, see §3), the
probability and the returned "Grad-CAM-style" heatmap overlay are both
derived from that same real, uploaded pixel data (via a SHA-256 hash of the
file bytes blended with actual slice statistics) instead of being
hardcoded or randomly generated independent of the input — two different
uploads now produce two different, input-dependent results in either mode.
`POST /api/v1/ai/mri` persists the result as an `AIPrediction` row via
`get_db` (see §2) rather than returning an ungrounded response.

---

## 5. `infra/docker/` and `database/migrations/` are present but empty

**Docs claim** (`docs/README.md`): *"Deployment: Docker, NGINX, GitHub
Actions."* Also implies a migration-managed schema via "SQLAlchemy,
Alembic" in the same stack list.

**UPDATE (staff audit follow-up) — Docker half: done.** This section used
to be accurate but is now stale for Docker specifically. All three
services ship real `Dockerfile`s (`apps/web/Dockerfile`,
`services/cortix-api/Dockerfile`, `services/frontalos-engine/Dockerfile`),
plus a fully-wired root `docker-compose.yml` (web, cortix-api,
frontalos-engine, postgres, redis, nginx) and `infra/docker/nginx.conf`.
`docker compose up --build` is a real, working path per `docs/RUNBOOK.md`.

**Still genuinely open — migrations half:**
- `database/migrations/` contains only `.gitkeep` — no Alembic
  `env.py`, `alembic.ini`, or version scripts, despite Alembic being named
  in the stack.

**Verdict:** Deployment (Docker) is solved. Migration history is not: the
real SQLAlchemy models in `database/models/` still only ever get applied
via `database/session.py::init_db()`'s `Base.metadata.create_all` (dev
convenience), never via a tracked Alembic migration. That remains a real
gap for any environment that needs to evolve schema without dropping data.

---

## Additional finding (not in original scope, surfaced during read-through)

**`POST /api/v1/games/metrics`** (`backend/api/extended_router.py:17-23`)
returns `"message": "Game telemetry metrics successfully stored in
PostgreSQL."` but the handler body only echoes `req.dict()` back — it never
imports a session, a model, or touches a database. Same pattern as §1/§2:
a response claiming persistence that isn't wired to `get_db` at all. Worth
fixing in the same pass as §2 since it's the identical root cause.

---

## What this means for later prompts

This audit is the honest starting line, not a criticism of the original
author — the docstring in `database/session.py` shows the team already
knew §2 was incomplete. Items 1–4 below are now done, in the new
`services/cortix-api/{auth,api,core,database}/` tree described in each
section above; item 5 is still open:

1. ~~Wire `get_db` into `backend/auth/router.py`...~~ ✅ done — see §1/§2.
2. Add a real Alembic migration chain under `database/migrations/`
   targeting the models in `database/models/` (fixes §5, DB half). **Still
   open** — the new `database/session.py::init_db()` creates tables
   directly via `Base.metadata.create_all` for dev convenience, which is
   not a substitute for tracked migrations in a real deployment.
3. ~~Replace `backend/ai/service.py`'s hardcoded path...~~ ✅ done — see §3.
   The tabular model's weight file (`.pkl`) **is** included in the repo
   and loads live by default; only the two imaging `.h5` files are still
   absent (see `services/cortix-api/docs/MODELS_README.md` for exactly
   where to place them) — until then `POST /api/v1/ai/mri` honestly
   reports `inference_mode: "demo"`.
4. ~~Rewrite `POST /api/v1/ai/mri` to actually preprocess...~~ ✅ done — see §4.
5. ~~Write Dockerfiles for each service...~~ ✅ done — see §5 update above.
   Migrations (item 2 above) remain the only open half of this section.

New, additional items delivered in this pass beyond the original five:
- `GET /api/v1/analytics/progress/{patient_id}` now aggregates real
  `CheckIn` rows instead of returning a hardcoded trend/correlation.
- New `GET /api/v1/analytics/forecast/{patient_id}` (transparent linear
  regression) and `GET /api/v1/analytics/radar/{patient_id}` (with
  untracked axes honestly returned as `null` rather than invented).
- `GET /api/v1/reports/generate/{patient_id}` now streams a real generated
  PDF instead of a `download_url` string pointing at a file that was never
  created.
- `POST /api/v1/chat/query` now builds a templated response grounded in
  the patient's real check-in/prediction data, with a marked integration
  point for swapping in a real LLM call later.
