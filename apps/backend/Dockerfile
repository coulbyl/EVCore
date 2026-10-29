################################################################################
# Stage 1 — Base: Node 24 Alpine + pnpm via corepack
################################################################################
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV npm_config_store_dir="/pnpm/store"
# Patch OS packages at base level to eliminate known Alpine CVEs in all stages
RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@10.33.0 --activate

################################################################################
# Stage 2 — Deps: the pnpm store, from the lockfile alone (lot 7, 2026-10-29)
#
# Cached as long as pnpm-lock.yaml does not change, locally and through the
# registry build cache in CI: a code change no longer downloads every package.
################################################################################
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

################################################################################
# Stage 3 — Builder: link deps offline, build workspace packages + backend
################################################################################
FROM deps AS builder
WORKDIR /app

# Copy entire monorepo (filtered by .dockerignore at repo root)
COPY . .

# Install all deps (dev included — needed for prisma generate + nest build),
# linked from the store fetched above: no network.
RUN pnpm install --offline --frozen-lockfile

# prisma generate reads schema only — no real DB connection needed at build time
# binaryTargets includes linux-musl-openssl-3.0.x so schema-engine is bundled for Alpine
ARG DATABASE_URL=postgresql://build:build@localhost:5432/evcore
ENV DATABASE_URL=$DATABASE_URL

# Build workspace packages in dependency order
# prisma generate (inside db build) downloads schema-engine for linux-musl
RUN pnpm --filter @evcore/analysis-core build
RUN pnpm --filter @evcore/db build
RUN pnpm --filter @evcore/transactional build

# Build NestJS backend (SWC compiler → dist/)
RUN pnpm --filter backend build

# Capture the Alpine schema engine so migrate deploy does not download it at runtime.
RUN mkdir -p /tmp/prisma-engines \
 && find /app/node_modules/.pnpm -path '*/node_modules/@prisma/engines/schema-engine-*' -print -quit \
 | xargs -r -I{} cp {} /tmp/prisma-engines/schema-engine

# Deploy: extract prod-only node_modules + workspace packages into /deploy
# pnpm copies built workspace packages (dist/) into /deploy/node_modules
RUN pnpm --filter backend --prod deploy --legacy /deploy

# Two trees for two layers: third-party packages (identical from one release
# to the next while the lockfile holds) and the workspace packages rebuilt on
# every release (@evcore/*, plus .modules.yaml which carries a date). With
# reproducible timestamps (deploy.yml, rewrite-timestamp) the first layer
# keeps its digest, so the server does not download 500 MB again.
RUN mkdir -p /deploy-ws/node_modules/.pnpm/node_modules \
 && mv /deploy/node_modules/@evcore /deploy-ws/node_modules/ \
 && mv /deploy/node_modules/.pnpm/@evcore+* /deploy-ws/node_modules/.pnpm/ \
 && if [ -e /deploy/node_modules/.pnpm/node_modules/@evcore ]; then \
      mv /deploy/node_modules/.pnpm/node_modules/@evcore /deploy-ws/node_modules/.pnpm/node_modules/; \
    fi \
 && if [ -e /deploy/node_modules/.modules.yaml ]; then \
      mv /deploy/node_modules/.modules.yaml /deploy-ws/node_modules/; \
    fi

################################################################################
# Stage 4 — Runner: minimal image with only what's needed at runtime
################################################################################
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/prisma-engines/schema-engine

# curl is required by ETL workers (fetchJsonViaCurl spawns it)
# logrotate handles safe log retention for the file logger.
RUN apk add --no-cache curl logrotate

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nestjs \
 && mkdir -p /app/logs /app/prisma-engines /app/logrotate /app/crontabs \
 && chown nestjs:nodejs /app/logs /app/prisma-engines /app/logrotate /app/crontabs

# Production node_modules: third-party first (stable layer), then the built
# workspace packages (@evcore/db, @evcore/transactional, @evcore/analysis-core).
COPY --from=builder --chown=nestjs:nodejs /deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /deploy-ws/node_modules ./node_modules

# Prisma CLI v7 expects the datasource URL from prisma.config.ts at runtime.
COPY --from=builder --chown=nestjs:nodejs /app/packages/db/prisma.config.ts ./node_modules/@evcore/db/prisma.config.ts
COPY --from=builder --chown=nestjs:nodejs /tmp/prisma-engines/schema-engine ./prisma-engines/schema-engine
RUN chmod +x ./prisma-engines/schema-engine

# Compiled NestJS app
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist

# package.json needed by some NestJS internals (e.g. version, main field)
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json

# Entrypoint: run migrations then start the app
COPY --chown=nestjs:nodejs apps/backend/entrypoint.sh ./entrypoint.sh
COPY --chown=nestjs:nodejs apps/backend/logrotate.conf ./logrotate.conf
COPY --chown=nestjs:nodejs apps/backend/run-logrotate.sh ./run-logrotate.sh
RUN chmod +x entrypoint.sh
RUN chmod +x run-logrotate.sh

USER nestjs

EXPOSE 3000

# 127.0.0.1, not localhost: inside the container busybox wget resolves
# localhost to ::1 first and the app listens on IPv4 only, so the check always
# failed and the container stayed "unhealthy" (found 2026-10-29, lot 7).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["sh", "entrypoint.sh"]
