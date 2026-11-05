// ─────────────────────────────────────────────
// CORRECT_SCORE (exact score) — OBSERVATION ONLY, PREDICTION channel (not value).
// Among the scorelines the book prices, emit the single MOST LIKELY one the model
// can price (argmax of the Poisson cell probability). Global config (the mechanism
// is league-agnostic). NEVER staked — odds are forward-collected only (no historical
// backtest), so a selection is recorded + settled analytically to accumulate forward
// data; the market price (odds/EV) is still stored for the bettor to judge.
//
// Argmax-EV was REJECTED (2026-07-01): on a ~40-outcome fat-tail market, maximizing
// EV = modelCellProbability × odds − 1 mechanically selects the cell where the model
// most over-prices vs the book — i.e. pure Poisson rounding noise on longshots
// (0:4 @ 501, "+1228% EV"), never a real edge. An independent Poisson simply cannot
// resolve a longshot scoreline to that precision, and the book is right there (same
// logic as AVOID's extreme-divergence rule above). The most probable scoreline is a
// credible, short-priced prediction; that is what serves a bettor.
//
// `minProbability` is a CONVICTION gate: if even the modal scoreline sits below it,
// no single score is predictable (match too open) → no pick. Dixon-Coles was rejected
// (2026-06-30) on the statistics engine's λ; on the market grid a per-league ρ
// improves the exact-score log-loss but was not shipped (ML2A-DEPENDANCE-BUTS.md):
// the matrix reads `scoreDependenceRho` when the grid sets one.
export const CORRECT_SCORE_CONFIG = {
  enabled: true,
  minProbability: 0.05,
} as const;
