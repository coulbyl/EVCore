import { Injectable } from '@nestjs/common';
import type { DoubleCandidate } from '@evcore/analysis-core';
import { CouponRepository, type PriceCandidateRow } from './coupon.repository';
import {
  PlayableOddsRepository,
  playableQuoteKey,
  type PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import { playableAtOperator } from '../betting-engine/pricing/playable-odds.filter';
import { startOfUtcDay } from '@utils/date.utils';

const DAY_MS = 24 * 60 * 60 * 1_000;

export type PricedPool = {
  dayStart: Date;
  rows: readonly PriceCandidateRow[];
  quotes: Map<string, PlayableQuote>;
  /**
   * Tout ce qui est coté le jour dit, prêt pour les compositeurs : la marge
   * se retire sur le groupe complet aux cotes de référence, la bande se lit
   * sur la cote jouable chez 1xBet, et le coût est la marge payée chez 1xBet.
   * Un choix non jouable chez l'opérateur reste dans son groupe (pour la
   * marge) avec une cote jouable nulle : il ne peut pas devenir une jambe.
   */
  candidates: DoubleCandidate[];
};

/**
 * Vivier coté du jour et prix 1xBet, chargés une seule fois par la
 * génération du soir pour le coupon cote 2 et les chasseurs (ils les
 * relisaient chacun, revue du lot 2).
 */
@Injectable()
export class CouponPricedPoolService {
  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async load(forDate: Date): Promise<PricedPool> {
    const dayStart = startOfUtcDay(forDate);
    const rows = await this.repository.findDoubleCandidates({
      from: dayStart,
      to: new Date(dayStart.getTime() + DAY_MS),
    });
    const quotes = await this.playableOdds.findPlayableQuotes(
      rows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const candidates = rows.map((r) => {
      const quote = quotes.get(playableQuoteKey(r));
      return {
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
        odds: r.odds,
        playableOdds: playableAtOperator(r, quotes)
          ? (quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds)
          : 0,
        operatorMargin: quote?.operatorMargin ?? null,
      };
    });
    return { dayStart, rows, quotes, candidates };
  }
}
