import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { EV_THRESHOLD } from '@modules/betting-engine/ev.constants';
import {
  ReportsRepository,
  type ActiveModelRow,
  type SettledEvSelectionRow,
} from './reports.repository';
import {
  META_ONLY_SEGMENTS,
  PROMOTION_RULE_TEXT,
  ROI_SHADOW_FIX_DATE,
  SHADOW_CAPTURED_SEGMENTS,
  computeVerdict,
} from './reports.constants';
import type {
  ActiveModelMeta,
  MlPromotionReport,
  PromotionWindow,
  SegmentComparison,
  SegmentReportRow,
} from './reports.types';

const WINDOW_DAYS: Record<
  Exclude<PromotionWindow, 'SINCE_ACTIVATION'>,
  number
> = {
  P7D: 7,
  P30D: 30,
  P90D: 90,
};

function readNumber(json: unknown, key: string): number | null {
  if (json === null || typeof json !== 'object') return null;
  const value = (json as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  async getMlPromotionReport(
    window: PromotionWindow,
  ): Promise<MlPromotionReport> {
    const to = new Date();
    // SINCE_ACTIVATION still needs a query floor — use 90d as the widest scan;
    // per-segment activation is applied during aggregation.
    const days = window === 'SINCE_ACTIVATION' ? 90 : WINDOW_DAYS[window];
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const [selections, activeModels] = await Promise.all([
      this.repo.findSettledEvSelections(from),
      this.repo.findActiveModels(),
    ]);

    const activeBySegment = new Map(activeModels.map((m) => [m.segment, m]));
    const asOf =
      selections.length > 0
        ? selections[selections.length - 1].createdAt.toISOString()
        : null;

    const shadowRows: SegmentReportRow[] = SHADOW_CAPTURED_SEGMENTS.map(
      (segment) => {
        const active = activeBySegment.get(segment) ?? null;
        const segmentFrom = this.segmentWindowStart(window, from, active);
        const market = segment.split(':')[1];
        const comparison = this.compareSegment(selections, market, segmentFrom);
        const { verdict, brierImprovement } =
          comparison !== null
            ? computeVerdict(comparison)
            : { verdict: 'INSUFFICIENT' as const, brierImprovement: null };
        return {
          segment,
          verdict,
          comparison,
          brierImprovement,
          activeModel: this.toMeta(active),
        };
      },
    );

    const metaRows: SegmentReportRow[] = META_ONLY_SEGMENTS.map((segment) => ({
      segment,
      verdict: 'META_ONLY' as const,
      comparison: null,
      brierImprovement: null,
      activeModel: this.toMeta(activeBySegment.get(segment) ?? null),
    }));

    return {
      window,
      from: from.toISOString(),
      to: to.toISOString(),
      asOf,
      rule: PROMOTION_RULE_TEXT,
      segments: [...shadowRows, ...metaRows],
    };
  }

  private segmentWindowStart(
    window: PromotionWindow,
    from: Date,
    active: ActiveModelRow | null,
  ): Date {
    if (window !== 'SINCE_ACTIVATION') return from;
    const activatedAt = active?.activatedAt;
    // Fall back to the 90d scan floor when the segment has no active model.
    return activatedAt && activatedAt > from ? activatedAt : from;
  }

  // Baseline vs corrected Brier + policy ROI over the comparable settled bets
  // of one segment. Returns null when no bet carries a shadow correction.
  private compareSegment(
    selections: SettledEvSelectionRow[],
    market: string,
    from: Date,
  ): SegmentComparison | null {
    let n = 0;
    let baselineBrierSum = new Decimal(0);
    let correctedBrierSum = new Decimal(0);
    let baselineProfit = new Decimal(0);
    let correctedProfit = new Decimal(0);
    let correctedPlaced = 0;

    for (const selection of selections) {
      if (selection.market !== market) continue;
      if (selection.createdAt < from) continue;
      if (selection.odds === null) continue;
      const correctedP = readNumber(
        selection.channelDecision.modelRun.features,
        'shadow_ml_corrected_p',
      );
      if (correctedP === null) continue;

      const outcome = selection.result === 'WON' ? 1 : 0;
      const baselineP = new Decimal(
        selection.probability.toString(),
      ).toNumber();
      const odds = new Decimal(selection.odds.toString());

      n += 1;
      baselineBrierSum = baselineBrierSum.plus((baselineP - outcome) ** 2);
      correctedBrierSum = correctedBrierSum.plus((correctedP - outcome) ** 2);

      // Baseline policy: the bet was actually placed → its realized profit.
      const profit = outcome === 1 ? odds.minus(1) : new Decimal(-1);
      baselineProfit = baselineProfit.plus(profit);

      // Corrected policy: would the model still place it? (corrected EV ≥ floor)
      const correctedEv = odds.times(correctedP).minus(1);
      if (correctedEv.greaterThanOrEqualTo(EV_THRESHOLD)) {
        correctedProfit = correctedProfit.plus(profit);
        correctedPlaced += 1;
      }
    }

    if (n === 0) return null;

    return {
      sampleSize: n,
      baselineBrier: baselineBrierSum.div(n).toNumber(),
      correctedBrier: correctedBrierSum.div(n).toNumber(),
      baselineRoi: baselineProfit.div(n).toNumber(),
      correctedRoi:
        correctedPlaced > 0
          ? correctedProfit.div(correctedPlaced).toNumber()
          : null,
    };
  }

  private toMeta(model: ActiveModelRow | null): ActiveModelMeta | null {
    if (model === null) return null;
    const metrics = model.metrics;
    return {
      versionId: model.id,
      algorithm: model.algorithm,
      activatedAt: model.activatedAt?.toISOString() ?? null,
      brierScore: readNumber(metrics, 'brierScore'),
      roiShadow: readNumber(metrics, 'roiShadow'),
      roiShadowLegacy: model.createdAt < ROI_SHADOW_FIX_DATE,
    };
  }
}
