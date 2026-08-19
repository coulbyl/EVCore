// Match probability helpers now live in the pure core
// (@evcore/analysis-core/probability). Re-exported here so existing
// './math/probability' imports keep resolving unchanged.
//
// buildLambdaConfig is the one app-side factory: it reads the per-league
// lookup tables (also in @evcore/analysis-core — same category as
// OU_SHRINKAGE_CONFIG, calibrates the shared probability rather than a
// staking decision) and produces the plain LambdaConfig the core needs.
import {
  type LambdaConfig,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
} from '@evcore/analysis-core';

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
  type OffensiveBalance,
  type OffensiveBalanceClassification,
  type H2HMarketSignalInputs,
  mapProbabilitiesToNumber,
  deriveLambdas,
  computeOffensiveBalance,
  rebalanceThreeWayProbabilities,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
  buildMatchupFeatures,
  blendTeamStats,
  applyH2HMarketSignalCorrection,
} from '@evcore/analysis-core';
