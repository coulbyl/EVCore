################################################################################
# Stage 1 — Base: Node 24 Alpine + pnpm via corepack
################################################################################
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV npm_config_store_dir="/pnpm/store"
RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@10.33.0 --activate

################################################################################
# Stage 2 — Deps: the pnpm store, from the lockfile alone (lot 7, 2026-10-29)
# — cached while pnpm-lock.yaml holds, as in apps/backend/Dockerfile.
################################################################################
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

################################################################################
# Stage 3 — Builder: link deps offline, build workspace packages + Next.js
################################################################################
FROM deps AS builder
WORKDIR /app

# Copy entire monorepo (filtered by .dockerignore at repo root)
COPY . .

# Install all deps (dev included — needed for tailwind, typescript, etc.),
# linked from the store fetched above: no network.
RUN pnpm install --offline --frozen-lockfile

# @evcore/analysis-core ships compiled (main/exports point at dist/, see its
# package.json) — apps/web now imports from it directly (helpers/fixture.ts's
# French market/pick labels, shared with apps/vantage-worker) instead of only
# depending on the workspace source, so it must be built before `next build`
# can resolve it. Same step apps/backend's Dockerfile already runs for the
# same reason.
RUN pnpm --filter @evcore/analysis-core build

# NEXT_PUBLIC_* vars must be available at build time (baked into the JS bundle)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js with standalone output
# (output: "standalone" is set in next.config.js)
RUN pnpm --filter web build

# The traced node_modules of the standalone bundle in a layer of its own: it
# keeps its digest while dependencies hold, and the server only downloads the
# app code that changed (with deploy.yml's reproducible timestamps).
RUN mkdir -p /standalone-deps \
 && mv apps/web/.next/standalone/node_modules /standalone-deps/node_modules

################################################################################
# Stage 4 — Runner: minimal image using Next.js standalone output
#
# next build --standalone traces all runtime dependencies and emits a
# self-contained server at .next/standalone/. In a pnpm monorepo the paths
# inside standalone/ mirror the repo structure, so server.js lives at
# apps/web/server.js inside the bundle.
################################################################################
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Standalone bundle: its traced node_modules first (stable layer), then the
# server and app code.
COPY --from=builder --chown=nextjs:nodejs /standalone-deps/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Static assets must be placed alongside the standalone server
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Public folder (SVGs, favicons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 127.0.0.1, not localhost: busybox wget tries ::1 first and the server
# listens on IPv4 only (see apps/backend/Dockerfile).
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

# server.js is emitted by Next.js standalone at the monorepo-relative path
CMD ["node", "apps/web/server.js"]
