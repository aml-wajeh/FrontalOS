# infra/ci

The CI pipeline lives at the repository root, in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml). That is the only path GitHub Actions reads.

## Jobs

| Job | What it runs |
|---|---|
| `ml-engine` | Lint and metric unit tests for `FrontalOS_Engine/` |
| `frontalos-engine` | Lint and tests for the real-time service: demo-mode fallback, temporal buffer, intervention policy, WebSocket |
| `cortix-api` | Lint and pytest for the backend |
| `web` | ESLint, TypeScript type-check, and Vitest |
| `docker-build` | Builds all three images on pushes to `main`. Nothing is deployed. |

Security scanning runs in a separate workflow, [`.github/workflows/codeql.yml`](../../../.github/workflows/codeql.yml).
