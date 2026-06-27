import Decimal from 'decimal.js';
import { BetStatus } from '@evcore/db';
import { Market, outcomeFromScores } from '@evcore/analysis-core';
import { FEATURE_WEIGHTS } from './ev.constants';

// Pure probability & math primitives now live in @evcore/analysis-core (shared
// prod ↔ backtest). Re-exported here so existing `./betting-engine.utils`
// imports across the module keep resolving unchanged.
export {
  asNumber,
  clamp,
  poissonProba,
  computePoissonMarkets,
  deriveMarketsFromPoisson,
  buildPoissonDistributions,
  isHalfTimeFullTimePick,
  HALF_TIME_FULL_TIME_PICKS,
} from '@evcore/analysis-core';
export type {
  ThreeWayProba,
  DerivedMarketsProba,
  HalfTimeFullTimePick,
} from '@evcore/analysis-core';

export type DeterministicFeatures = {
  recentForm: Decimal.Value;
  xg: Decimal.Value;
  domExtPerf: Decimal.Value;
  leagueVolat: Decimal.Value;
};

export type FeatureWeights = {
  recentForm: Decimal.Value;
  xg: Decimal.Value;
  domExtPerf: Decimal.Value;
  leagueVolat: Decimal.Value;
};

// Canonical EV & odds math now lives in @evcore/analysis-core (pure core shared
// by prod and backtest). Re-exported here so existing `./betting-engine.utils`
// imports across the module keep resolving unchanged.
export {
  calculateEV,
  bookmakerMargin,
  removeOverround,
  calculateKellyStakePct,
} from '@evcore/analysis-core';

export function calculateDeterministicScore(
  features: DeterministicFeatures,
  weights: FeatureWeights = FEATURE_WEIGHTS,
): Decimal {
  return new Decimal(features.recentForm)
    .times(weights.recentForm)
    .plus(new Decimal(features.xg).times(weights.xg))
    .plus(new Decimal(features.domExtPerf).times(weights.domExtPerf))
    .plus(new Decimal(features.leagueVolat).times(weights.leagueVolat));
}

// Conditions mapping pick names → score predicates.
// Used by computeJointProbability and resolvePickBetStatus.
const PICK_CONDITIONS: Record<string, (h: number, a: number) => boolean> = {
  HOME: (h, a) => h > a,
  DRAW: (h, a) => h === a,
  AWAY: (h, a) => h < a,
  OVER_0_5: (h, a) => h + a > 0,
  UNDER_0_5: (h, a) => h + a === 0,
  OVER_1_5: (h, a) => h + a > 1,
  UNDER_1_5: (h, a) => h + a <= 1,
  OVER: (h, a) => h + a > 2,
  UNDER: (h, a) => h + a <= 2,
  OVER_3_5: (h, a) => h + a > 3,
  UNDER_3_5: (h, a) => h + a <= 3,
  OVER_4_5: (h, a) => h + a > 4,
  UNDER_4_5: (h, a) => h + a <= 4,
  YES: (h, a) => h >= 1 && a >= 1, // BTTS YES
  NO: (h, a) => h === 0 || a === 0, // BTTS NO
  '1X': (h, a) => h >= a,
  X2: (h, a) => a >= h,
  '12': (h, a) => h !== a,
};

export type ComboPick = {
  market1: Market;
  pick1: string;
  market2: Market;
  pick2: string;
};

type ResolveHalfTimeFullTimeInput = {
  pick: string;
  homeHtScore: number | null;
  awayHtScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

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

// Joint probability over all goal-score combinations (h, a) satisfying both pick conditions.
// Assumes goal independence between home and away (standard Poisson model).
export function computeJointProbability(
  combo: ComboPick,
  distHome: number[],
  distAway: number[],
): Decimal {
  let joint = 0;
  const cond1 = PICK_CONDITIONS[combo.pick1];
  const cond2 = PICK_CONDITIONS[combo.pick2];
  for (let h = 0; h < distHome.length; h++) {
    for (let a = 0; a < distAway.length; a++) {
      if (cond1?.(h, a) && cond2?.(h, a)) {
        joint += (distHome[h] ?? 0) * (distAway[a] ?? 0);
      }
    }
  }
  return new Decimal(joint);
}

// Resolve the outcome of a combo-match bet against actual scores.
export function resolveComboPickBetStatus(
  combo: ComboPick,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (homeScore === null || awayScore === null) return BetStatus.VOID;
  const ok1 = PICK_CONDITIONS[combo.pick1]?.(homeScore, awayScore) ?? false;
  const ok2 = PICK_CONDITIONS[combo.pick2]?.(homeScore, awayScore) ?? false;
  return ok1 && ok2 ? BetStatus.WON : BetStatus.LOST;
}

// Resolve the outcome of a HALF_TIME_FULL_TIME bet against half-time and full-time scores.
export function resolveHalfTimeFullTimeBetStatus(
  input: ResolveHalfTimeFullTimeInput,
): BetStatus {
  if (
    input.homeHtScore === null ||
    input.awayHtScore === null ||
    input.homeScore === null ||
    input.awayScore === null
  ) {
    return BetStatus.VOID;
  }

  const [expectedHalf, expectedFull] = input.pick.split('_');
  if (!expectedHalf || !expectedFull) return BetStatus.VOID;

  const halfOutcome = outcomeFromScores(input.homeHtScore, input.awayHtScore);
  const fullOutcome = outcomeFromScores(input.homeScore, input.awayScore);
  if (!halfOutcome || !fullOutcome) return BetStatus.VOID;

  return expectedHalf === halfOutcome && expectedFull === fullOutcome
    ? BetStatus.WON
    : BetStatus.LOST;
}

// Resolve OVER_UNDER_HT and FIRST_HALF_WINNER bets against half-time scores.
export function resolveFirstHalfBetStatus(
  pick: string,
  homeHtScore: number | null,
  awayHtScore: number | null,
): BetStatus {
  if (homeHtScore === null || awayHtScore === null) return BetStatus.VOID;
  const condition = PICK_CONDITIONS[pick];
  if (!condition) return BetStatus.VOID;
  return condition(homeHtScore, awayHtScore) ? BetStatus.WON : BetStatus.LOST;
}

// Resolve a bet from in-progress scores when the outcome is already irrevocable.
// Returns null if the outcome cannot yet be determined (wait for FINISHED).
// Never re-settles combos here — callers handle those separately.
type EarlyBetStatusInput = {
  market: Market;
  pick: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

export function resolveEarlyBetStatus({
  market,
  pick,
  homeScore,
  awayScore,
  homeHtScore,
  awayHtScore,
}: EarlyBetStatusInput): BetStatus | null {
  // HT markets — settle as soon as HT scores are available
  if (market === Market.OVER_UNDER_HT || market === Market.FIRST_HALF_WINNER) {
    if (homeHtScore === null || awayHtScore === null) return null;
    return resolveFirstHalfBetStatus(pick, homeHtScore, awayHtScore);
  }

  // HTFT needs both HT and FT — only settle at FINISHED
  if (market === Market.HALF_TIME_FULL_TIME) return null;

  // 1X2 and DC — in-progress score doesn't confirm final result
  if (market === Market.ONE_X_TWO || market === Market.DOUBLE_CHANCE)
    return null;

  const totalGoals = homeScore + awayScore;

  if (market === Market.BTTS) {
    const bothScored = homeScore >= 1 && awayScore >= 1;
    if (pick === 'YES') return bothScored ? BetStatus.WON : null;
    if (pick === 'NO') return bothScored ? BetStatus.LOST : null;
    return null;
  }

  // OVER picks: irrevocably WON once goal threshold is crossed
  const OVER_WON_THRESHOLD: Record<string, number> = {
    OVER_0_5: 1,
    OVER_1_5: 2,
    OVER: 3,
    OVER_3_5: 4,
    OVER_4_5: 5,
  };
  // UNDER picks: irrevocably LOST once goal threshold is crossed
  const UNDER_LOST_THRESHOLD: Record<string, number> = {
    UNDER_0_5: 1,
    UNDER_1_5: 2,
    UNDER: 3,
    UNDER_3_5: 4,
    UNDER_4_5: 5,
  };

  const overThreshold = OVER_WON_THRESHOLD[pick];
  if (overThreshold !== undefined) {
    return totalGoals >= overThreshold ? BetStatus.WON : null;
  }

  const underThreshold = UNDER_LOST_THRESHOLD[pick];
  if (underThreshold !== undefined) {
    return totalGoals >= underThreshold ? BetStatus.LOST : null;
  }

  return null;
}

// Resolve the outcome of a single-market bet (1X2, OVER_UNDER, BTTS, DOUBLE_CHANCE).
export function resolvePickBetStatus(
  pick: string,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (homeScore === null || awayScore === null) return BetStatus.VOID;
  const condition = PICK_CONDITIONS[pick];
  if (!condition) return BetStatus.VOID;
  return condition(homeScore, awayScore) ? BetStatus.WON : BetStatus.LOST;
}

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
