import Decimal from 'decimal.js';
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

export function deriveMarketsFromPoisson(
  lambdaHome: number,
  lambdaAway: number,
  oneXTwo: ThreeWayProba,
  maxGoals = 10,
): DerivedMarketsProba {
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );
  return deriveMarketsFromDistributions(homeDist, awayDist, oneXTwo);
}

export function calculateDeterministicScore(
  features: DeterministicFeatures,
): Decimal {
  return new Decimal(features.recentForm)
    .times(FEATURE_WEIGHTS.recentForm)
    .plus(new Decimal(features.xg).times(FEATURE_WEIGHTS.xg))
    .plus(new Decimal(features.domExtPerf).times(FEATURE_WEIGHTS.domExtPerf))
    .plus(new Decimal(features.leagueVolat).times(FEATURE_WEIGHTS.leagueVolat));
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
