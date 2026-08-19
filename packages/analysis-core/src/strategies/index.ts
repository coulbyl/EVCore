export type {
  FixtureSnapshot,
  EvaluatedMarket,
  ContextSignals,
  StrategyContext,
  StrategySelection,
  StrategyDecision,
  ChannelStrategy,
} from "./types";
export {
  buildStrategyContext,
  type BuildStrategyContextInput,
} from "./context-builder";
export { ChannelStrategyOrchestrator } from "./orchestrator";
export { V1_STRATEGIES, createChannelStrategyOrchestrator } from "./registry";
export { ValueStrategy } from "./value.strategy";
export { SafeStrategy } from "./safe.strategy";
export { DominantStrategy } from "./dominant.strategy";
export { BttsStrategy, decideBtts } from "./btts.strategy";
export { DrawStrategy } from "./draw.strategy";
export { GoalsStrategy, decideGoals } from "./goals.strategy";
export { CleanSheetStrategy, decideCleanSheet } from "./clean-sheet.strategy";
export { TeamTotalStrategy, decideTeamTotal } from "./team-total.strategy";
export {
  WinEitherHalfStrategy,
  decideWinEitherHalf,
} from "./win-either-half.strategy";
export { ConsensusStrategy, decideConsensus } from "./consensus.strategy";
export { AvoidStrategy, decideAvoid } from "./avoid.strategy";
export {
  CorrectScoreStrategy,
  decideCorrectScore,
} from "./correct-score.strategy";
export {
  ResultTotalGoalsStrategy,
  decideResultTotalGoals,
} from "./result-total-goals.strategy";
export {
  OverUnderHtStrategy,
  decideOverUnderHt,
} from "./over-under-ht.strategy";
export { ResultBttsStrategy, decideResultBtts } from "./result-btts.strategy";
export { DrawNoBetStrategy, decideDrawNoBet } from "./draw-no-bet.strategy";
export { WinToNilStrategy, decideWinToNil } from "./win-to-nil.strategy";
export {
  DoubleChanceStrategy,
  decideDoubleChance,
} from "./double-chance.strategy";
export {
  FirstHalfWinnerStrategy,
  decideFirstHalfWinner,
} from "./first-half-winner.strategy";
export {
  HalfTimeFullTimeStrategy,
  decideHalfTimeFullTime,
} from "./half-time-full-time.strategy";
export type {
  ChannelStrategyLeagueConfig,
  ChannelStrategyConfigChannel,
} from "./channel-strategy-config.types";
export {
  CHANNEL_STRATEGY_CONFIG_CHANNELS,
  getChannelStrategyConfig,
} from "./channel-strategy.config";
export { DOMINANT_MIN_MARGIN, DOMINANT_MIN_ODDS } from "./dominant.config";
export {
  FIRST_HALF_WINNER_MIN_MARGIN,
  FIRST_HALF_CONFIG,
} from "./first-half-winner.config";
export { CLEAN_SHEET_CONFIG } from "./clean-sheet.config";
export { WIN_EITHER_HALF_CONFIG } from "./win-either-half.config";
export { WIN_TO_NIL_CONFIG } from "./win-to-nil.config";
export { DOUBLE_CHANCE_CONFIG } from "./double-chance.config";
export { HALF_TIME_FULL_TIME_CONFIG } from "./half-time-full-time.config";
export {
  GOALS_CONFIG,
  getGoalsLineConfigs,
  type GoalsLine,
  type GoalsSide,
  type GoalsLineConfig,
  type GoalsLeagueConfig,
} from "./goals.config";
export {
  TEAM_TOTAL_CONFIG,
  getTeamTotalLineConfigs,
  type TeamTotalTeam,
  type TeamTotalLine,
  type TeamTotalSide,
  type TeamTotalLineConfig,
  type TeamTotalLeagueConfig,
} from "./team-total.config";
export { CONSENSUS_CONFIG } from "./consensus.config";
export { AVOID_CONFIG } from "./avoid.config";
export { CORRECT_SCORE_CONFIG } from "./correct-score.config";
export {
  getResultTotalGoalsLineConfigs,
  type ResultTotalGoalsSide,
  type ResultTotalGoalsLine,
  type ResultTotalGoalsLineConfig,
} from "./result-total-goals.config";
export {
  getOverUnderHtLineConfigs,
  type OverUnderHtLine,
  type OverUnderHtSide,
  type OverUnderHtLineConfig,
} from "./over-under-ht.config";
export {
  getResultBttsPickConfigs,
  type ResultBttsSide,
  type ResultBttsOutcome,
  type ResultBttsPickConfig,
  type ResultBttsLeagueConfig,
} from "./result-btts.config";
export {
  getDrawNoBetConfig,
  DRAW_NO_BET_CONFIG,
  DRAW_NO_BET_DEFAULT,
} from "./draw-no-bet.config";
