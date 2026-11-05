import Decimal from 'decimal.js';
import { Injectable, Logger } from '@nestjs/common';
import { CouponSource, StrategyChannel } from '@evcore/db';
import {
  COMBO_COUPON_CLASS,
  composeReadingCombo,
  type CouponClass,
  type Market,
  type ReadingComboSelection,
  type ReadingLeg,
} from '@evcore/analysis-core';
import { READING_CHANNELS } from '@config/screens.constants';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import { operatorPrice } from '../betting-engine/pricing/playable-odds.filter';
import { MatchesRepository } from '../screens/matches.repository';
import { groupBy, readingOf, uniqueKeys } from '../screens/matches-reading';
import { ENGINE_COMBO_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

export type EngineComboGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/** Un produit composé sur les lectures : sa classe, sa règle, sa politique.
 * Le combiné seul depuis l'arrêt du coupon long le 2026-11-04. */
export type EngineCouponProfile = {
  couponClass: CouponClass;
  compose: <T extends ReadingLeg>(
    readings: readonly T[],
  ) => ReadingComboSelection<T>;
  policy: { version: string; pass: string };
  label: string;
};

export const ENGINE_COMBO_PROFILE: EngineCouponProfile = {
  couponClass: COMBO_COUPON_CLASS,
  compose: (readings) => composeReadingCombo(readings),
  policy: ENGINE_COMBO_POLICY,
  label: 'Combiné',
};

type ComboReading = ReadingLeg & { channel: string; scheduledAt: Date };

/**
 * Génère le combiné du jour à partir des lectures (2026-11-05) : pour chaque
 * match du jour, « Notre lecture » telle que la liste et la fiche du match
 * la montrent (`readingOf`, même requête, mêmes cotes 1xBet), puis deux
 * lectures par la règle de COMBO_COUPON_CLASS. Un match sans lecture est
 * ignoré : le combiné ne propose jamais un autre pari que la lecture.
 */
@Injectable()
export class CouponEngineComboGenerationService {
  private readonly logger = new Logger(CouponEngineComboGenerationService.name);

  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly matches: MatchesRepository,
  ) {}

  async generateForDate(
    forDate: Date,
    profile: EngineCouponProfile = ENGINE_COMBO_PROFILE,
  ): Promise<EngineComboGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);
    const fixtures = await this.repository.findReadingComboFixtures({
      from: dayStart,
      to: dayEnd,
    });
    const candidates = await this.matches.findReadingCandidates({
      fixtureIds: fixtures.map((f) => f.fixtureId),
      channels: READING_CHANNELS,
    });
    // Les cotes 1xBet seules, comme la liste des matchs.
    const quotes = await this.playableOdds.findPlayableQuotes(
      uniqueKeys(candidates),
      { operatorOnly: true },
    );
    const byFixture = groupBy(candidates, (c) => c.fixtureId);
    const now = new Date();
    const readings: ComboReading[] = fixtures.flatMap((fixture) => {
      const own = byFixture.get(fixture.fixtureId) ?? [];
      const choice = readingOf({ candidates: own, quotes, day: 'today', now });
      if (!('reading' in choice)) return [];
      const { reading } = choice;
      const channel = own.find(
        (c) => c.market === reading.market && c.pick === reading.pick,
      )?.channel;
      if (!channel) return [];
      return [
        {
          fixtureId: fixture.fixtureId,
          competition: fixture.competition,
          market: reading.market,
          pick: reading.pick,
          odds: reading.odds,
          chance: reading.chance,
          channel,
          scheduledAt: fixture.scheduledAt,
        },
      ];
    });

    const selection = profile.compose(readings);
    const pass = {
      name: profile.policy.pass,
      policyVersion: profile.policy.version,
    };
    if (selection.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: selection.candidateCount,
        reason: selection.reason,
        pass,
      });
      this.logger.log(
        `${profile.label} ${dayStart.toISOString().slice(0, 10)} : abstention ` +
          `(${selection.reason}, ${selection.candidateCount} lectures éligibles)`,
      );
      return {
        outcome: 'abstained',
        reason: selection.reason,
        candidateCount: selection.candidateCount,
      };
    }

    const lastFixtureScheduledAt = selection.legs.reduce((latest, leg) => {
      return leg.scheduledAt > latest ? leg.scheduledAt : latest;
    }, dayStart);
    const combinedOdds = selection.legs
      .reduce((acc, leg) => acc.times(leg.odds), new Decimal(1))
      .toNumber();
    // Retour attendu = 1 : la règle ne crédite aucun avantage ; la chance
    // annoncée est la fréquence du marché, celle que la lecture affiche.
    const { proposalId, created } =
      await this.repository.upsertPriceComposerProposal({
        forDate: dayStart,
        combinedOdds,
        expectedReturn: 1,
        lastFixtureScheduledAt,
        legs: selection.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          market: leg.market as Market,
          pick: leg.pick,
          odds: leg.odds,
          expectedReturn: 1,
          // La jambe annonce la chance de la lecture (fréquence du marché,
          // 1xBet) : c'est elle que le règlement compare au réel.
          probability: leg.chance,
          canal: leg.channel as StrategyChannel,
          ...operatorPrice(leg, quotes),
        })),
        profile: {
          source: CouponSource.ENGINE,
          targetOddsMin: profile.couponClass.targetOddsMin,
          targetOddsMax: profile.couponClass.targetOddsMax,
          policyVersion: profile.policy.version,
        },
      });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      // The proposal of the day is immutable: a later pass that finds it
      // published says so instead of « composed » (ENV-PROD § 3).
      outcome: created ? 'composed' : 'preserved',
      candidateCount: selection.candidateCount,
      proposalId,
      pass,
    });
    this.logger.log(
      `${profile.label} ${dayStart.toISOString().slice(0, 10)} : ${selection.legs.length} jambes, ` +
        `cote ${combinedOdds.toFixed(2)}`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: selection.candidateCount,
    };
  }
}
