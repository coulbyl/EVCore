import { Injectable, Logger } from '@nestjs/common';
import {
  FAVOURITE_COUPON_CLASS,
  pickHomeFavourite,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import { playableAtOperator } from '../betting-engine/pricing/playable-odds.filter';
import { FAVOURITE_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

export type FavouriteGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/**
 * Génère le pari sûr du jour : une jambe, le plus gros favori à domicile dont
 * la cote d'analyse tombe dans 1,10–1,35 (règle « generator-v2 », mesure dans
 * FAVOURITE_COUPON_CLASS). Rien ne vient du moteur ni du LLM : seule la cote
 * d'avant match entre dans la décision.
 *
 * Il partage le vivier et la passe du compositeur par le prix, et s'abstient
 * — résultat enregistré, pas panne — quand aucun favori à domicile n'est dans
 * la bande.
 */
@Injectable()
export class CouponFavouriteGenerationService {
  private readonly logger = new Logger(CouponFavouriteGenerationService.name);

  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async generateForDate(forDate: Date): Promise<FavouriteGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);
    const allRows = await this.repository.findPriceCandidates({
      from: dayStart,
      to: dayEnd,
    });
    // Jouable chez l'opérateur, ou pas proposé (playable-odds.filter.ts).
    const quotes = await this.playableOdds.findPlayableQuotes(
      allRows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const rows = allRows.filter((r) => playableAtOperator(r, quotes));

    const selection = pickHomeFavourite(rows);
    if (selection.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: selection.candidateCount,
        reason: selection.reason,
        pass: {
          name: FAVOURITE_POLICY.pass,
          policyVersion: FAVOURITE_POLICY.version,
        },
      });
      this.logger.log(
        `Pari sûr ${dayStart.toISOString().slice(0, 10)} : abstention ` +
          `(${selection.reason}, ${rows.length} candidats)`,
      );
      return {
        outcome: 'abstained',
        reason: selection.reason,
        candidateCount: selection.candidateCount,
      };
    }

    const { leg } = selection;
    const kickoff =
      rows.find((row) => row.fixtureId === leg.fixtureId)?.scheduledAt ??
      dayStart;
    // Retour attendu = 1 : la règle ne crédite aucun avantage (ROI mesuré
    // +0,9 à +3,2 % par an au meilleur prix, −5 % aux cotes d'analyse), et la
    // probabilité affichée doit rester celle du PRIX, jamais du moteur.
    const proposalId = await this.repository.upsertPriceComposerProposal({
      forDate: dayStart,
      combinedOdds: leg.odds,
      expectedReturn: 1,
      lastFixtureScheduledAt: kickoff,
      legs: [
        {
          fixtureId: leg.fixtureId,
          market: leg.market as Market,
          pick: leg.pick,
          odds: leg.odds,
          expectedReturn: 1,
        },
      ],
      profile: {
        targetOddsMin: FAVOURITE_COUPON_CLASS.targetOddsMin,
        targetOddsMax: FAVOURITE_COUPON_CLASS.targetOddsMax,
        policyVersion: FAVOURITE_POLICY.version,
      },
    });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: 'composed',
      candidateCount: selection.candidateCount,
      proposalId,
      pass: {
        name: FAVOURITE_POLICY.pass,
        policyVersion: FAVOURITE_POLICY.version,
      },
    });
    this.logger.log(
      `Pari sûr ${dayStart.toISOString().slice(0, 10)} : ${leg.fixtureId} ` +
        `${leg.market}/${leg.pick} à ${leg.odds.toFixed(2)}`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: selection.candidateCount,
    };
  }
}
