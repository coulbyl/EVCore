# EVCore

> Autonomous value-driven sports betting engine built around Expected Value (EV) mathematics.

EVCore is a disciplined probabilistic decision system — not a tip generator. It targets long-term ROI through deterministic data scoring, calibrated over time, with the backend always acting as the final authority.

**Status:** Phase 2 in progress — live odds pipeline operational, daily coupon generator active.

---

## What it does

- Collects live and historical football data (fixtures, results, xG, odds) via API-Football
- Computes match probabilities using a Poisson model weighted by 4 deterministic features
- Evaluates all markets (1X2, Over/Under 2.5, BTTS, Double Chance, 12 combo-match pairs) for value bets where `EV ≥ 8%`
- Applies fractional Kelly (0.25×) for stake sizing
- Generates a daily coupon of up to 6 legs ranked by `qualityScore = EV × deterministicScore`
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
pnpm --filter backend test  # Vitest unit tests (204 tests)
```

Default service endpoints:

| Service    | URL                     |
| ---------- | ----------------------- |
| Backend    | `http://localhost:3000` |
| PostgreSQL | `localhost:5432`        |
| Redis      | `localhost:6379`        |
| Mailpit UI | `http://localhost:8025` |

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

---

## Environment variables

Key variables (see `.env.example` for the full list):

```
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
API_FOOTBALL_KEY=<your-key>

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
```

---

## Documentation

| File                     | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| [EVCORE.md](EVCORE.md)   | Full product specification — architecture, model, constraints |
| [ROADMAP.md](ROADMAP.md) | Implementation roadmap — phase-by-phase checklist             |
| [TODO.md](TODO.md)       | Current work plan and upcoming blocs                          |
| [COUPON.md](COUPON.md)   | Daily coupon generator specification                          |
| [CLAUDE.md](CLAUDE.md)   | AI coding conventions (Claude Code)                           |

---

## Phase status

| Phase          | Status      | Key deliverable                              |
| -------------- | ----------- | -------------------------------------------- |
| MVP Phase 1    | ✅ Complete | Backtest validated — Brier 0.592, ROI +2.28% |
| Phase 2 Bloc 1 | ✅ Complete | Live odds pipeline, multi-league ETL         |
| Phase 2 Bloc 2 | ✅ Complete | ETL hardening, Kelly fractional              |
| Phase 2 Bloc 3 | ✅ Complete | Daily coupon generator (204 tests)           |
| Phase 2 Bloc 4 | 🔲 Next     | Shadow data collection, auto-activation loop |
| Phase 2 Bloc 5 | 🔲 Planned  | Coupon settlement, result notifications      |
| Phase 2 Bloc 6 | 🔲 Planned  | OpenClaw (LLM delta), Grafana, TimescaleDB   |
