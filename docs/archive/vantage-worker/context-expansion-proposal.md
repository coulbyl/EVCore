# VANTAGE — context expansion proposal (A + C)

Status: **proposal, not implemented.** Nothing in this document has been coded. It exists to
formalize a design discussion (2026-08-29) triggered by two real prod misses on 2026-08-28/29
fixtures, and to inventory what's actually available in the database before committing to a
shape. See [`architecture.md`](architecture.md) for VANTAGE's current, shipped design — this
document proposes changing it, not describing it.

## The problem this solves

VANTAGE's current prompt (`src/vantage/prompt.ts:18`) hard-codes its selection criterion to
**inter-channel disagreement only**:

> "Ne produis 'play' que si tu identifies une tension ou un biais concret entre canaux."

And its context (`src/context/build-match-context.ts`) contains **only** the other 19 channels'
own `SELECTED` decisions + their measured calibration — nothing else. Two consequences, both
confirmed against real 2026-08-28/29 data:

1. **92% of VANTAGE's `no_play` verdicts (942/1020, measured 2026-08-29) are phrased as
   "channels converge, no tension"** — this is not an edge case, it is the default outcome on
   almost every match, by construction of the prompt.
2. **VANTAGE cannot see a market at all if the channel that owns it abstained.** On
   `SV Elversberg 3-2 Bayer Leverkusen` (2026-08-29), the BTTS channel itself was `REJECTED`
   (below its own 0.35 threshold) — so no "marché=BTTS" line ever reached VANTAGE's prompt, and a
   BTTS-Yes result that happened (both teams scored) was structurally invisible to it, independent
   of what the model itself might have judged plausible from the match context. Measured
   abstention rate across the 1362 fixtures VANTAGE has already read: DOMINANT 85.8% silent,
   FIRST_HALF 88.1%, BTTS 57.5%, DRAW 66.4%.

This document proposes fusing two of the four alternatives discussed: **A** (give VANTAGE raw
match signals so it can form an opinion independent of what any channel computed) and **C**
(stop discarding a channel's own near-threshold read when it abstains).

## What C adds — and why it's cheaper than expected

Every deterministic channel already computes and logs its internal probability **even when it
abstains**. Example, a real `REJECTED` BTTS decision:

```json
{ "bttsNo": 0.69, "bttsYes": 0.31, "yesThreshold": 0.35, "noThreshold": null }
```

`build-match-context.ts:42-54` throws this away — `cd.selections[0]` is `null` on a `REJECTED`
row (no `ChannelSelection` is ever written for a rejection), so the prompt only ever sees "Canal
BTTS : aucune sélection (below_threshold)". The near-miss number that would let VANTAGE judge "69%
is close to a real signal, just under this channel's own bar" never reaches it.

**Caveat, not yet resolved**: `reasonDetails` shape is per-strategy, not a shared schema — BTTS's
`{bttsNo, bttsYes, yesThreshold, noThreshold}` is not the same shape as another channel's
rejection payload. Extracting "the market probability this channel almost played" generically
across 19 strategies needs either (a) a small per-channel mapping table in vantage-worker, or (b)
a shared, typed shape strategies write into on rejection — the second is a betting-engine change,
out of scope for a vantage-worker-only fix. Needs a pass over all 19 strategies' rejection payload
shapes before committing to an approach.

## What A adds on top

Even with every channel's near-miss exposed, VANTAGE is still capped at what the deterministic
layer thought to compute. A means giving it the same raw features the engine itself reads, so it
can have a view a channel simply never modeled.

**Verified available (2026-08-29), scoped to what's actually populated:**

| Source                                 | Table                                                                 | Coverage                                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team_stats`                           | populated                                                             | 1737 teams, fresh (last row today 04:02)                                              | `recentForm`, `xgFor`, `xgAgainst`, `homeWinRate`, `awayWinRate`, `drawRate`, `leagueVolatility` — scoped to each team's current season; known start-of-season gap for F2/ERD/POR/D2/D3/BEL1/TUR2/SUI2/SVN1 ([[project_season_rollover_teamstats_gap]])                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `standing`                             | populated                                                             | **FIFA World Cup only (48 rows)**                                                     | Not usable — was added for WC2026, never wired to domestic ETL. Do not treat classement/points as available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| H2H                                    | not a table — computed live from `fixture`                            | any two teams with ≥3 past `FINISHED` meetings                                        | Pure functions in `@evcore/analysis-core/probability/h2h.ts` (`computeH2HScoreFromLegs`, `computeH2HMarketSignalsFromLegs`, `computeH2HScorelineSignalFromLegs`) — same fetch pattern as `H2HService.fetchLegs`, point-in-time-safe (`scheduledAt < fixtureDate`). Below 3 legs, everything is `null`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `coach_tenure`                         | populated                                                             | 17 861 rows, actively synced (`coachs-sync.worker.ts`)                                | Used elsewhere for a "new coach" window signal (`channel-decision.repository.ts:findNewCoachTeams`, `rolling-stats.service.ts`) — a plain fact ("current coach in charge for N matches"), cheap to surface as-is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `odds_snapshot`                        | populated                                                             | **3.97M rows**, fresh to today (19:02)                                                | Per-bookmaker, per-market. Currently VANTAGE only ever sees the odds attached to a channel's own selected pick — never the raw market landscape for markets no channel selected. **Must be framed as "what the market prices," never as edge/EV** — CLAUDE.md: claimed edge is anti-predictive, `MAX_LEG_EDGE` is a ceiling not a signal, this rule applies to VANTAGE's reasoning exactly as much as to any channel's.                                                                                                                                                                                                                                                                                    |
| `ModelRun.features.shadow_predictions` | populated                                                             | 2551/2572 model runs in the last 7 days (99%)                                         | **The most interesting one found in this pass.** API-Football's own `/predictions` endpoint, ingested as a genuinely independent second forecaster (`SHADOW_PREDICTIONS` flag, on by default) — `{percent: {home, draw, away}, poisson: {home, away}, winnerName, conflict}`. `conflict` is already a precomputed boolean: does API-Football's own pick disagree directionally with our λ? This is the one signal in the whole system that is **not derived from the same team_stats/λ pipeline as every channel** — comparing our channels against each other (what VANTAGE does today) is comparing correlated numbers by construction; comparing against `shadow_predictions` is a real second opinion. |
| Line movement                          | not a stored table, computed against `odds_snapshot` at analysis time | active gate (`FEATURE_FLAGS.SCORING.LINE_MOVEMENT`, `LINE_MOVEMENT_THRESHOLD = 0.10`) | A channel can already abstain because its pick's odds moved >10% adversely over 7 days — another concrete, already-logged rejection reason C should surface, not something new to compute.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Confirmed by the user (2026-08-30): `ML_CORRECTION_ENABLED=true` in prod.** Unlike H2H, this
correction is **never folded into a channel's own probability** —
`betting-engine.service.ts:1165-1179` computes it strictly _after_ `persistedChannelDecisions` are
already written, and stores it only in `ModelRun.features.shadow_ml_by_channel` /
`shadow_ml_corrected_p` / `shadow_ml_edge_delta`, never read back by any decision. So — unlike H2H
— this is genuinely new information VANTAGE has never seen, at the same tier of interest as
`shadow_predictions` below. Coverage (14-day, `jsonb_typeof = 'object'` model runs): TEAM_TOTAL
4287, GOALS 4119, CLEAN_SHEET 3455, WIN_EITHER_HALF 3198, BTTS 1372, VALUE 818, DOMINANT 750 —
7 channels have an active `ml_model_version` segment. Shape per channel:
`{correctedP: number, edgeDelta: number}`. **Caution before using it as-is**: some observed
`edgeDelta` magnitudes look large (e.g. a real CLEAN_SHEET row: `edgeDelta: 0.70`,
`correctedP: 0.94` against whatever the deterministic layer had) — worth a calibration sanity
check on `shadow_ml_corrected_p` vs settled results per channel before trusting it as VANTAGE
input, not just assuming "ML-corrected" means "better."

**Checked and explicitly ruled out for now:**

- `INJURIES` and `LINEUPS` shadow flags are both `false` — collected (injuries) or post-hoc only
  (lineups) but not live-usable signals. Do not build on these yet.
- H2H per-market signals (`H2H_MARKET_SIGNALS`) and the H2H lambda correction (`H2H`) are both
  **already active in prod** and already baked into every channel's final probability before
  VANTAGE ever sees it (confirmed 2026-08-29, [[project_h2h_market_signals_ready]]) — re-exposing
  them to VANTAGE would be redundant. Only the H2H **scoreline** signal (CORRECT_SCORE-specific,
  still shadow-only) is not yet visible to VANTAGE in any form.

## Shape of a fused A+C context (sketch, not final)

For each fixture, in addition to today's channel-readings block:

1. **Near-miss readings** — every `REJECTED` channel's own probability, once a shared extraction
   exists (the C caveat above), phrased the same way a `SELECTED` reading is today: "Canal BTTS :
   pas de sélection (69% NO / 31% YES, sous son seuil 35%)."
2. **Raw team signals** — `team_stats` fields for both teams, plus `coach_tenure` ("en poste
   depuis N matchs") when the "new coach" window applies.
3. **H2H** — score + scoreline signal (not the 6 market rates — already redundant, see above),
   gated on `sampleSize >= H2H_MIN_SAMPLE`.
4. **Independent second opinions** — two distinct ones, both currently invisible to VANTAGE, kept
   labeled separately since they're independent of each other too:
   - `shadow_predictions` — external (API-Football), not derived from our λ/team_stats at all.
   - `shadow_ml_by_channel[channel]` — internal but architecturally separate: a trained ML segment
     correcting that specific channel's own probability, never fed back into what the channel
     actually selected. Only for the 7 channels with an active segment (see table above);
     needs the calibration sanity check noted there before being trusted as strongly as
     `shadow_predictions`.
5. **Market context, not edge** — the raw odds-implied 1X2/BTTS/O-U split from `odds_snapshot`
   for markets with no channel selection, framed only as "ce que le marché price," with the same
   anti-edge language CLAUDE.md already requires elsewhere.

## What this is not

- Not a change to `ModelRun.llmDelta`/`openclawRaw` — VANTAGE stays a channel, not a scoring-loop
  input. Unchanged from `architecture.md`.
- Not a redefinition without cost: this pushes VANTAGE from "meta-trust layer over the 19
  deterministic channels" toward "a 20th, more independent forecaster" — `architecture.md`'s own
  framing ("why a match-first read, not a market-first scan") will need a rewrite pass once a
  direction is picked, not just the prompt/context code.
- Not free on calibration risk: VANTAGE's current, narrow mandate is why its calibration looks
  unusually good (53.3% announced vs 53.2% realized, [[project_vantage_channel]]) — it plays
  rarely. Widening scope will raise its play rate and should be tracked as a **separate
  `configVersion` cohort** (e.g. `vantage-v3-context`) so its calibration is never blended with
  the current `vantage-v2-research` numbers.

## Open questions before this becomes a build

1. ~~Per-channel rejection payload shapes~~ — **audited 2026-08-30**, directly against DB content
   (`reasonDetails` on `REJECTED` rows), not by reading all 19 strategy files:

   | Tier                                                       | Channels                                                                                                                                                                                                                                                                                                                          | Notes                                                                                                                                                                                |
   | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Direct `probability`/`impliedProbability` field            | VALUE, SAFE, DOMINANT, DRAW, DOUBLE_CHANCE, RESULT_TOTAL_GOALS                                                                                                                                                                                                                                                                    | ✅ extractable as-is, one shared field name                                                                                                                                          |
   | Two named probabilities + threshold, per-channel key names | BTTS (`bttsYes`/`bttsNo`), CLEAN_SHEET (`cleanSheetHome`/`cleanSheetAway`), WIN_EITHER_HALF, DRAW_NO_BET, WIN_TO_NIL                                                                                                                                                                                                              | ⚠️ needs a small per-channel key-mapping table, no shared schema                                                                                                                     |
   | No usable number logged                                    | **GOALS** (`candidateLines` is a list of pick _labels_, no probability at all), **FIRST_HALF** (97% `null`; the rare object payload is `margin`/`minMargin`, a distance-to-threshold, not a probability), **OVER_UNDER_HT** (100% `null`), **HALF_TIME_FULL_TIME** (100% `null`), **CORRECT_SCORE** (99.99% `null`, 4/40006 rows) | ❌ C cannot help here without first changing these strategies in `@evcore/analysis-core` to log a probability on rejection — a separate, larger piece of work outside vantage-worker |
   | Meta, no market pick                                       | CONSENSUS, AVOID                                                                                                                                                                                                                                                                                                                  | n/a — not applicable to near-miss extraction                                                                                                                                         |

   **Practical conclusion**: C is buildable now for 11/19 channels (6 trivial, 5 needing a mapping
   table). It cannot close the gap on GOALS, FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME, or
   CORRECT_SCORE without an upstream change to those strategies — a decision to make separately,
   not blocked on vantage-worker.

   **Root-caused 2026-08-30, per channel (`reasonCode` distribution on `REJECTED` rows):**

   | Channel             | Dominant reasonCode | Share  | Root cause                       |
   | ------------------- | ------------------- | ------ | -------------------------------- |
   | OVER_UNDER_HT       | `market_suspended`  | 100%   | deliberate quality gate          |
   | HALF_TIME_FULL_TIME | `market_suspended`  | 99.5%  | deliberate quality gate          |
   | FIRST_HALF          | `market_suspended`  | 97.2%  | deliberate quality gate          |
   | CORRECT_SCORE       | `no_odds`           | 99.99% | real gap — matrix never computed |
   | GOALS               | `no_priced_line`    | 100%   | real gap — probability discarded |

   **`market_suspended` (FIRST_HALF/OVER_UNDER_HT/HALF_TIME_FULL_TIME)** — all three share the
   same `!context.selectionConfig.htftCalibrated` gate at the top of their `decide*` function
   (`first-half-winner.strategy.ts`, `over-under-ht.strategy.ts`, `half-time-full-time.strategy.ts`).
   `htftCalibrated` restricts these markets to leagues with real HT-decomposition history, following
   a 2026-08-13 audit finding a bivariate-Poisson overestimation risk elsewhere. The probability is
   technically computable (it exists upstream in `context.probabilities`) but is **deliberately
   withheld as untrustworthy** in non-calibrated leagues — this is not a logging gap, exposing it
   would undermine the exact reason the gate exists. **Decision (2026-08-30, user): leave it hidden
   from VANTAGE too** — it already sees "aucune sélection (market_suspended)", which correctly
   signals a frozen market rather than a neutral absence. Do not surface the underlying number.

   **`no_priced_line` (GOALS)** — real, trivially-fixable gap. `goals.strategy.ts`'s
   `no_priced_line` branch returns `reasonDetails: { candidateLines: candidates.map((c) => c.pick) }`
   — discarding `c.probability`, which is already computed on every candidate. One-line fix:
   `candidateLines: candidates.map((c) => ({ pick: c.pick, probability: c.probability.toNumber() }))`.

   **`no_odds` (CORRECT_SCORE)** — real gap, requires moving a computation earlier.
   `correct-score.strategy.ts` returns `no_odds` _before_ calling `computeCorrectScoreMatrix`, so
   99.99% of CORRECT_SCORE's rejections carry no model opinion at all, even though the matrix could
   be computed from `lambdaHome`/`lambdaAway` independent of odds availability. Fix: compute the
   matrix first, report the modal scoreline + probability in `reasonDetails` regardless of pricing,
   keep the `no_odds` rejection (never select/stake without a price) unchanged otherwise.

   Both real fixes (GOALS, CORRECT_SCORE) are self-contained to their own strategy file, don't
   touch selection/staking logic, and don't require a design decision — they're ready to build
   whenever this proposal moves to implementation.

2. ~~Token/cost impact~~ — **estimated 2026-08-30** (hand-counted, not measured against a real
   Groq call — no prompt with this expanded shape has been built or sent yet):

   | Addition                                     | Est. tokens/match | Why                                                                    |
   | -------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
   | Near-miss readings (C, 11 channels)          | +200              | ~10 REJECTED lines/match on average, each grows from ~10 to ~30 tokens |
   | Raw `team_stats` (A, both teams)             | +100              | 7 fields × 2 teams                                                     |
   | H2H score + scoreline                        | +30               | often just "insufficient sample"                                       |
   | `shadow_predictions`                         | +50               | external second opinion block                                          |
   | `shadow_ml_by_channel` (DOMINANT/VALUE only) | +35               | 2 short lines, not always both present                                 |
   | Raw market context (odds, uncovered markets) | +40               | capped to 3-5 key markets, never framed as edge                        |
   | **Total**                                    | **~+455**         |                                                                        |

   Baseline ~1400 input / ~250 output tokens ($0.00036/match) → ~1855 input / ~275 output
   (~$0.00044/match, **+22%**). Output stays flat — `reasonDetails` is schema-capped at 500 chars
   regardless of input size. At full 68-competition scope: **~$0.95-1.75/month, up from
   ~$0.75-1.40/month (+$0.20-0.35/month)**. Not a budget constraint at any point in this proposal —
   the research web-search add-on alone already costs more ($1.50-2/month for 8 leagues). Re-measure
   against real `usage.prompt_tokens` once an actual expanded prompt exists, rather than trusting
   this hand count.

3. Whether `shadow_predictions`' `conflict` boolean alone (cheap) is worth shipping ahead of the
   rest of this proposal, as a smaller, isolated first step.
4. ~~Confirm `ML_CORRECTION_ENABLED` prod status~~ — confirmed 2026-08-30: `true`. **Calibration
   audit done 2026-08-30** (Brier score, announced probability vs `correctedP`, joined on each
   channel's own settled rank-1 selection):

   | Channel         | n settled | Brier announced | Brier corrected | Verdict          |
   | --------------- | --------- | --------------- | --------------- | ---------------- |
   | GOALS           | 9155      | 0.2328          | 0.2382          | worse            |
   | TEAM_TOTAL      | 7614      | 0.2422          | 0.2734          | **worse, large** |
   | CLEAN_SHEET     | 6209      | 0.2242          | 0.2785          | **worse, large** |
   | WIN_EITHER_HALF | 5297      | 0.2326          | 0.2413          | worse            |
   | DOMINANT        | 1839      | 0.2663          | 0.2316          | **better**       |
   | BTTS            | 1273      | 0.2371          | 0.2426          | worse            |
   | VALUE           | 992       | 0.2541          | 0.2097          | **better**       |

   **5 of 7 channels are made worse by the ML correction**, two substantially. Sample sizes are
   large enough (992–9155) that this isn't noise. **Do not expose `shadow_ml_by_channel` to
   VANTAGE for GOALS/TEAM_TOTAL/CLEAN_SHEET/WIN_EITHER_HALF/BTTS** — it would hand VANTAGE a
   worse number than what it already sees. Only **DOMINANT** and **VALUE** are calibration-safe
   candidates for this signal. This also means `ML_CORRECTION_ENABLED=true` in prod is currently
   shipping a shadow signal that is net-negative on 5/7 segments — worth flagging back to whoever
   owns the ml-worker training loop, independent of VANTAGE.
