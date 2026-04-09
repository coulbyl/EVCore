################################################################################
# Stage 1 — Base: Node 24 Alpine + pnpm via corepack
################################################################################
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@10.30.3 --activate

################################################################################
# Stage 2 — Builder: install deps, build workspace packages + Next.js
################################################################################
FROM base AS builder
WORKDIR /app

# Copy entire monorepo (filtered by .dockerignore at repo root)
COPY . .

# Install all deps (dev included — needed for tailwind, typescript, etc.)
RUN pnpm install --frozen-lockfile

# Build Next.js with standalone output
# (output: "standalone" is set in next.config.js)
RUN pnpm --filter web build

################################################################################
# Stage 3 — Runner: minimal image using Next.js standalone output
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

# Standalone bundle (includes a minimal node_modules with traced deps)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Static assets must be placed alongside the standalone server
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Public folder (SVGs, favicons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# server.js is emitted by Next.js standalone at the monorepo-relative path
CMD ["node", "apps/web/server.js"]
