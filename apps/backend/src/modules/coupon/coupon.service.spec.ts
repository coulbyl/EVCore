import { describe, expect, it, vi } from 'vitest';
import { CouponService } from './coupon.service';
import type { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import type { CouponFollowRepository } from './coupon-follow.repository';
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
    _count: { views: 0, placements: 0, follows: 0 },
    placements: [],
    follows: [],
    legs: [
      {
        id: 'leg-1',
        fixtureId: 'fixture-1',
        canal: 'BTTS',
        market: 'BTTS',
        pick: 'YES',
        line: null,
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
  const playable = {
    findPlayableQuotes: vi.fn().mockResolvedValue(new Map()),
  } as unknown as PlayableOddsRepository;
  const follows = {
    follow: vi.fn().mockResolvedValue(undefined),
    unfollow: vi.fn().mockResolvedValue(undefined),
  } as unknown as CouponFollowRepository;
  return new CouponService(repo, playable, follows);
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

describe('CouponService.getTrackRecord', () => {
  it('returns each class with the exact settled date range', async () => {
    const findClassTrackRecord = vi.fn().mockResolvedValue([
      {
        source: 'PRICE_COMPOSER',
        targetOddsMin: 1.2,
        settled: 7,
        won: 6,
        avgOdds: 1.19,
        returnPerUnit: 0.97,
        firstDay: new Date('2026-10-16T00:00:00.000Z'),
        lastDay: new Date('2026-10-22T00:00:00.000Z'),
        worstLosingStreak: 1,
      },
    ]);
    const repo = { findClassTrackRecord } as unknown as CouponRepository;
    const playable = {} as unknown as PlayableOddsRepository;

    const [row] = await new CouponService(
      repo,
      playable,
      {} as CouponFollowRepository,
    ).getTrackRecord(30);

    expect(row).toMatchObject({
      settled: 7,
      won: 6,
      returnPerUnit: 0.97,
      firstDay: '2026-10-16',
      lastDay: '2026-10-22',
      worstLosingStreak: 1,
      days: 30,
    });
  });
});

describe('CouponService.follow', () => {
  function followHarness(exists: boolean) {
    const repo = {
      exists: vi.fn().mockResolvedValue(exists),
    } as unknown as CouponRepository;
    const follows = {
      follow: vi.fn().mockResolvedValue(undefined),
      unfollow: vi.fn().mockResolvedValue(undefined),
    } as unknown as CouponFollowRepository;
    return {
      service: new CouponService(repo, {} as PlayableOddsRepository, follows),
      follows,
    };
  }

  it('follows an existing coupon', async () => {
    const { service, follows } = followHarness(true);
    await service.follow('coupon-1', 'u1');
    expect(follows.follow).toHaveBeenCalledWith('coupon-1', 'u1');
  });

  it('answers 404 for an unknown coupon', async () => {
    const { service, follows } = followHarness(false);
    await expect(service.follow('nope', 'u1')).rejects.toThrow(
      'Coupon introuvable',
    );
    expect(follows.follow).not.toHaveBeenCalled();
  });
});

describe('CouponService.getAbstentions', () => {
  it('keeps the products whose latest attempt abstained and that have no coupon', async () => {
    const repo = {
      findLatestAttempts: vi.fn().mockResolvedValue([
        {
          pass: 'double',
          outcome: 'abstained',
          reason: 'no_combination_in_window',
        },
        { pass: 'favourite', outcome: 'composed', reason: null },
        // Pas un produit de l'Accueil : jamais expliqué au joueur.
        { pass: 'price-composer', outcome: 'abstained', reason: 'x' },
        {
          pass: 'hunter-hunter_draw',
          outcome: 'abstained',
          reason: 'no_candidate_in_band',
        },
        // Le moteur s'abstient mais le combiné de l'IA (1,2) est publié.
        {
          pass: 'engine-combo',
          outcome: 'abstained',
          reason: 'not_enough_calibrated_short_legs',
        },
      ]),
      findPublishedTargets: vi.fn().mockResolvedValue([1.2]),
    } as unknown as CouponRepository;
    const service = new CouponService(
      repo,
      {} as PlayableOddsRepository,
      {} as CouponFollowRepository,
    );
    await expect(service.getAbstentions('2026-10-29')).resolves.toEqual([
      { couponClass: 'DOUBLE', reason: 'no_combination_in_window' },
      { couponClass: 'HUNTER_DRAW', reason: 'no_candidate_in_band' },
    ]);
  });
});
