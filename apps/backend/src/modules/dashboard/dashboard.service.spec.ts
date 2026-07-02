import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
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
