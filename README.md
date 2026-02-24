# EVCore

> Autonomous value-driven sports betting engine built around Expected Value (EV) mathematics.

EVCore is a disciplined probabilistic decision system — not a tip generator. It targets long-term ROI through deterministic data scoring, calibrated over time, with the backend always acting as the final authority.

**Domain:** evcore.live

---

## What it does

- Collects historical football data (fixtures, results, xG) from multiple open sources
- Computes match probabilities using a Poisson model weighted by 4 deterministic features
- Identifies value bets where `EV = (probability × odds) − 1 ≥ 8%`
- Tracks performance metrics (Brier Score, ROI, drawdown) and self-calibrates over time
- Sends alerts via Slack/Email when EV opportunities or anomalies are detected

**Phase 1 scope:** Premier League only, historical data, no live odds.

---

## Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Monorepo      | pnpm + Turborepo                      |
| Backend       | NestJS + TypeScript                   |
| Database      | PostgreSQL + Prisma                   |
| Queues        | BullMQ + Redis                        |
| Orchestration | Kestra                                |
| Validation    | Zod + class-validator                 |
| Math          | jStat, decimal.js, simple-statistics  |
| Notifications | Novu (self-hosted)                    |
| Infra         | Docker Compose, Nginx, GitHub Actions |

---

## Getting started

**Requirements:** Node.js >= 18, pnpm 9

```bash
# Install dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Build all packages
pnpm build

# Lint
pnpm lint

# Type-check
pnpm typecheck
```

Start a specific app:

```bash
pnpm --filter backend dev
pnpm --filter web dev
```

Start the full stack (backend + DB + Redis + Novu):

```bash
docker compose up -d
```

Default service endpoints:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Novu Dashboard: `http://localhost:4000`
- Novu API: `http://localhost:3010`
- Novu WS: `http://localhost:3012`

---

## Project structure

```
apps/
  backend/    # NestJS API — Betting Engine, ETL workers, validation
  web/        # Next.js dashboard
  docs/       # Next.js documentation
packages/
  ui/                # Shared React component library
  eslint-config/     # Shared ESLint rules
  typescript-config/ # Shared TypeScript configs
```

---

## Documentation

| File                                                               | Purpose                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [EVCORE.md](EVCORE.md)                                             | Full product specification — architecture, model, stack, constraints |
| [ROADMAP.md](ROADMAP.md)                                           | Implementation roadmap with milestones and weekly checkboxes         |
| [CLAUDE.md](CLAUDE.md)                                             | AI coding conventions (Claude Code)                                  |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | AI coding conventions (GitHub Copilot)                               |

---

## Milestones

| Milestone                                          | Due          |
| -------------------------------------------------- | ------------ |
| `mvp-foundations` — Setup monorepo, DB, Docker, CI | 28 fév 2026  |
| `mvp-month-1` — ETL, model, backtest               | 14 mars 2026 |
| `mvp-month-2` — Odds, EV, simulation               | 31 mars 2026 |
| `mvp-month-3` — Automation, learning, validation   | 8 avr 2026   |
| `phase-2` — Live odds, OpenClaw, Grafana           | 31 mai 2026  |
