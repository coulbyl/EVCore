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
import {
  operatorPrice,
  playableAtOperator,
} from '../betting-engine/pricing/playable-odds.filter';
import {
  playableQuoteKey,
  type PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import { ENGINE_COMBO_POLICY, HUNTER_POLICY } from './coupon.constants';
import {
  CouponPricedPoolService,
  type PricedPool,
} from './coupon-priced-pool.service';

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
    private readonly pricedPool: CouponPricedPoolService,
  ) {}

  /** `pool` : le vivier déjà chargé par la génération du soir, sinon relu. */
  async generateForDate(
    forDate: Date,
    pool?: PricedPool,
  ): Promise<HunterPassOutcome[]> {
    const priced = pool ?? (await this.pricedPool.load(forDate));
    const { dayStart } = priced;
    const scoreRows = (
      await this.repository.findEngineComboCandidates({
        from: dayStart,
        to: new Date(dayStart.getTime() + DAY_MS),
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      })
    ).filter((r) => r.market === SCORE_HUNTER.market);
    const scoreQuotes = await this.playableOdds.findPlayableQuotes(
      scoreRows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const scoreCandidates = scoreRows
      .filter((r) => playableAtOperator(r, scoreQuotes))
      .map((r) => {
        const quote = scoreQuotes.get(playableQuoteKey(r));
        return {
          ...r,
          playableOdds: quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds,
        };
      });
    // Les matchs que le méta-canal AVOID signale sont écartés des chasseurs
    // (plan du 23/10, reste de revue du lot 2).
    const avoided = new Set(
      await this.repository.findAvoidedFixtureIds({
        from: dayStart,
        to: new Date(dayStart.getTime() + DAY_MS),
      }),
    );
    const marketCandidates = priced.candidates.map((c) =>
      avoided.has(c.fixtureId) ? { ...c, playableOdds: 0 } : c,
    );
    const quotes = new Map([...priced.quotes, ...scoreQuotes]);
    const kickoffs = new Map(
      [...priced.rows, ...scoreRows].map((r) => [r.fixtureId, r.scheduledAt]),
    );
    const context = { dayStart, kickoffs, quotes };

    return [
      await this.persist({
        ...context,
        spec: BTTS_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(marketCandidates, BTTS_HUNTER),
      }),
      await this.persist({
        ...context,
        spec: DRAW_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(marketCandidates, DRAW_HUNTER),
      }),
      await this.persist({
        ...context,
        spec: SCORE_HUNTER,
        source: CouponSource.ENGINE,
        composition: composeScoreHunter(
          scoreCandidates.filter((c) => !avoided.has(c.fixtureId)),
        ),
      }),
    ];
  }

  private async persist(input: {
    dayStart: Date;
    spec: HunterSpec;
    source: CouponSource;
    composition: HunterComposition;
    kickoffs: ReadonlyMap<string, Date>;
    quotes: Map<string, PlayableQuote>;
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
          ...operatorPrice(leg, input.quotes),
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
