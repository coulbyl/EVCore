# vantage-worker

**VANTAGE** is EVCore's 20th channel — the only one whose decisions come from an LLM instead of deterministic math. It reads every other channel's decision on a match, plus each channel's measured reliability on that competition, and forms its own independent pick. It never adjusts anyone else's score, never picks by default, and is admitted into the coupon composer through the exact same calibration process every other channel already goes through — no special status.

Full rationale, guardrails, and rollout plan: [`docs/architecture.md`](docs/architecture.md). This file is the "how to run it" reference.

## Why a separate app

VANTAGE calls an LLM (Groq) — network I/O, non-deterministic by nature. The rest of the betting engine (`@evcore/analysis-core`) is a pure, synchronous, side-effect-free package by design (see its own `architecture.guard.spec.ts`). VANTAGE cannot live inside it, so it runs as its own process — same pattern as `apps/ml-worker`: its own Dockerfile, its own lifecycle, talking to the shared Postgres database and BullMQ/Redis broker, never touching the backend's request path. The backend does not know VANTAGE exists while it's running; it only sees the `channel_decision` rows VANTAGE writes, same as any other channel.

Unlike `ml-worker`, VANTAGE is written in TypeScript and imports `@evcore/db` and `@evcore/analysis-core` directly — no reimplemented enum catalogs, no drift risk between what a channel means here and what it means in the pure core.

## Prerequisites

- The `VANTAGE` value must exist in the database's `StrategyChannel` enum (see [Setup](#setup) — this is a schema migration, run once, not part of normal deploys).
- A Groq API key with access to `openai/gpt-oss-120b` (or whatever `GROQ_MODEL` you configure).
- The same Postgres and Redis instances the rest of EVCore already uses.

## Setup

1. Copy `.env.example` to `.env` and fill in `GROQ_API_KEY`.
2. Apply the schema change that adds `VANTAGE` to the `StrategyChannel` enum. **Run this yourself** — per project convention, migrations are never run by an agent:
   ```bash
   pnpm --filter @evcore/db db:migrate
   ```
   (This picks up the `VANTAGE` value already added to `packages/db/prisma/schema.prisma`.)
3. Install and run:
   ```bash
   pnpm install
   pnpm --filter vantage-worker dev
   ```

## What it does, in one loop

1. **Sweep** (every `SWEEP_INTERVAL_MS`, default 5 min): finds fixtures within the next 48h (or the last 2h) that have at least one non-VANTAGE channel decision and no VANTAGE decision yet. Runs on **every active competition by default** (`VANTAGE_COMPETITION_CODES` empty) — the verdict-only pipeline costs ~$1/month even at full volume, so there's no reason to restrict it. Enqueues one BullMQ job per fixture.
2. **Research** (optional, `VANTAGE_ENABLE_RESEARCH=true`): a search call (`VANTAGE_RESEARCH_PROVIDER` — `groq` for `groq/compound-mini`'s native web search, or `tavily` for a direct Tavily `/search` call, independent of any LLM provider) searches the web for team news/injuries/enjeu before the verdict call — but only for fixtures in `VANTAGE_RESEARCH_COMPETITION_CODES`, which defaults to "les grands championnats" (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Europa Conference League), independently of the verdict pipeline's own (unrestricted) league scope. OFF by default — unlike the verdict call, search is billed per-request and does add up at full volume. See `docs/architecture.md` — Situational research.
3. **Analyze** (one job per fixture): reads that fixture's channel decisions + each channel's calibration on that competition (+ the research summary, if enabled), asks Groq for a structured verdict, validates the response against a Zod schema (and a second pass checking the pick is legal for its market), and — only if it passes both — writes a `ChannelDecision` + `ChannelSelection` row with `channel: VANTAGE`. An invalid response is logged and dropped, never persisted half-formed.

Both steps are idempotent: re-running a sweep or replaying a job for a fixture that already has a VANTAGE decision just overwrites it (same `(modelRunId, channel)` uniqueness every channel already has).

## Commands

```bash
pnpm dev         # long-running worker + self-scheduled sweep
pnpm build       # tsc -> dist/
pnpm start       # run the built worker (dist/main.js)
pnpm sweep       # run one sweep and exit — for an external cron instead of the worker's own scheduler
pnpm test        # vitest — pure logic only (schema validation, pick legality); no DB/network needed
pnpm typecheck
pnpm lint
```

## Docker

```bash
docker build -t vantage-worker -f apps/vantage-worker/Dockerfile .
docker run --env-file apps/vantage-worker/.env vantage-worker
```

**Dev compose** — opt-in, not part of a bare `docker compose up` (avoids failing every service in the file over a missing `GROQ_API_KEY`):

```bash
GROQ_API_KEY=... docker compose --profile vantage up -d vantage-worker
```

**Prod** — already wired: `docker-compose.prod.yml` runs it against the same Postgres/Redis as `backend`, and `.github/workflows/deploy.yml` builds and pushes `ghcr.io/<owner>/evcore-vantage-worker` on every deploy alongside the other images. Set `GROQ_API_KEY` (and any `VANTAGE_*`/`GROQ_*` override) in the server's `.env` before the first deploy — it's a required var there, same treatment as `POSTGRES_PASSWORD`.

## Cost

All 68 active competitions, verdict only (`VANTAGE_ENABLE_RESEARCH=false`, the default): **~$0.75–1.40/month**. With web search on for the default 8 "grands championnats" only: **~$1.50–2/month** more. Widening research to all 68 leagues would add **~$10–20/month** instead — search is billed per-request, not per-token, so it doesn't stay negligible at scale the way the verdict call does. See `docs/architecture.md` — Cost / Situational research for the full breakdown.
