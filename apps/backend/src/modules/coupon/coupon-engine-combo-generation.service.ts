import { Injectable, Logger } from '@nestjs/common';
import { CouponSource, StrategyChannel } from '@evcore/db';
import {
  COMBO_COUPON_CLASS,
  LONG_COUPON_CLASS,
  composeEngineCombo,
  composeEngineLong,
  type CalibrationCell,
  type ComboCandidate,
  type CouponClass,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import { playableAtOperator } from '../betting-engine/pricing/playable-odds.filter';
import { ENGINE_COMBO_POLICY, ENGINE_LONG_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

export type EngineComboGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

type Composer = (
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
) =>
  | { outcome: 'picked'; legs: ComboCandidate[]; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/** Un produit composé sur les sélections du moteur : sa classe, sa règle,
 * sa politique. Deux aujourd'hui, le combiné (2026-10-13) et le coupon long
 * (2026-10-18), sur le même vivier et la même calibration. */
export type EngineCouponProfile = {
  couponClass: CouponClass;
  compose: Composer;
  policy: { version: string; pass: string };
  label: string;
};

export const ENGINE_COMBO_PROFILE: EngineCouponProfile = {
  couponClass: COMBO_COUPON_CLASS,
  compose: composeEngineCombo,
  policy: ENGINE_COMBO_POLICY,
  label: 'Combiné',
};

export const ENGINE_LONG_PROFILE: EngineCouponProfile = {
  couponClass: LONG_COUPON_CLASS,
  compose: composeEngineLong,
  policy: ENGINE_LONG_POLICY,
  label: 'Coupon long',
};

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

  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async generateForDate(
    forDate: Date,
    profile: EngineCouponProfile = ENGINE_COMBO_PROFILE,
  ): Promise<EngineComboGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);
    const since = new Date(
      dayStart.getTime() -
        ENGINE_COMBO_POLICY.calibrationWindowDays * 24 * 60 * 60 * 1_000,
    );
    const [allRows, calibration] = await Promise.all([
      this.repository.findEngineComboCandidates({
        from: dayStart,
        to: dayEnd,
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      }),
      this.repository.findChannelCompetitionCalibration(since),
    ]);
    // Jouable chez l'opérateur, ou pas proposé (playable-odds.filter.ts).
    const quotes = await this.playableOdds.findPlayableQuotes(
      allRows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const rows = allRows.filter((r) => playableAtOperator(r, quotes));

    const selection = profile.compose(rows, calibration);
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
        // La jambe annonce ce que son canal annonce sur Décisions : c'est
        // cette probabilité que le règlement compare au réel, et celle du
        // combiné LLM construit sur le même vivier.
        probability: leg.probability,
        canal: leg.channel as StrategyChannel,
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
      outcome: 'composed',
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
