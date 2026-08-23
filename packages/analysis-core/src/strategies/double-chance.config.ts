// DOUBLE_CHANCE (dc1X/dcX2/dc12) — OBSERVATION ONLY (2026-08-16). Unlike every
// other market launched this way, this is NOT a new signal: dc1X/dcX2/dc12
// are pure linear derivations of the already-calibrated 1X2
// (dc1X = home+draw, etc. — poisson.ts), so there's nothing new to audit
// per league. Global config (mechanism is league-agnostic, same as
// CORRECT_SCORE) — inherits whatever calibration home/draw/away already has
// via H2H/lambda-scale corrections.
//
// `minProbability` is a conviction floor on whichever double-chance combo is
// picked — a structural launch value (not backtested), same status
// CORRECT_SCORE_CONFIG's 0.05 had at its own launch. Chosen high (0.75)
// because DOUBLE_CHANCE's entire value proposition is "cover 2 of 3 outcomes
// at short odds" — a low-conviction double-chance pick has no real edge over
// just avoiding a bet.
export const DOUBLE_CHANCE_CONFIG = {
  enabled: true,
  minProbability: 0.75,
} as const;
