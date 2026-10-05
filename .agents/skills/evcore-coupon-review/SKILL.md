---
name: evcore-coupon-review
description: Review EVCore coupon composition, candidate ranking, joint probability, correlation, EV and settlement. Use to diagnose failed coupons, compare LLM and deterministic shadow composition, or propose validated coupon policy changes without bypassing existing guardrails.
---

# EVCore coupon review

Read root `AGENTS.md` and the `evcore-forecast-audit` skill first when assessing
probability quality or historical performance. Inspect these current paths:

- `apps/vantage-worker/src/coupon/run-coupon-generation.ts`: orchestration.
- `pool-query.ts`, `odds-batch.ts`, `channel-reliability-query.ts` in that
  directory: candidates, actual quotes and calibration observations.
- `score-candidates.ts`: calibrated per-leg probability, EV, edge and pool.
- `selection-prompt.ts`, `selection-schema.ts`, `generate-coupon-selection.ts`:
  LLM contract and provenance.
- `validate-coupon-selection.ts`: deterministic post-generation validation.
- `compose-deterministic-shadow.ts`: comparison path; do not confuse shadow
  composition with published LLM proposals.
- `packages/analysis-core/src/coupon/guardrails.ts`, `coupon-classes.ts`,
  `channel-reliability.ts`, `deterministic-composer.ts`: shared policies.
- `apps/backend/src/modules/coupon/coupon-settlement.service.ts`: settlement.

1. Freeze class, policy version, pool cutoff, calibrated probabilities,
   quote timestamps, bounds and candidate universe. Require real fixture,
   market and pick IDs. Never manufacture odds or selections to fill a coupon.
2. Replay admission filters and pool reduction before reviewing the LLM.
   Trace rejected candidates, tie-breaking and the separate probability/value
   rankings. Do not assume Top-N ranks correspond to superior realized returns.
3. Re-run deterministic validation: positive per-leg EV, permitted odds,
   class bounds, unique fixtures and anti-correlation limits. Preserve
   `empty_pool`, `no_coupon`, rejected/gave-up outcomes. A smaller or absent
   coupon is valid; do not force five picks or relax constraints to get one.
4. Report raw product, the actual EVCore `jointProbability`, offered combined
   odds and coupon EV separately. Inspect whether a correction is applied:
   the current LLM validator sets `jointProbability = rawJointProbability`;
   do not describe that as a calibrated joint correction. Label the product an independence estimate,
   not a demonstrated probability. Anti-correlation exclusions reduce obvious
   overlap but do not prove independence. Do not import the external betting
   module's scalar correlation adjustment into EVCore.
5. Inspect LLM selection IDs, reasons, prompt/model version, attempts and
   validator feedback. Keep numerical probabilities from the calibrated
   pipeline; unsupported narrative confidence must not replace them.
6. Compare LLM and deterministic shadow on identical eligible pools and dates.
   Assess coverage/no-coupon rate, leg count, joint calibration, settled win
   rate, ROI, drawdown and day-clustered uncertainty. Keep selection windows
   separate from untouched chronological validation. Preserve losing/empty
   days and correct void/partial payouts in all denominators.
7. Record conclusions against immutable pre-match proposals and later
   settlement. Propose one versioned policy change with evidence and a
   reproducible test/shadow plan. Do not publish a coupon, place a bet or
   silently promote a research policy.

Use offline targeted checks from the root:

```bash
pnpm --filter @evcore/analysis-core test
pnpm --filter vantage-worker test
pnpm --filter @evcore/backtest-core test
```

For a configured development database, inspect
`packages/backtest-core/scripts/backtest-deterministic-coupon.ts` and its
`--from`, `--to`, `--config`, `--sweep` options. Freeze dates/configuration
before executing. Treat a sweep as selection research, never holdout evidence.

Deliver: cutoff and provenance; eligible/rejected pool counts; composition
path and class; leg-level calibrated probability/price/EV; raw and corrected
joint probability; validation outcome; historical evidence or explicitly
missing data; next experiment. Never promise frequent five-leg wins.
