# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EVCore** is an autonomous, probability-driven sports betting engine. It analyses and proposes — it never places a bet on a user's behalf.

**20 strategies** run per fixture (`V1_STRATEGIES`, `packages/analysis-core/src/strategies/registry.ts`), grouped by the generating process that feeds them rather than by market (`docs/prediction-engine-families.md`):

- **16 Phase-1 market channels**: full-match Poisson (DOMINANT, GOALS, BTTS, DOUBLE_CHANCE, TEAM_TOTAL, CLEAN_SHEET, CORRECT_SCORE, RESULT_TOTAL_GOALS, RESULT_BTTS, DRAW_NO_BET, WIN_TO_NIL), first-half distribution (FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME, WIN_EITHER_HALF) and market-implied (DRAW).
- **2 Phase-2 filters**, VALUE and SAFE: not independent scanners, they re-select among Phase-1 decisions. They keep running for observation only — no bet, no display since 2026-09-03.
- **2 Phase-3 meta-channels**, CONSENSUS and AVOID, which emit no pick of their own. CONTRARIAN is declared in the enum but deliberately **not implemented** (no edge in disagreeing with the market, study of 2026-06-23); UNDERDOG, FAVORITE, LIVE_VALUE and MARKET_MOVE are enum leftovers that never run (`UNIMPLEMENTED_STRATEGY_CHANNELS`).

Two more channels sit outside the engine: **VANTAGE** (the LLM's own pick, the player's "Avis IA", run by `apps/vantage-worker` after every other channel has decided) and **PRICE** (no probability, it only composes already-priced legs by market cost).

Channel naming is always the English code (`DRAW`, `SAFE`, `BTTS`, `DOUBLE_CHANCE`) — the old French tags (NUL, SV, BB, CONF) are retired everywhere in code. The word "canal" is never shown to a player; the admin keeps channels.

It is a disciplined probabilistic decision system — not a tip generator or AI chatbot. Scoring is **100% deterministic**: no LLM output enters the score (`model_run.llmDelta` is always null). The only LLM is VANTAGE, in `apps/vantage-worker`; `apps/backend` is LLM-agnostic. The backend is always the final authority.

⚠️ **Five measured results that override older intuitions in this repo** (audit 2026-08-22, `docs/audits/2026-08-22/audit-canaux-investir.md`):

- **Claimed edge (`p − 1/odds`) is anti-predictive.** Across 51 860 settled selections the realised rate is flat (0.511 → 0.375) while the announced rate climbs from 0.481 to 0.699. It is now used as a **ceiling** (`MAX_LEG_EDGE = 0.10`), never as a selection floor, and ranking is done on calibrated probability. Treat any `EV ≥ 8%` framing found elsewhere in the docs as historical.
- **Coupon ROI has no statistical power** at current volumes (SE 13–18 points for 10-point differences). The learning loop runs at the **leg** level. Never conclude from a coupon-level ROI.
- **The engine is behind the market** (audit 2026-09-16, `docs/journal-experiences.md`). Brier 0.63874 against the market's 0.59920 over 3 633 fixtures (+0.0395 ± 0.0080), and the optimal weight of the engine in a blend with the price is **0%**, degrading monotonically. `EV = p × odds − 1` assumes `p` beats the price; it does not. Any new feature is judged on the **residual** — the gap between realised and market-implied — never on absolute Brier.
- **Searching more markets does not create edge.** Settling the engine's full opportunity space (1.67M evaluated picks, 17 markets, every fixture) shows every market negative, −4.40% to −12.17%. Competition × market does **not** persist across disjoint periods (correlation −0.022 over 160 cells); what persists strongly (+0.696) is how much each market **costs**. Rank legs on measured price, never on "most likely to land" — that is the EV rule, and it is an over-estimation detector.
- **Leg calibration collapses above odds 1.80** (388 settled LLM legs): realised/announced 0.899 below 1.45, 0.836 from 1.45 to 1.80, **0.619 above**. Inside a band no channel stands out. Cut on odds, never on channel.

Coupons are composed by the backend (`apps/backend/src/modules/coupon`, classes in `packages/analysis-core/src/coupon/coupon-classes.ts`) and separated by `coupon_proposal.source`:

- `PRICE_COMPOSER`: Favori du jour (`FAVOURITE`, one leg 1.20–1.35), Coupon cote 2 (`DOUBLE`), the hunters (`HUNTER_BTTS`, `HUNTER_DRAW`, `HUNTER_HT_DRAW`, `HUNTER_CORNERS`) and the Combiné IA (`AI_COMBO`, legs 1.45–1.80, combined 4–10, composed from the AI's played opinions).
- `ENGINE`: Combiné du jour (`COMBO`, since 2026-11-05 two match readings, one per league, 1.30–1.80 at 1xBet, combined 1.80–2.60, ranked on the market's frequency, `engine-combo-v3`) and the Chasseur Score exact (`HUNTER_SCORE`).
- `LLM`: no longer written — the LLM combo was cut on 2026-11-03; old rows stay for history.

The price coupon 5–15 (`UNIQUE`) and the engine long coupon (`LONG`) are no longer written since 2026-11-04; their old rows stay visible to admins in Résultats. Compare products **per leg**, never by coupon ROI.

Read [EVCORE.md](EVCORE.md) for the current product specification before making any architectural decision (the original v1 spec is archived in `docs/archive/EVCORE-spec-v1.md`, history only).
Check [ROADMAP.md](ROADMAP.md) for the current state and the open work before adding or modifying any feature.

## Database access

The PostgreSQL database runs in Docker. **Never use `psql` directly or `prisma db execute`** — they are not available in this environment.

Always use:

```bash
docker exec evcore-postgres psql -U postgres -d evcore -c "YOUR SQL HERE"
```

Column names in this project use camelCase in Postgres (Prisma default). Always quote them: `"scheduledAt"`, `"couponProposalId"`, `"isCorrect"`, etc.

### Never count `channel_selection` raw

A fixture is re-analysed 5 to 7 times before kickoff and **each run writes its
own row**. Counting the table directly reports 182 744 selections where 33 197
real bets exist: standard errors are divided by ~2.4 and fully correlated
blocks pass for a sample. It has already produced a false result (a channel
read +6.0% per leg over "1 559 selections"; deduplicated it is 216 bets with a
confidence interval from −9.9% to +21.2%).

Use the `channel_selection_deduped` view, or reproduce both of its filters:

```sql
SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick) ...
WHERE mr."analyzedAt" < f."scheduledAt"   -- exclut ~48 000 rétro-analyses
ORDER BY cd.channel, mr."fixtureId", cs.market, cs.pick,
         mr."analyzedAt" DESC, cs.id DESC
```

### Odds carry a line

`odds_snapshot.line` holds the market line where it is part of the price
identity (Asian Handicap: the same `pick` exists at ten handicaps on one
fixture). It is in the unique constraint. Markets added before 2026-09-15 keep
their line encoded in `pick` (`OVER_1_5`) and leave the column null — never
parse a line out of `pick` for a market that has the column.

`odds_closing_line` and `odds_opening_line` expose the last and first
pre-kickoff price per fixture, bookmaker, market, pick and line. **Always
filter on `hoursBeforeKickoff`**: a last snapshot 24 hours out is not a
closing line.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work:

1. Identify the feature involved.
2. Read the relevant doc in `node_modules/next/dist/docs/`.
3. Follow the bundled docs over model memory if they differ.

Use the local Next.js docs as the source of truth for:

- App Router
- Server vs Client Components
- data fetching and caching
- routing and navigation
- metadata
- middleware
- configuration

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:shadcn-agent-rules -->

# shadcn/ui: ALWAYS check project context before coding

Before any shadcn/ui work:

1. Read `.agents/skills/shadcn/SKILL.md`.
2. Run `pnpm dlx shadcn@latest info --json` to inspect the current project context.
3. Run `pnpm dlx shadcn@latest docs <component>` for every component you plan to add, modify, or compose.
4. Prefer existing shadcn components and built-in variants over custom markup.

Follow these rules:

- Use semantic tokens and component variants instead of raw Tailwind colors.
- Use `gap-*` instead of `space-x-*` / `space-y-*`.
- Use existing shadcn composition patterns before building custom wrappers.
- Never overwrite existing shadcn components blindly; preview updates with `--dry-run` and `--diff`.

<!-- END:shadcn-agent-rules -->

<!-- BEGIN:tanstack-table-agent-rules -->

# TanStack Table: ALWAYS align with repo patterns before coding

Before any TanStack Table work:

1. Inspect current table usage in this repo and the surrounding feature UI.
2. Read the relevant TanStack Table documentation for the feature being implemented.
3. Design the table API around reusable column definitions and feature flags, not one-off page markup.

Use TanStack Table for:

- sorting
- column visibility
- expandable rows
- pagination
- responsive table-to-card fallbacks

Do not:

- rebuild sorting or row state manually with ad hoc React state if TanStack already provides the model
- mix business logic into cell renderers when it belongs in selectors, formatters, or feature components
- hardcode mobile/desktop table variants separately when one shared table model can drive both

<!-- END:tanstack-table-agent-rules -->

---

## Commands

This is a **pnpm monorepo** managed by Turborepo. Use `pnpm` (v10, `packageManager` in `package.json`), not `npm` or `yarn`. Node >= 22 required.

```bash
pnpm dev           # All apps in dev mode: web :3000, backend API :3001 + backend worker (dev:worker)
pnpm build         # Build all packages and apps
pnpm lint          # ESLint across all packages
pnpm format        # Prettier on all .ts, .tsx, .md files
pnpm typecheck     # TypeScript type-checking (no emit)
```

Scope a command to one package:

```bash
pnpm --filter backend dev          # API only; worker: pnpm --filter backend dev:worker
pnpm --filter @evcore/ui build
```

Tests:

- Vitest: `pnpm --filter backend test`, `pnpm --filter @evcore/analysis-core test`, `pnpm --filter @evcore/backtest-core test`, `pnpm --filter vantage-worker test`.
- Web: Playwright e2e in `apps/web/e2e` (`pnpm --filter web e2e`) and `node --test` helpers (`pnpm --filter web test:unit`).
- ml-worker: `pytest` in `apps/ml-worker`.

---

## Architecture

### Monorepo Structure

```
apps/
  backend/         # NestJS, two processes: main.ts (HTTP API, :3001) + main.worker.ts (BullMQ workers)
  web/             # Next.js app, player + admin (port 3000)
  vantage-worker/  # The only LLM in the repo: VANTAGE opinions ("Avis IA"), Groq/Cerebras/Together/Fireworks
  ml-worker/       # Python (Phase 3 groundwork); its shadow correction is off (ML_CORRECTION: false)
packages/
  analysis-core/     # @evcore/analysis-core — pure engine: probabilities, strategies, coupon classes and composers, settlement, EV math
  backtest-core/     # @evcore/backtest-core — point-in-time replays and backtest scripts
  db/                # @evcore/db — Prisma schema, migrations, generated client
  transactional/     # @evcore/transactional — React Email templates
  ui/                # @evcore/ui — shared React components
  eslint-config/     # @evcore/eslint-config
  typescript-config/ # @evcore/typescript-config
```

### Backend Module Structure (NestJS)

```
apps/backend/src/
  main.ts / app.module.ts            # HTTP API process
  main.worker.ts / worker.module.ts  # worker process (ETL, analysis, coupons, settlement, push)
  modules/
    etl/              # API-Football ingestion workers (BullMQ), odds, stats, squads
    fixture/          # Fixtures + results
    betting-engine/   # Deterministic scoring, channel decisions, ModelRun
    coupon/           # Daily coupon generation, settlement, follows
    adjustment/       # AdjustmentProposal + learning loop (auto-apply + rollback)
    risk/             # Automatic market suspension
    odds-archive/     # Monthly Parquet archive of odds_snapshot (RustFS)
    notification/     # In-app notifications
    mail/             # Email via Resend (templates in packages/transactional)
    push/             # Web push
    app-setting/      # Operating settings editable from the admin screen
    …                 # auth, admin-*, announcements, support, console, screens, …
  common/             # guards, interceptors, decorators, filters
  config/             # Constants and env schema (env = secrets + addresses only)
```

Each module follows: `*.module.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` → `dto/`

### System Data Flow

```
ETL workers (BullMQ, API-Football + CSV imports)
        ↓ [Zod validated]
PostgreSQL 18 (single source of truth; odds_snapshot partitioned by month,
               closed months archived as Parquet on RustFS)
        ↓
Betting engine (deterministic, @evcore/analysis-core)
        ↓
ModelRun + channel_decision / channel_selection
        ↓
Daily coupon generation (PRICE_COMPOSER, ENGINE) → settlement → notifications

VANTAGE (apps/vantage-worker) reads the decisions and writes its own opinion
next to them — never into the score.
```

### Component Responsibilities

| Component      | Role                                            | Never                          |
| -------------- | ----------------------------------------------- | ------------------------------ |
| ETL Workers    | Collect + normalize data                        | Infer or fill missing data     |
| PostgreSQL     | Historical truth                                | —                              |
| Betting Engine | Probabilistic scoring + decisions               | Call an LLM                    |
| Backend        | Validation, risk control, auto-apply + rollback | Bypass Zod or rate-limit rules |
| VANTAGE        | Its own opinion, shown as "Avis IA"             | Feed the engine's score        |

---

## Coding Conventions

### ESLint — règles critiques

**Backend** (`--max-warnings 0`) — zéro tolérance, tout warning bloque le build :

- `max-params` : **3 paramètres maximum** par fonction/méthode. Au-delà, regrouper en un objet options : `function foo(opts: { a, b, c, d })` — jamais 4 paramètres positionnels. Seule exception : un constructeur d'injection NestJS (pas d'objet d'options possible), avec `// eslint-disable-next-line max-params -- <raison>`.
- `no-unused-vars` : tout import ou variable non utilisé doit être supprimé avant commit.

**Frontend web** (`--max-warnings 3` dans `apps/web/package.json`) — le lint passe aujourd'hui sans aucun warning ; la marge de 3 n'est pas un quota, ne pas en ajouter.

- `no-unused-vars` : même règle — supprimer les imports inutiles immédiatement.

**Avant chaque commit** : toujours lancer `pnpm lint` pour vérifier les deux apps.

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

### React / Next.js Page Components

When a `*-page-client.tsx` file grows beyond one or two internal components, **extract each function component into its own file** inside the collocated `components/` directory:

- `*-constants.ts` — shared constants and pure utility functions (no JSX, no `"use client"`)
- `result-badge.tsx`, `slip-button.tsx`, … — one file per component
- The page client keeps **only**: data fetching hooks, routing/navigation state, and top-level layout

Rules:

- Add `"use client"` only to files that use hooks or browser APIs — pure JSX files don't need it
- Each file imports only what it directly uses — no barrel re-exports
- Shared display logic (e.g. `formatPct`, canal color maps) goes in a `*-constants.ts` sibling, not inlined in multiple components
- Components that belong to a single page live in that page's `components/` folder; components used across pages live in `apps/web/components/`

### NestJS Patterns

- **Controllers**: routing and DTO validation only — zero business logic
- **Services**: all business logic — call repositories, never Prisma directly
- **Repositories**: all Prisma queries — one repository per Prisma model
- **Guards**: authentication and authorization
- **Interceptors**: logging, response transformation
- Use `class-validator` decorators on DTOs for request validation
- Use `ConfigService` for all env variable access — never `process.env` directly in services

### Validation

- **Zod** for all external data (ETL ingestion, third-party API responses, LLM output in `apps/vantage-worker`)
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
- EV formula: `EV = (probability × odds) - 1` — defined once in `calculateEV()` (`packages/analysis-core/src/ev/ev-math.ts`); EV constants (`EV_THRESHOLD`, …) live in `apps/backend/src/modules/betting-engine/ev.constants.ts`. Never inline

---

## EVCore-Specific Rules

These rules reflect the product specification in [EVCORE.md](EVCORE.md) and must never be bypassed.

### Hard constraints (backend enforces, never client)

- EV threshold: `≥ 0.08` — defined in config, never hardcoded inline. Still gates the VALUE channel, but **it is no longer a quality signal**: see the anti-predictive edge result in the overview. Coupon composition applies `MAX_LEG_EDGE = 0.10` as a ceiling on top of it, which is the exact complement, and VALUE no longer stakes or shows. Do not add new selection logic keyed on EV or edge.
- No LLM output enters the score. If one ever does, it is capped at `0.30` server-side (never trust frontend or LLM output) and needs a human decision first
- Weight adjustment: minimum 50 bets on market, maximum 5% change per week
- Market suspension: automatic at ROI < -15% over 50+ settled legs — measured on `channel_selection_deduped` over a trailing 90 days (never the `bet` table), with the loss established (95 % upper bound of the ROI below zero) so a bad week alone suspends nothing — never manual shortcut
- `AdjustmentProposal` is **auto-applied** by the backend when calibration triggers; humans see the applied proposal and can rollback via `POST /adjustment/:id/rollback`
- Rollback rate-limit: one auto-apply per 7 days per market (enforced server-side)

### Decisions that require human approval

- Rolling back an auto-applied `AdjustmentProposal`
- Reactivating a suspended market
- Changing EV threshold
- Introducing any LLM output into the scoring loop
- Manually disabling a factor auto-activé par la boucle d'apprentissage (rollback via `AdjustmentProposal`)

### Money, settlement and totals — review expectations

Measured mistakes from the PR #275 review (2026-10-28). Full list, cases and fixing commits in [docs/review-expectations.md](docs/review-expectations.md); read it before touching settlement, results, follows or a scheduled job. The user bankroll and slips (`bankroll_transaction`, `bet_slip`) were removed on 2026-10-31; the rules still hold for what settles today (`bet`, `coupon_proposal` and its legs, `coupon_follow`, digests).

- **Every settlement write must survive a replay.** Settlement re-runs on every pass: count, credit or notify on a _transition_ to settled, never on a state, and test both a second pass and a post-settlement correction (WON → VOID, LOST → WON).
- **A count and the amounts next to it cover the same set.** "N coupons réglés, X gagnés": X comes from those N only; a pending coupon is "encore en jeu", never counted as settled.
- **Unknown is not zero.** A value that cannot be computed (a win without recorded odds) is excluded and counted apart, never shown as 0 or as a loss — the same rule in every calculator of the domain.
- **A dated job must handle late arrivals.** Key on "not yet reported" (record what was reported) over a sliding window, never on the date window alone.
- **Decimal products too.** Odds and probability products used in comparisons or stored go through `decimal.js`; convert to `number` only at the Prisma/API boundary.
- **Derived values travel with their source.** Borrowing odds from another record means borrowing their frequency from the same record.
- **Mocks carry the real shape** of the row (a bet always has a `status`).
- **Before a PR to main**, run `/code-review` (`high` for money, settlement or scheduled jobs) and fix every correctness finding before merging.

### What AI must never generate in this codebase

- Code that lets LLM output bypass Zod schema validation
- Kelly staking — removed (`KELLY_ENABLED` is in `RETIRED_ENV`, `apps/backend/src/config/env.schema.ts`); bringing it back needs a new human decision
- Auto-reactivation of suspended markets
- Direct Prisma calls outside of repository files — including in a service that already has some: when you touch it, move its queries to a repository instead of adding one more
- Hardcoded numeric thresholds that belong in `config/`
- Weight adjustment logic that bypasses the 50-bet minimum check

---

## ETL Rules

- Each BullMQ job validates its payload with Zod **before any DB write** — partial data is rejected entirely
- Respect the rate limits in `apps/backend/src/config/etl.constants.ts` (`API_FOOTBALL_RATE_LIMIT_MS`, `STATS_RATE_LIMIT_MS`, …); API-Football Pro plan, 7 500 calls a day
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

| Feature                                                                                                           | Status                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical import, backtest, calibration                                                                          | MVP — done                                                                                                                                                              |
| Odds integration (11 books), EV simulation, live data                                                             | Phase 2 — done                                                                                                                                                          |
| Automatic market suspension, auto-applied adjustments + rollback                                                  | Phase 2 — done                                                                                                                                                          |
| OpenClaw / LLM delta in the score                                                                                 | Abandoned — the only LLM is VANTAGE, outside the score                                                                                                                  |
| Grafana dashboards, TimescaleDB                                                                                   | Abandoned — replaced by monthly partitioning of `odds_snapshot` + Parquet archive (RustFS) and the admin console                                                        |
| Kelly criterion                                                                                                   | Removed (`KELLY_ENABLED` retired) — needs a new human decision                                                                                                          |
| Multi-league                                                                                                      | Done                                                                                                                                                                    |
| Python worker (scikit-learn calibration), ML shadow correction                                                    | Built, then retired from the decision path (`ML_CORRECTION: false`, `docs/audits/2026-10-29/ML-UTILITE.md`)                                                             |
| Market grid as engine input + ML for what the price does not say (half-time, corners, learned margin, dependence) | Phase 3, redefined 2026-10-29 (`docs/audits/2026-10-29/ML-V2-PROPOSITION.md`); judged on the residual vs Pinnacle, never on absolute Brier; no ML call at analysis time |
| Multi-sport (`docs/multi-sport-extension.md`), Loto (`loto.md`)                                                   | Future, not planned                                                                                                                                                     |
| SaaS, multi-tenant                                                                                                | Phase 4 — future                                                                                                                                                        |

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
