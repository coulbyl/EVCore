import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { StrategyChannel, type Prisma } from '@evcore/db';
import { ReportsService } from './reports.service';
import type {
  ReportsRepository,
  SettledEvSelectionRow,
} from './reports.repository';

function makeSelection(input: {
  channel: StrategyChannel;
  market: string;
  probability: string;
  odds: string;
  result: 'WON' | 'LOST';
  correctedP?: number;
  createdAt?: Date;
}): SettledEvSelectionRow {
  const features: Record<string, Prisma.JsonValue> = {};
  if (input.correctedP !== undefined) {
    features['shadow_ml_by_channel'] = {
      [input.channel]: { correctedP: input.correctedP, edgeDelta: 0 },
    };
  }
  return {
    market: input.market,
    result: input.result,
    probability: new Decimal(input.probability),
    odds: new Decimal(input.odds),
    createdAt: input.createdAt ?? new Date('2026-07-01T00:00:00.000Z'),
    channelDecision: {
      channel: input.channel,
      modelRun: { features },
    },
  };
}

function makeRepo(selections: SettledEvSelectionRow[]): ReportsRepository {
  return {
    findSettledEvSelections: vi.fn().mockResolvedValue(selections),
    findActiveModels: vi.fn().mockResolvedValue([]),
  } as unknown as ReportsRepository;
}

describe('ReportsService.getMlPromotionReport', () => {
  it('does not mix VALUE:OVER_UNDER and GOALS:OVER_UNDER selections sharing the same market', async () => {
    // 60 VALUE:OVER_UNDER, all WON, corrected == baseline (no Brier change).
    const valueSelections = Array.from({ length: 60 }, () =>
      makeSelection({
        channel: StrategyChannel.VALUE,
        market: 'OVER_UNDER',
        probability: '0.6',
        odds: '1.9',
        result: 'WON',
        correctedP: 0.6,
      }),
    );
    // 60 GOALS:OVER_UNDER, all LOST, corrected far off baseline (should only
    // affect the GOALS row, not leak into VALUE's comparison).
    const goalsSelections = Array.from({ length: 60 }, () =>
      makeSelection({
        channel: StrategyChannel.GOALS,
        market: 'OVER_UNDER',
        probability: '0.6',
        odds: '1.9',
        result: 'LOST',
        correctedP: 0.1,
      }),
    );

    const service = new ReportsService(
      makeRepo([...valueSelections, ...goalsSelections]),
    );
    const report = await service.getMlPromotionReport('P90D');

    const value = report.segments.find((s) => s.segment === 'VALUE:OVER_UNDER');
    const goals = report.segments.find((s) => s.segment === 'GOALS:OVER_UNDER');

    expect(value?.comparison?.sampleSize).toBe(60);
    expect(value?.comparison?.baselineBrier).toBeCloseTo(0.16, 8); // (0.6-1)^2
    expect(value?.comparison?.correctedBrier).toBeCloseTo(0.16, 8); // unchanged

    expect(goals?.comparison?.sampleSize).toBe(60);
    expect(goals?.comparison?.baselineBrier).toBeCloseTo(0.36, 8); // (0.6-0)^2
    expect(goals?.comparison?.correctedBrier).toBeCloseTo(0.01, 8); // (0.1-0)^2
  });

  it('never replays the EV policy for non-VALUE channels — correctedRoi stays null', async () => {
    const selections = Array.from({ length: 60 }, () =>
      makeSelection({
        channel: StrategyChannel.DOMINANT,
        market: 'ONE_X_TWO',
        probability: '0.6',
        odds: '2.0',
        result: 'WON',
        correctedP: 0.7, // would clear any EV floor if replayed
      }),
    );

    const service = new ReportsService(makeRepo(selections));
    const report = await service.getMlPromotionReport('P90D');

    const dominant = report.segments.find(
      (s) => s.segment === 'DOMINANT:ONE_X_TWO',
    );
    expect(dominant?.comparison?.correctedRoi).toBeNull();
    // Brier still improves (0.7 closer to WON=1 than 0.6) but ROI can't
    // confirm GO without a real per-league threshold replay → capped at WATCH.
    expect(dominant?.verdict).not.toBe('GO');
  });

  it('replays the VALUE EV policy and can reach GO when both Brier and ROI improve', async () => {
    // 60 settled picks: baseline p=0.5 (Brier .25 either way), corrected p=0.7
    // when WON (Brier .09) — a clear calibration improvement. Odds 2.2 keeps
    // every corrected pick above EV_THRESHOLD (0.08) at p=0.7.
    const won = Array.from({ length: 40 }, () =>
      makeSelection({
        channel: StrategyChannel.VALUE,
        market: 'ONE_X_TWO',
        probability: '0.5',
        odds: '2.2',
        result: 'WON',
        correctedP: 0.7,
      }),
    );
    const lost = Array.from({ length: 20 }, () =>
      makeSelection({
        channel: StrategyChannel.VALUE,
        market: 'ONE_X_TWO',
        probability: '0.5',
        odds: '2.2',
        result: 'LOST',
        correctedP: 0.7,
      }),
    );

    const service = new ReportsService(makeRepo([...won, ...lost]));
    const report = await service.getMlPromotionReport('P90D');

    const value = report.segments.find((s) => s.segment === 'VALUE:ONE_X_TWO');
    expect(value?.comparison?.sampleSize).toBe(60);
    expect(value?.comparison?.correctedRoi).not.toBeNull();
    expect(value?.verdict).toBe('GO');
  });

  it('returns null comparison (no verdict computation) when no selection carries a shadow correction', async () => {
    const selections = [
      makeSelection({
        channel: StrategyChannel.BTTS,
        market: 'BTTS',
        probability: '0.6',
        odds: '1.8',
        result: 'WON',
        // no correctedP
      }),
    ];

    const service = new ReportsService(makeRepo(selections));
    const report = await service.getMlPromotionReport('P90D');

    const btts = report.segments.find((s) => s.segment === 'BTTS:BTTS');
    expect(btts?.comparison).toBeNull();
    expect(btts?.verdict).toBe('INSUFFICIENT');
  });
});
