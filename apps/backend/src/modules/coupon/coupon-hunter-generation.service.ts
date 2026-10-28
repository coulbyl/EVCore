import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CouponSource, StrategyChannel } from '@evcore/db';
import {
  HUNTERS,
  composeHunterByEngine,
  composeHunterByMarket,
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
  ranking: 'market' | 'engine';
  outcome: 'composed' | 'abstained';
  candidateCount: number;
};

/**
 * Chasseurs BTTS et Nul en ombre : chaque jour, pour chaque chasseur, une
 * sélection classée par le prix (source PRICE_COMPOSER) et une classée par
 * le moteur (source ENGINE), écrites `shadow: true`. Le règlement et la CLV
 * par jambe existants s'en occupent ; rien n'est montré au joueur.
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
    const since = new Date(
      dayStart.getTime() - HUNTER_POLICY.calibrationWindowDays * DAY_MS,
    );
    const [priced, engineRows, calibration] = await Promise.all([
      this.repository.findDoubleCandidates(range),
      this.repository.findEngineComboCandidates({
        ...range,
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      }),
      this.repository.findChannelCompetitionCalibration(since),
    ]);
    const quotes = await this.playableOdds.findPlayableQuotes(
      [...priced, ...engineRows].map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    // Même lecture que le coupon cote 2 : la marge se retire sur le groupe
    // complet aux cotes de référence, la bande se lit sur la cote jouable.
    const marketCandidates = priced.map((r) => {
      const quote = quotes.get(playableQuoteKey(r));
      return {
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
        odds: r.odds,
        playableOdds: playableAtOperator(r, quotes)
          ? (quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds)
          : 0,
      };
    });
    const engineCandidates = engineRows.filter((r) =>
      playableAtOperator(r, quotes),
    );
    const kickoffs = new Map(
      [...priced, ...engineRows].map((r) => [r.fixtureId, r.scheduledAt]),
    );

    const outcomes: HunterPassOutcome[] = [];
    for (const spec of HUNTERS) {
      outcomes.push(
        await this.persist({
          dayStart,
          spec,
          ranking: 'market',
          composition: composeHunterByMarket(marketCandidates, spec),
          kickoffs,
        }),
        await this.persist({
          dayStart,
          spec,
          ranking: 'engine',
          composition: composeHunterByEngine(
            engineCandidates,
            calibration,
            spec,
          ),
          kickoffs,
        }),
      );
    }
    return outcomes;
  }

  private async persist(input: {
    dayStart: Date;
    spec: HunterSpec;
    ranking: 'market' | 'engine';
    composition: HunterComposition;
    kickoffs: ReadonlyMap<string, Date>;
  }): Promise<HunterPassOutcome> {
    const { dayStart, spec, ranking, composition } = input;
    const policyVersion = `${HUNTER_POLICY.version}-${ranking}`;
    const pass = {
      name: `hunter-${spec.coupon.name.toLowerCase()}-${ranking}`,
      policyVersion,
    };
    const base = {
      hunter: spec.coupon.name,
      ranking,
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
    const expectedReturn = new Decimal(leg.probability)
      .times(leg.odds)
      .toNumber();
    const proposalId = await this.repository.upsertPriceComposerProposal({
      forDate: dayStart,
      combinedOdds: leg.odds,
      // jointProbability = retour attendu / cote : la probabilité annoncée.
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
          ...(ranking === 'engine'
            ? { canal: spec.channel as StrategyChannel }
            : {}),
        },
      ],
      profile: {
        source:
          ranking === 'market'
            ? CouponSource.PRICE_COMPOSER
            : CouponSource.ENGINE,
        targetOddsMin: spec.coupon.targetOddsMin,
        targetOddsMax: spec.coupon.targetOddsMax,
        policyVersion,
        shadow: true,
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
      `Chasseur ${spec.coupon.name} (${ranking}, ombre) ${dayStart.toISOString().slice(0, 10)} : ` +
        `${leg.market}/${leg.pick} à ${leg.odds}`,
    );
    return { ...base, outcome: 'composed' };
  }
}
