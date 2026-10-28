import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  DOUBLE_COUPON_CLASS,
  composeDouble,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { operatorPrice } from '../betting-engine/pricing/playable-odds.filter';
import { DOUBLE_POLICY } from './coupon.constants';
import {
  CouponPricedPoolService,
  type PricedPool,
} from './coupon-priced-pool.service';

export type DoubleGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/**
 * Génère le coupon cote 2 du jour : deux jambes de cote combinée 2 à 3 chez
 * le book du joueur, prises parmi tout ce qui est coté et classées par la
 * probabilité du marché sans marge (DOUBLE_COUPON_CLASS). Rien ne vient du
 * moteur ni du LLM : la probabilité annoncée est celle du prix.
 *
 * S'abstient — résultat enregistré, pas panne — quand aucune combinaison
 * n'entre dans la fenêtre.
 */
@Injectable()
export class CouponDoubleGenerationService {
  private readonly logger = new Logger(CouponDoubleGenerationService.name);

  constructor(
    private readonly repository: CouponRepository,
    private readonly pricedPool: CouponPricedPoolService,
  ) {}

  /** `pool` : le vivier déjà chargé par la génération du soir, sinon relu. */
  async generateForDate(
    forDate: Date,
    pool?: PricedPool,
  ): Promise<DoubleGenerationOutcome> {
    const { dayStart, rows, quotes, candidates } =
      pool ?? (await this.pricedPool.load(forDate));
    const composition = composeDouble(candidates);

    if (composition.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: composition.candidateCount,
        reason: composition.reason,
        pass: {
          name: DOUBLE_POLICY.pass,
          policyVersion: DOUBLE_POLICY.version,
        },
      });
      this.logger.log(
        `Coupon cote 2 ${dayStart.toISOString().slice(0, 10)} : abstention ` +
          `(${composition.reason}, ${composition.candidateCount} candidats)`,
      );
      return {
        outcome: 'abstained',
        reason: composition.reason,
        candidateCount: composition.candidateCount,
      };
    }

    const referenceOdds = composition.legs.reduce(
      (acc, leg) => acc.times(leg.odds),
      new Decimal(1),
    );
    const probability = composition.probability;
    const kickoffs = composition.legs.map(
      (leg) =>
        rows.find((row) => row.fixtureId === leg.fixtureId)?.scheduledAt ??
        dayStart,
    );
    const lastKickoff = new Date(
      Math.max(...kickoffs.map((date) => date.getTime())),
    );
    // jointProbability = retour attendu / cote : on écrit le retour attendu
    // qui la rend égale à la probabilité du marché.
    const proposalId = await this.repository.upsertPriceComposerProposal({
      forDate: dayStart,
      combinedOdds: referenceOdds.toNumber(),
      expectedReturn: probability.times(referenceOdds).toNumber(),
      lastFixtureScheduledAt: lastKickoff,
      legs: composition.legs.map((leg) => ({
        fixtureId: leg.fixtureId,
        market: leg.market as Market,
        pick: leg.pick,
        odds: leg.odds,
        probability: leg.fair.toNumber(),
        expectedReturn: leg.fair.times(leg.odds).toNumber(),
        ...operatorPrice(leg, quotes),
      })),
      profile: {
        targetOddsMin: DOUBLE_COUPON_CLASS.targetOddsMin,
        targetOddsMax: DOUBLE_COUPON_CLASS.targetOddsMax,
        policyVersion: DOUBLE_POLICY.version,
      },
    });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: 'composed',
      candidateCount: composition.candidateCount,
      proposalId,
      pass: { name: DOUBLE_POLICY.pass, policyVersion: DOUBLE_POLICY.version },
    });
    this.logger.log(
      `Coupon cote 2 ${dayStart.toISOString().slice(0, 10)} : ` +
        `${composition.legs.map((l) => `${l.market}/${l.pick}`).join(' + ')} ` +
        `à ${composition.playableCombinedOdds.toFixed(2)} (${probability.times(100).toFixed(0)} %)`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: composition.candidateCount,
    };
  }
}
