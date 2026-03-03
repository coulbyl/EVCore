// Feature flags for shadow scoring — flip to true when the underlying data source is ready.
// SCORING flags control which signals are included in the deterministic analysis.
// Flags set to false produce a null shadow value logged in ModelRun.features.
export const FEATURE_FLAGS = {
  SCORING: {
    LINE_MOVEMENT: true, // filter picks with >10% adverse odds movement over 7 days
    INJURIES: false, // shadow collected by injuries-sync worker
    H2H: false, // shadow value computed in BettingEngineService
    CONGESTION: false, // shadow value computed in BettingEngineService
    LINEUPS: false, // post-hoc only — shadow value: null
  },
} as const;
