import { describe, expect, it, vi } from 'vitest';
import type { ResultsService } from './results.service';
import type { ResultsScreen } from './results.types';
import { PublicService } from './public.service';
import type { TodayService } from './today.service';
import type { TodayCoupon, TodayScreen } from './today.types';

const NOW = new Date('2026-10-30T15:00:00.000Z');

function coupon(id: string, product: TodayCoupon['product']): TodayCoupon {
  return {
    id,
    product,
    forDate: '2026-10-30',
    state: 'upcoming',
    firstKickoffAt: '2026-10-30T19:00:00.000Z',
    odds: 1.28,
    referenceOdds: 1.3,
    paidOdds: null,
    chance: 0.8,
    oddsBand: null,
    followedByMe: true,
    canFollow: true,
    legs: [],
  };
}

function screen(overrides: Partial<TodayScreen> = {}): TodayScreen {
  return {
    date: '2026-10-30',
    yesterday: [{ product: 'FAVOURITE', outcome: 'won', followedByMe: true }],
    week: null,
    heroId: 'fav',
    coupons: [coupon('fav', 'FAVOURITE'), coupon('combo', 'COMBO')],
    absences: [],
    followedInProgress: [],
    forms: [
      {
        product: 'FAVOURITE',
        days: [
          { date: '2026-10-13', outcome: 'won' },
          { date: '2026-10-14', outcome: 'lost' },
        ],
        won: 1,
        played: 2,
        worstLosingStreak: 1,
      },
    ],
    ...overrides,
  };
}

const RESULTS = {
  period: 'all',
  products: ['FAVOURITE', 'COMBO', 'DOUBLE', 'HUNTER_BTTS'].map((product) => ({
    product,
    retired: false,
    launchedOn: '2026-10-13',
    since: '2026-10-13',
    won: 11,
    lost: 3,
    refunded: 0,
    daysWithoutCoupon: 2,
    worstLosingStreak: 1,
    last: [],
    tooEarly: false,
    settledDays: 14,
    comparison: null,
    francs: null,
  })),
  ai: {
    since: '2026-10-28',
    won: 4,
    lost: 1,
    refunded: 0,
    last: [],
    tooEarly: true,
    comparison: null,
    francs: null,
  },
} as unknown as ResultsScreen;

function harness(today: TodayScreen, lastHeroes: (TodayCoupon | null)[] = []) {
  const heroOfDay = vi.fn();
  for (const coupon of lastHeroes) heroOfDay.mockResolvedValueOnce(coupon);
  heroOfDay.mockResolvedValue(null);
  const todayService = {
    getToday: vi.fn().mockResolvedValue(today),
    heroOfDay,
  } as unknown as TodayService;
  const results = {
    getResults: vi.fn().mockResolvedValue(RESULTS),
  } as unknown as ResultsService;
  return {
    service: new PublicService(todayService, results),
    todayService,
    results,
  };
}

describe('PublicService.getToday', () => {
  it('reads the screens without a player, results since launch', async () => {
    const { service, todayService, results } = harness(screen());
    await service.getToday(NOW);
    expect(todayService.getToday).toHaveBeenCalledWith(null, NOW);
    expect(results.getResults).toHaveBeenCalledWith(
      { period: 'all', isAdmin: false },
      NOW,
    );
  });

  it('serves the hero only, without anything a player follows', async () => {
    const { service } = harness(screen());
    const page = await service.getToday(NOW);
    expect(page.hero?.id).toBe('fav');
    expect(page.hero).not.toHaveProperty('followedByMe');
    expect(page.hero).not.toHaveProperty('canFollow');
    // Never the other products' coupons.
    expect(JSON.stringify(page)).not.toContain('"combo"');
    expect(page.yesterday).toEqual([{ product: 'FAVOURITE', outcome: 'won' }]);
    expect(page.heroForm).toEqual({
      days: [
        { date: '2026-10-13', outcome: 'won' },
        { date: '2026-10-14', outcome: 'lost' },
      ],
      won: 1,
      played: 2,
      since: '2026-10-13',
    });
  });

  it('the first three lines of Résultats and the AI, without the detail', async () => {
    const { service } = harness(screen());
    const page = await service.getToday(NOW);
    expect(page.results.map((r) => r.product)).toEqual([
      'FAVOURITE',
      'COMBO',
      'DOUBLE',
    ]);
    expect(page.results[0]).toEqual({
      product: 'FAVOURITE',
      won: 11,
      lost: 3,
      refunded: 0,
      tooEarly: false,
      settledDays: 14,
      since: '2026-10-13',
    });
    expect(page.ai).toEqual({
      won: 4,
      lost: 1,
      tooEarly: true,
      since: '2026-10-28',
    });
  });

  it('a day without a coupon: no hero, the reasons', async () => {
    const { service } = harness(
      screen({
        heroId: null,
        coupons: [],
        absences: [
          { product: 'FAVOURITE', reason: 'no_home_favourite_in_band' },
        ],
      }),
    );
    const page = await service.getToday(NOW);
    expect(page.hero).toBeNull();
    expect(page.lastWon).toBeNull();
    expect(page.heroForm).toBeNull();
    expect(page.absences).toHaveLength(1);
  });

  it('a day without a hero shows the last one that won, with its day', async () => {
    const empty = screen({ heroId: null, coupons: [], absences: [] });
    const won = {
      ...screen({}).coupons[0],
      state: 'won' as const,
    };
    const lost = { ...won, id: 'lost-one', state: 'lost' as const };
    // Nothing yesterday, a loss two days ago, the win three days ago.
    const { service, todayService } = harness(empty, [null, lost, won]);
    const page = await service.getToday(NOW);
    expect(page.hero).toBeNull();
    expect(page.lastWon?.coupon.id).toBe(won.id);
    expect(page.lastWon?.date).toBe(
      new Date(NOW.getTime() - 3 * 86_400_000).toISOString().slice(0, 10),
    );
    expect(page.lastWon?.coupon).not.toHaveProperty('followedByMe');
    expect(vi.mocked(todayService.heroOfDay)).toHaveBeenCalledTimes(3);
  });
});
