// Pure probability, math, scoring, odds & settlement primitives now live in
// @evcore/analysis-core (shared prod ↔ backtest). Re-exported here so existing
// `./betting-engine.utils` imports across the module keep resolving unchanged.
export {
  asNumber,
  clamp,
  poissonProba,
  computePoissonMarkets,
  deriveMarketsFromPoisson,
  buildPoissonDistributions,
  isHalfTimeFullTimePick,
  HALF_TIME_FULL_TIME_PICKS,
  calculateDeterministicScore,
  calculateEV,
  bookmakerMargin,
  removeOverround,
  calculateKellyStakePct,
  resolveHalfTimeFullTimeBetStatus,
  resolveFirstHalfBetStatus,
  resolveEarlyBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
  buildBetPickKey,
} from '@evcore/analysis-core';
export type {
  ThreeWayProba,
  DerivedMarketsProba,
  HalfTimeFullTimePick,
  DeterministicFeatures,
  FeatureWeights,
} from '@evcore/analysis-core';
