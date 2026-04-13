# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EVCore** is an autonomous, value-driven sports betting engine built around Expected Value (EV) mathematics. It is a disciplined probabilistic decision system — not a tip generator or AI chatbot. The system targets long-term ROI through deterministic data scoring (70%) refined by LLM context (30%), with the backend always acting as the final authority.

Read [EVCORE.md](EVCORE.md) for the full product specification before making any architectural decision.
Check [ROADMAP.md](ROADMAP.md) to know the current implementation state before adding or modifying any feature.

---

## Commands

This is a **pnpm monorepo** managed by Turborepo. Use `pnpm` (v9), not `npm` or `yarn`. Node >= 18 required.

```bash
pnpm dev           # Run all apps in dev mode (web :3000, docs :3001)
pnpm build         # Build all packages and apps
pnpm lint          # ESLint across all packages
pnpm format        # Prettier on all .ts, .tsx, .md files
pnpm typecheck     # TypeScript type-checking (no emit)
```

Scope a command to one package:

```bash
pnpm --filter backend dev
pnpm --filter @repo/ui build
```

Tests: Vitest (backend). Run with `pnpm --filter backend test`. No test framework on frontend yet.

---

## Architecture

### Monorepo Structure

```
apps/
  backend/    # NestJS API + Betting Engine (to be created)
  web/        # Next.js dashboard (port 3000)
  docs/       # Next.js docs (port 3001)
packages/
  ui/                # Shared React component library (@repo/ui)
  eslint-config/     # Shared ESLint configs (@repo/eslint-config)
  typescript-config/ # Shared TS configs (@repo/typescript-config)
```

### Backend Module Structure (NestJS)

```
apps/backend/src/
  modules/
    fixture/           # Fixtures + results
    betting-engine/    # EV scoring + decision
    etl/               # Data ingestion workers (BullMQ)
    model-run/         # ModelRun storage + audit
    adjustment/        # AdjustmentProposal + learning loop
    notification/      # Email (Nodemailer) + in-app notifications
  common/
    guards/
    interceptors/
    decorators/
    filters/
  config/              # All constants and env config
  prisma/              # Prisma client singleton
```

Each module follows: `*.module.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` → `dto/` → `entities/`

### System Data Flow

```
ETL Workers (BullMQ/Kestra)
        ↓ [Zod validated]
PostgreSQL (single source of truth)
        ↓
Betting Engine Service (deterministic 70%)
        ↓
OpenClaw (LLM delta, capped 30%) — Phase 2 only
        ↓
Backend Validation (authority)
        ↓
ModelRun stored + notification alert
```

### Component Responsibilities

| Component      | Role                                            | Never                          |
| -------------- | ----------------------------------------------- | ------------------------------ |
| ETL Workers    | Collect + normalize data                        | Infer or fill missing data     |
| PostgreSQL     | Historical truth                                | —                              |
| Betting Engine | Probabilistic scoring + EV                      | Call LLM for raw data          |
| Backend        | Validation, risk control, auto-apply + rollback | Bypass Zod or rate-limit rules |
| OpenClaw       | Contextual delta only                           | Be primary data source         |

---

## Coding Conventions

### TypeScript

- `strict: true` and `noUncheckedIndexedAccess: true` are enforced — never disable them
- No `any`. Use `unknown` then narrow, or define a proper type
- Explicit return types on all public service/repository methods
- Prefer `type` over `interface` for data shapes; use `interface` only for class contracts
- Use `const` assertions for config objects: `{ EV_THRESHOLD: 0.08 } as const`

### Naming

| Element             | Convention                  | Example                     |
| ------------------- | --------------------------- | --------------------------- |
| Files               | kebab-case                  | `betting-engine.service.ts` |
| Classes             | PascalCase                  | `BettingEngineService`      |
| Interfaces/Types    | PascalCase                  | `ModelRunOutput`            |
| Variables/functions | camelCase                   | `calculateEV()`             |
| Constants           | UPPER_SNAKE_CASE            | `EV_THRESHOLD`              |
| Env vars            | UPPER_SNAKE_CASE            | `DATABASE_URL`              |
| DB tables           | snake_case (Prisma default) | `model_run`                 |

### NestJS Patterns

- **Controllers**: routing and DTO validation only — zero business logic
- **Services**: all business logic — call repositories, never Prisma directly
- **Repositories**: all Prisma queries — one repository per Prisma model
- **Guards**: authentication and authorization
- **Interceptors**: logging, response transformation
- Use `class-validator` decorators on DTOs for request validation
- Use `ConfigService` for all env variable access — never `process.env` directly in services

### Validation

- **Zod** for all external data (ETL ingestion, third-party API responses, OpenClaw output)
- **class-validator** for all NestJS DTO (inbound HTTP requests)
- Validate at system boundaries only — trust internal service calls
- If Zod parse fails on ETL data: reject the entire payload, log with full context, trigger notification alert

### Secrets handling

- Never read or print secret env files: `.env`, `.env.*` (except `.env.example`)
- Never exfiltrate, log, or commit API keys, passwords, tokens, or connection strings
- If a task requires a secret value, ask the user to provide it explicitly instead of opening secret files

### Arithmetic

- **Never use native `number` for odds, EV, probabilities, or bankroll calculations**
- Use `decimal.js` for all odds and EV math
- Probability values must always be in `[0, 1]` — assert this at ingestion
- EV formula: `EV = (probability × odds) - 1` — defined once in `config/ev.constants.ts`, never inline

---

## EVCore-Specific Rules

These rules reflect the product specification in EVCORE.md and must never be bypassed.

### Hard constraints (backend enforces, never client)

- EV threshold: `≥ 0.08` — defined in config, never hardcoded inline
- OpenClaw weight cap: `≤ 0.30` — enforced server-side, never trust frontend or LLM output
- Weight adjustment: minimum 50 bets on market, maximum 5% change per week
- Market suspension: automatic at ROI < -15% over 50+ bets — never manual shortcut
- `AdjustmentProposal` is **auto-applied** by the backend when calibration triggers; humans see the applied proposal and can rollback via `POST /adjustment/:id/rollback`
- Rollback rate-limit: one auto-apply per 7 days per market (enforced server-side)

### Decisions that require human approval

- Rolling back an auto-applied `AdjustmentProposal`
- Reactivating a suspended market
- Changing EV threshold
- Introducing OpenClaw into the scoring loop (not before MVP validation)
- Manually disabling a factor auto-activé par la boucle d'apprentissage (rollback via `AdjustmentProposal`)

### What AI must never generate in this codebase

- Code that lets LLM output bypass Zod schema validation
- Kelly criterion formula (not before Phase 2 config flag is set)
- Auto-reactivation of suspended markets
- Direct Prisma calls outside of repository files
- Hardcoded numeric thresholds that belong in `config/`
- Weight adjustment logic that bypasses the 50-bet minimum check

---

## ETL Rules

- Each BullMQ job validates its payload with Zod **before any DB write** — partial data is rejected entirely
- Respect rate limits: FBref 1 req/3s, Understat custom delay
- Every `ModelRun` must log: `fixture_id`, `features`, `deterministic_score`, `llm_delta` (if any), `final_score`, `decision`
- `odds_snapshot` is mandatory in phase live — `decision: NO_BET` if missing
- Fixture marked `POSTPONED` → no `ModelRun` generated

---

## Testing

- Test files colocated with source: `fixture.service.spec.ts` next to `fixture.service.ts`
- Unit test all service methods — mock repositories
- Zod schema tests for every ETL validator (test valid + invalid + edge cases)
- No mocking of Prisma client directly — use a test database with Vitest
- EV calculation functions must have deterministic unit tests with known inputs/outputs

---

## Phase Boundaries

Before adding any feature, verify it belongs to the current phase:

| Feature                                    | Phase                          |
| ------------------------------------------ | ------------------------------ |
| Historical import, backtest, calibration   | MVP                            |
| Odds integration, EV simulation, live data | Phase 2                        |
| OpenClaw integration                       | Phase 2 (after MVP validation) |
| Grafana dashboards, TimescaleDB            | Phase 2                        |
| Kelly criterion, multi-league              | Phase 2                        |
| Python worker (scikit-learn calibration)   | Phase 3                        |
| ML model (XGBoost), Monte Carlo            | Phase 3                        |
| SaaS, multi-tenant                         | Phase 4                        |

If asked to implement something from a future phase, flag it and ask for confirmation.

## next.js

Next.js ships version-matched documentation inside the next package, allowing AI coding agents to reference accurate, up-to-date APIs and patterns. An AGENTS.md file at the root of your project directs agents to these bundled docs instead of their training data.

node_modules/next/dist/docs/
├── 01-app/
│ ├── 01-getting-started/
│ ├── 02-guides/
│ └── 03-api-reference/
├── 02-pages/
├── 03-architecture/
└── index.mdx
