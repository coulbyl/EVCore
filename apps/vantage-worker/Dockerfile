################################################################################
# Stage 1 — Base: Node 24 Alpine + pnpm via corepack
################################################################################
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@10.33.0 --activate

################################################################################
# Stage 2 — Builder: install deps, build workspace packages + this worker
################################################################################
FROM base AS builder
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

# prisma generate reads schema only — no real DB connection needed at build time
ARG DATABASE_URL=postgresql://build:build@localhost:5432/evcore
ENV DATABASE_URL=$DATABASE_URL

RUN pnpm --filter @evcore/analysis-core build
RUN pnpm --filter @evcore/db build
RUN pnpm --filter vantage-worker build

RUN pnpm --filter vantage-worker --prod deploy --legacy /deploy

################################################################################
# Stage 3 — Runner: minimal image with only what's needed at runtime
################################################################################
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs vantage

COPY --from=builder --chown=vantage:nodejs /deploy/node_modules ./node_modules
COPY --from=builder --chown=vantage:nodejs /app/apps/vantage-worker/dist ./dist
COPY --from=builder --chown=vantage:nodejs /app/apps/vantage-worker/package.json ./package.json

USER vantage

CMD ["node", "dist/main.js"]
