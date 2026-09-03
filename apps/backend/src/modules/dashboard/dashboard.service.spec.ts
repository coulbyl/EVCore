import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import { StrategyChannel } from '@evcore/db';
import { DashboardService } from './dashboard.service';
import type { DashboardRepository } from './dashboard.repository';

type LeaderboardSlip = Awaited<
  ReturnType<DashboardRepository['getLeaderboardData']>
>[number];

// One SIMPLE coupon, one leg, stake 1 unit — WON returns `odds`, LOST returns 0.
function simpleSlip(opts: {
  userId: string;
  username: string;
  odds: number;
  won: boolean;
}): LeaderboardSlip {
  return {
    userId: opts.userId,
    type: 'SIMPLE',
    unitStake: new Decimal(1),
    user: { username: opts.username },
    items: [
      {
        stakeOverride: null,
        bet: {
          status: opts.won ? 'WON' : 'LOST',
          oddsSnapshot: new Decimal(opts.odds),
        },
      },
    ],
  } as unknown as LeaderboardSlip;
}

function repeat<T>(n: number, fn: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => fn(i));
}

describe('DashboardService.getLeaderboard', () => {
  it('excludes a user below the minimum settled-coupon floor, even with a huge ROI', async () => {
    const slips: LeaderboardSlip[] = [
      // "lucky": 1 coupon, one big longshot win (+900% ROI) — below the floor.
      simpleSlip({ userId: 'lucky', username: 'lucky', odds: 10, won: true }),
      // "steady": 5 settled coupons, modest but consistent ROI — meets the floor.
      ...repeat(5, (i) =>
        simpleSlip({
          userId: 'steady',
          username: 'steady',
          odds: 1.5,
          won: i < 4, // 4 won, 1 lost → ROI = (4*1.5 - 5) / 5 * 100 = 20%
        }),
      ),
    ];

    const repo = {
      getLeaderboardData: vi.fn().mockResolvedValue(slips),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getLeaderboard();

    expect(result.map((r) => r.username)).toEqual(['steady']);
    expect(result[0]?.roi).toBe('+20.0%');
  });

  it('ranks eligible users by ROI once both clear the settled-coupon floor', async () => {
    const slips: LeaderboardSlip[] = [
      ...repeat(5, (i) =>
        simpleSlip({
          userId: 'high-roi',
          username: 'high-roi',
          odds: 2.0,
          won: i < 4, // ROI = (4*2 - 5) / 5 * 100 = 60%
        }),
      ),
      ...repeat(5, (i) =>
        simpleSlip({
          userId: 'low-roi',
          username: 'low-roi',
          odds: 1.2,
          won: i < 4, // ROI = (4*1.2 - 5) / 5 * 100 = -4%
        }),
      ),
    ];

    const repo = {
      getLeaderboardData: vi.fn().mockResolvedValue(slips),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getLeaderboard();

    expect(result.map((r) => r.username)).toEqual(['high-roi', 'low-roi']);
    expect(result[0]?.rank).toBe(1);
    expect(result[1]?.rank).toBe(2);
  });

  it('returns an empty leaderboard when no user meets the settled-coupon floor', async () => {
    const slips: LeaderboardSlip[] = [
      simpleSlip({ userId: 'a', username: 'a', odds: 3, won: true }),
      simpleSlip({ userId: 'b', username: 'b', odds: 2, won: false }),
    ];

    const repo = {
      getLeaderboardData: vi.fn().mockResolvedValue(slips),
    } satisfies Partial<DashboardRepository>;

    const service = new DashboardService(
      repo as unknown as DashboardRepository,
    );
    const result = await service.getLeaderboard();

    expect(result).toEqual([]);
  });
});

type ChannelSelectionRow = Awaited<
  ReturnType<DashboardRepository['findChannelSelectionsInRange']>
>[number];

function selectionRow(opts: {
  won: boolean;
  odds: number;
  probability: number;
}): ChannelSelectionRow {
  return {
    result: opts.won ? 'WON' : 'LOST',
    odds: new Decimal(opts.odds),
    probability: new Decimal(opts.probability),
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

describe('DashboardService.getChannelHealth — calibration-based classification', () => {
  it('classifies GREEN by calibration even when flat-stake ROI is negative (regression: DRAW showed "Négatif" on ROI while being one of only 2 well-calibrated channels — docs/vantage-centric-redesign-2026-09-01.md §5.4)', async () => {
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
    const result = await service.getChannelHealth('2026-01-01', '2026-01-31');
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
    const result = await service.getChannelHealth('2026-01-01', '2026-01-31');
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
    const result = await service.getChannelHealth('2026-01-01', '2026-01-31');
    const draw = result.find((r) => r.channel === StrategyChannel.DRAW);

    expect(draw?.status).toBe('INSUFFICIENT_DATA');
  });
});
