import { Injectable } from '@nestjs/common';
import { AdjustmentStatus, Market, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { NotificationService } from '@modules/notification/notification.service';
import {
  CalibrationService,
  type CalibrationResult,
} from './calibration.service';
import {
  MAX_WEIGHT_CHANGE,
  MIN_BET_COUNT,
  MIN_DAYS_BETWEEN_APPLICATIONS,
} from './adjustment.constants';
import type { FeatureWeights } from '@modules/betting-engine/betting-engine.utils';

// The MVP targets ONE_X_TWO exclusively; market is implicit.
const CALIBRATION_MARKET = Market.ONE_X_TWO;

type SettleAndCheckResult = {
  settled: number;
  calibration: CalibrationResult | null;
  proposalId: string | null;
};

type WeightEntry = { key: keyof FeatureWeights; value: Decimal };

@Injectable()
export class AdjustmentService {
  // eslint-disable-next-line max-params -- Nest DI constructor wiring for core services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
    private readonly calibration: CalibrationService,
    private readonly notification: NotificationService,
  ) {}

  async settleAndCheck(fixtureId: string): Promise<SettleAndCheckResult> {
    const { settled } = await this.bettingEngine.settleOpenBets(fixtureId);

    const calibrationResult =
      await this.calibration.computeForMarket(CALIBRATION_MARKET);

    if (
      calibrationResult === null ||
      !calibrationResult.needsAdjustment ||
      calibrationResult.betCount < MIN_BET_COUNT
    ) {
      return { settled, calibration: calibrationResult, proposalId: null };
    }

    const recentApply = await this.findRecentApply();
    if (recentApply !== null) {
      return { settled, calibration: calibrationResult, proposalId: null };
    }

    const proposalId = await this.autoApply(calibrationResult);
    return { settled, calibration: calibrationResult, proposalId };
  }

  async rollback(proposalId: string): Promise<{ newProposalId: string }> {
    const target =
      await this.prisma.client.adjustmentProposal.findUniqueOrThrow({
        where: { id: proposalId },
      });

    // Rollback = new APPLIED proposal that restores the state before target was applied.
    const newProposal = await this.prisma.client.adjustmentProposal.create({
      data: {
        currentWeights: target.proposedWeights as Prisma.InputJsonValue,
        proposedWeights: target.currentWeights as Prisma.InputJsonValue,
        calibrationError: target.calibrationError,
        triggerBetCount: target.triggerBetCount,
        status: AdjustmentStatus.APPLIED,
        appliedAt: new Date(),
        notes: `Rollback of proposal ${proposalId}`,
      },
      select: { id: true },
    });

    await this.notification.sendWeightAdjustmentAlert({
      proposalId: newProposal.id,
      isRollback: true,
      rolledBackProposalId: proposalId,
    });

    return { newProposalId: newProposal.id };
  }

  async listProposals() {
    return this.prisma.client.adjustmentProposal.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findRecentApply() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MIN_DAYS_BETWEEN_APPLICATIONS);

    return this.prisma.client.adjustmentProposal.findFirst({
      where: {
        status: AdjustmentStatus.APPLIED,
        appliedAt: { gte: cutoff },
      },
      select: { id: true },
    });
  }

  private async autoApply(
    calibrationResult: CalibrationResult,
  ): Promise<string> {
    const currentWeights = await this.bettingEngine.getEffectiveWeights();
    const proposedWeights = computeAdjustedWeights(
      currentWeights,
      calibrationResult.meanError,
    );

    const proposal = await this.prisma.client.adjustmentProposal.create({
      data: {
        currentWeights: weightsToJson(currentWeights),
        proposedWeights: weightsToJson(proposedWeights),
        calibrationError: calibrationResult.brierScore
          .toDecimalPlaces(6)
          .toNumber(),
        triggerBetCount: calibrationResult.betCount,
        status: AdjustmentStatus.APPLIED,
        appliedAt: new Date(),
      },
      select: { id: true },
    });

    await this.notification.sendWeightAdjustmentAlert({
      proposalId: proposal.id,
      isRollback: false,
      brierScore: calibrationResult.brierScore.toNumber(),
      meanError: calibrationResult.meanError.toNumber(),
    });

    return proposal.id;
  }
}

/**
 * Rebalances weights by shifting delta from the top-2 heaviest features
 * to the bottom-2 lightest, preserving the total sum.
 * Direction depends on meanError sign: positive → reduce top, negative → increase top.
 */
function computeAdjustedWeights(
  current: FeatureWeights,
  meanError: Decimal,
): FeatureWeights {
  const delta = Math.min(MAX_WEIGHT_CHANGE, Math.abs(meanError.toNumber()));

  const entries: WeightEntry[] = [
    { key: 'recentForm', value: new Decimal(current.recentForm) },
    { key: 'xg', value: new Decimal(current.xg) },
    { key: 'domExtPerf', value: new Decimal(current.domExtPerf) },
    { key: 'leagueVolat', value: new Decimal(current.leagueVolat) },
  ];

  // Sort descending by current weight
  entries.sort((a, b) => b.value.minus(a.value).toNumber());

  const d = new Decimal(delta);

  if (meanError.greaterThan(0)) {
    // Overconfident → reduce top-2, increase bottom-2
    entries[0].value = entries[0].value.minus(d).clampedTo(0.01, 0.99);
    entries[1].value = entries[1].value.minus(d).clampedTo(0.01, 0.99);
    entries[2].value = entries[2].value.plus(d).clampedTo(0.01, 0.99);
    entries[3].value = entries[3].value.plus(d).clampedTo(0.01, 0.99);
  } else {
    // Underconfident → increase top-2, reduce bottom-2
    entries[0].value = entries[0].value.plus(d).clampedTo(0.01, 0.99);
    entries[1].value = entries[1].value.plus(d).clampedTo(0.01, 0.99);
    entries[2].value = entries[2].value.minus(d).clampedTo(0.01, 0.99);
    entries[3].value = entries[3].value.minus(d).clampedTo(0.01, 0.99);
  }

  // Normalize to sum=1
  const total = entries.reduce((sum, e) => sum.plus(e.value), new Decimal(0));
  const normalized = entries.map((e) => ({
    key: e.key,
    value: e.value.div(total),
  }));

  const result: Record<string, Decimal> = {};
  for (const { key, value } of normalized) {
    result[key] = value;
  }

  return {
    recentForm: result['recentForm'],
    xg: result['xg'],
    domExtPerf: result['domExtPerf'],
    leagueVolat: result['leagueVolat'],
  };
}

function weightsToJson(w: FeatureWeights): Record<string, string> {
  return {
    recentForm: new Decimal(w.recentForm).toFixed(6),
    xg: new Decimal(w.xg).toFixed(6),
    domExtPerf: new Decimal(w.domExtPerf).toFixed(6),
    leagueVolat: new Decimal(w.leagueVolat).toFixed(6),
  };
}
