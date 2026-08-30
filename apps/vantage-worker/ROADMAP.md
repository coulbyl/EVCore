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
- [x] **CI/CD wired.** `pnpm --filter vantage-worker test` runs in `ci.yml`'s existing `validate` job (Node/TS, no separate job needed unlike `ml-worker`'s Python one). `deploy.yml` builds and pushes `ghcr.io/<owner>/evcore-vantage-worker` on the same trigger as the other images (full monorepo build context, like `backend`, not `ml-worker`'s self-contained one) and the `deploy` job waits on it. `docker-compose.prod.yml` runs it against the same Postgres/Redis as everything else. `docker-compose.yml` (dev) has it too, but opt-in only (`profiles: ["vantage"]`) — a required `GROQ_API_KEY` would otherwise fail `docker compose up` for every service in the file, not just this one, since Compose interpolates variables for all services up front regardless of profile.

## Disclosure

Running `@evcore/db build`/`generate` while verifying this work caused Prisma 7 to auto-generate **and apply** migration `20260828030238_add_vantage_channel` (`ALTER TYPE "StrategyChannel" ADD VALUE 'VANTAGE'`) against the real database, without an explicit `migrate dev`/`migrate deploy` command being run. This is a live, applied migration, not a pending one — flagged here since project convention is that only a human runs migrations.

## Done (2026-08-30, docs/context-expansion-proposal.md)

- [x] Two upstream `@evcore/analysis-core` fixes so a real number reaches VANTAGE even when the
      owning channel abstains: GOALS' `no_priced_line` rejection now logs each candidate line's
      computed probability (used to log only the pick label); CORRECT_SCORE's probability matrix
      is now computed as soon as λ exists, independent of odds availability, so `no_odds` (99.99%
      of its rejections) now carries the modal scoreline + probability instead of nothing.
- [x] Near-miss extraction (`context/near-miss.ts`) — surfaces a REJECTED channel's own
      near-threshold probability for 11/19 channels (6 direct, 5 two-sided-with-mapping); the
      other 8 are deliberately excluded (market_suspended gate on FIRST_HALF/OVER_UNDER_HT/
      HALF_TIME_FULL_TIME — kept hidden per an explicit 2026-08-30 decision — or meta-channels).
- [x] Raw team signals (`context/team-signals.ts`) — `team_stats` (recentForm/xgFor/xgAgainst/
      home-away-draw rates/leagueVolatility) for both teams, plus a "new coach" fact from
      `coach_tenure` when the current coach has fewer than 5 finished matches in charge.
- [x] H2H scoreline signal (`context/h2h-signal.ts`) — the one H2H read not already folded into
      every channel's own probability (the 6 per-market H2H signals are redundant here, confirmed
      active in prod since 2026-07-28).
- [x] Two independent second opinions (`context/shadow-signals.ts`) — `shadow_predictions`
      (API-Football's own forecast, genuinely uncorrelated with this system's λ) and
      `shadow_ml_by_channel` restricted to DOMINANT/VALUE only (a Brier-score calibration audit
      found the correction makes GOALS/TEAM_TOTAL/CLEAN_SHEET/WIN_EITHER_HALF/BTTS worse, not
      better).
- [x] Raw ONE_X_TWO market price (`context/market-odds.ts`) for fixtures no channel selected that
      market on — framed strictly as "what the market prices," never as an edge/EV signal.
- [x] Prompt rewrite (`vantage/prompt.ts`) — the "only play on inter-channel tension" rule is now
      one of four legitimate bases (tension, near-miss, raw-data reading, second-opinion
      disagreement); an explicit worked example fixes a measured ~30% sur/sous-estimé calibration-
      direction inversion in real prod output; reasonDetails guidance now asks for a narrative
      "why this pick" read instead of a channel-by-channel fact list — see project memory
      project_vantage_reasondetails_quality for the audit this responds to.
- [x] `CONFIG_VERSION` bumped to `vantage-v3-context` — this cohort's calibration is tracked
      separately from `vantage-v2-research`'s, never blended (v2's near-perfect calibration came
      from playing rarely; widening scope needs its own measurement, not an assumption it's safe).
- [x] `MIN_ODDS` floor (`analyze-fixture.ts`) extended to also check the new raw-market-odds block,
      not just channel readings — otherwise a play sourced purely from that block could bypass it.
- [x] Code-review pass on the above: fixed 4 near-miss extraction bugs (BTTS's threshold field name,
      VALUE/SAFE's two real rejection shapes, DOMINANT's two uncovered rejection reasons), a
      degenerate all-null market-odds row, wasted queries on an empty-readings context, and no
      per-query resilience in `buildMatchContext`'s Promise.all.
- [x] Fixed two contradictions found on a second read of the rewritten `prompt.ts`: the "always cite
      a channel + its calibration ratio" rule directly conflicted with the new "write for a player,
      not a fact list" rule on the most common case (tension-based plays) — reworded to require
      traceability to a basis without mandating the jargon; and the raw market-odds block could be
      read as a fifth legitimate "play" basis on its own — now explicit that it can only support one
      of the four real bases, never stand in for one.
- [x] **Real prod-config bug found and fixed (2026-08-30)**: situational research gated on
      `config.llmProvider === "groq"` (primary only) — prod actually runs `LLM_PROVIDER=cerebras`
      with `LLM_PROVIDER_FALLBACKS=groq,together`, so research was silently dead on every fixture
      despite `VANTAGE_ENABLE_RESEARCH=true` (matches the 0/342 `researchCitations` observed
      2026-08-29). `research.ts`/`main.ts` now resolve the Groq client via `findProviderClient`
      (`client.ts`), which checks primary AND fallbacks — Groq no longer needs to be the primary
      verdict provider for research to run.

## Not done yet — before the pilot can start

- [ ] **Get a Groq API key** and confirm `openai/gpt-oss-120b` (and, if enabled, `groq/compound-mini`) behave as expected on a handful of real fixtures — nothing here has been run against the live Groq API yet.
- [ ] **Set `GROQ_API_KEY` (and the other `VANTAGE_*`/`GROQ_*` vars, if not using the defaults) in the server's `.env`** before the next deploy — `docker-compose.prod.yml`'s `vantage-worker` service will otherwise fail to start (`GROQ_API_KEY is required`, matching how `POSTGRES_PASSWORD`/`NEXT_PUBLIC_API_URL` already behave in that file).
- [ ] **Decide on `VANTAGE_ENABLE_RESEARCH`** — off (default, ~$1/month total), on with the default grands-championnats scope (~$1.50-2/month more), or widened to all 68 leagues (~$10-20/month) — see `docs/architecture.md` — Situational research (cost) before flipping it.
- [ ] **Manual read-through of the first batch of `reasonDetails`** on well-known leagues (La Liga, Premier League, Championship) before trusting any of it.

## Deliberately deferred — needs its own decision later, not a default

- [ ] Enriching VANTAGE's context with live odds/EV on its _own_ selection (currently null — it commits to market/pick/probability only, no odds lookup yet).
- [ ] Making research per-team (two searches) instead of one combined query, if a single `compound-mini` search proves too shallow for both sides of a match.
- [ ] Any integration with the deterministic scoring loop (`ModelRun.llmDelta`/`openclawRaw`) — out of scope for VANTAGE entirely; a separate, explicitly human-approved initiative if it ever happens.
- [ ] Surfacing VANTAGE in the "Ce qu'on assume" / Investir Phase-2 filters — today it's visible on Decisions and Historique verifiable like any channel, but VALUE/SAFE's re-selection logic hasn't been reviewed for how it should treat VANTAGE's picks.
