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
# Stage 3 — Builder: link deps offline, build workspace packages + this worker
################################################################################
FROM deps AS builder
WORKDIR /app

COPY . .
RUN pnpm install --offline --frozen-lockfile

# prisma generate reads schema only — no real DB connection needed at build time
ARG DATABASE_URL=postgresql://build:build@localhost:5432/evcore
ENV DATABASE_URL=$DATABASE_URL

RUN pnpm --filter @evcore/analysis-core build
RUN pnpm --filter @evcore/db build
RUN pnpm --filter vantage-worker build

RUN pnpm --filter vantage-worker --prod deploy --legacy /deploy

# Third-party packages and workspace packages in two layers, as in
# apps/backend/Dockerfile: the first keeps its digest while the lockfile holds.
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

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs vantage

COPY --from=builder --chown=vantage:nodejs /deploy/node_modules ./node_modules
COPY --from=builder --chown=vantage:nodejs /deploy-ws/node_modules ./node_modules
COPY --from=builder --chown=vantage:nodejs /app/apps/vantage-worker/dist ./dist
COPY --from=builder --chown=vantage:nodejs /app/apps/vantage-worker/package.json ./package.json

USER vantage

CMD ["node", "dist/main.js"]
