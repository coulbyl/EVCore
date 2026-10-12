import { Injectable, Logger } from '@nestjs/common';
import { CouponSource, StrategyChannel } from '@evcore/db';
import {
  COMBO_COUPON_CLASS,
  composeEngineCombo,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { ENGINE_COMBO_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

export type EngineComboGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/**
 * Génère le combiné du jour sur les sélections du moteur : trois « Notre
 * sélection » de l'écran Décisions, une par championnat, les moins chères
 * d'abord (règle et mesure dans COMBO_COUPON_CLASS). Même vivier et même
 * calibration que l'écran, pour que ce que l'utilisateur voit sur un match
 * et ce qu'on lui propose en combiné soient la même chose.
 */
@Injectable()
export class CouponEngineComboGenerationService {
  private readonly logger = new Logger(CouponEngineComboGenerationService.name);

  constructor(private readonly repository: CouponRepository) {}

  async generateForDate(forDate: Date): Promise<EngineComboGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);
    const since = new Date(
      dayStart.getTime() -
        ENGINE_COMBO_POLICY.calibrationWindowDays * 24 * 60 * 60 * 1_000,
    );
    const [rows, calibration] = await Promise.all([
      this.repository.findEngineComboCandidates({
        from: dayStart,
        to: dayEnd,
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      }),
      this.repository.findChannelCompetitionCalibration(since),
    ]);

    const selection = composeEngineCombo(rows, calibration);
    const pass = {
      name: ENGINE_COMBO_POLICY.pass,
      policyVersion: ENGINE_COMBO_POLICY.version,
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
        `Combiné ${dayStart.toISOString().slice(0, 10)} : abstention ` +
          `(${selection.reason}, ${selection.candidateCount} jambes éligibles)`,
      );
      return {
        outcome: 'abstained',
        reason: selection.reason,
        candidateCount: selection.candidateCount,
      };
    }

    const kickoffById = new Map(rows.map((r) => [r.fixtureId, r.scheduledAt]));
    const lastFixtureScheduledAt = selection.legs.reduce((latest, leg) => {
      const kickoff = kickoffById.get(leg.fixtureId);
      return kickoff && kickoff > latest ? kickoff : latest;
    }, dayStart);
    const combinedOdds = selection.legs.reduce((acc, leg) => acc * leg.odds, 1);
    // Retour attendu = 1 : la règle ne crédite aucun avantage (retour mesuré
    // 1,048 ± bruit) ; la probabilité affichée est celle du prix.
    const proposalId = await this.repository.upsertPriceComposerProposal({
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
        canal: leg.channel as StrategyChannel,
      })),
      profile: {
        source: CouponSource.ENGINE,
        targetOddsMin: COMBO_COUPON_CLASS.targetOddsMin,
        targetOddsMax: COMBO_COUPON_CLASS.targetOddsMax,
        policyVersion: ENGINE_COMBO_POLICY.version,
      },
    });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: 'composed',
      candidateCount: selection.candidateCount,
      proposalId,
      pass,
    });
    this.logger.log(
      `Combiné ${dayStart.toISOString().slice(0, 10)} : ${selection.legs.length} jambes, ` +
        `cote ${combinedOdds.toFixed(2)}`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: selection.candidateCount,
    };
  }
}
