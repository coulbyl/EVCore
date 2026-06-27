import { Market } from '@evcore/analysis-core';
import type { ComboPick } from '@evcore/analysis-core';

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
} from '@evcore/analysis-core';
export type {
  ThreeWayProba,
  DerivedMarketsProba,
  HalfTimeFullTimePick,
  DeterministicFeatures,
  FeatureWeights,
  ComboPick,
} from '@evcore/analysis-core';

// Validated combo pairs — only combinations that are logically consistent and
// have positive expected correlation. Impossible combos (HOME+DRAW, etc.) are absent.
export const COMBO_WHITELIST: readonly ComboPick[] = [
  {
    market1: Market.ONE_X_TWO,
    pick1: 'HOME',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'HOME',
    market2: Market.OVER_UNDER,
    pick2: 'OVER',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'HOME',
    market2: Market.BTTS,
    pick2: 'NO',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'AWAY',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'AWAY',
    market2: Market.OVER_UNDER,
    pick2: 'OVER',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'AWAY',
    market2: Market.BTTS,
    pick2: 'NO',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'DRAW',
    market2: Market.OVER_UNDER,
    pick2: 'UNDER',
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: 'DRAW',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: '1X',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: 'X2',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: '12',
    market2: Market.BTTS,
    pick2: 'YES',
  },
  // NOTE: {OVER_UNDER/OVER + BTTS/YES} is intentionally excluded.
  // Over 2.5 and BTTS Yes are near-tautological on the same match: virtually
  // every Over-2.5 game also satisfies BTTS Yes (except 0-3+ or 3-0+ scores).
  // The Poisson joint probability correctly captures this near-perfect correlation,
  // making the combo appear to have massive EV vs the bookmaker's naive product
  // odds — but the edge is an artifact of the independence assumption in the
  // bookmaker's pricing, not a genuine model signal.
] as const;

export function buildBetPickKey(input: {
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
}): string {
  return [
    input.market,
    input.pick,
    input.comboMarket ?? '-',
    input.comboPick ?? '-',
  ].join('|');
}
