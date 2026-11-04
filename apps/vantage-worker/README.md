# vantage-worker

**VANTAGE** is EVCore's 20th channel — the only one whose decisions come from an LLM instead of deterministic math. It reads every other channel's decision on a match, plus each channel's measured reliability on that competition, and forms its own independent pick. It never adjusts anyone else's score and never picks by default. Its picks are shown to the player as the **Avis IA** (match sheet and a line of Résultats) and measured like every other channel, by calibration (realised ÷ announced) on `vantage_decision_history` — no special status. A no-play is shown too: when VANTAGE reads a match and declines, its text appears on the match sheet (`aiAbstentionOf`, `apps/backend/src/modules/screens/match-sheet.service.ts`, `voice: match` texts only).

The worker composes **no coupon**. Its own LLM combo was cut on 2026-11-03; the **Combiné IA** (4–10, legs 1.45–1.80, `AI_COMBO_COUPON_CLASS`) is composed by the backend (`coupon-hunter-generation.service.ts`, source `PRICE_COMPOSER`) from the plays VANTAGE wrote, priced at 1xBet.

Current version: `CONFIG_VERSION = "vantage-v6-match-voice"` (`src/vantage/analyze-fixture.ts`); each version's cohort is measured separately, never blended.

Full rationale, guardrails, and rollout plan: [`docs/architecture.md`](docs/architecture.md). This file is the "how to run it" reference.

## Why a separate app

VANTAGE calls an LLM (`gpt-oss-120b` through an OpenAI-compatible provider) — network I/O, non-deterministic by nature. The rest of the betting engine (`@evcore/analysis-core`) is a pure, synchronous, side-effect-free package by design (see its own `architecture.guard.spec.ts`). VANTAGE cannot live inside it, so it runs as its own process — same pattern as `apps/ml-worker`: its own Dockerfile, its own lifecycle, talking to the shared Postgres database and BullMQ/Redis broker, never touching the backend's request path. The backend does not know VANTAGE exists while it's running; it only sees the `channel_decision` rows VANTAGE writes, same as any other channel.

Unlike `ml-worker`, VANTAGE is written in TypeScript and imports `@evcore/db` and `@evcore/analysis-core` directly — no reimplemented enum catalogs, no drift risk between what a channel means here and what it means in the pure core.

## Prerequisites

- The same Postgres and Redis instances the rest of EVCore already uses (the `VANTAGE` channel is already in the schema).
- A key for at least one provider of the chain. The model is a decision in code (`gpt-oss-120b`, its id per provider in `src/config.ts`), no longer an env var.

## Providers and settings

- **Chain**: `LLM_PROVIDER` (primary: `groq`, `cerebras`, `together` or `fireworks`; default `groq`) then `LLM_PROVIDER_FALLBACKS` (comma-separated, tried in order on a 429, 5xx or timeout). A fallback named without its key is left out.
- **Live overrides** (`src/settings.ts`, read at every pass): the `app_setting` rows `llm.providers` (primary + fallbacks) and `research` (on/off, provider, competitions), edited in the admin's Réglages; provider keys (`groq.apiKey`… `tavily.apiKey`) in Réglages › Intégrations, decrypted with the backend's `SETTINGS_ENCRYPTION_KEY`. An absent or malformed row leaves the environment's value; the `scheduling.enabled` row pauses the scheduled sweep.
- **Retired variables** (`GROQ_MODEL`, `*_MODEL`, `SWEEP_INTERVAL_MS`, `VANTAGE_COMPETITION_CODES`, `VANTAGE_COUPON_*`) are only warned about at start.

## Setup

1. Copy `.env.example` to `.env` and fill in the key of your `LLM_PROVIDER` (or store it in Réglages › Intégrations).
2. Install and run:
   ```bash
   pnpm install
   pnpm --filter vantage-worker dev
   ```

## What it does, in one loop

1. **Sweep** (every 5 min, fixed in `src/config.ts`): finds fixtures within the next 48h (or the last 2h) that have at least one non-VANTAGE channel decision and no VANTAGE decision yet. Runs on **every active competition** — the verdict-only pipeline costs ~$1/month even at full volume, so there's no reason to restrict it. Enqueues one BullMQ job per fixture.
2. **Research** (optional, `VANTAGE_ENABLE_RESEARCH=true` or the `research` setting): a search call (`VANTAGE_RESEARCH_PROVIDER` — `groq` for `groq/compound-mini`'s native web search, or `tavily` for a direct Tavily `/search` call, independent of any LLM provider) searches the web for team news/injuries/enjeu before the verdict call — but only for fixtures in `VANTAGE_RESEARCH_COMPETITION_CODES`, which defaults to "les grands championnats" (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Europa Conference League), independently of the verdict pipeline's own (unrestricted) league scope. OFF by default — unlike the verdict call, search is billed per-request and does add up at full volume. See `docs/architecture.md` — Situational research.
3. **Analyze** (one job per fixture): reads that fixture's channel decisions + each channel's calibration on that competition (+ the research summary, if enabled), asks the provider chain for a structured verdict, validates the response against a Zod schema (and a second pass checking the pick is legal for its market), and — only if it passes both — writes a `ChannelDecision` + `ChannelSelection` row with `channel: VANTAGE`. An invalid response is logged and dropped, never persisted half-formed.

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

**Dev compose** — opt-in, not part of a bare `docker compose up` (avoids failing every service in the file over a missing key):

```bash
GROQ_API_KEY=... docker compose --profile vantage up -d vantage-worker
```

**Prod** — already wired: `docker-compose.prod.yml` runs it against the same Postgres/Redis as `backend`, and `.github/workflows/deploy.yml` builds and pushes `ghcr.io/<owner>/evcore-vantage-worker` on every deploy alongside the other images. It reads the same server `.env` as the backend (`SETTINGS_ENCRYPTION_KEY`, `LLM_PROVIDER`, `LLM_PROVIDER_FALLBACKS`, and the provider keys while Réglages › Intégrations holds none).

## Cost

All 68 active competitions, verdict only (`VANTAGE_ENABLE_RESEARCH=false`, the default): **~$0.75–1.40/month**. With web search on for the default 8 "grands championnats" only: **~$1.50–2/month** more. Widening research to all 68 leagues would add **~$10–20/month** instead — search is billed per-request, not per-token, so it doesn't stay negligible at scale the way the verdict call does. See `docs/architecture.md` — Cost / Situational research for the full breakdown.

## Still open

- The `tavily` research provider has unit tests (mocked `fetch`) but has not been confirmed against Tavily's live endpoint.
- Research is still one combined query per match; two per-team searches stay a deferred option if one proves too shallow.
- Whether research earns its cost is still to be measured: compare the research-assisted cohort (grands championnats) with the channel-only one, by calibration.
- Feeding VANTAGE back into the deterministic score (`ModelRun.llmDelta`/`openclawRaw`) stays out of scope without an explicit human decision.
