# FrontalOS

**AI-powered ADHD support platform: real-time engagement estimation from webcam video.**
Graduation Project, Professional Diploma (2026). **v2 in progress.**

> Research prototype and decision-support demo. **Not a diagnostic or medical device.**

## What's here

| Folder | Contents |
|---|---|
| [`FrontalOS_Engine/`](FrontalOS_Engine) | Video engagement model: X3D-XS 3D-CNN fine-tuned on DAiSEE for 4-output regression (engagement, boredom, confusion, frustration), plus the training script, dataset loader, and multithreaded real-time webcam observer. |
| [`frontalos-platform/`](frontalos-platform) | Full platform monorepo, described in the list below. See [its README](frontalos-platform/README.md) and the [runbook](frontalos-platform/docs/RUNBOOK.md). |

The platform monorepo contains:

- Next.js 14 + TypeScript web app with role-based portals
- FastAPI backend (`cortix-api`) on PostgreSQL + Redis
- FastAPI WebSocket real-time engine (`frontalos-engine`)
- Docker Compose (6 services) behind an Nginx reverse proxy

## Quick start

```bash
cd frontalos-platform
cp .env.example .env   # set JWT_SECRET_KEY
docker compose up --build
```

Then open http://localhost:3000.

## Data

The DAiSEE dataset is **not included** because of its size and license. Obtain it from its official source and point `DATASET_ROOT` in `FrontalOS_Engine/train.py` to it.

## v2 roadmap (in progress)

- Held-out DAiSEE test-split evaluation against baseline predictors
- Fix train/serve temporal skew in the live pipeline
- Deterministic intervention policy (smoothing, hysteresis, cooldown)
- Latency benchmarking (p50/p95, GPU vs. CPU)
- Fully on-device processing: no frames stored or transmitted
