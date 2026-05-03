################################################################################
# Stage 1 — Base: Node 24 Alpine + pnpm via corepack
################################################################################
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Patch OS packages at base level to eliminate known Alpine CVEs in all stages
RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@10.33.0 --activate

################################################################################
# Stage 2 — Builder: install deps, build workspace packages + backend
################################################################################
FROM base AS builder
WORKDIR /app

# Copy entire monorepo (filtered by .dockerignore at repo root)
COPY . .

# Install all deps (dev included — needed for prisma generate + nest build)
RUN pnpm install --frozen-lockfile

# prisma generate reads schema only — no real DB connection needed at build time
# binaryTargets includes linux-musl-openssl-3.0.x so schema-engine is bundled for Alpine
ARG DATABASE_URL=postgresql://build:build@localhost:5432/evcore
ENV DATABASE_URL=$DATABASE_URL

# Build workspace packages in dependency order
# prisma generate (inside db build) downloads schema-engine for linux-musl
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

################################################################################
# Stage 3 — Runner: minimal image with only what's needed at runtime
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

# Production node_modules (includes built @evcore/db, @evcore/transactional, prisma CLI)
COPY --from=builder --chown=nestjs:nodejs /deploy/node_modules ./node_modules

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["sh", "entrypoint.sh"]
