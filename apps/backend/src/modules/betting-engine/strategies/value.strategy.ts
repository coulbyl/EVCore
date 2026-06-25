import { Market } from '@evcore/analysis-core';
import type { EvaluatedPick, ViablePick } from '../betting-engine.types';
import {
  FALLBACK_MIN_QUALITY_SCORE,
  getModelScoreThreshold,
  LINE_MOVEMENT_THRESHOLD,
} from '../ev.constants';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';

const ALL_MARKETS: readonly Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.DOUBLE_CHANCE,
  Market.HALF_TIME_FULL_TIME,
  Market.OVER_UNDER_HT,
  Market.FIRST_HALF_WINNER,
];

export class ValueStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.VALUE;
  readonly allowedMarkets = ALL_MARKETS;

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;

    if (context.odds === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.MISSING_ODDS,
        selections: [],
      };
    }

    const scoreThreshold = getModelScoreThreshold(context.competitionCode);
    if (context.deterministicScore.lessThan(scoreThreshold)) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'score_below_threshold',
        reasonDetails: {
          score: context.deterministicScore.toNumber(),
          threshold: scoreThreshold.toNumber(),
        },
        selections: [],
      };
    }

    const allPicks = context.evaluatedMarkets.flatMap((m) => m.picks);
    const best = selectBestEvPick(allPicks);

    if (best === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'no_viable_pick',
        selections: [],
      };
    }

    if (
      context.signals.lineMovement !== null &&
      context.signals.lineMovement > LINE_MOVEMENT_THRESHOLD.toNumber()
    ) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'line_movement',
        reasonDetails: { movement: context.signals.lineMovement },
        selections: [],
      };
    }

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: best.market,
          pick: best.pick,
          comboMarket: best.comboMarket,
          comboPick: best.comboPick,
          probability: best.probability,
          odds: best.odds,
          ev: best.ev,
          qualityScore: best.qualityScore,
          rank: 1,
        },
      ],
    };
  }
}

function selectBestEvPick(picks: EvaluatedPick[]): ViablePick | null {
  if (picks.length === 0) return null;

  const topByQuality = picks.reduce<EvaluatedPick | null>(
    (best, p) =>
      best === null || p.qualityScore.greaterThan(best.qualityScore) ? p : best,
    null,
  );
  const primaryWasRejected = topByQuality?.rejectionReason !== undefined;

  const viable = picks
    .filter((p): p is ViablePick => p.rejectionReason === undefined)
    .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));

  if (primaryWasRejected) {
    return (
      viable.find((p) =>
        p.qualityScore.greaterThanOrEqualTo(FALLBACK_MIN_QUALITY_SCORE),
      ) ?? null
    );
  }

  return viable[0] ?? null;
}
