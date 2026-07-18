import Decimal from "decimal.js";
import { asNumber, clamp } from "../math";
import type { MatchProbabilities } from "../selection/types";

export type TeamStatsInput = {
  recentForm: unknown;
  xgFor: unknown;
  xgAgainst: unknown;
  homeWinRate: unknown;
  awayWinRate: unknown;
  drawRate: unknown;
  leagueVolatility: unknown;
};

export type MatchupFeatures = {
  recentForm: Decimal;
  xg: Decimal;
  domExtPerf: Decimal;
  leagueVolat: Decimal;
};

// League-specific tuning injected by the app; the core only does arithmetic.
export type LambdaConfig = {
  meanLambda: number;
  homeAdvFactor: number;
  awayDisadvFactor: number;
  // Per-league goal-level correction applied to both lambdas. Corrects a
  // structural bias where the xG-shrinkage goal expectation is systematically
  // too high/low for a league (measured 2026-06-30: stable across seasons).
  // Optional, default 1.0 (no change) for unlisted leagues.
  lambdaScale?: number;
};

// Bayesian shrinkage weight toward the league mean lambda.
export const LAMBDA_SHRINKAGE_FACTOR = 0.7;

export function mapProbabilitiesToNumber(
  probabilities: MatchProbabilities,
): Record<string, number | Record<string, number>> {
  return {
    home: probabilities.home.toNumber(),
    draw: probabilities.draw.toNumber(),
    away: probabilities.away.toNumber(),
    over15: probabilities.over15.toNumber(),
    under15: probabilities.under15.toNumber(),
    over25: probabilities.over25.toNumber(),
    under25: probabilities.under25.toNumber(),
    over35: probabilities.over35.toNumber(),
    under35: probabilities.under35.toNumber(),
    over45: probabilities.over45.toNumber(),
    under45: probabilities.under45.toNumber(),
    bttsYes: probabilities.bttsYes.toNumber(),
    bttsNo: probabilities.bttsNo.toNumber(),
    dc1X: probabilities.dc1X.toNumber(),
    dcX2: probabilities.dcX2.toNumber(),
    dc12: probabilities.dc12.toNumber(),
    dnbHome: probabilities.dnbHome.toNumber(),
    dnbAway: probabilities.dnbAway.toNumber(),
    teamTotalHome: Object.fromEntries(
      Object.entries(probabilities.teamTotalHome).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    teamTotalAway: Object.fromEntries(
      Object.entries(probabilities.teamTotalAway).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    cleanSheetHome: probabilities.cleanSheetHome.toNumber(),
    cleanSheetAway: probabilities.cleanSheetAway.toNumber(),
    winToNilHome: probabilities.winToNilHome.toNumber(),
    winToNilAway: probabilities.winToNilAway.toNumber(),
    winEitherHalfHome: probabilities.winEitherHalfHome.toNumber(),
    winEitherHalfAway: probabilities.winEitherHalfAway.toNumber(),
    htft: Object.fromEntries(
      Object.entries(probabilities.htft).map(([pick, value]) => [
        pick,
        value.toNumber(),
      ]),
    ),
    ouHT: Object.fromEntries(
      Object.entries(probabilities.ouHT).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    firstHalfWinner: {
      home: probabilities.firstHalfWinner.home.toNumber(),
      draw: probabilities.firstHalfWinner.draw.toNumber(),
      away: probabilities.firstHalfWinner.away.toNumber(),
    },
    secondHalfWinner: {
      home: probabilities.secondHalfWinner.home.toNumber(),
      draw: probabilities.secondHalfWinner.draw.toNumber(),
      away: probabilities.secondHalfWinner.away.toNumber(),
    },
  };
}

export function deriveLambdas(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
  config: LambdaConfig,
): { home: number; away: number } {
  const homeXgFor = asNumber(homeStats.xgFor);
  const awayXgFor = asNumber(awayStats.xgFor);
  const homeXgAgainst = asNumber(homeStats.xgAgainst);
  const awayXgAgainst = asNumber(awayStats.xgAgainst);

  const leagueAvg = Math.max(
    0.5,
    (homeXgFor + awayXgFor + homeXgAgainst + awayXgAgainst) / 4,
  );

  const rawHome =
    LAMBDA_SHRINKAGE_FACTOR * ((homeXgFor * awayXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * config.meanLambda;
  const rawAway =
    LAMBDA_SHRINKAGE_FACTOR * ((awayXgFor * homeXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * config.meanLambda;

  const scale = config.lambdaScale ?? 1;
  return {
    home: clamp(rawHome * config.homeAdvFactor * scale, 0.05, 5),
    away: clamp(rawAway * config.awayDisadvFactor * scale, 0.05, 5),
  };
}

export function rebalanceThreeWayProbabilities(input: {
  probabilities: MatchProbabilities;
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  blendWeight: Decimal;
}): MatchProbabilities {
  const { probabilities, homeStats, awayStats, blendWeight } = input;
  if (blendWeight.lte(0)) return probabilities;

  const targetDraw = clamp(
    (clamp(asNumber(homeStats.drawRate), 0.05, 0.6) +
      clamp(asNumber(awayStats.drawRate), 0.05, 0.6)) /
      2,
    0.05,
    0.6,
  );
  const homeWinRate = clamp(asNumber(homeStats.homeWinRate), 0.01, 0.95);
  const awayWinRate = clamp(asNumber(awayStats.awayWinRate), 0.01, 0.95);
  const directionalTargetBase = homeWinRate + awayWinRate;
  if (directionalTargetBase <= 0) return probabilities;

  const targetHomeShare = homeWinRate / directionalTargetBase;
  const targetHome = (1 - targetDraw) * targetHomeShare;
  const targetAway = 1 - targetDraw - targetHome;
  const weight = blendWeight.toNumber();

  const home = new Decimal(
    probabilities.home.toNumber() * (1 - weight) + targetHome * weight,
  );
  const draw = new Decimal(
    probabilities.draw.toNumber() * (1 - weight) + targetDraw * weight,
  );
  const away = new Decimal(
    probabilities.away.toNumber() * (1 - weight) + targetAway * weight,
  );

  const nonDrawMass = home.plus(away);

  return {
    ...probabilities,
    home,
    draw,
    away,
    dc1X: home.plus(draw),
    dcX2: draw.plus(away),
    dc12: home.plus(away),
    dnbHome: nonDrawMass.isZero() ? new Decimal(0.5) : home.div(nonDrawMass),
    dnbAway: nonDrawMass.isZero() ? new Decimal(0.5) : away.div(nonDrawMass),
  };
}

export function buildMatchupFeatures(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
): MatchupFeatures {
  const recentForm = clamp01(
    (asNumber(homeStats.recentForm) + (1 - asNumber(awayStats.recentForm))) / 2,
  );
  const xg = clamp01(
    asNumber(homeStats.xgFor) /
      Math.max(0.1, asNumber(homeStats.xgFor) + asNumber(awayStats.xgFor)),
  );
  const domExtPerf = clamp01(
    (asNumber(homeStats.homeWinRate) + (1 - asNumber(awayStats.awayWinRate))) /
      2,
  );
  const leagueVolat = clamp01(
    Math.max(
      asNumber(homeStats.leagueVolatility),
      asNumber(awayStats.leagueVolatility),
    ) / 3,
  );

  return {
    recentForm: new Decimal(recentForm),
    xg: new Decimal(xg),
    domExtPerf: new Decimal(domExtPerf),
    leagueVolat: new Decimal(leagueVolat),
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

type BlendTeamStatsInput = {
  primary: TeamStatsInput;
  secondary: TeamStatsInput;
  formWeight: number;
  xgWeight: number;
};

export function blendTeamStats({
  primary,
  secondary,
  formWeight,
  xgWeight,
}: BlendTeamStatsInput): TeamStatsInput {
  const fw1 = 1 - formWeight;
  const xw1 = 1 - xgWeight;
  return {
    recentForm:
      asNumber(primary.recentForm) * formWeight +
      asNumber(secondary.recentForm) * fw1,
    xgFor: asNumber(primary.xgFor) * xgWeight + asNumber(secondary.xgFor) * xw1,
    xgAgainst:
      asNumber(primary.xgAgainst) * xgWeight +
      asNumber(secondary.xgAgainst) * xw1,
    homeWinRate: secondary.homeWinRate,
    awayWinRate: secondary.awayWinRate,
    drawRate: secondary.drawRate,
    leagueVolatility: primary.leagueVolatility,
  };
}
