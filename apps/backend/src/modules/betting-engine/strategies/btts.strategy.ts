import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import {
  BTTS_NO_CONFIG,
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

type BttsCandidate = { pick: 'YES' | 'NO'; probability: Decimal };

export class BttsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.BTTS;
  readonly allowedMarkets: readonly Market[] = [Market.BTTS];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    // YES is calibrated per league; NO is calibrated separately and globally
    // (observation only — see BTTS_NO_CONFIG). Both live on the BTTS market.
    const yesConfig = getChannelStrategyConfig('BTTS', context.competitionCode);
    const noConfig = BTTS_NO_CONFIG;

    if (!yesConfig.enabled && !noConfig.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    const { bttsYes, bttsNo } = context.probabilities;
    const candidates: BttsCandidate[] = [];
    if (yesConfig.enabled && !bttsYes.lessThan(yesConfig.threshold)) {
      candidates.push({ pick: 'YES', probability: bttsYes });
    }
    if (noConfig.enabled && !bttsNo.lessThan(noConfig.threshold)) {
      candidates.push({ pick: 'NO', probability: bttsNo });
    }

    if (candidates.length === 0) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'below_threshold',
        reasonDetails: {
          bttsYes: bttsYes.toNumber(),
          yesThreshold: yesConfig.enabled ? yesConfig.threshold : null,
          bttsNo: bttsNo.toNumber(),
          noThreshold: noConfig.enabled ? noConfig.threshold : null,
        },
        selections: [],
      };
    }

    // YES and NO are mutually exclusive; if both clear their thresholds pick the
    // more confident side (higher model probability).
    const best = candidates.reduce((a, b) =>
      b.probability.greaterThan(a.probability) ? b : a,
    );

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: Market.BTTS,
          pick: best.pick,
          probability: best.probability,
          ...priceForSelection({
            odds: context.odds,
            market: Market.BTTS,
            pick: best.pick,
            probability: best.probability,
          }),
          rank: 1,
        },
      ],
    };
  }
}
