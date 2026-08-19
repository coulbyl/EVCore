// Feature flags for shadow scoring — flip to true when the underlying data source is ready.
// SCORING flags control which signals are included in the deterministic analysis.
// Flags set to false produce a null shadow value logged in ModelRun.features.
//
// ML_CORRECTION is runtime-configurable: set ML_CORRECTION_ENABLED=true in the backend
// environment to activate without a code change or redeploy.
export const FEATURE_FLAGS = {
  SCORING: {
    LINE_MOVEMENT: true, // filter picks with >10% adverse odds movement over 7 days
    INJURIES: false, // shadow collected by injuries-sync worker
    H2H: true, // lambda-adjustment applied in BettingEngineService (docs/h2h-service-v2-plan.md §4, activated 2026-07-23)
    H2H_MARKET_SIGNALS: true, // per-market logit-shift (BTTS/OVER25/CLEAN_SHEET/WIN_TO_NIL) applied in BettingEngineService — combined backtest confirmed gain on top of H2H lambda correction, 6/6 markets (packages/db/reports/backtest-h2h-market-signals-combined-2026-07-28.txt), activated 2026-07-28
    CONGESTION: true, // logit-shift on OVER25/BTTS (applyCongestionSignalCorrection) — validated 2026-08-19 (packages/db/reports/backtest-congestion-signal-value-2026-08-19.txt), real gain but ~10x smaller than H2H_MARKET_SIGNALS (score is 0 for most fixtures — weekly domestic calendars rarely produce short rest)
    LINEUPS: false, // post-hoc only — shadow value: null
    ML_CORRECTION: process.env['ML_CORRECTION_ENABLED'] === 'true', // activate after ≥50 shadow picks validated
    // API-Football /predictions as an independent second model — shadow only:
    // stored in features.shadow_predictions, logged on directional conflict
    // with our λ, never consumed by scoring. ~1 request per analysis pass.
    SHADOW_PREDICTIONS: process.env['SHADOW_PREDICTIONS_ENABLED'] !== 'false',
  },
} as const;
