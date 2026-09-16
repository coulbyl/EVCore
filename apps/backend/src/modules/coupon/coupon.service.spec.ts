import { describe, expect, it, vi } from 'vitest';
import { CouponService } from './coupon.service';
import type { CouponRepository } from './coupon.repository';

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    forDate: new Date('2026-09-14T00:00:00.000Z'),
    rank: 1,
    signalWindowDays: 38,
    targetOddsMin: 5,
    targetOddsMax: 15,
    combinedOdds: 6.1,
    jointProbability: 0.2,
    signalScore: 0.62,
    status: 'PENDING',
    result: null,
    reasoning: { generationPass: 'INTRADAY' },
    lastFixtureScheduledAt: new Date('2026-09-14T20:00:00.000Z'),
    generatedAt: new Date('2026-09-14T12:00:00.000Z'),
    _count: { views: 0, placements: 0 },
    placements: [],
    legs: [
      {
        id: 'leg-1',
        fixtureId: 'fixture-1',
        canal: 'BTTS',
        market: 'BTTS',
        pick: 'YES',
        probability: 0.62,
        oddsSnapshot: 1.8,
        signalScore: 0.62,
        isCorrect: null,
        featureSnapshot: { modelRunId: 'captured-run' },
        fixture: {
          scheduledAt: new Date('2026-09-14T18:00:00.000Z'),
          homeScore: null,
          awayScore: null,
          homeHtScore: null,
          awayHtScore: null,
          homeTeam: { name: 'Home', logoUrl: null },
          awayTeam: { name: 'Away', logoUrl: null },
          season: {
            competition: {
              code: 'PL',
              name: 'Premier League',
              country: 'England',
            },
          },
          modelRuns: [{ id: 'latest-run' }],
        },
      },
    ],
    ...overrides,
  };
}

function serviceWith(rows: unknown[]) {
  const repo = {
    findByDate: vi.fn().mockResolvedValue(rows),
  } as unknown as CouponRepository;
  return new CouponService(repo);
}

describe('CouponService.getCoupons', () => {
  it('returns the captured generation pass and model run provenance', async () => {
    const [coupon] = await serviceWith([proposal()]).getCoupons(
      '2026-09-14',
      'user-1',
    );

    expect(coupon?.batch).toBe('intraday');
    expect(coupon?.legs[0]?.modelRunId).toBe('captured-run');
  });

  it('decodes historical intraday rows and falls back to their latest run', async () => {
    const legacy = proposal({
      signalWindowDays: 39,
      reasoning: null,
      legs: [
        {
          ...proposal().legs[0],
          featureSnapshot: {},
        },
      ],
    });
    const [coupon] = await serviceWith([legacy]).getCoupons(
      '2026-09-14',
      'user-1',
    );

    expect(coupon?.batch).toBe('intraday');
    expect(coupon?.legs[0]?.modelRunId).toBe('latest-run');
  });
});
