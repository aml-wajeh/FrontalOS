# infra/ci

The real, active workflow GitHub runs is `.github/workflows/ci.yml` — GitHub
Actions only picks up workflows from that exact path, so that's the one
that actually executes on push/PR.

`github-actions.yml` in this folder is an identical copy kept here for
discoverability alongside the rest of `infra/`. If you edit the pipeline,
edit `.github/workflows/ci.yml` and copy the change here (or symlink it)
so the two don't drift.

## What it does

Three independent jobs (`web`, `cortix-api`, `frontalos-engine`) run lint,
type-check, and tests in parallel; a fourth (`docker-build`) then builds
all three Docker images to confirm the repo is always in a working state.
Nothing deploys anywhere.
