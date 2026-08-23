// HALF_TIME_FULL_TIME (9-way HT×FT joint grid) — OBSERVATION ONLY
// (2026-08-16). Same PREDICTION-not-value-bet philosophy as CORRECT_SCORE
// (argmax of probability, not EV — an EV-argmax over 9 cells has the same
// fat-tail-noise risk CORRECT_SCORE's 2026-07-01 audit found on scorelines).
// Gated by SelectionConfig.htftCalibrated in the strategy itself (only the 7
// leagues with real HT decomposition history — see ev.constants.ts
// HTFT_CALIBRATED_LEAGUES), so no separate per-league table is needed here:
// the leagues that reach this config are already pre-filtered as trustworthy.
//
// `minProbability` scaled from CORRECT_SCORE_CONFIG's own launch value (0.05
// against a ~20-30 priced scoreline grid, roughly 1.5-2x uniform) to this
// market's 9 cells (uniform ≈ 0.11) — 0.20 sits in the same relative
// position. Not itself backtested.
export const HALF_TIME_FULL_TIME_CONFIG = {
  enabled: true,
  minProbability: 0.2,
} as const;
