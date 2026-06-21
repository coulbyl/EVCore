import { Market } from '@evcore/db';
import type { EvaluatedPick, ViablePick } from '../betting-engine.types';
import { buildBetPickKey } from '../betting-engine.utils';
import {
  EV_HARD_CAP,
  getModelScoreThreshold,
  getSvMinOdds,
  getSvMinProbability,
  SAFE_VALUE_MAX_ODDS,
  SAFE_VALUE_MIN_EV,
  SV_UNDER_LAMBDA_COMPARISON_THRESHOLD,
} from '../ev.constants';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';

const SAFE_MARKETS: readonly Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.OVER_UNDER_HT,
];

export class SafeStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.SAFE;
  readonly allowedMarkets = SAFE_MARKETS;

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

    const evDecision = context.previousDecisions.get(STRATEGY_CHANNEL.VALUE);
    const evSel = evDecision?.selections[0];
    const evPickKey = evSel
      ? buildBetPickKey({
          market: evSel.market,
          pick: evSel.pick,
          comboMarket: evSel.comboMarket ?? null,
          comboPick: evSel.comboPick ?? null,
        })
      : null;

    const allPicks = context.evaluatedMarkets.flatMap((m) => m.picks);
    const best = selectSafePick({
      picks: allPicks,
      suspendedMarkets: context.signals.suspendedMarkets,
      excludedPickKey: evPickKey,
      lambdaTotal: context.signals.lambdaTotal,
      competitionCode: context.competitionCode,
    });

    if (best === null) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: 'no_safe_candidate',
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

function selectSafePick(opts: {
  picks: EvaluatedPick[];
  suspendedMarkets: ReadonlySet<Market>;
  excludedPickKey: string | null;
  lambdaTotal: number;
  competitionCode: string | null;
}): ViablePick | null {
  const {
    picks,
    suspendedMarkets,
    excludedPickKey,
    lambdaTotal,
    competitionCode,
  } = opts;
  const svMinProbability = getSvMinProbability(competitionCode);
  const svMinOdds = getSvMinOdds(competitionCode);

  const isEligible = (p: EvaluatedPick): boolean => {
    if (p.isCombo) return false;
    if (!SAFE_MARKETS.includes(p.market)) return false;
    if (p.probability.lessThan(svMinProbability)) return false;
    if (p.ev.lessThan(SAFE_VALUE_MIN_EV)) return false;
    if (p.ev.greaterThan(EV_HARD_CAP)) return false;
    if (p.odds.lessThan(svMinOdds)) return false;
    if (p.odds.greaterThan(SAFE_VALUE_MAX_ODDS)) return false;
    if (suspendedMarkets.has(p.market)) return false;
    if (
      excludedPickKey !== null &&
      buildBetPickKey({
        market: p.market,
        pick: p.pick,
        comboMarket: p.comboMarket ?? null,
        comboPick: p.comboPick ?? null,
      }) === excludedPickKey
    )
      return false;
    return true;
  };

  const candidates = picks.filter(isEligible);
  if (candidates.length === 0) return null;

  const bestPick = candidates.reduce((best, c) => {
    const cmpProb = c.probability.comparedTo(best.probability);
    if (cmpProb > 0) return c;
    if (cmpProb < 0) return best;
    return c.ev.comparedTo(best.ev) > 0 ? c : best;
  });

  // At high lambda, prefer Over over Under when qualityScore is better
  if (
    bestPick.market === Market.OVER_UNDER &&
    (bestPick.pick === 'UNDER_3_5' || bestPick.pick === 'UNDER_4_5') &&
    lambdaTotal >= SV_UNDER_LAMBDA_COMPARISON_THRESHOLD
  ) {
    const bestOver = picks
      .filter(
        (p): p is ViablePick =>
          p.rejectionReason === undefined &&
          !p.isCombo &&
          p.market === Market.OVER_UNDER &&
          (p.pick === 'OVER' || p.pick === 'OVER_3_5') &&
          p.ev.greaterThanOrEqualTo(SAFE_VALUE_MIN_EV) &&
          p.ev.lessThanOrEqualTo(EV_HARD_CAP) &&
          p.odds.greaterThanOrEqualTo(svMinOdds) &&
          p.odds.lessThanOrEqualTo(SAFE_VALUE_MAX_ODDS) &&
          !suspendedMarkets.has(p.market) &&
          (excludedPickKey === null ||
            buildBetPickKey({
              market: p.market,
              pick: p.pick,
              comboMarket: null,
              comboPick: null,
            }) !== excludedPickKey),
      )
      .reduce<ViablePick | null>(
        (best, p) =>
          best === null || p.qualityScore.greaterThan(best.qualityScore)
            ? p
            : best,
        null,
      );

    if (
      bestOver !== null &&
      bestOver.qualityScore.greaterThan(bestPick.qualityScore)
    ) {
      return bestOver;
    }
  }

  return bestPick;
}

// Needed by tests: export the pure function for unit testing without a strategy instance.
export { selectSafePick };
