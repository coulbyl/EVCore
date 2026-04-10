# EVCore

> Autonomous value-driven sports betting engine built around Expected Value (EV) mathematics.

EVCore is a disciplined probabilistic decision system — not a tip generator. It targets long-term ROI through deterministic data scoring, calibrated over time, with the backend always acting as the final authority.

**Status:** Phase 2 in progress — coupon settlement completed, Bloc 6 (HT/FT foundations) started.

---

## What it does

- Collects live and historical football data (fixtures, results, xG, odds) via API-Football
- Computes match probabilities using a Poisson model weighted by 4 deterministic features
- Evaluates all markets (1X2, Over/Under 2.5, BTTS, Double Chance, 12 combo-match pairs) for value bets where `EV ≥ 8%`
- Applies fractional Kelly (0.25×) for stake sizing
- Generates a coupon (daily or 2-3 day window) of up to 6 legs ranked by `qualityScore = EV × deterministicScore`
- Filters picks with adverse line movement (> 10% odds drop over 7 days)
- Tracks performance metrics (Brier Score, ROI, drawdown) and self-calibrates over time
- Sends alerts via Email when opportunities, anomalies, or auto-calibrations are detected

**Validated on 3 EPL seasons:** Brier Score 0.592 (< 0.65 threshold), Calibration Error 2.5%, simulated ROI +2.28%.

---

## Stack

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| Monorepo      | pnpm + Turborepo                             |
| Backend       | NestJS + TypeScript (strict)                 |
| Database      | PostgreSQL + Prisma                          |
| Queues        | BullMQ + Redis                               |
| Validation    | Zod (external data) + class-validator (DTOs) |
| Math          | decimal.js, Poisson model                    |
| Notifications | Nodemailer (SMTP) + in-app DB                |
| Infra         | Docker Compose, GitHub Actions               |

---

## Getting started

**Requirements:** Node.js >= 18, pnpm 9, Docker

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis + Mailpit)
docker compose up -d

# Apply DB migrations
pnpm --filter @evcore/db db:migrate -- --name init

# Start backend in dev mode
pnpm --filter backend dev
```

Run all quality checks:

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # TypeScript (no emit)
pnpm --filter backend test  # Vitest unit tests (231 tests)
```

Useful maintenance commands:

```bash
pnpm --filter @evcore/db db:stats
```

Default service endpoints (dev):

| Service    | URL                     |
| ---------- | ----------------------- |
| Backend    | `http://localhost:3000` |
| PostgreSQL | `localhost:5432`        |
| Redis      | `localhost:6379`        |
| Mailpit UI | `http://localhost:8025` |

Production endpoints:

| Service | URL                        |
| ------- | -------------------------- |
| Web     | `https://c-evcore.com`     |
| Backend | `https://api.c-evcore.com` |

---

## Project structure

```
apps/
  backend/    # NestJS API — Betting Engine, ETL workers, coupon generator
  web/        # Next.js dashboard (in progress)
packages/
  db/                # Prisma schema + generated client (@evcore/db)
  transactional/     # React Email templates (@evcore/transactional)
  ui/                # Shared React component library (@repo/ui)
  eslint-config/     # Shared ESLint rules
  typescript-config/ # Shared TypeScript configs
```

### Backend modules

| Module            | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `etl/`            | BullMQ workers: fixtures, results, stats, odds (live + CSV) |
| `betting-engine/` | Poisson model, EV calculation, pick selection, settlement   |
| `coupon/`         | Daily coupon generation, anti-correlation, scheduling       |
| `adjustment/`     | Calibration, auto-apply AdjustmentProposal, rollback        |
| `risk/`           | ROI alerts, market suspension, Brier alerts, weekly report  |
| `notification/`   | Email (SMTP) + in-app notifications                         |
| `fixture/`        | Fixture + OddsSnapshot storage                              |
| `rolling-stats/`  | Rolling form, xG, dom/ext performance, league volatility    |

### xG data hygiene

- `stats-sync` now treats `expected_goals: null` as unavailable data, not as `0`.
- When historical xG coverage is missing, rolling stats fall back to recent goals instead of persisting misleading `0/0` xG snapshots.

---

## Environment variables

Key variables (see `.env.example` for the full list):

```
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
API_FOOTBALL_KEY=<your-key>
API_FOOTBALL_DAILY_QUOTA=7500
API_FOOTBALL_QUOTA_ALERT_PCT=80
API_FOOTBALL_AVG_DAILY_FIXTURES_PER_LEAGUE=10
API_FOOTBALL_AVG_DAILY_STATS_FIXTURES_PER_LEAGUE=2

# Email (dev: Mailpit on port 1025)
SMTP_ENABLED=true
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=evcore@localhost
SMTP_TO=admin@localhost

# Feature flags
KELLY_ENABLED=false
ETL_SCHEDULING_ENABLED=false
COUPON_SCHEDULING_ENABLED=false
ODDS_SNAPSHOT_RETENTION_DAYS=30

# CORS (prod: restrict to frontend domain)
CORS_ORIGIN=https://c-evcore.com
```

### Rate-limit / quota tuning (10 leagues first prod)

- Keep `API_FOOTBALL_RATE_LIMIT_MS=6000` to avoid spikes.
- Use 10 active leagues with realistic assumptions:
  - `API_FOOTBALL_AVG_DAILY_FIXTURES_PER_LEAGUE=10`
  - `API_FOOTBALL_AVG_DAILY_STATS_FIXTURES_PER_LEAGUE=2`
- Estimated daily API calls: about `280/day` (`~3.7%` of a `7500/day` quota).
- The backend logs this estimate on startup and emits a warning when it crosses `API_FOOTBALL_QUOTA_ALERT_PCT`.

---

## Documentation

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| [EVCORE.md](EVCORE.md)     | Full product specification — architecture, model, constraints |
| [ROADMAP.md](ROADMAP.md)   | Implementation roadmap — phase-by-phase checklist             |
| [TODO.md](TODO.md)         | Current work plan and upcoming blocs                          |
| [COUPON.md](COUPON.md)     | Daily coupon generator specification                          |
| [OPENCLAW.md](OPENCLAW.md) | OpenClaw policy — stand-by post-prod + activation criteria    |
| [GRAFANA.md](GRAFANA.md)   | Grafana policy — stand-by post-prod + activation criteria     |
| [CLAUDE.md](CLAUDE.md)     | AI coding conventions (Claude Code)                           |

---

## Phase status

| Phase          | Status         | Key deliverable                                                          |
| -------------- | -------------- | ------------------------------------------------------------------------ |
| MVP Phase 1    | ✅ Complete    | Backtest validated — Brier 0.592, ROI +2.28%                             |
| Phase 2 Bloc 1 | ✅ Complete    | Live odds pipeline, multi-league ETL                                     |
| Phase 2 Bloc 2 | ✅ Complete    | ETL hardening, Kelly fractional                                          |
| Phase 2 Bloc 3 | ✅ Complete    | Daily coupon generator (204 tests)                                       |
| Phase 2 Bloc 4 | 🚧 In progress | Shadow data collection, auto-activation loop                             |
| Phase 2 Bloc 5 | ✅ Complete    | Coupon settlement, result notifications                                  |
| Phase 2 Bloc 6 | 🚧 In progress | HT/FT end-to-end livré, OpenClaw/Grafana stand-by post-prod, TimescaleDB |
