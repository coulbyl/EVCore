# vantage-worker — roadmap

Status as of 2026-08-28. See [`docs/architecture.md`](docs/architecture.md) for rationale, [README](README.md) for setup.

## Done

- [x] App scaffolded (`apps/vantage-worker`) — TypeScript, own `Dockerfile`, imports `@evcore/db` + `@evcore/analysis-core` directly.
- [x] `VANTAGE` added to the shared `StrategyChannel` enum (`@evcore/analysis-core` + `packages/db/prisma/schema.prisma`, kept in sync by the existing conformance test) — **not** added to `META_STRATEGY_CHANNELS`, since VANTAGE emits real picks.
- [x] Match context builder — reads a fixture's other channel decisions + their calibration on that competition, excludes VANTAGE's own past reads.
- [x] Prompt + Zod response schema (`no_play` / `play` discriminated union) + a second market-aware pick-legality check.
- [x] Groq client wrapper (`openai/gpt-oss-120b`, `temperature: 0`, JSON mode).
- [x] Persistence — writes `ChannelDecision`/`ChannelSelection` exactly like any other channel; idempotent re-runs (upsert on `(modelRunId, channel)`, stale selection cleared on verdict change).
- [x] BullMQ sweep (self-scheduled repeatable job, `pnpm sweep` for external-cron use) + per-fixture analyze worker.
- [x] Unit tests for the pure logic (pick legality, response schema, prompt rendering with/without research) — 14 tests, no DB/network needed.
- [x] Frontend wiring so a VANTAGE decision displays correctly the moment it appears: channel color/label tokens, Historique verifiable label, `CHANNEL_ORDER`/`CHANNEL_DISPLAY_ORDER`, fr/en labels.
- [x] Full monorepo typecheck/lint/test pass (backend, web, analysis-core, db, vantage-worker) with the enum addition in place.
- [x] Situational research (`VANTAGE_ENABLE_RESEARCH`) — `groq/compound-mini` web search as a separate, best-effort call ahead of the verdict call; citations logged in `reasonDetails.researchCitations`; defaults OFF with its cost tradeoff documented (`docs/architecture.md` — Situational research).
- [x] `VANTAGE_COMPETITION_CODES` (verdict scope) defaults to empty (all 68 active competitions) — the agreed rollout, not a curated subset.
- [x] `VANTAGE_RESEARCH_COMPETITION_CODES` (research scope, independent from the above) defaults to "les grands championnats" — Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Europa Conference League (`PL,LL,BL1,SA,L1,UCL,UEL,UECL`) — so turning `VANTAGE_ENABLE_RESEARCH` on is safe-by-default (~$1.50-2/month) rather than defaulting to full 68-league search cost.

## Disclosure

Running `@evcore/db build`/`generate` while verifying this work caused Prisma 7 to auto-generate **and apply** migration `20260828030238_add_vantage_channel` (`ALTER TYPE "StrategyChannel" ADD VALUE 'VANTAGE'`) against the real database, without an explicit `migrate dev`/`migrate deploy` command being run. This is a live, applied migration, not a pending one — flagged here since project convention is that only a human runs migrations.

## Not done yet — before the pilot can start

- [ ] **Get a Groq API key** and confirm `openai/gpt-oss-120b` (and, if enabled, `groq/compound-mini`) behave as expected on a handful of real fixtures — nothing here has been run against the live Groq API yet.
- [ ] **Add `vantage-worker` to `docker-compose.yml`** alongside `ml-worker`, pointed at the same Postgres/Redis.
- [ ] **Decide on `VANTAGE_ENABLE_RESEARCH`** — off (default, ~$1/month total), on with the default grands-championnats scope (~$1.50-2/month more), or widened to all 68 leagues (~$10-20/month) — see `docs/architecture.md` — Situational research (cost) before flipping it.
- [ ] **Manual read-through of the first batch of `reasonDetails`** on well-known leagues (La Liga, Premier League, Championship) before trusting any of it.

## Deliberately deferred — needs its own decision later, not a default

- [ ] Enriching VANTAGE's context with live odds/EV on its _own_ selection (currently null — it commits to market/pick/probability only, no odds lookup yet).
- [ ] Making research per-team (two searches) instead of one combined query, if a single `compound-mini` search proves too shallow for both sides of a match.
- [ ] Any integration with the deterministic scoring loop (`ModelRun.llmDelta`/`openclawRaw`) — out of scope for VANTAGE entirely; a separate, explicitly human-approved initiative if it ever happens.
- [ ] Surfacing VANTAGE in the "Ce qu'on assume" / Investir Phase-2 filters — today it's visible on Decisions and Historique verifiable like any channel, but VALUE/SAFE's re-selection logic hasn't been reviewed for how it should treat VANTAGE's picks.
