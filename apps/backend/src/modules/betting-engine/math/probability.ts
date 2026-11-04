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
  crossLeagueLambdaFactors,
  getLeagueStrengths,
  isEuropeanCompetition,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
} from '@evcore/analysis-core';

// `leagues` (the national league of each side) only matters in a European
// fixture: there the λ carry the league-strength factors
// (docs/audits/2026-11-04/FORCE-CHAMPIONNATS.md). Everywhere else it is
// ignored and the config is the league's own.
export function buildLambdaConfig(
  competitionCode?: string | null,
  leagues?: { home: string | null; away: string | null } | null,
): LambdaConfig {
  const [homeAdvFactor, awayDisadvFactor] =
    getLeagueHomeAwayFactors(competitionCode);
  return {
    meanLambda: getLeagueMeanLambda(competitionCode),
    homeAdvFactor,
    awayDisadvFactor,
    lambdaScale: getLeagueLambdaScale(competitionCode),
    ...(isEuropeanCompetition(competitionCode) && leagues
      ? {
          crossLeagueFactors: crossLeagueLambdaFactors({
            homeLeague: leagues.home,
            awayLeague: leagues.away,
            strengths: getLeagueStrengths(),
          }),
        }
      : {}),
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
  applyCongestionSignalCorrection,
} from '@evcore/analysis-core';
