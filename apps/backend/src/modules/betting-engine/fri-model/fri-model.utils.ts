import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import {
  buildPoissonDistributions,
  deriveMarketsFromPoisson,
  type ThreeWayProba,
} from '../betting-engine.utils';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';
import {
  FRI_DRAW_TO_GOALS_SENSITIVITY,
  FRI_DRAW_RATE,
  FRI_GOAL_SHARE_MAX,
  FRI_GOAL_SHARE_MIN,
  FRI_GOAL_TOTAL_BASE,
  FRI_GOAL_TOTAL_MAX,
  FRI_GOAL_TOTAL_MIN,
  FRI_HOME_ADVANTAGE_ELO,
} from './fri-model.constants';

const ZERO = new Decimal(0);

export function buildFriSupportedMarkets(): ReadonlySet<Market> {
  return new Set<Market>([
    Market.ONE_X_TWO,
    Market.DOUBLE_CHANCE,
    Market.BTTS,
    Market.OVER_UNDER,
    Market.OVER_UNDER_HT,
    Market.FIRST_HALF_WINNER,
    Market.HALF_TIME_FULL_TIME,
  ]);
}

export function eloExpectedScore(
  homeElo: number,
  awayElo: number,
  homeAdvantage = FRI_HOME_ADVANTAGE_ELO,
): number {
  return 1 / (10 ** (-(homeElo - awayElo + homeAdvantage) / 400) + 1);
}

export function buildFriMatchProbabilities(
  oneXTwo: ThreeWayProba,
): MatchProbabilities {
  const nonDrawMass = oneXTwo.home.plus(oneXTwo.away);
  return {
    home: oneXTwo.home,
    draw: oneXTwo.draw,
    away: oneXTwo.away,
    over15: ZERO,
    under15: ZERO,
    over25: ZERO,
    under25: ZERO,
    over35: ZERO,
    under35: ZERO,
    over45: ZERO,
    under45: ZERO,
    bttsYes: ZERO,
    bttsNo: ZERO,
    dc1X: oneXTwo.home.plus(oneXTwo.draw),
    dcX2: oneXTwo.draw.plus(oneXTwo.away),
    dc12: oneXTwo.home.plus(oneXTwo.away),
    // Derivable from home/away alone (no goal distribution needed), unlike
    // teamTotal below which requires per-side Poisson marginals FRI doesn't model.
    dnbHome: nonDrawMass.isZero()
      ? new Decimal(0.5)
      : oneXTwo.home.div(nonDrawMass),
    dnbAway: nonDrawMass.isZero()
      ? new Decimal(0.5)
      : oneXTwo.away.div(nonDrawMass),
    teamTotalHome: {},
    teamTotalAway: {},
    // Requires per-side goal distributions FRI doesn't model, same as teamTotal.
    cleanSheetHome: ZERO,
    cleanSheetAway: ZERO,
    winToNilHome: ZERO,
    winToNilAway: ZERO,
    htft: {
      HOME_HOME: ZERO,
      HOME_DRAW: ZERO,
      HOME_AWAY: ZERO,
      DRAW_HOME: ZERO,
      DRAW_DRAW: ZERO,
      DRAW_AWAY: ZERO,
      AWAY_HOME: ZERO,
      AWAY_DRAW: ZERO,
      AWAY_AWAY: ZERO,
    },
    ouHT: {
      OVER_0_5: ZERO,
      UNDER_0_5: ZERO,
      OVER_1_5: ZERO,
      UNDER_1_5: ZERO,
    },
    firstHalfWinner: { home: ZERO, draw: ZERO, away: ZERO },
    secondHalfWinner: { home: ZERO, draw: ZERO, away: ZERO },
    winEitherHalfHome: ZERO,
    winEitherHalfAway: ZERO,
  };
}

export function eloProbabilities(
  homeElo: number,
  awayElo: number,
  drawRate = FRI_DRAW_RATE,
): MatchProbabilities {
  const winExpectation = eloExpectedScore(homeElo, awayElo);
  const draw = drawRate * (1 - Math.abs(2 * winExpectation - 1));
  return buildFriMatchProbabilities({
    home: new Decimal(winExpectation * (1 - draw)),
    draw: new Decimal(draw),
    away: new Decimal((1 - winExpectation) * (1 - draw)),
  });
}

export function devigOneXTwoOdds(odds: FullOddsSnapshot): MatchProbabilities {
  const homeInverse = new Decimal(1).div(odds.homeOdds);
  const drawInverse = new Decimal(1).div(odds.drawOdds);
  const awayInverse = new Decimal(1).div(odds.awayOdds);
  const total = homeInverse.plus(drawInverse).plus(awayInverse);

  return buildFriMatchProbabilities({
    home: homeInverse.div(total),
    draw: drawInverse.div(total),
    away: awayInverse.div(total),
  });
}

export function computeFriDeterministicScore(
  probabilities: MatchProbabilities | null,
): Decimal {
  if (probabilities === null) {
    return ZERO;
  }

  return Decimal.max(
    probabilities.home,
    probabilities.draw,
    probabilities.away,
  );
}

export function estimateFriGoalTotal(oneXTwo: ThreeWayProba): number {
  const drawProbability = oneXTwo.draw.toNumber();
  const adjusted =
    FRI_GOAL_TOTAL_BASE -
    (drawProbability - FRI_DRAW_RATE) * FRI_DRAW_TO_GOALS_SENSITIVITY;

  return clamp(adjusted, FRI_GOAL_TOTAL_MIN, FRI_GOAL_TOTAL_MAX);
}

export function estimateFriGoalShare(oneXTwo: ThreeWayProba): number {
  const home = oneXTwo.home.toNumber();
  const away = oneXTwo.away.toNumber();
  const nonDrawMass = home + away;
  if (nonDrawMass <= Number.EPSILON) {
    return 0.5;
  }

  return clamp(home / nonDrawMass, FRI_GOAL_SHARE_MIN, FRI_GOAL_SHARE_MAX);
}

export function estimateFriLambdas(oneXTwo: ThreeWayProba): {
  home: number;
  away: number;
} {
  const goalTotal = estimateFriGoalTotal(oneXTwo);
  const homeShare = estimateFriGoalShare(oneXTwo);
  const home = goalTotal * homeShare;
  const away = Math.max(goalTotal - home, 0.05);

  return { home, away };
}

export function buildFriPoissonModel(oneXTwo: ThreeWayProba): {
  probabilities: MatchProbabilities;
  lambda: { home: number; away: number };
  distHome: number[];
  distAway: number[];
} {
  const lambda = estimateFriLambdas(oneXTwo);
  const { distHome, distAway } = buildPoissonDistributions(
    lambda.home,
    lambda.away,
  );
  const derivedMarkets = deriveMarketsFromPoisson({
    lambdaHome: lambda.home,
    lambdaAway: lambda.away,
    oneXTwo,
  });

  return {
    probabilities: {
      home: oneXTwo.home,
      draw: oneXTwo.draw,
      away: oneXTwo.away,
      ...derivedMarkets,
    },
    lambda,
    distHome,
    distAway,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
