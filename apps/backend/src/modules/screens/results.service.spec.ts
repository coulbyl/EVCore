import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { ProductWeekService } from '@modules/coupon/product-day/product-week.service';
import { RESULTS_PRODUCTS } from '@config/results.constants';
import { productDaysOf } from '@modules/coupon/product-day/product-day';
import type {
  ProductDayRepository,
  ProductLegRow,
} from '@modules/coupon/product-day/product-day.repository';
import type { AiAdviceRow, ResultsRepository } from './results.repository';
import { ResultsService } from './results.service';

const NOW = new Date('2026-10-30T15:00:00.000Z');
const d = (value: number | string) => new Prisma.Decimal(value);

/** A one-leg Favori day; `operatorOdds` 1,25 unless said otherwise. */
function favourite(
  date: string,
  result: ProductLegRow['result'],
  overrides: Partial<ProductLegRow> = {},
): ProductLegRow {
  return {
    couponId: `fav-${date}`,
    source: 'PRICE_COMPOSER',
    targetOddsMin: d(1.1),
    forDate: new Date(`${date}T00:00:00.000Z`),
    result,
    market: 'ONE_X_TWO',
    pick: 'HOME',
    operatorOdds: d('1.250'),
    oddsSnapshot: d('1.280'),
    probability: d('0.8000'),
    operatorFairProbability: d('0.7600'),
    isCorrect: result === 'WON' ? true : result === 'LOST' ? false : null,
    settledAt: result ? new Date(`${date}T22:00:00.000Z`) : null,
    scheduledAt: new Date(`${date}T19:00:00.000Z`),
    homeName: 'PSG',
    awayName: 'Lens',
    ...overrides,
  };
}

/** Days from 2026-10-13 on, one outcome each. */
function favouriteRun(outcomes: ProductLegRow['result'][]): ProductLegRow[] {
  return outcomes.map((result, i) =>
    favourite(
      new Date(Date.UTC(2026, 9, 13 + i)).toISOString().slice(0, 10),
      result,
    ),
  );
}

function harness(input: {
  legs?: ProductLegRow[];
  abstentions?: { date: string; product: string; reason: string | null }[];
  advice?: AiAdviceRow[];
}) {
  const repository = {
    findAiAdvice: vi.fn().mockResolvedValue(input.advice ?? []),
  } as unknown as ResultsRepository;
  // The stored days, written from the legs by the real rule.
  const productDays = {
    findDays: vi
      .fn()
      .mockResolvedValue(productDaysOf(input.legs ?? [], RESULTS_PRODUCTS)),
  } as unknown as ProductDayRepository;
  const coupons = {
    getProductAbstentions: vi.fn().mockResolvedValue(input.abstentions ?? []),
  } as unknown as CouponService;
  const productWeek = {
    getWeek: vi.fn().mockResolvedValue({
      week: '2026-10-26',
      products: [
        { product: 'FAVOURITE', won: 5, played: 6, days: [] },
        { product: 'COMBO_AI', won: 3, played: 4, days: [] },
      ],
    }),
  } as unknown as ProductWeekService;
  return {
    service: new ResultsService(repository, productDays, coupons, productWeek),
    repository,
    productWeek,
  };
}

const W: ProductLegRow['result'] = 'WON';
const L: ProductLegRow['result'] = 'LOST';
const V: ProductLegRow['result'] = 'VOID';

describe('ResultsService.getResults', () => {
  it("« Hier »: yesterday's coupon of each product of Aujourd'hui, the odds paid after a win", async () => {
    const { service } = harness({
      legs: [favourite('2026-10-29', 'WON'), favourite('2026-10-28', 'LOST')],
    });
    const screen = await service.getResults(
      { period: '90', isAdmin: false },
      NOW,
    );
    expect(screen.yesterday).toEqual({
      date: '2026-10-29',
      items: [{ product: 'FAVOURITE', outcome: 'won', paidOdds: 1.25 }],
    });
    expect(screen.week).toBeNull();
  });

  it("Monday: « Ta semaine », the products of Aujourd'hui only", async () => {
    const { service } = harness({});
    const monday = new Date('2026-11-02T08:00:00.000Z');
    const screen = await service.getResults(
      { period: '90', isAdmin: false },
      monday,
    );
    expect(screen.week).toEqual({
      week: '2026-10-26',
      products: [{ product: 'FAVOURITE', won: 5, played: 6 }],
    });
  });

  it('lists the products a player sees, in screen order, then the AI', async () => {
    const { service } = harness({});
    const screen = await service.getResults(
      { period: '90', isAdmin: false },
      NOW,
    );
    expect(screen.products.map((p) => p.product)).toEqual([
      'FAVOURITE',
      'COMBO',
      'DOUBLE',
      'HUNTER_BTTS',
      'HUNTER_DRAW',
      'HUNTER_SCORE',
      'HUNTER_CORNERS',
      'COMBO_AI',
    ]);
    const admin = await service.getResults(
      { period: '90', isAdmin: true },
      NOW,
    );
    expect(admin.products.at(-1)).toMatchObject({
      product: 'UNIQUE',
      retired: true,
    });
  });

  it('counts won and lost days; a refund is neither; pending days wait', async () => {
    const { service } = harness({
      legs: [...favouriteRun([W, L, V, W, L, L, W, W, W, W, W, null])],
      abstentions: [
        {
          date: '2026-10-25',
          product: 'FAVOURITE',
          reason: 'no_home_favourite_in_band',
        },
      ],
    });
    const [fav] = (
      await service.getResults({ period: '90', isAdmin: false }, NOW)
    ).products;
    expect(fav).toMatchObject({
      since: '2026-10-13',
      won: 7,
      lost: 3,
      refunded: 1,
      daysWithoutCoupon: 1,
      // L (14), refund (15), W (16), then L, L (17, 18): the refund
      // neither breaks nor extends a streak.
      worstLosingStreak: 2,
      last: ['W', 'L', 'W', 'L', 'L', 'W', 'W', 'W', 'W', 'W'].map((o) =>
        o === 'W' ? 'won' : 'lost',
      ),
      settledDays: 11,
      tooEarly: false,
    });
  });

  it('too early under ten settled days: no comparison, no francs', async () => {
    const { service } = harness({ legs: favouriteRun([W, W, L]) });
    const [fav] = (
      await service.getResults({ period: '90', isAdmin: false }, NOW)
    ).products;
    expect(fav).toMatchObject({
      tooEarly: true,
      settledDays: 3,
      comparison: null,
      francs: null,
    });
  });

  it('a 30-day period starts 29 days back, never before launch', async () => {
    const { service } = harness({});
    const screen = await service.getResults(
      { period: '30', isAdmin: false },
      NOW,
    );
    // Launched 2026-10-13: the window starts there, not on 2026-10-01.
    expect(screen.products[0]?.since).toBe('2026-10-13');
    // Launched 2026-10-30.
    expect(screen.products[6]?.since).toBe('2026-10-30');
  });

  it('announced against realised over the same days, chances as shown', async () => {
    const legs = favouriteRun([W, W, W, W, W, W, W, W, L, L]);
    // A day above 1,80 without a market frequency: chance unknown, left out
    // of both figures.
    legs.push(
      favourite('2026-10-23', 'WON', {
        operatorOdds: d('1.900'),
        operatorFairProbability: null,
      }),
    );
    const { service } = harness({ legs });
    const [fav] = (
      await service.getResults({ period: '90', isAdmin: false }, NOW)
    ).products;
    expect(fav?.comparison).toEqual({
      days: 10,
      announced: 0.8,
      realised: 0.8,
    });
  });

  it('francs on days priced at 1xBet on every leg, won or lost alike', async () => {
    const legs = favouriteRun([W, W, W, W, W, W, W, W, L, L]);
    // Unpriced days, one won, one lost: both left out, counted apart.
    legs.push(favourite('2026-10-23', 'WON', { operatorOdds: null }));
    legs.push(favourite('2026-10-24', 'LOST', { operatorOdds: null }));
    const { service } = harness({ legs });
    const [fav] = (
      await service.getResults({ period: '90', isAdmin: false }, NOW)
    ).products;
    // 10 priced days: 8 won at 1,25 → 10 000 F back for 10 000 F staked.
    expect(fav?.francs).toEqual({
      days: 10,
      staked: 10000,
      returned: 10000,
      unpricedDays: 2,
      from: '2026-10-13',
      to: '2026-10-22',
    });
  });

  it('a partial gain pays the won legs only, the refunded one at 1', async () => {
    const day = '2026-10-13';
    const combo = (overrides: Partial<ProductLegRow>) =>
      favourite(day, 'PARTIAL', {
        couponId: 'combo',
        source: 'ENGINE',
        targetOddsMin: d(1.2),
        ...overrides,
      });
    const legs = [
      combo({ operatorOdds: d('1.200'), isCorrect: true }),
      combo({ operatorOdds: d('1.300'), isCorrect: null }),
      combo({ operatorOdds: d('1.100'), isCorrect: true }),
      ...favouriteRun([W, W, W, W, W, W, W, W, W, W]).map((l) => ({
        ...l,
        couponId: `c-${l.couponId}`,
        source: 'ENGINE',
        targetOddsMin: d(1.2),
        forDate: new Date(l.forDate.getTime() + 86_400_000),
      })),
    ];
    const { service } = harness({ legs });
    const detail = await service.getProduct(
      { product: 'COMBO', period: '90', isAdmin: false },
      NOW,
    );
    const first = detail.days.at(-1);
    expect(first).toMatchObject({
      date: '2026-10-13',
      outcome: 'won',
      label: '3 matchs',
      market: null,
      // 1,20 × 1,10, the refunded leg paying 1.
      paidOdds: 1.32,
    });
  });
});

describe('ResultsService.getProduct', () => {
  it('a grid cell per day of the period and the days with their reasons', async () => {
    const { service } = harness({
      legs: [favourite('2026-10-28', 'WON'), favourite('2026-10-30', null)],
      abstentions: [
        {
          date: '2026-10-29',
          product: 'FAVOURITE',
          reason: 'no_home_favourite_in_band',
        },
      ],
    });
    const detail = await service.getProduct(
      { product: 'FAVOURITE', period: '30', isAdmin: false },
      NOW,
    );
    expect(detail.grid.slice(-4)).toEqual([
      { date: '2026-10-27', outcome: 'none' },
      { date: '2026-10-28', outcome: 'won' },
      { date: '2026-10-29', outcome: 'none' },
      { date: '2026-10-30', outcome: 'pending' },
    ]);
    expect(detail.days.slice(0, 3)).toEqual([
      expect.objectContaining({ date: '2026-10-30', outcome: 'pending' }),
      {
        date: '2026-10-29',
        outcome: 'none',
        reason: 'no_home_favourite_in_band',
      },
      expect.objectContaining({
        date: '2026-10-28',
        outcome: 'won',
        label: 'PSG – Lens',
        paidOdds: 1.25,
      }),
    ]);
  });

  it('a retired product is the admin’s only; an unknown one is a 404', async () => {
    const { service } = harness({});
    await expect(
      service.getProduct(
        { product: 'LONG', period: '90', isAdmin: false },
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getProduct({ product: 'LONG', period: '90', isAdmin: true }, NOW),
    ).resolves.toMatchObject({ product: 'LONG', retired: true });
    await expect(
      service.getProduct({ product: 'NOPE', period: '90', isAdmin: true }, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ResultsService — Avis IA', () => {
  const advice = (result: AiAdviceRow['result'], i: number): AiAdviceRow => ({
    kickoff: new Date(Date.UTC(2026, 9, 29 - i, 19)),
    homeName: 'PSG',
    awayName: 'Lens',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    odds: d('1.500'),
    probability: d('0.6500'),
    result,
    configVersion: 'v5',
  });

  it('counts per opinion; a void one is refunded; at its own odds', async () => {
    const rows = [
      'WON',
      'WON',
      'LOST',
      'VOID',
      'WON',
      'WON',
      'WON',
      'LOST',
      'WON',
      'WON',
      'WON',
    ].map((r, i) => advice(r as AiAdviceRow['result'], i));
    const { service } = harness({ advice: rows });
    const { ai } = await service.getResults(
      { period: '90', isAdmin: false },
      NOW,
    );
    expect(ai).toMatchObject({ won: 8, lost: 2, refunded: 1, tooEarly: false });
    expect(ai.comparison).toEqual({ days: 10, announced: 0.65, realised: 0.8 });
    // 8 won at 1,50 on 10 staked.
    expect(ai.francs).toMatchObject({
      days: 10,
      staked: 10000,
      returned: 12000,
    });
  });
});
