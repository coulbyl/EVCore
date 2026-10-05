# Repository map

Verify these paths and current behavior before each audit; this map describes
the integration point, not proof that every historical row is reliable.

| Concern | Existing implementation |
| --- | --- |
| Canonical EV and proportional de-vig | `packages/analysis-core/src/ev/ev-math.ts` |
| Complete market outcome partition | `packages/analysis-core/src/pricing/market-fair.ts` |
| Quote assembly and freshness | `packages/analysis-core/src/pricing/odds-assembly.ts` |
| Probability generation | `packages/analysis-core/src/probability/` |
| Strategy eligibility | `packages/analysis-core/src/strategies/` |
| Production model assembly | `apps/backend/src/modules/betting-engine/` |
| Reliability fit and per-leg correction | `packages/analysis-core/src/coupon/channel-reliability.ts` |
| Candidate scoring/reduction | `apps/vantage-worker/src/coupon/score-candidates.ts` |
| Point-in-time historical reads | `packages/backtest-core/src/point-in-time-loader.ts` |
| Replay | `packages/backtest-core/src/replay-engine.ts`, `backtest-runner.ts` |
| Frozen selection/validation | `packages/backtest-core/src/validation-protocol.ts` |
| Calibration reporting | `apps/backend/src/modules/backtest/model-calibration.service.ts`, `backtest.report.ts` |

Read `packages/backtest-core/src/architecture.guard.spec.ts` before adding
historical queries: do not bypass the loader with a new direct Prisma query.
Inspect legacy `packages/db/scripts/backtest-*.ts` for ideas, not as proof of
point-in-time validity. Read `docs/backtest-harness-architecture.md` for limits.

Run targeted offline checks from the root:

```bash
pnpm --filter @evcore/analysis-core test
pnpm --filter @evcore/backtest-core test
pnpm --filter vantage-worker test
```

For database-dependent replay, read the selected script's options and data
access before executing. Use an already configured development database;
do not execute scripts that read `.env` files. Report a missing database
instead of inventing a measured result.
