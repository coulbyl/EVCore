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
    H2H: false, // shadow value computed in BettingEngineService
    CONGESTION: false, // shadow value computed in BettingEngineService
    LINEUPS: false, // post-hoc only — shadow value: null
    ML_CORRECTION: process.env['ML_CORRECTION_ENABLED'] === 'true', // activate after ≥50 shadow picks validated
    // API-Football /predictions as an independent second model — shadow only:
    // stored in features.shadow_predictions, logged on directional conflict
    // with our λ, never consumed by scoring. ~1 request per analysis pass.
    SHADOW_PREDICTIONS: process.env['SHADOW_PREDICTIONS_ENABLED'] !== 'false',
  },
} as const;
