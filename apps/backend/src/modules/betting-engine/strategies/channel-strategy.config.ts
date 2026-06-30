// Channel strategy config now lives in the pure core
// (@evcore/analysis-core/strategies). Re-exported here so existing imports
// keep resolving unchanged.
export {
  DOMINANT_MIN_MARGIN,
  BTTS_NO_CONFIG,
  getBttsNoConfig,
  CHANNEL_STRATEGY_CONFIG_CHANNELS,
  CHANNEL_STRATEGY_CONFIG,
  GOALS_CONFIG,
  getGoalsLineConfigs,
  CONSENSUS_CONFIG,
  AVOID_CONFIG,
  getChannelStrategyConfig,
  type BttsNoLeagueConfig,
  type ChannelStrategyLeagueConfig,
  type ChannelStrategyConfigChannel,
  type GoalsLine,
  type GoalsSide,
  type GoalsLineConfig,
  type GoalsLeagueConfig,
} from '@evcore/analysis-core';
