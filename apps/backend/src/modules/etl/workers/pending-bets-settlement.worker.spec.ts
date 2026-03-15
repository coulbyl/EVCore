import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixtureService } from '../../fixture/fixture.service';
import type { BettingEngineService } from '../../betting-engine/betting-engine.service';
import type { CouponService } from '../../coupon/coupon.service';
import type { NotificationService } from '../../notification/notification.service';
import { PendingBetsSettlementWorker } from './pending-bets-settlement.worker';

function buildFixtureResponse(status: 'NS' | 'FT') {
  return {
    get: 'fixtures',
    parameters: { id: '999' },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 999,
          referee: null,
          timezone: 'UTC',
          date: '2025-03-15T20:00:00+00:00',
          timestamp: 1742068800,
          periods: { first: 1742068800, second: 1742072400 },
          venue: { id: 1, name: 'Stadium', city: 'City' },
          status: {
            long: status === 'FT' ? 'Match Finished' : 'Not Started',
            short: status,
            elapsed: status === 'FT' ? 90 : null,
            extra: null,
          },
        },
        league: {
          id: 39,
          name: 'Premier League',
          country: 'England',
          logo: 'x',
          flag: 'x',
          season: 2025,
          round: 'Regular Season - 1',
          standings: true,
        },
        teams: {
          home: { id: 1, name: 'Home', logo: 'x', winner: status === 'FT' },
          away: { id: 2, name: 'Away', logo: 'x', winner: false },
        },
        goals: {
          home: status === 'FT' ? 2 : null,
          away: status === 'FT' ? 1 : null,
        },
        score: {
          halftime: {
            home: status === 'FT' ? 1 : null,
            away: status === 'FT' ? 0 : null,
          },
          fulltime: {
            home: status === 'FT' ? 2 : null,
            away: status === 'FT' ? 1 : null,
          },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
    ],
  };
}

describe('PendingBetsSettlementWorker', () => {
  const fixtureService = {
    findPendingSettlementFixtures: vi.fn(),
    syncFixtureState: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureService>;
  const bettingEngineService = {
    settleOpenBets: vi.fn().mockResolvedValue({ settled: 1 }),
  } satisfies Partial<BettingEngineService>;
  const couponService = {
    settlePendingCouponsByFixture: vi
      .fn()
      .mockResolvedValue({ settledCount: 1 }),
    settleExpiredCoupons: vi.fn().mockResolvedValue({ settledCount: 0 }),
  } satisfies Partial<CouponService>;
  const notification = {
    sendEtlFailureAlert: vi.fn(),
  } satisfies Partial<NotificationService>;
  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
  } satisfies Partial<ConfigService>;

  const worker = new PendingBetsSettlementWorker(
    fixtureService as unknown as FixtureService,
    bettingEngineService as unknown as BettingEngineService,
    couponService as unknown as CouponService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(worker, {
      notification: notification as unknown as NotificationService,
      config: config as unknown as ConfigService,
    });
    fixtureService.syncFixtureState.mockResolvedValue(undefined);
    bettingEngineService.settleOpenBets.mockResolvedValue({ settled: 1 });
    couponService.settlePendingCouponsByFixture.mockResolvedValue({
      settledCount: 1,
    });
    couponService.settleExpiredCoupons.mockResolvedValue({ settledCount: 0 });
    config.getOrThrow.mockReturnValue('test-api-key');
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        scheduledAt: new Date('2025-03-15T20:00:00Z'),
        season: {
          competition: {
            leagueId: 39,
            code: 'PL',
          },
        },
      },
    ]);
  });

  it('updates fixture state and settles bets/coupons when a fixture finishes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildFixtureResponse('FT')),
    });

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith({
      externalId: 999,
      scheduledAt: new Date('2025-03-15T20:00:00.000Z'),
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
    });
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
      'fixture-1',
    );
    expect(couponService.settlePendingCouponsByFixture).toHaveBeenCalledWith(
      'fixture-1',
    );
    expect(couponService.settleExpiredCoupons).toHaveBeenCalledOnce();
  });

  it('only refreshes fixture state when the fixture is still scheduled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildFixtureResponse('NS')),
    });

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
    expect(couponService.settlePendingCouponsByFixture).not.toHaveBeenCalled();
    expect(couponService.settleExpiredCoupons).toHaveBeenCalledOnce();
  });

  it('throws on non-ok API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      worker.process({ data: {} } as Job<Record<string, never>>),
    ).rejects.toThrow('API-FOOTBALL responded 500 for fixture 999');
  });
});
