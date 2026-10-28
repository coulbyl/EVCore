import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CouponSource } from '@evcore/db';
import {
  BTTS_HUNTER,
  DRAW_HUNTER,
  SCORE_HUNTER,
  composeHunterByMarket,
  composeScoreHunter,
  type HunterComposition,
  type HunterSpec,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import { playableAtOperator } from '../betting-engine/pricing/playable-odds.filter';
import { playableQuoteKey } from '../betting-engine/pricing/playable-odds.repository';
import { ENGINE_COMBO_POLICY, HUNTER_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

const DAY_MS = 24 * 60 * 60 * 1_000;

export type HunterPassOutcome = {
  hunter: string;
  outcome: 'composed' | 'abstained';
  candidateCount: number;
};

/**
 * Chasseurs du jour, montrés aux joueurs comme les autres coupons
 * (2026-10-28) : BTTS « oui » et Nul classés par le prix (source
 * PRICE_COMPOSER), Score exact pris parmi les scores retenus par le moteur
 * (source ENGINE). Une sélection par chasseur ou l'abstention, enregistrée.
 */
@Injectable()
export class CouponHunterGenerationService {
  private readonly logger = new Logger(CouponHunterGenerationService.name);

  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async generateForDate(forDate: Date): Promise<HunterPassOutcome[]> {
    const dayStart = startOfUtcDay(forDate);
    const range = { from: dayStart, to: new Date(dayStart.getTime() + DAY_MS) };
    const [priced, engineRows] = await Promise.all([
      this.repository.findDoubleCandidates(range),
      this.repository.findEngineComboCandidates({
        ...range,
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      }),
    ]);
    const scoreRows = engineRows.filter(
      (r) => r.market === SCORE_HUNTER.market,
    );
    const quotes = await this.playableOdds.findPlayableQuotes(
      [...priced, ...scoreRows].map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const playableOf = (r: {
      fixtureId: string;
      market: string;
      pick: string;
      odds: number;
    }): number => {
      if (!playableAtOperator(r, quotes)) return 0;
      const quote = quotes.get(playableQuoteKey(r));
      return quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds;
    };
    // Même lecture que le coupon cote 2 : la marge se retire sur le groupe
    // complet aux cotes de référence, la bande se lit sur la cote jouable.
    const marketCandidates = priced.map((r) => ({
      fixtureId: r.fixtureId,
      market: r.market,
      pick: r.pick,
      odds: r.odds,
      playableOdds: playableOf(r),
    }));
    const scoreCandidates = scoreRows.map((r) => ({
      ...r,
      playableOdds: playableOf(r),
    }));
    const kickoffs = new Map(
      [...priced, ...engineRows].map((r) => [r.fixtureId, r.scheduledAt]),
    );

    return [
      await this.persist({
        dayStart,
        spec: BTTS_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(marketCandidates, BTTS_HUNTER),
        kickoffs,
      }),
      await this.persist({
        dayStart,
        spec: DRAW_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(marketCandidates, DRAW_HUNTER),
        kickoffs,
      }),
      await this.persist({
        dayStart,
        spec: SCORE_HUNTER,
        source: CouponSource.ENGINE,
        composition: composeScoreHunter(scoreCandidates),
        kickoffs,
      }),
    ];
  }

  private async persist(input: {
    dayStart: Date;
    spec: HunterSpec;
    source: CouponSource;
    composition: HunterComposition;
    kickoffs: ReadonlyMap<string, Date>;
  }): Promise<HunterPassOutcome> {
    const { dayStart, spec, composition } = input;
    const pass = {
      name: `hunter-${spec.coupon.name.toLowerCase()}`,
      policyVersion: HUNTER_POLICY.version,
    };
    const base = {
      hunter: spec.coupon.name,
      candidateCount: composition.candidateCount,
    };
    if (composition.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: composition.candidateCount,
        reason: composition.reason,
        pass,
      });
      return { ...base, outcome: 'abstained' };
    }

    const { leg } = composition;
    // Probabilité du marché × cote : jointProbability retombe sur la
    // fréquence du marché, celle affichée au joueur.
    const expectedReturn = new Decimal(leg.probability)
      .times(leg.odds)
      .toNumber();
    const proposalId = await this.repository.upsertPriceComposerProposal({
      forDate: dayStart,
      combinedOdds: leg.odds,
      expectedReturn,
      lastFixtureScheduledAt: input.kickoffs.get(leg.fixtureId) ?? dayStart,
      legs: [
        {
          fixtureId: leg.fixtureId,
          market: leg.market as Market,
          pick: leg.pick,
          odds: leg.odds,
          expectedReturn,
          probability: leg.probability,
        },
      ],
      profile: {
        source: input.source,
        targetOddsMin: spec.coupon.targetOddsMin,
        targetOddsMax: spec.coupon.targetOddsMax,
        policyVersion: HUNTER_POLICY.version,
      },
    });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: 'composed',
      candidateCount: composition.candidateCount,
      proposalId,
      pass,
    });
    this.logger.log(
      `Chasseur ${spec.coupon.name} ${dayStart.toISOString().slice(0, 10)} : ` +
        `${leg.market}/${leg.pick} à ${leg.odds}`,
    );
    return { ...base, outcome: 'composed' };
  }
}
