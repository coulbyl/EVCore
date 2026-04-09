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
ARG DATABASE_URL=postgresql://build:build@localhost:5432/evcore
ENV DATABASE_URL=$DATABASE_URL

# Build workspace packages in dependency order
RUN pnpm --filter @evcore/db build
RUN pnpm --filter @evcore/transactional build

# Build NestJS backend (SWC compiler → dist/)
RUN pnpm --filter backend build

# Deploy: extract prod-only node_modules + workspace packages into /deploy
# pnpm copies built workspace packages (dist/) into /deploy/node_modules
RUN pnpm --filter backend --prod deploy --legacy /deploy

################################################################################
# Stage 3 — Runner: minimal image with only what's needed at runtime
################################################################################
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nestjs

# Production node_modules (includes built @evcore/db and @evcore/transactional)
COPY --from=builder --chown=nestjs:nodejs /deploy/node_modules ./node_modules

# Compiled NestJS app
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist

# package.json needed by some NestJS internals (e.g. version, main field)
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
