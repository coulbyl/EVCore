import { Market } from '@evcore/db';
import { getChannelStrategyConfig } from './channel-strategy.config';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';

export class BttsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.BTTS;
  readonly allowedMarkets: readonly Market[] = [Market.BTTS];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    const config = getChannelStrategyConfig('BTTS', context.competitionCode);
    if (!config?.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    const bttsProb = context.probabilities.bttsYes;
    if (bttsProb.lessThan(config.threshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'below_threshold',
        reasonDetails: {
          probability: bttsProb.toNumber(),
          threshold: config.threshold,
        },
        selections: [],
      };
    }

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: Market.BTTS,
          pick: 'YES',
          probability: bttsProb,
          rank: 1,
        },
      ],
    };
  }
}
