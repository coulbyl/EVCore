import Decimal from "decimal.js";
import {
  type DerivedMarketsProba,
  type FirstHalfMarkets,
  HALF_TIME_FULL_TIME_PICKS,
  type HalfTimeFullTimePick,
  isHalfTimeFullTimePick,
  outcomeFromScores,
  type TeamTotalProba,
  type ThreeWayProba,
} from "./markets";

// Empirical share of a match's goals scored in the first half. Football is not
// half-symmetric — teams open cautiously and games break open later. Measured at
// 0.444 across 40,550 finished fixtures in this DB (first-half goals 1.239 vs
// full-time 2.791). The naive λ/2 split assumes 0.50, over-predicting first-half
// goals by ~13% and inflating every half-time market (HT Over/Under, HT/FT,
// First-Half Winner). At 0.44, P(HT Over 1.5) lands on the empirical base rate
// (~0.351 modeled vs 0.353 actual). The second half carries the complement so the
// two halves still sum to the full-time lambda (coherent with 1X2).
const FIRST_HALF_GOAL_FRACTION = 0.44;

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

function poissonProbaFromDistributions(
  homeDist: number[],
  awayDist: number[],
): ThreeWayProba {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;

  for (let h = 0; h < homeDist.length; h++) {
    for (let a = 0; a < awayDist.length; a++) {
      const p = (homeDist[h] ?? 0) * (awayDist[a] ?? 0);
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
  let under15 = 0;
  let under25 = 0;
  let under35 = 0;
  let under45 = 0;

  for (let h = 0; h <= Math.min(1, homeDist.length - 1); h++) {
    for (let a = 0; a <= Math.min(1 - h, awayDist.length - 1); a++) {
      under15 += (homeDist[h] ?? 0) * (awayDist[a] ?? 0);
    }
  }
  for (let h = 0; h <= Math.min(2, homeDist.length - 1); h++) {
    for (let a = 0; a <= Math.min(2 - h, awayDist.length - 1); a++) {
      under25 += (homeDist[h] ?? 0) * (awayDist[a] ?? 0);
    }
  }
  for (let h = 0; h <= Math.min(3, homeDist.length - 1); h++) {
    for (let a = 0; a <= Math.min(3 - h, awayDist.length - 1); a++) {
      under35 += (homeDist[h] ?? 0) * (awayDist[a] ?? 0);
    }
  }
  for (let h = 0; h <= Math.min(4, homeDist.length - 1); h++) {
    for (let a = 0; a <= Math.min(4 - h, awayDist.length - 1); a++) {
      under45 += (homeDist[h] ?? 0) * (awayDist[a] ?? 0);
    }
  }

  const over15 = Math.max(0, 1 - under15);
  const over25 = Math.max(0, 1 - under25);
  const over35 = Math.max(0, 1 - under35);
  const over45 = Math.max(0, 1 - under45);
  // Uses the same truncated+normalized distributions for coherence with 1X2.
  const bttsYes = (1 - (homeDist[0] ?? 0)) * (1 - (awayDist[0] ?? 0));
  const bttsNo = 1 - bttsYes;
  const { htft, ouHT, firstHalfWinner } =
    computeFirstHalfMarketsFromMatchDistributions(homeDist, awayDist);

  // Draw No Bet: renormalize home/away over the non-draw mass only — distinct
  // from dc1X/dc12 below, which are unnormalized sums that still include the
  // draw as part of a two-way payout.
  const nonDrawMass = oneXTwo.home.plus(oneXTwo.away);
  const dnbHome = nonDrawMass.isZero()
    ? new Decimal(0.5)
    : oneXTwo.home.div(nonDrawMass);
  const dnbAway = nonDrawMass.isZero()
    ? new Decimal(0.5)
    : oneXTwo.away.div(nonDrawMass);

  return {
    over15: new Decimal(over15),
    under15: new Decimal(under15),
    over25: new Decimal(over25),
    under25: new Decimal(under25),
    over35: new Decimal(over35),
    under35: new Decimal(under35),
    over45: new Decimal(over45),
    under45: new Decimal(under45),
    bttsYes: new Decimal(bttsYes),
    bttsNo: new Decimal(bttsNo),
    dc1X: oneXTwo.home.plus(oneXTwo.draw),
    dcX2: oneXTwo.draw.plus(oneXTwo.away),
    dc12: oneXTwo.home.plus(oneXTwo.away),
    dnbHome,
    dnbAway,
    teamTotalHome: computeTeamTotalProba(homeDist),
    teamTotalAway: computeTeamTotalProba(awayDist),
    htft,
    ouHT,
    firstHalfWinner,
  };
}

// Team Total: marginal Over/Under X.5 for a single side's own Poisson
// distribution — no joint distribution needed since each side's goals are
// modeled independently.
function computeTeamTotalProba(dist: number[]): TeamTotalProba {
  const proba: TeamTotalProba = {};
  const lines = [0, 1, 2, 3, 4, 5, 6] as const;
  for (const line of lines) {
    let under = 0;
    for (let g = 0; g <= Math.min(line, dist.length - 1); g++) {
      under += dist[g] ?? 0;
    }
    const over = Math.max(0, 1 - under);
    proba[`UNDER_${line}_5`] = new Decimal(under);
    proba[`OVER_${line}_5`] = new Decimal(over);
  }
  return proba;
}

// Derives HT/FT, Over/Under HT, and First Half Winner from the full-time
// Poisson distributions. All three share the same homeHalfDist/awayHalfDist
// so the computation is done in a single pass.
function computeFirstHalfMarketsFromMatchDistributions(
  homeDist: number[],
  awayDist: number[],
): FirstHalfMarkets {
  const maxGoals = Math.max(0, homeDist.length - 1, awayDist.length - 1);
  const factorialCache = buildFactorialCache(maxGoals);
  const lambdaHome = expectedGoalsFromDistribution(homeDist);
  const lambdaAway = expectedGoalsFromDistribution(awayDist);

  const homeHalfDist = normalizedPoissonDistribution(
    lambdaHome * FIRST_HALF_GOAL_FRACTION,
    maxGoals,
    factorialCache,
  );
  const awayHalfDist = normalizedPoissonDistribution(
    lambdaAway * FIRST_HALF_GOAL_FRACTION,
    maxGoals,
    factorialCache,
  );
  // Halves are independent but NOT identical: the second half carries the larger
  // share (1 − FIRST_HALF_GOAL_FRACTION) so 1H + 2H sums back to the full-time
  // lambda, keeping HT/FT coherent with the 1X2 distribution.
  const homeSecondDist = normalizedPoissonDistribution(
    lambdaHome * (1 - FIRST_HALF_GOAL_FRACTION),
    maxGoals,
    factorialCache,
  );
  const awaySecondDist = normalizedPoissonDistribution(
    lambdaAway * (1 - FIRST_HALF_GOAL_FRACTION),
    maxGoals,
    factorialCache,
  );

  const htftTotals = Object.fromEntries(
    HALF_TIME_FULL_TIME_PICKS.map((pick) => [pick, 0]),
  ) as Record<HalfTimeFullTimePick, number>;

  let under0_5_ht = 0;
  let under1_5_ht = 0;
  let homeHT = 0;
  let drawHT = 0;
  let awayHT = 0;

  for (let h1 = 0; h1 < homeHalfDist.length; h1++) {
    for (let a1 = 0; a1 < awayHalfDist.length; a1++) {
      const pHalf = (homeHalfDist[h1] ?? 0) * (awayHalfDist[a1] ?? 0);
      if (pHalf <= 0) continue;

      // OU HT
      if (h1 + a1 === 0) under0_5_ht += pHalf;
      if (h1 + a1 <= 1) under1_5_ht += pHalf;

      // First Half Winner
      if (h1 > a1) homeHT += pHalf;
      else if (h1 === a1) drawHT += pHalf;
      else awayHT += pHalf;

      // HT/FT
      const halfOutcome = outcomeFromScores(h1, a1);
      for (let h2 = 0; h2 < homeSecondDist.length; h2++) {
        for (let a2 = 0; a2 < awaySecondDist.length; a2++) {
          const p =
            pHalf * (homeSecondDist[h2] ?? 0) * (awaySecondDist[a2] ?? 0);
          if (p <= 0) continue;
          const fullOutcome = outcomeFromScores(h1 + h2, a1 + a2);
          const pick = `${halfOutcome}_${fullOutcome}`;
          if (isHalfTimeFullTimePick(pick)) {
            htftTotals[pick] += p;
          }
        }
      }
    }
  }

  return {
    htft: Object.fromEntries(
      HALF_TIME_FULL_TIME_PICKS.map((pick) => [
        pick,
        new Decimal(htftTotals[pick]),
      ]),
    ) as Record<HalfTimeFullTimePick, Decimal>,
    ouHT: {
      OVER_0_5: new Decimal(Math.max(0, 1 - under0_5_ht)),
      UNDER_0_5: new Decimal(under0_5_ht),
      OVER_1_5: new Decimal(Math.max(0, 1 - under1_5_ht)),
      UNDER_1_5: new Decimal(under1_5_ht),
    },
    firstHalfWinner: {
      home: new Decimal(homeHT),
      draw: new Decimal(drawHT),
      away: new Decimal(awayHT),
    },
  };
}

function expectedGoalsFromDistribution(distribution: number[]): number {
  return distribution.reduce((sum, p, goals) => sum + goals * p, 0);
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
  const factorial = factorialCache[k];
  if (factorial === undefined) return 0;

  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial;
}

function buildFactorialCache(maxN: number): number[] {
  const cache = new Array<number>(maxN + 1);
  cache[0] = 1;
  for (let i = 1; i <= maxN; i++) {
    cache[i] = (cache[i - 1] ?? 1) * i;
  }
  return cache;
}

// Full-time exact-score distribution: P(home=h, away=a) for every scoreline on a
// 0..maxGoals grid, as a map keyed "H:A". Built from the SAME normalized Poisson
// distributions as 1X2/Over-Under/BTTS (independent product — Dixon-Coles was
// empirically rejected 2026-06-30: no gain on goal markets, worse on exact score),
// so it is coherent with them: summing cells by outcome reproduces the 1X2 vector.
// The grid captures essentially all realistically-priced scorelines; tail cells
// beyond it carry negligible probability. Powers the CORRECT_SCORE channel
// (observation-only) — a priced scoreline maps to its cell probability + EV.
export function computeCorrectScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 6,
): Record<string, Decimal> {
  const { homeDist, awayDist } = normalizedPoissonDistributions(
    lambdaHome,
    lambdaAway,
    maxGoals,
  );
  const matrix: Record<string, Decimal> = {};
  for (let h = 0; h < homeDist.length; h++) {
    for (let a = 0; a < awayDist.length; a++) {
      matrix[`${h}:${a}`] = new Decimal(
        (homeDist[h] ?? 0) * (awayDist[a] ?? 0),
      );
    }
  }
  return matrix;
}

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
