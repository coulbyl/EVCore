// All strategy domain types now live in the pure core
// (@evcore/analysis-core/strategies). Re-exported here so existing imports
// against './channel-strategy.types' keep resolving unchanged.
export {
  STRATEGY_CHANNEL,
  META_STRATEGY_CHANNELS,
  CHANNEL_DECISION_STATUS,
  MODEL_RUN_PHASE,
  SPORT_TYPE,
} from '@evcore/analysis-core';
export type {
  StrategyChannel,
  ChannelDecisionStatus,
  ModelRunPhase,
  SportType,
  FixtureSnapshot,
  EvaluatedMarket,
  ContextSignals,
  StrategyContext,
  StrategySelection,
  StrategyDecision,
  ChannelStrategy,
} from '@evcore/analysis-core';
