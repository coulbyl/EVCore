// Strategy channels — one decision lane per channel (EV/SAFE/DOMINANT/...).
//
// SOURCE OF TRUTH for the `StrategyChannel` domain enum. Mirrored by the Prisma
// `StrategyChannel` enum and guarded by the conformance test (see market.ts).
export const STRATEGY_CHANNEL = {
  VALUE: "VALUE",
  SAFE: "SAFE",
  DOMINANT: "DOMINANT",
  BTTS: "BTTS",
  DRAW: "DRAW",
  GOALS: "GOALS",
  CLEAN_SHEET: "CLEAN_SHEET",
  TEAM_TOTAL: "TEAM_TOTAL",
  WIN_EITHER_HALF: "WIN_EITHER_HALF",
  FIRST_HALF: "FIRST_HALF",
  DOUBLE_CHANCE: "DOUBLE_CHANCE",
  UNDERDOG: "UNDERDOG",
  FAVORITE: "FAVORITE",
  LIVE_VALUE: "LIVE_VALUE",
  MARKET_MOVE: "MARKET_MOVE",
  CONSENSUS: "CONSENSUS",
  CONTRARIAN: "CONTRARIAN",
  AVOID: "AVOID",
  CORRECT_SCORE: "CORRECT_SCORE",
  RESULT_TOTAL_GOALS: "RESULT_TOTAL_GOALS",
  OVER_UNDER_HT: "OVER_UNDER_HT",
  RESULT_BTTS: "RESULT_BTTS",
  DRAW_NO_BET: "DRAW_NO_BET",
  WIN_TO_NIL: "WIN_TO_NIL",
  HALF_TIME_FULL_TIME: "HALF_TIME_FULL_TIME",
} as const;

export type StrategyChannel =
  (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL];

// Filter channels run in Phase 2 (after every market-specialized Phase-1
// channel has decided, before the Phase-3 meta-strategies). VALUE and SAFE
// are not independent scanners of the whole evaluated-markets pool — they
// select among the picks the Phase-1 market specialists already vetted
// (docs/prediction-engine-families.md §0, docs/channel-strategy-
// architecture.md §5). Moved here from Phase 1 on 2026-08-18.
export const FILTER_STRATEGY_CHANNELS = new Set<StrategyChannel>([
  STRATEGY_CHANNEL.VALUE,
  STRATEGY_CHANNEL.SAFE,
]);

// Meta-strategies run in Phase 3 (after Phase 1 market specialists AND Phase 2
// filters have both decided). CONSENSUS and AVOID are implemented + enabled.
// CONTRARIAN is intentionally NOT implemented: a 2026-06-23 read-only study (3
// seasons) found the model has no edge disagreeing with the market — backing
// the model's favorite when it differs from the market's loses -10.1% ROI (hit
// 27%), and favorites the model flags as "overvalued" still win 63.2% vs 64.2%
// implied (≈ no information). The model adds value by agreeing (CONSENSUS) or
// flagging its own overreach (AVOID), not by fading the market. Kept in the
// set for completeness.
export const META_STRATEGY_CHANNELS = new Set<StrategyChannel>([
  STRATEGY_CHANNEL.CONSENSUS,
  STRATEGY_CHANNEL.CONTRARIAN,
  STRATEGY_CHANNEL.AVOID,
]);
