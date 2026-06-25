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
  FIRST_HALF: "FIRST_HALF",
  DOUBLE_CHANCE: "DOUBLE_CHANCE",
  UNDERDOG: "UNDERDOG",
  FAVORITE: "FAVORITE",
  LIVE_VALUE: "LIVE_VALUE",
  MARKET_MOVE: "MARKET_MOVE",
  CONSENSUS: "CONSENSUS",
  CONTRARIAN: "CONTRARIAN",
  AVOID: "AVOID",
} as const;

export type StrategyChannel =
  (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL];

// Meta-strategies run in Phase 2 (after all primary decisions are available).
// CONSENSUS and AVOID are implemented + enabled. CONTRARIAN is intentionally
// NOT implemented: a 2026-06-23 read-only study (3 seasons) found the model has
// no edge disagreeing with the market — backing the model's favorite when it
// differs from the market's loses -10.1% ROI (hit 27%), and favorites the model
// flags as "overvalued" still win 63.2% vs 64.2% implied (≈ no information). The
// model adds value by agreeing (CONSENSUS) or flagging its own overreach
// (AVOID), not by fading the market. Kept in the set for completeness.
export const META_STRATEGY_CHANNELS = new Set<StrategyChannel>([
  STRATEGY_CHANNEL.CONSENSUS,
  STRATEGY_CHANNEL.CONTRARIAN,
  STRATEGY_CHANNEL.AVOID,
]);
