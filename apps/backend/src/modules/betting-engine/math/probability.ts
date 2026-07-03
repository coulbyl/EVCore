// Match probability helpers now live in the pure core
// (@evcore/analysis-core/probability). Re-exported here so existing
// './math/probability' imports keep resolving unchanged.
//
// buildLambdaConfig is the one app-side factory: it reads the league lookup
// tables from ev.constants and produces the plain LambdaConfig the core needs.
import type { LambdaConfig } from '@evcore/analysis-core';
import {
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
} from '../ev.constants';

export function buildLambdaConfig(
  competitionCode?: string | null,
): LambdaConfig {
  const [homeAdvFactor, awayDisadvFactor] =
    getLeagueHomeAwayFactors(competitionCode);
  return {
    meanLambda: getLeagueMeanLambda(competitionCode),
    homeAdvFactor,
    awayDisadvFactor,
    lambdaScale: getLeagueLambdaScale(competitionCode),
  };
}

export {
  type TeamStatsInput,
  type MatchupFeatures,
  type LambdaConfig,
  mapProbabilitiesToNumber,
  deriveLambdas,
  rebalanceThreeWayProbabilities,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
  buildMatchupFeatures,
  blendTeamStats,
} from '@evcore/analysis-core';
