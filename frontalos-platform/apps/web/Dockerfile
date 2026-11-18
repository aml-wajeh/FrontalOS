# =============================================================================
# apps/web/Dockerfile — Next.js 14 (App Router) production image
# =============================================================================
# Three stages: deps (install once, cached) -> build (compile the standalone
# server) -> run (copy only the pruned standalone output into a slim image).
# This is a monorepo (npm workspaces: apps/*, packages/*), so every stage
# builds from the REPO ROOT as its context, not apps/web -- the workspace
# link to @frontalos/design-tokens (packages/design-tokens) only resolves
# that way. See docker-compose.yml: `context: .`, `dockerfile:
# apps/web/Dockerfile`.

# ---- deps -------------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
# npm workspaces require the full lockfile + every workspace's package.json
# to be present before `npm ci` can resolve the tree correctly.
RUN npm ci

# ---- build --------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY packages/design-tokens ./packages/design-tokens
COPY apps/web ./apps/web

# NEXT_PUBLIC_* variables are inlined into the client bundle at BUILD time,
# not read at container start -- they must be supplied here as build args.
# docker-compose.yml passes these from the root .env automatically.
ARG NEXT_PUBLIC_CORTIX_API_URL=http://localhost:8000
# Base URL only (no trailing path) — the client appends
# /ws/observe/{sessionId} itself. See lib/websocket/useObserverSocket.ts.
ARG NEXT_PUBLIC_FRONTALOS_WS_URL=ws://localhost:8001
ENV NEXT_PUBLIC_CORTIX_API_URL=$NEXT_PUBLIC_CORTIX_API_URL
ENV NEXT_PUBLIC_FRONTALOS_WS_URL=$NEXT_PUBLIC_FRONTALOS_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=apps/web

# ---- run ------------------------------------------------------------------
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# `output: "standalone"` (apps/web/next.config.mjs) produces a self-contained
# server at .next/standalone/apps/web/server.js (path mirrors the monorepo
# layout it was built from) plus a pruned node_modules already inside it --
# nothing from the `build` stage's full node_modules needs to be copied.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# server.js lives at apps/web/server.js inside the copied standalone output
# because the build ran from the monorepo root (see the `build` stage).
CMD ["node", "apps/web/server.js"]
