export {
  type ThreeWayProba,
  type DerivedMarketsProba,
  type ResultTotalGoalsProba,
  type ResultBttsProba,
  type TeamTotalProba,
  HALF_TIME_FULL_TIME_PICKS,
  type HalfTimeFullTimePick,
  outcomeFromScores,
  isHalfTimeFullTimePick,
} from "./markets";
export {
  poissonProba,
  computePoissonMarkets,
  deriveMarketsFromPoisson,
  buildPoissonDistributions,
  computeCorrectScoreMatrix,
} from "./poisson";
export {
  type OverUnderShrinkageConfig,
  type TeamTotalShrinkageBlock,
  type ResultTotalGoalsShrinkageBlock,
  OU_SHRINKAGE_CONFIG,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
} from "./ou-shrinkage";
export {
  type TeamStatsInput,
  type MatchupFeatures,
  type LambdaConfig,
  type OffensiveBalance,
  type OffensiveBalanceClassification,
  LAMBDA_SHRINKAGE_FACTOR,
  mapProbabilitiesToNumber,
  deriveLambdas,
  computeOffensiveBalance,
  rebalanceThreeWayProbabilities,
  buildMatchupFeatures,
  blendTeamStats,
  getLeagueThreeWayEmpiricalBlendWeight,
} from "./match-stats";
export {
  getLeagueMeanLambda,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  HOME_ADVANTAGE_LAMBDA_FACTOR,
  AWAY_DISADVANTAGE_LAMBDA_FACTOR,
} from "./league-lambda-config";
export {
  type H2HMarketSignalInputs,
  H2H_MARKET_SIGNAL_DELTAS,
  logit,
  sigmoid,
  applyH2HMarketSignalCorrection,
} from "./h2h-market-signal-correction";
export {
  type H2HLeg,
  type H2HMarketSignals,
  type H2HScorelineSignal,
  H2H_LIMIT_DEFAULT,
  H2H_MIN_SAMPLE,
  H2H_DECAY,
  H2H_DRAW_SCORE,
  computeH2HScoreFromLegs,
  computeH2HMarketSignalsFromLegs,
  computeH2HScorelineSignalFromLegs,
} from "./h2h";
export {
  type TeamCongestionInputs,
  CONGESTION_UPCOMING_WINDOW_MS,
  computeRestPenalty,
  computeTeamCongestionScore,
  computeCongestionScoreFromTeams,
} from "./congestion";
export {
  CONGESTION_SIGNAL_DELTA,
  applyCongestionSignalCorrection,
} from "./congestion-signal-correction";
export {
  type ResolveEffectiveTeamStatsInput,
  EUROPEAN_COMPETITION_CODE_SET,
  isEuropeanCompetition,
  EUROPEAN_CROSS_COMP_FORM_WEIGHT,
  EUROPEAN_CROSS_COMP_XG_WEIGHT,
  NATIONAL_TEAM_COMPETITION_CODE_SET,
  isNationalTeamCompetition,
  NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT,
  NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT,
  DOMESTIC_SEASON_ROLLOVER_FORM_WEIGHT,
  DOMESTIC_SEASON_ROLLOVER_XG_WEIGHT,
  DOMESTIC_SEASON_ROLLOVER_MIN_GAMES,
  resolveEffectiveTeamStats,
} from "./team-stats-resolution";
