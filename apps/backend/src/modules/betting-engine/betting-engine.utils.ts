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
  computeJointProbability,
  resolveComboPickBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolveFirstHalfBetStatus,
  resolveEarlyBetStatus,
  resolvePickBetStatus,
  COMBO_WHITELIST,
  buildBetPickKey,
} from '@evcore/analysis-core';
export type {
  ThreeWayProba,
  DerivedMarketsProba,
  HalfTimeFullTimePick,
  DeterministicFeatures,
  FeatureWeights,
  ComboPick,
} from '@evcore/analysis-core';

// COMBO_WHITELIST and buildBetPickKey now live in the pure core
// (@evcore/analysis-core/selection) and are re-exported above.
