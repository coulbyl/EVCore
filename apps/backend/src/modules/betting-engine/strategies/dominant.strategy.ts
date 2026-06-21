import { Market } from '@evcore/db';
import {
  DOMINANT_MIN_MARGIN,
  getChannelStrategyConfig,
} from './channel-strategy.config';
import { priceForSelection } from './selection-odds';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';

export class DominantStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.DOMINANT;
  readonly allowedMarkets: readonly Market[] = [Market.ONE_X_TWO];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    const config = getChannelStrategyConfig(
      'DOMINANT',
      context.competitionCode,
    );
    if (!config?.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    const { home, draw, away } = context.probabilities;
    const candidates = [
      { pick: 'HOME', probability: home },
      { pick: 'DRAW', probability: draw },
      { pick: 'AWAY', probability: away },
    ].sort((a, b) => b.probability.comparedTo(a.probability));

    const [first, second] = candidates;

    if (first.probability.lessThan(config.threshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'below_threshold',
        reasonDetails: {
          probability: first.probability.toNumber(),
          threshold: config.threshold,
        },
        selections: [],
      };
    }

    if (
      first.probability.minus(second.probability).lessThan(DOMINANT_MIN_MARGIN)
    ) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'insufficient_margin',
        reasonDetails: {
          margin: first.probability.minus(second.probability).toNumber(),
          minMargin: DOMINANT_MIN_MARGIN.toNumber(),
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
          pick: first.pick,
          probability: first.probability,
          ...priceForSelection({
            odds: context.odds,
            market: Market.ONE_X_TWO,
            pick: first.pick,
            probability: first.probability,
          }),
          rank: 1,
        },
      ],
    };
  }
}
