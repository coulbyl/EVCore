---
name: evcore-coupon-review
description: Review EVCore coupon composition, candidate ranking, joint probability, correlation, EV and settlement. Use to diagnose failed coupons, compare the backend's coupon sources (PRICE_COMPOSER and ENGINE) leg by leg, or propose validated coupon policy changes without bypassing existing guardrails.
---

# EVCore coupon review

Read root `AGENTS.md` and the `evcore-forecast-audit` skill first when assessing
probability quality or historical performance. Inspect these current paths:

- `apps/backend/src/modules/coupon/coupon-daily-generation.service.ts`:
  orchestration of every product of the day (price, favourite, double,
  engine combo, hunters and the Combiné IA).
- `coupon-priced-pool.service.ts`, `coupon.repository.ts` in that directory:
  candidates, 1xBet quotes and margins, persisted proposals and their
  `source` (`PRICE_COMPOSER`, `ENGINE`; `LLM` only for the combo cut on
  2026-11-03).
- `coupon-engine-combo-generation.service.ts` (source `ENGINE`),
  `coupon-price-generation.service.ts`, `coupon-favourite-generation.service.ts`,
  `coupon-double-generation.service.ts`, `coupon-hunter-generation.service.ts`
  (hunters and the Combiné IA, composed from VANTAGE's plays): one service
  per product.
- `packages/analysis-core/src/coupon/`: `coupon-classes.ts`,
  `pool-eligibility.ts`, `guardrails.ts`, `channel-reliability.ts`,
  `combo-generator.ts`, `price-composer.ts`, `favourite-generator.ts`,
  `double-composer.ts`, `hunter-composer.ts`, `ai-combo-composer.ts`,
  `deterministic-composer.ts` (backtests only): shared, pure policies.
- `apps/backend/src/modules/coupon/coupon-settlement.service.ts`: settlement.

There is no coupon code left in `apps/vantage-worker` and no deterministic
shadow: every product is published and measured live.

1. Freeze class, policy version, pool cutoff, calibrated probabilities,
   quote timestamps, bounds and candidate universe. Require real fixture,
   market and pick IDs. Never manufacture odds or selections to fill a coupon.
2. Replay admission filters and pool reduction before reviewing the
   composition. Trace rejected candidates, tie-breaking and the separate probability/value
   rankings. Do not assume Top-N ranks correspond to superior realized returns.
3. Re-run deterministic validation: permitted odds, class bounds, the
   `MAX_LEG_EDGE` ceiling (claimed edge is anti-predictive: a ceiling, never
   a floor), unique fixtures and anti-correlation limits. Preserve
   `empty_pool`, `no_coupon`, rejected/gave-up outcomes. A smaller or absent
   coupon is valid; do not force five picks or relax constraints to get one.
4. Report raw product, the actual EVCore `jointProbability`, offered combined
   odds and coupon EV separately. For price-composed coupons,
   `jointProbability` is expected return ÷ combined odds, a price estimate,
   never the engine's (`coupon.repository.ts`); do not describe it as a
   calibrated joint correction. Label any product an independence estimate,
   not a demonstrated probability. Anti-correlation exclusions reduce obvious
   overlap but do not prove independence. Do not import the external betting
   module's scalar correlation adjustment into EVCore.
5. For the Combiné IA, inspect the VANTAGE plays it drew from
   (`vantage_decision_history`, `configVersion`) and keep the market's
   frequency as its chance; unsupported narrative confidence must not
   replace a measured probability.
6. Compare sources (`PRICE_COMPOSER`, `ENGINE`) **per leg** on identical
   dates: realised ÷ announced by odds band, coverage/no-coupon rate, leg
   count and day-clustered uncertainty. Coupon ROI has no statistical power
   at current volumes: never conclude from it. Keep selection windows
   separate from untouched chronological validation. Preserve losing/empty
   days and correct void/partial payouts in all denominators.
7. Record conclusions against immutable pre-match proposals and later
   settlement. Propose one versioned policy change with evidence and a
   reproducible test and replay plan. Do not publish a coupon, place a bet or
   silently promote a research policy.

Use offline targeted checks from the root:

```bash
pnpm --filter @evcore/analysis-core test
pnpm --filter backend test
pnpm --filter @evcore/backtest-core test
```

For a configured development database, inspect
`packages/backtest-core/scripts/backtest-deterministic-coupon.ts` and its
`--from`, `--to`, `--config`, `--sweep` options, and the
`report:coupon-policies` / `report:coupon-clv` scripts of `@evcore/backtest-core`. Freeze dates/configuration
before executing. Treat a sweep as selection research, never holdout evidence.

Deliver: cutoff and provenance; eligible/rejected pool counts; composition
path and class; leg-level calibrated probability/price/EV; raw and corrected
joint probability; validation outcome; historical evidence or explicitly
missing data; next experiment. Never promise frequent five-leg wins.
