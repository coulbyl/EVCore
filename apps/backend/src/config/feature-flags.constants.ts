// Feature flags for shadow scoring — flip to true when the underlying data source is ready.
// SCORING flags control which signals are included in the deterministic analysis.
// Flags set to false produce a null shadow value logged in ModelRun.features.
export const FEATURE_FLAGS = {
  SCORING: {
    LINE_MOVEMENT: true, // filter picks with >10% adverse odds movement over 7 days
    INJURIES: false, // ETL not implemented — shadow value: null
    H2H: false, // H2HService not implemented — shadow value: null
    CONGESTION: false, // CongestionService not implemented — shadow value: null
    LINEUPS: false, // post-hoc only — shadow value: null
  },
} as const;
