import { Injectable } from '@nestjs/common';
import { AdjustmentStatus, Market, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { CouponService } from '@modules/coupon/coupon.service';
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
  shadowCorrelations: ShadowCorrelationsResult | null;
  shadowProposalId: string | null;
};

type WeightEntry = { key: keyof FeatureWeights; value: Decimal };
type ShadowFeatureKey = 'shadow_h2h' | 'shadow_congestion' | 'shadow_injuries';
type ShadowCorrelation = {
  feature: ShadowFeatureKey;
  rho: number;
  sampleSize: number;
};
type ShadowCorrelationsResult = {
  betCount: number;
  correlations: ShadowCorrelation[];
};
type SettledBetWithFeatures = {
  status: 'WON' | 'LOST';
  modelRun: { features: unknown };
};

const SHADOW_FEATURE_KEYS: readonly ShadowFeatureKey[] = [
  'shadow_h2h',
  'shadow_congestion',
  'shadow_injuries',
];
const SHADOW_ACTIVATION_RHO_THRESHOLD = 0.15;
const SHADOW_CORRELATION_LOOKBACK = 200;

@Injectable()
export class AdjustmentService {
  // eslint-disable-next-line max-params -- Nest DI constructor wiring for core services.
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
    private readonly couponService: CouponService,
    private readonly calibration: CalibrationService,
    private readonly notification: NotificationService,
  ) {}

  async settleAndCheck(fixtureId: string): Promise<SettleAndCheckResult> {
    const { settled } = await this.bettingEngine.settleOpenBets(fixtureId);
    await this.couponService.settlePendingCouponsByFixture(fixtureId);
    await this.couponService.settleExpiredCoupons(new Date());

    const calibrationResult =
      await this.calibration.computeForMarket(CALIBRATION_MARKET);

    if (
      calibrationResult === null ||
      !calibrationResult.needsAdjustment ||
      calibrationResult.betCount < MIN_BET_COUNT
    ) {
      const shadowCorrelations = await this.computeShadowCorrelations();
      const shadowProposalId =
        shadowCorrelations === null
          ? null
          : await this.autoActivateShadowFeatures(shadowCorrelations);
      return {
        settled,
        calibration: calibrationResult,
        proposalId: null,
        shadowCorrelations,
        shadowProposalId,
      };
    }

    const recentApply = await this.findRecentApply();
    if (recentApply !== null) {
      const shadowCorrelations = await this.computeShadowCorrelations();
      return {
        settled,
        calibration: calibrationResult,
        proposalId: null,
        shadowCorrelations,
        shadowProposalId: null,
      };
    }

    const proposalId = await this.autoApply(calibrationResult);
    const shadowCorrelations = await this.computeShadowCorrelations();
    return {
      settled,
      calibration: calibrationResult,
      proposalId,
      shadowCorrelations,
      shadowProposalId: null,
    };
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

  /**
   * Runs calibration check and auto-applies if triggered.
   * Does not settle any bets — purely reads existing settled bets.
   * Called by the settlement worker after each batch, and exposed via the controller.
   */
  async runCalibrationCheck(): Promise<{
    calibration: CalibrationResult | null;
    proposalId: string | null;
    shadowCorrelations: ShadowCorrelationsResult | null;
    shadowProposalId: string | null;
  }> {
    const calibrationResult =
      await this.calibration.computeForMarket(CALIBRATION_MARKET);

    if (
      calibrationResult === null ||
      !calibrationResult.needsAdjustment ||
      calibrationResult.betCount < MIN_BET_COUNT
    ) {
      const shadowCorrelations = await this.computeShadowCorrelations();
      const shadowProposalId =
        shadowCorrelations === null
          ? null
          : await this.autoActivateShadowFeatures(shadowCorrelations);
      return {
        calibration: calibrationResult,
        proposalId: null,
        shadowCorrelations,
        shadowProposalId,
      };
    }

    const recentApply = await this.findRecentApply();
    if (recentApply !== null) {
      const shadowCorrelations = await this.computeShadowCorrelations();
      return {
        calibration: calibrationResult,
        proposalId: null,
        shadowCorrelations,
        shadowProposalId: null,
      };
    }

    const proposalId = await this.autoApply(calibrationResult);
    const shadowCorrelations = await this.computeShadowCorrelations();
    return {
      calibration: calibrationResult,
      proposalId,
      shadowCorrelations,
      shadowProposalId: null,
    };
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

  async computeShadowCorrelations(): Promise<ShadowCorrelationsResult | null> {
    const settledBets = await this.prisma.client.bet.findMany({
      where: { status: { in: ['WON', 'LOST'] } },
      select: {
        status: true,
        modelRun: { select: { features: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: SHADOW_CORRELATION_LOOKBACK,
    });

    if (settledBets.length < MIN_BET_COUNT) return null;

    const correlations = SHADOW_FEATURE_KEYS.map((feature) =>
      this.computeFeatureCorrelation(
        feature,
        settledBets as SettledBetWithFeatures[],
      ),
    );

    return { betCount: settledBets.length, correlations };
  }

  private computeFeatureCorrelation(
    feature: ShadowFeatureKey,
    settledBets: SettledBetWithFeatures[],
  ): ShadowCorrelation {
    const values: number[] = [];
    const outcomes: number[] = [];

    for (const bet of settledBets) {
      const features = toObjectRecord(bet.modelRun.features);
      if (features === null) continue;

      const maybeValue = extractShadowFeatureValue(features, feature);
      if (maybeValue === null) continue;

      values.push(maybeValue);
      outcomes.push(bet.status === 'WON' ? 1 : 0);
    }

    if (values.length < MIN_BET_COUNT) {
      return { feature, rho: 0, sampleSize: values.length };
    }

    return {
      feature,
      rho: spearmanRho(values, outcomes),
      sampleSize: values.length,
    };
  }

  private async autoActivateShadowFeatures(
    correlations: ShadowCorrelationsResult,
  ): Promise<string | null> {
    const candidates = correlations.correlations.filter(
      (item) =>
        Math.abs(item.rho) > SHADOW_ACTIVATION_RHO_THRESHOLD &&
        item.sampleSize >= MIN_BET_COUNT,
    );

    if (candidates.length === 0) return null;

    const recentApply = await this.findRecentApply();
    if (recentApply !== null) return null;

    const currentWeights = await this.bettingEngine.getEffectiveWeights();
    const currentWeightsJson = weightsToJson(currentWeights);
    const featureList = candidates
      .map((c) => `${c.feature} (rho=${c.rho.toFixed(3)}, n=${c.sampleSize})`)
      .join(', ');

    // Runtime constants are immutable; we persist activation intent in APPLIED proposal notes.
    const proposal = await this.prisma.client.adjustmentProposal.create({
      data: {
        currentWeights: currentWeightsJson,
        proposedWeights: currentWeightsJson,
        calibrationError: 0,
        triggerBetCount: correlations.betCount,
        status: AdjustmentStatus.APPLIED,
        appliedAt: new Date(),
        notes: `Shadow auto-activation: ${featureList}`,
      },
      select: { id: true },
    });

    await this.notification.sendWeightAdjustmentAlert({
      proposalId: proposal.id,
      isRollback: false,
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

function extractShadowFeatureValue(
  features: Record<string, unknown>,
  feature: ShadowFeatureKey,
): number | null {
  const raw = features[feature];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  if (
    feature === 'shadow_injuries' &&
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw)
  ) {
    const total = (raw as Record<string, unknown>)['total'];
    if (typeof total === 'number' && Number.isFinite(total)) return total;
  }

  return null;
}

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  return value as Record<string, unknown>;
}

function spearmanRho(values: number[], outcomes: number[]): number {
  if (values.length !== outcomes.length || values.length < 2) return 0;

  const rankX = averageRanks(values);
  const rankY = averageRanks(outcomes);
  return pearson(rankX, rankY);
}

function averageRanks(values: number[]): number[] {
  const indexed = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i + 1;
    while (j < indexed.length && indexed[j].value === indexed[i].value) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n < 2) return 0;

  const meanX = x.reduce((sum, v) => sum + v, 0) / n;
  const meanY = y.reduce((sum, v) => sum + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}
