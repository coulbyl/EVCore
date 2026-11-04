# EVCore

> Probability-driven football analysis engine. It analyses and proposes; it never places a bet on a user's behalf.

EVCore is a probabilistic football-analysis system whose decisions, prices and
outcomes are measured prospectively, leg by leg. The backend remains the final
authority for numerical validation and publication.

**Status:** in production. The engine is measured behind the market (Brier
0.639 against 0.599, optimal blend weight 0 %), so products are ranked on the
measured price, not on the engine's claimed edge. Historical backtests are
research evidence, not proof of future profitability.

---

## What it does

- Collects fixtures, results, stats, events, lineups and odds from many bookmakers via API-Football; odds history is partitioned by month and archived to Parquet.
- Scores every fixture with Poisson-family prediction channels (`docs/prediction-engine-families.md`), settles every selection and measures calibration (realised ÷ announced) and closing-line value per leg.
- Suspends a market automatically when its loss is established over 90 days of deduplicated selections.
- Publishes the player products: Pari sûr du jour, Combiné du jour, coupon cote 2, hunters (BTTS, draw, correct score, corners, half-time draw), Combiné IA 4–10, and an AI opinion per match (`apps/vantage-worker`).
- Never frames a claimed edge (`p − 1/odds`) as quality: it is anti-predictive and used as a ceiling. Product details: [EVCORE.md](EVCORE.md).

---

## Stack

| Layer         | Technology                                                 |
| ------------- | ---------------------------------------------------------- |
| Monorepo      | pnpm + Turborepo                                           |
| Backend       | NestJS + TypeScript (strict), API and worker processes     |
| Web           | Next.js                                                    |
| Database      | PostgreSQL 18 + Prisma 7, PgBouncer                        |
| Queues        | BullMQ + Redis                                             |
| Storage       | RustFS (S3-compatible): support attachments, odds archive  |
| Validation    | Zod (external data) + class-validator (DTOs)               |
| Math          | decimal.js, Poisson model                                  |
| Notifications | Resend (email), Web Push, in-app                           |
| Infra         | Docker Compose, GitHub Actions (images scanned with Trivy) |

---

## Getting started

**Requirements:** Node.js >= 22, pnpm 10, Docker

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, PgBouncer, Redis, RustFS, Mailpit, vantage-worker)
docker compose up -d

# Apply DB migrations
pnpm --filter @evcore/db db:migrate

# Seed competitions
pnpm --filter @evcore/db db:seed

# Create the first admin account (asked at the terminal)
pnpm --filter @evcore/db create-admin

# Start the apps in dev mode (turbo `dev` + `dev:worker`: web, backend API, backend worker, vantage-worker)
pnpm dev
```

Run all quality checks:

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # TypeScript (no emit)
pnpm --filter backend test  # Vitest unit tests
```

Default service endpoints (dev):

| Service     | URL                     |
| ----------- | ----------------------- |
| Web         | `http://localhost:3000` |
| Backend API | `http://localhost:3001` |
| PostgreSQL  | `localhost:5432`        |
| PgBouncer   | `localhost:5433`        |
| Redis       | `localhost:6379`        |
| RustFS (S3) | `http://localhost:9000` |
| Mailpit UI  | `http://localhost:8025` |

Production endpoints:

| Service | URL                        |
| ------- | -------------------------- |
| Web     | `https://c-evcore.com`     |
| Backend | `https://api.c-evcore.com` |

---

## Project structure

```
apps/
  backend/         # NestJS API + worker: ETL, betting engine, coupons, settlement, admin
  web/             # Next.js app (public, player, admin)
  vantage-worker/  # LLM opinions per match (VANTAGE), BullMQ consumer
  ml-worker/       # Python training code (Phase 3, redefined); not in the compose files
packages/
  analysis-core/     # Pure engine core shared by the backend and backtests
  backtest-core/     # Point-in-time backtest harness
  db/                # Prisma schema, migrations, scripts (@evcore/db)
  transactional/     # React Email templates (@evcore/transactional)
  ui/                # Shared React component library (@repo/ui)
  eslint-config/     # Shared ESLint rules
  typescript-config/ # Shared TypeScript configs
```

---

## Environment variables

The `.env` holds **secrets and addresses only**. Every decision (hours,
thresholds, flags) lives in `apps/backend/src/config/`; operator switches live
in the `app_setting` table, edited in the admin screen **Réglages**; third-party
keys can be stored encrypted in **Réglages › Intégrations**, the `.env` value
serving as fallback. The backend validates its environment at start
(`apps/backend/src/config/env.schema.ts`) and warns about retired variables.

Backend (see `apps/backend/.env.example`):

```
# Process
NODE_ENV  PORT  HOST  LOG_LEVEL  LOG_DIR

# Addresses
DATABASE_URL  PGBOUNCER_URL  DATABASE_POOL_MAX  REDIS_HOST  REDIS_PORT
APP_URL  CORS_ORIGINS  AUTH_COOKIE_DOMAIN
RUSTFS_ENDPOINT  RUSTFS_PUBLIC_ENDPOINT  RUSTFS_REGION  RUSTFS_BUCKET

# Secrets
TOTP_APP_SECRET (required in production)  ADMIN_API_TOKEN  SETTINGS_ENCRYPTION_KEY
API_FOOTBALL_KEY  THE_ODDS_API_KEY
RESEND_API_KEY  RESEND_FROM  RESEND_ADMIN_TO
VAPID_PUBLIC_KEY  VAPID_PRIVATE_KEY  VAPID_SUBJECT
RUSTFS_ACCESS_KEY  RUSTFS_SECRET_KEY

# This machine
ETL_SCHEDULING_ENABLED   # false on a local copy of production
```

The vantage-worker has its own `apps/vantage-worker/.env.example` (LLM
providers, research provider).

---

## Documentation

| File                                                       | Purpose                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [EVCORE.md](EVCORE.md)                                     | Product specification                                           |
| [ROADMAP.md](ROADMAP.md)                                   | Current state, phases and open work                             |
| [TODO.md](TODO.md)                                         | Open items outside the roadmap                                  |
| [CLAUDE.md](CLAUDE.md)                                     | Coding conventions and measured results that override intuition |
| [docs/exploitation.md](docs/exploitation.md)               | Operations: worker, manual syncs, odds archive, integrations    |
| [PROD_DB_ACCESS.md](PROD_DB_ACCESS.md)                     | Read-only access to the production database                     |
| [docs/journal-experiences.md](docs/journal-experiences.md) | What was tried and measured                                     |
| [docs/archive/](docs/archive/)                             | Finished plans, the v1 spec, the roadmap history                |

---

## Phase status

| Phase   | Status                  | Content                                                                                                                                      |
| ------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP     | ✅ Done                 | Historical import, Poisson, backtest, calibration loop; March 2026 validation figures withdrawn as proof                                     |
| Phase 2 | ✅ In production        | Live odds, multi-league ETL, channels, settlement, CLV, deterministic coupons, AI opinions; Kelly, Grafana, TimescaleDB and OpenClaw dropped |
| Phase 3 | 📋 Redefined 2026-10-29 | Market grid as engine input; ML only for what the price does not say, judged on the residual vs Pinnacle                                     |
| Phase 4 | Future                  | SaaS, multi-tenant                                                                                                                           |
