// ─────────────────────────────────────────────
// AVOID (meta) — negative decision. Flags a fixture/pick that should not feed
// the recommendations. Of the doc's candidate triggers, only one fires
// meaningfully in our data: EXTREME model↔market divergence. The others are
// non-events here (no fixture ever has contradictory HOME&AWAY primaries;
// lambdaFloorHit is false everywhere) or already handled (missing odds → NO_BET).
//
// Validated 2026-06-23 on settled 1X2 selections (3 seasons): when the model
// claims an edge ≥ 0.30 over the market (probability − 1/odds), the MARKET is
// right, not the model — ROI by edge bucket: [20,30%) +10.9% but ≥30% −20.4%
// (hit 28%). Per season ≥30% is negative/flat AND worse than the rest every
// time: -34.2/-22.5/-0.7 vs +6.8/+3.1/+1.2. So extreme divergence signals a
// model/data problem, not an edge → AVOID blocks it. Global (league-agnostic).
export const AVOID_CONFIG = {
  enabled: true,
  // A selected pick whose model edge (probability − implied) reaches this is
  // treated as implausible → the fixture is flagged for avoidance.
  maxEdge: 0.3,
} as const;
