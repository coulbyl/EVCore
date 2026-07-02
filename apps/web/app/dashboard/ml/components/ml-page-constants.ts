// Mirrors apps/backend/src/modules/ml/ml.constants.ts ML_SEGMENTS. Canal
// names renamed 2026-07 (EV→VALUE, CONF→DOMINANT) — see docs/ml-worker-sync.md.
export const ML_SEGMENTS = [
  "ALL",
  "VALUE:ONE_X_TWO",
  "VALUE:OVER_UNDER",
  "VALUE:BTTS",
  "VALUE:FIRST_HALF_WINNER",
  "SAFE:ONE_X_TWO",
  "SAFE:OVER_UNDER",
  "DOMINANT:ONE_X_TWO",
  "BTTS:BTTS",
  "DRAW:ONE_X_TWO",
  "GOALS:OVER_UNDER",
] as const;
