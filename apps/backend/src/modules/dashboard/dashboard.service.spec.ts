import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import { StrategyChannel } from '@evcore/db';
import { DashboardService } from './dashboard.service';
import type { DashboardRepository } from './dashboard.repository';

type ChannelSelectionRow = Awaited<
  ReturnType<DashboardRepository['findChannelSelectionsInRange']>
>[number];

function selectionRow(opts: {
  won: boolean;
  odds: number;
  probability: number;
  marginPaid?: number | null;
}): ChannelSelectionRow {
  return {
    result: opts.won ? 'WON' : 'LOST',
    odds: new Decimal(opts.odds),
    probability: new Decimal(opts.probability),
    market: 'ONE_X_TWO',
    marginPaid:
      opts.marginPaid === null ? null : new Decimal(opts.marginPaid ?? 0.05),
    channelDecision: {
      channel: StrategyChannel.DRAW,
      modelRun: {
        fixture: {
          season: {
            competition: { code: 'FR1', name: 'Ligue 1', country: 'France' },
          },
        },
      },
    },
  } as unknown as ChannelSelectionRow;
}

describe('DashboardService.getChannelStatsByCompetition — calibration-based classification', () => {
  it('classifies GREEN by calibration even when flat-stake ROI is negative (regression: DRAW showed "Négatif" on ROI while being one of only 2 well-calibrated channels — docs/archive/vantage-centric-redesign-2026-09-01.md §5.4)', async () => {
    // 40 settled selections, 31 won (77.5% real) — announced probability
    // 0.77 on every row (~perfectly calibrated, ratio ≈ 1.006), but odds
    // of 1.25 (bookmaker margin) make flat-stake ROI negative regardless:
    // (31*1.25 - 40) / 40 * 100 = -3.125%.
    const selections = [
      ...Array.from({ length: 31 }, () =>
        selectionRow({ won: true, odds: 1.25, probability: 0.77 }),
      ),
      ...Array.from({ length: 9 }, () =>
        selectionRow({ won: false, odds: 1.25, probability: 0.77 }),
      ),
    ];
    const repo = {
      findChannelSelectionsInRange: vi.fn().mockResolvedValue(selections),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getChannelStatsByCompetition(
      '2026-01-01',
      '2026-01-31',
    );
    const draw = result.find((r) => r.channel === StrategyChannel.DRAW);

    expect(draw?.roi).toBeLessThan(0);
    expect(draw?.calibrationRatio).toBeGreaterThanOrEqual(0.85);
    expect(draw?.status).toBe('GREEN');
  });

  it('classifies RED when the calibration ratio is badly overconfident, whatever the ROI', async () => {
    // 40 selections, only 40% real hit rate against an 80% announced
    // probability — ratio 0.5, clearly below the 0.7 floor.
    const selections = [
      ...Array.from({ length: 16 }, () =>
        selectionRow({ won: true, odds: 1.05, probability: 0.8 }),
      ),
      ...Array.from({ length: 24 }, () =>
        selectionRow({ won: false, odds: 1.05, probability: 0.8 }),
      ),
    ];
    const repo = {
      findChannelSelectionsInRange: vi.fn().mockResolvedValue(selections),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getChannelStatsByCompetition(
      '2026-01-01',
      '2026-01-31',
    );
    const draw = result.find((r) => r.channel === StrategyChannel.DRAW);

    expect(draw?.calibrationRatio).toBeLessThan(0.7);
    expect(draw?.status).toBe('RED');
  });

  it('classifies INSUFFICIENT_DATA below the 30-sample floor, even with a perfect calibration ratio', async () => {
    const selections = Array.from({ length: 10 }, (_, i) =>
      selectionRow({ won: i < 8, odds: 1.25, probability: 0.8 }),
    );
    const repo = {
      findChannelSelectionsInRange: vi.fn().mockResolvedValue(selections),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getChannelStatsByCompetition(
      '2026-01-01',
      '2026-01-31',
    );
    const draw = result.find((r) => r.channel === StrategyChannel.DRAW);

    expect(draw?.status).toBe('INSUFFICIENT_DATA');
  });
});

describe('DashboardService — market frequency without a paid margin', () => {
  it('falls back on the typical margin of the market', async () => {
    const selections = Array.from({ length: 30 }, (_, i) =>
      selectionRow({
        won: i < 15,
        odds: 2,
        probability: 0.6,
        marginPaid: null,
      }),
    );
    const repo = {
      findChannelSelectionsInRange: vi.fn().mockResolvedValue(selections),
    } satisfies Partial<DashboardRepository>;
    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const [draw] = await service.getChannelStatsByCompetition(
      '2026-09-01',
      '2026-09-30',
    );
    // ONE_X_TWO : marge typique 5 % → 1 / 2 / 1,05 = 0,4762.
    expect(draw?.market).toBeCloseTo(0.4762, 4);
  });
});
