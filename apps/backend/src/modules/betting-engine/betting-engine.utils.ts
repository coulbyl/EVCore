import Decimal from 'decimal.js';
import { BetStatus, Market } from '@evcore/db';
import { FEATURE_WEIGHTS } from './ev.constants';

export type ThreeWayProba = {
  home: Decimal;
  draw: Decimal;
  away: Decimal;
};

export type DerivedMarketsProba = {
  over25: Decimal;
  under25: Decimal;
  bttsYes: Decimal;
  bttsNo: Decimal;
  dc1X: Decimal;
  dcX2: Decimal;
  dc12: Decimal;
};

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

export function poissonProba(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 10,
): ThreeWayProba {
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );

  return poissonProbaFromDistributions(homeDist, awayDist);
}

export function computePoissonMarkets(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 10,
): ThreeWayProba & DerivedMarketsProba {
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );
  const oneXTwo = poissonProbaFromDistributions(homeDist, awayDist);
  const derived = deriveMarketsFromDistributions(homeDist, awayDist, oneXTwo);
  return { ...oneXTwo, ...derived };
}

export function deriveMarketsFromPoisson(input: {
  lambdaHome: number;
  lambdaAway: number;
  oneXTwo: ThreeWayProba;
  maxGoals?: number;
}): DerivedMarketsProba {
  const { lambdaHome, lambdaAway, oneXTwo, maxGoals = 10 } = input;
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );
  return deriveMarketsFromDistributions(homeDist, awayDist, oneXTwo);
}

// Formule EV canonique — source unique pour le service et le backtest
// EV = (probabilité estimée × cote décimale) − 1
export function calculateEV(
  probability: Decimal.Value,
  odds: Decimal.Value,
): Decimal {
  return new Decimal(probability).mul(odds).minus(1);
}

// Fractional Kelly stake sizing.
// Kelly formula for decimal odds: K = (p × odds − 1) / (odds − 1)
// stakePct = fraction × K, capped at maxStake.
// Returns 0 for negative or undefined Kelly (redundant guard — EV ≥ threshold
// ensures positive Kelly, but odds = 1 would cause division by zero).
export function calculateKellyStakePct(
  probability: Decimal.Value,
  odds: Decimal.Value,
  { fraction, maxStake }: { fraction: Decimal.Value; maxStake: Decimal.Value },
): Decimal {
  const p = new Decimal(probability);
  const o = new Decimal(odds);
  if (o.lte(1)) return new Decimal(0);
  const kelly = p.times(o).minus(1).dividedBy(o.minus(1));
  if (kelly.lte(0)) return new Decimal(0);
  return Decimal.min(new Decimal(fraction).times(kelly), new Decimal(maxStake));
}

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

function poissonProbaFromDistributions(
  homeDist: number[],
  awayDist: number[],
): ThreeWayProba {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;

  for (let h = 0; h < homeDist.length; h++) {
    for (let a = 0; a < awayDist.length; a++) {
      const p = homeDist[h] * awayDist[a];
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }

  const total = pHome + pDraw + pAway;
  if (total <= 0) {
    return {
      home: new Decimal(0),
      draw: new Decimal(0),
      away: new Decimal(0),
    };
  }

  return {
    home: new Decimal(pHome / total),
    draw: new Decimal(pDraw / total),
    away: new Decimal(pAway / total),
  };
}

function deriveMarketsFromDistributions(
  homeDist: number[],
  awayDist: number[],
  oneXTwo: ThreeWayProba,
): DerivedMarketsProba {
  let under25 = 0;
  for (let h = 0; h <= Math.min(2, homeDist.length - 1); h++) {
    for (let a = 0; a <= Math.min(2 - h, awayDist.length - 1); a++) {
      under25 += homeDist[h] * awayDist[a];
    }
  }

  const over25 = Math.max(0, 1 - under25);
  // Uses the same truncated+normalized distributions for coherence with 1X2.
  const bttsYes = (1 - (homeDist[0] ?? 0)) * (1 - (awayDist[0] ?? 0));
  const bttsNo = 1 - bttsYes;

  return {
    over25: new Decimal(over25),
    under25: new Decimal(under25),
    bttsYes: new Decimal(bttsYes),
    bttsNo: new Decimal(bttsNo),
    dc1X: oneXTwo.home.plus(oneXTwo.draw),
    dcX2: oneXTwo.draw.plus(oneXTwo.away),
    dc12: oneXTwo.home.plus(oneXTwo.away),
  };
}

function normalizedPoissonDistributions(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number,
): { homeDist: number[]; awayDist: number[] } {
  const safeMaxGoals = Math.max(0, Math.floor(maxGoals));
  const factorialCache = buildFactorialCache(safeMaxGoals);
  return {
    homeDist: normalizedPoissonDistribution(
      lambdaHome,
      safeMaxGoals,
      factorialCache,
    ),
    awayDist: normalizedPoissonDistribution(
      lambdaAway,
      safeMaxGoals,
      factorialCache,
    ),
  };
}

function normalizedPoissonDistribution(
  lambda: number,
  maxGoals: number,
  factorialCache: number[],
): number[] {
  const raw = Array.from({ length: maxGoals + 1 }, (_, k) =>
    poissonPmf(k, lambda, factorialCache),
  );
  const total = raw.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return raw.map(() => 0);
  return raw.map((p) => p / total);
}

function poissonPmf(
  k: number,
  lambda: number,
  factorialCache: number[],
): number {
  if (!Number.isFinite(k) || !Number.isFinite(lambda)) return 0;
  if (k < 0 || lambda < 0) return 0;
  if (!Number.isInteger(k)) return 0;
  if (k >= factorialCache.length) return 0;

  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorialCache[k];
}

function buildFactorialCache(maxN: number): number[] {
  const cache = new Array<number>(maxN + 1);
  cache[0] = 1;
  for (let i = 1; i <= maxN; i++) {
    cache[i] = cache[i - 1] * i;
  }
  return cache;
}

// ─── Multi-market combo helpers ───────────────────────────────────────────────

// Public wrapper exposing the internal normalized distributions for combo scoring.
export function buildPoissonDistributions(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 10,
): { distHome: number[]; distAway: number[] } {
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );
  return { distHome: homeDist, distAway: awayDist };
}

// Conditions mapping pick names → score predicates.
// Used by computeJointProbability and resolvePickBetStatus.
const PICK_CONDITIONS: Record<string, (h: number, a: number) => boolean> = {
  HOME: (h, a) => h > a,
  DRAW: (h, a) => h === a,
  AWAY: (h, a) => h < a,
  OVER: (h, a) => h + a > 2,
  UNDER: (h, a) => h + a <= 2,
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

export const HALF_TIME_FULL_TIME_PICKS = [
  'HOME_HOME',
  'HOME_DRAW',
  'HOME_AWAY',
  'DRAW_HOME',
  'DRAW_DRAW',
  'DRAW_AWAY',
  'AWAY_HOME',
  'AWAY_DRAW',
  'AWAY_AWAY',
] as const;

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
  {
    market1: Market.OVER_UNDER,
    pick1: 'OVER',
    market2: Market.BTTS,
    pick2: 'YES',
  },
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

function outcomeFromScores(
  homeScore: number,
  awayScore: number,
): 'HOME' | 'DRAW' | 'AWAY' {
  if (homeScore > awayScore) return 'HOME';
  if (homeScore < awayScore) return 'AWAY';
  return 'DRAW';
}
