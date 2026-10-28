import { Injectable, Logger } from '@nestjs/common';
import {
  DOUBLE_COUPON_CLASS,
  composeDouble,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import { playableAtOperator } from '../betting-engine/pricing/playable-odds.filter';
import { playableQuoteKey } from '../betting-engine/pricing/playable-odds.repository';
import { DOUBLE_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

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
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async generateForDate(forDate: Date): Promise<DoubleGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);
    const rows = await this.repository.findDoubleCandidates({
      from: dayStart,
      to: dayEnd,
    });
    const quotes = await this.playableOdds.findPlayableQuotes(
      rows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    // La marge se retire sur le groupe complet aux cotes de référence ; la
    // fenêtre 2–3 et la bande des jambes se lisent sur la cote jouable.
    // Un choix non jouable chez l'opérateur reste dans son groupe (pour la
    // marge) mais ne peut pas devenir une jambe.
    const composition = composeDouble(
      rows.map((r) => {
        const quote = quotes.get(playableQuoteKey(r));
        const playable = playableAtOperator(r, quotes)
          ? (quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds)
          : 0;
        return {
          fixtureId: r.fixtureId,
          market: r.market,
          pick: r.pick,
          odds: r.odds,
          playableOdds: playable,
        };
      }),
    );

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
      (acc, leg) => acc * leg.odds,
      1,
    );
    const probability = composition.probability.toNumber();
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
      combinedOdds: referenceOdds,
      expectedReturn: probability * referenceOdds,
      lastFixtureScheduledAt: lastKickoff,
      legs: composition.legs.map((leg) => ({
        fixtureId: leg.fixtureId,
        market: leg.market as Market,
        pick: leg.pick,
        odds: leg.odds,
        probability: leg.fair.toNumber(),
        expectedReturn: leg.fair.toNumber() * leg.odds,
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
        `à ${composition.playableCombinedOdds.toFixed(2)} (${(probability * 100).toFixed(0)} %)`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: composition.candidateCount,
    };
  }
}
