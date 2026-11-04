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
  LEAGUE_STRENGTH_MAP,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
} from '@evcore/analysis-core';

// `leagues` is the national league of each side, which the caller reads for
// a European fixture only: the λ then carry the league-strength factors
// (docs/audits/2026-11-04/FORCE-CHAMPIONNATS.md). Without it the factors
// are 1 / 1.
export function buildLambdaConfig(
  competitionCode?: string | null,
  leagues?: { home: string | null; away: string | null } | null,
): LambdaConfig & { crossLeagueFactors: { home: number; away: number } } {
  const [homeAdvFactor, awayDisadvFactor] =
    getLeagueHomeAwayFactors(competitionCode);
  return {
    meanLambda: getLeagueMeanLambda(competitionCode),
    homeAdvFactor,
    awayDisadvFactor,
    lambdaScale: getLeagueLambdaScale(competitionCode),
    crossLeagueFactors: leagues
      ? crossLeagueLambdaFactors({
          homeLeague: leagues.home,
          awayLeague: leagues.away,
          strengths: LEAGUE_STRENGTH_MAP,
        })
      : { home: 1, away: 1 },
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
