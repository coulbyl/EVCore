import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { getPredictionConfig } from '../../prediction/prediction.constants';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';

export class DrawStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.DRAW;
  readonly allowedMarkets: readonly Market[] = [Market.ONE_X_TWO];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    // DRAW channel reuses the legacy DRAW prediction config
    const config = getPredictionConfig('DRAW', context.competitionCode);
    if (!config?.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    // The DRAW signal is the bookmaker implied probability (1/drawOdds), not the model draw probability.
    // All league thresholds were backtested on this selector.
    const drawOdds = context.odds?.drawOdds ?? null;
    if (drawOdds === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.MISSING_ODDS,
        selections: [],
      };
    }

    const impliedProb = new Decimal(1).div(drawOdds);
    if (impliedProb.lessThan(config.threshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'below_threshold',
        reasonDetails: {
          impliedProbability: impliedProb.toNumber(),
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
          market: Market.ONE_X_TWO,
          pick: 'DRAW',
          probability: impliedProb,
          odds: drawOdds,
          impliedProbability: impliedProb,
          rank: 1,
        },
      ],
    };
  }
}
