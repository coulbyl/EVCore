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
export { BttsStrategy } from "./btts.strategy";
export { DrawStrategy } from "./draw.strategy";
export { GoalsStrategy, decideGoals } from "./goals.strategy";
export { ConsensusStrategy, decideConsensus } from "./consensus.strategy";
export { AvoidStrategy, decideAvoid } from "./avoid.strategy";
export {
  DOMINANT_MIN_MARGIN,
  BTTS_NO_CONFIG,
  CHANNEL_STRATEGY_CONFIG_CHANNELS,
  CHANNEL_STRATEGY_CONFIG,
  GOALS_CONFIG,
  getGoalsLineConfigs,
  CONSENSUS_CONFIG,
  AVOID_CONFIG,
  getChannelStrategyConfig,
  type ChannelStrategyLeagueConfig,
  type ChannelStrategyConfigChannel,
  type GoalsLine,
  type GoalsSide,
  type GoalsLineConfig,
  type GoalsLeagueConfig,
} from "./config";
