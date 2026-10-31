import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@evcore/db';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { ProductWeekService } from '@modules/coupon/product-day/product-week.service';
import type {
  TodayFormRow,
  TodayLegRow,
  TodayRepository,
} from './today.repository';
import { TodayService } from './today.service';

const NOW = new Date('2026-10-30T15:00:00.000Z');
const TODAY = new Date('2026-10-30T00:00:00.000Z');

const d = (value: number | string) => new Prisma.Decimal(value);

function leg(overrides: Partial<TodayLegRow>): TodayLegRow {
  return {
    couponId: 'fav',
    forDate: TODAY,
    targetOddsMin: d(1.1),
    combinedOdds: d('1.280'),
    realizedOdds: null,
    probability: d('0.8100'),
    oddsSnapshot: d('1.280'),
    operatorFairProbability: d('0.7700'),
    result: null,
    followedByMe: false,
    legId: 'leg-1',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    line: null,
    operatorOdds: d('1.250'),
    fact: 'PSG a gagné ses 9 derniers matchs à domicile',
    isCorrect: null,
    settledAt: null,
    fixtureId: 'fx-1',
    scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
    fixtureStatus: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    homeName: 'Paris Saint-Germain',
    homeShortName: 'PSG',
    homeLogoUrl: null,
    awayName: 'Lens',
    awayShortName: 'LEN',
    awayLogoUrl: null,
    competitionCode: 'FL1',
    competitionName: 'Ligue 1',
    ...overrides,
  };
}

function day(
  date: string,
  targetOddsMin: number,
  overrides: Partial<TodayFormRow> = {},
): TodayFormRow {
  return {
    forDate: new Date(`${date}T00:00:00.000Z`),
    targetOddsMin: d(targetOddsMin),
    result: 'WON',
    followedByMe: false,
    ...overrides,
  };
}

function harness(input: {
  legs?: TodayLegRow[];
  days?: TodayFormRow[];
  abstentions?: { date: string; product: string; reason: string | null }[];
}) {
  const repository = {
    findCouponLegs: vi.fn().mockResolvedValue(input.legs ?? []),
    findProductDays: vi.fn().mockResolvedValue(input.days ?? []),
    findPublishedCouponLegs: vi.fn().mockResolvedValue(input.legs ?? []),
  } as unknown as TodayRepository;
  const coupons = {
    getProductAbstentions: vi.fn().mockResolvedValue(input.abstentions ?? []),
  } as unknown as CouponService;
  const productWeek = {
    getWeek: vi.fn().mockResolvedValue({
      week: '2026-10-26',
      days: [],
      products: [
        { product: 'FAVOURITE', won: 5, played: 6 },
        { product: 'COMBO', won: 4, played: 6 },
      ],
    }),
  } as unknown as ProductWeekService;
  return {
    service: new TodayService(repository, coupons, productWeek),
    repository,
    coupons,
    productWeek,
  };
}

describe('TodayService', () => {
  it('reads today, the followed lookback and the 30-day window', async () => {
    const { service, repository, coupons } = harness({});
    const screen = await service.getToday('user-1', NOW);
    expect(screen.date).toBe('2026-10-30');
    expect(repository.findCouponLegs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        today: TODAY,
        followedSince: new Date('2026-10-28T00:00:00.000Z'),
      }),
    );
    expect(repository.findProductDays).toHaveBeenCalledWith(
      expect.objectContaining({
        since: new Date('2026-09-30T00:00:00.000Z'),
        until: TODAY,
      }),
    );
    expect(coupons.getProductAbstentions).toHaveBeenCalledWith({
      from: TODAY,
      to: new Date('2026-10-31T00:00:00.000Z'),
    });
  });

  it('groups legs into coupons, in screen order, priced at 1xBet', async () => {
    const { service } = harness({
      legs: [
        // The Combiné comes first in the rows (earlier kick-off)…
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          combinedOdds: d('1.450'),
          probability: d('0.8000'),
          legId: 'c1',
          fixtureId: 'fx-2',
          operatorOdds: d('1.18'),
          scheduledAt: new Date('2026-10-30T13:00:00.000Z'),
        }),
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          combinedOdds: d('1.450'),
          legId: 'c2',
          fixtureId: 'fx-3',
          operatorOdds: d('1.21'),
          scheduledAt: new Date('2026-10-30T18:00:00.000Z'),
        }),
        leg({}),
      ],
    });
    const screen = await service.getToday('user-1', NOW);
    // …but the Favori leads the screen.
    expect(screen.coupons.map((c) => c.product)).toEqual([
      'FAVOURITE',
      'COMBO',
    ]);
    const [favourite, combo] = screen.coupons;
    expect(favourite).toMatchObject({
      state: 'upcoming',
      canFollow: true,
      odds: 1.25,
      referenceOdds: 1.28,
      // 1,25 at 1xBet: under 1,80, the engine's 0,81, not the market's.
      chance: 0.81,
      firstKickoffAt: '2026-10-30T19:00:00.000Z',
    });
    // 1,18 × 1,21 = 1,4278, in decimal.js: never 1,4277999…
    expect(combo).toMatchObject({
      state: 'live',
      canFollow: false,
      odds: 1.428,
      // 0,80 × 0,81.
      chance: 0.648,
      firstKickoffAt: '2026-10-30T13:00:00.000Z',
    });
    expect(combo?.legs.map((l) => l.state)).toEqual(['live', 'upcoming']);
  });

  it("says what 1xBet keeps, and a hunter's odds band", async () => {
    const { service } = harness({
      legs: [
        // 1,25 × 0,77 = 0,9625 : 1xBet garde 3,75 %.
        leg({}),
        leg({
          couponId: 'draw',
          targetOddsMin: d(2.9),
          legId: 'h1',
          fixtureId: 'fx-9',
          operatorOdds: d('3.20'),
          operatorFairProbability: null,
        }),
      ],
    });
    const [favourite, draw] = (await service.getToday('user-1', NOW)).coupons;
    expect(favourite).toMatchObject({ operatorKeep: 0.0375, oddsBand: null });
    // Unknown without the market's frequency, never 0.
    expect(draw).toMatchObject({
      operatorKeep: null,
      oddsBand: { min: 2.9, max: 3.6 },
    });
  });

  it("above 1,80 a leg's chance is the market's, never the engine's", async () => {
    const draw = {
      couponId: 'draw',
      targetOddsMin: d(2.9),
      operatorOdds: d('3.300'),
      oddsSnapshot: d('3.400'),
      // The engine says 0,34, the market 0,29.
      probability: d('0.3400'),
      operatorFairProbability: d('0.2900'),
    };
    const { service } = harness({ legs: [leg(draw)] });
    const [coupon] = (await service.getToday('user-1', NOW)).coupons;
    expect(coupon?.chance).toBe(0.29);
    expect(coupon?.legs[0]).toMatchObject({
      chance: 0.29,
      marketFrequency: 0.29,
    });
  });

  it('above 1,80 without a market frequency, the chance is unknown', async () => {
    const { service } = harness({
      legs: [
        leg({
          couponId: 'draw',
          targetOddsMin: d(2.9),
          operatorOdds: null,
          oddsSnapshot: d('3.400'),
          probability: d('0.3400'),
          operatorFairProbability: null,
        }),
      ],
    });
    const [coupon] = (await service.getToday('user-1', NOW)).coupons;
    expect(coupon?.chance).toBeNull();
    expect(coupon?.legs[0]?.chance).toBeNull();
  });

  it('a leg without a 1xBet price leaves the coupon price unknown', async () => {
    const { service } = harness({
      legs: [
        leg({ couponId: 'combo', targetOddsMin: d(1.2), legId: 'c1' }),
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          legId: 'c2',
          operatorOdds: null,
        }),
      ],
    });
    const [combo] = (await service.getToday('user-1', NOW)).coupons;
    expect(combo?.odds).toBeNull();
    expect(combo?.referenceOdds).toBe(1.28);
    expect(combo?.legs[1]?.odds).toBeNull();
  });

  it('a partial gain reads won with the odds really paid', async () => {
    const settled = {
      couponId: 'combo',
      targetOddsMin: d(1.2),
      result: 'PARTIAL' as const,
      realizedOdds: d('1.320'),
    };
    const { service } = harness({
      legs: [
        leg({
          ...settled,
          legId: 'c1',
          isCorrect: true,
          settledAt: NOW,
          fixtureStatus: 'FINISHED',
          homeScore: 2,
          awayScore: 0,
          scheduledAt: new Date('2026-10-30T11:00:00.000Z'),
        }),
        leg({
          ...settled,
          legId: 'c2',
          settledAt: NOW,
          fixtureStatus: 'POSTPONED',
          scheduledAt: new Date('2026-10-30T12:00:00.000Z'),
        }),
      ],
    });
    const [combo] = (await service.getToday('user-1', NOW)).coupons;
    expect(combo).toMatchObject({ state: 'won', paidOdds: 1.32 });
    expect(combo?.legs.map((l) => [l.state, l.score])).toEqual([
      ['won', { home: 2, away: 0 }],
      ['void', null],
    ]);
  });

  it('shows the fact under a leg, never an empty one', async () => {
    const { service } = harness({
      legs: [
        leg({ couponId: 'combo', targetOddsMin: d(1.2), legId: 'c1' }),
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          legId: 'c2',
          fact: '',
        }),
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          legId: 'c3',
          fact: null,
        }),
      ],
    });
    const [combo] = (await service.getToday('user-1', NOW)).coupons;
    expect(combo?.legs.map((l) => l.fact)).toEqual([
      'PSG a gagné ses 9 derniers matchs à domicile',
      null,
      null,
    ]);
  });

  it('a match postponed before settlement reads postponed', async () => {
    const { service } = harness({
      legs: [leg({ fixtureStatus: 'POSTPONED' })],
    });
    const [favourite] = (await service.getToday('user-1', NOW)).coupons;
    expect(favourite?.legs[0]?.state).toBe('postponed');
  });

  it('a combo with a postponed match is priced on the matches still played', async () => {
    const combo = (overrides: Parameters<typeof leg>[0]) =>
      leg({
        couponId: 'combo',
        targetOddsMin: d(1.2),
        combinedOdds: d('1.450'),
        probability: d('0.8000'),
        ...overrides,
      });
    const { service } = harness({
      legs: [
        combo({ legId: 'c1', fixtureId: 'fx-2', operatorOdds: d('1.18') }),
        combo({
          legId: 'c2',
          fixtureId: 'fx-3',
          operatorOdds: d('1.21'),
          fixtureStatus: 'POSTPONED',
        }),
      ],
    });
    const [coupon] = (await service.getToday('user-1', NOW)).coupons;
    // 1,18 alone, the postponed match paying 1; its chance left out too.
    expect(coupon).toMatchObject({ odds: 1.18, chance: 0.8 });
    expect(coupon?.legs.map((l) => l.state)).toEqual(['upcoming', 'postponed']);
  });

  it('keeps a followed coupon of an earlier day apart while it runs', async () => {
    const { service } = harness({
      legs: [
        leg({
          couponId: 'yesterday-combo',
          forDate: new Date('2026-10-29T00:00:00.000Z'),
          targetOddsMin: d(1.2),
          followedByMe: true,
          scheduledAt: new Date('2026-10-29T22:00:00.000Z'),
        }),
        leg({}),
      ],
    });
    const screen = await service.getToday('user-1', NOW);
    expect(screen.coupons.map((c) => c.id)).toEqual(['fav']);
    expect(screen.followedInProgress).toMatchObject([
      { id: 'yesterday-combo', forDate: '2026-10-29', state: 'live' },
    ]);
  });

  it('ignores a proposal outside the products of the screen', async () => {
    const { service } = harness({
      // 2,5: the long coupon, not a product of « Aujourd'hui ».
      legs: [leg({ couponId: 'long', targetOddsMin: d(2.5) })],
    });
    expect((await service.getToday('user-1', NOW)).coupons).toEqual([]);
  });

  it('writes « Hier »: followed first, unsettled as pending', async () => {
    const { service } = harness({
      days: [
        day('2026-10-29', 1.1, { result: 'WON' }),
        day('2026-10-29', 1.2, { result: 'LOST' }),
        day('2026-10-29', 2, { result: null, followedByMe: true }),
        day('2026-10-28', 2.9, { result: 'WON' }),
      ],
    });
    const screen = await service.getToday('user-1', NOW);
    expect(screen.yesterday).toEqual([
      { product: 'DOUBLE', outcome: 'pending', followedByMe: true },
      { product: 'FAVOURITE', outcome: 'won', followedByMe: false },
      { product: 'COMBO', outcome: 'lost', followedByMe: false },
    ]);
  });

  it('counts each form: refunds are neither, pending days are left out', async () => {
    const { service } = harness({
      days: [
        day('2026-10-20', 1.1, { result: 'LOST' }),
        day('2026-10-21', 1.1, { result: 'VOID' }),
        day('2026-10-22', 1.1, { result: 'LOST' }),
        day('2026-10-23', 1.1, { result: 'PARTIAL' }),
        day('2026-10-24', 1.1, { result: 'LOST' }),
        day('2026-10-29', 1.1, { result: null }),
        day('2026-10-24', 2.9, { result: 'WON' }),
      ],
    });
    const { forms } = await service.getToday('user-1', NOW);
    expect(forms).toEqual([
      {
        product: 'FAVOURITE',
        days: [
          { date: '2026-10-20', outcome: 'lost' },
          { date: '2026-10-21', outcome: 'void' },
          { date: '2026-10-22', outcome: 'lost' },
          { date: '2026-10-23', outcome: 'won' },
          { date: '2026-10-24', outcome: 'lost' },
        ],
        won: 1,
        played: 4,
        // Lost, refunded, lost: the refund does not break the streak.
        worstLosingStreak: 2,
      },
      {
        product: 'HUNTER_DRAW',
        days: [{ date: '2026-10-24', outcome: 'won' }],
        won: 1,
        played: 1,
        worstLosingStreak: 0,
      },
    ]);
  });

  it('lists the abstentions in screen order, products of the screen only', async () => {
    const { service } = harness({
      abstentions: [
        { date: '2026-10-30', product: 'DOUBLE', reason: 'target_unreachable' },
        {
          date: '2026-10-30',
          product: 'FAVOURITE',
          reason: 'no_home_favourite_in_band',
        },
        // Not a product of « Aujourd'hui ».
        { date: '2026-10-30', product: 'LONG', reason: 'x' },
      ],
    });
    const { absences } = await service.getToday('user-1', NOW);
    expect(absences).toEqual([
      { product: 'FAVOURITE', reason: 'no_home_favourite_in_band' },
      { product: 'DOUBLE', reason: 'target_unreachable' },
    ]);
  });

  it('the Favori is the hero; when it abstains the Combiné takes over', async () => {
    const favourite = leg({});
    const combo = leg({ couponId: 'combo', targetOddsMin: d(1.2) });
    const draw = leg({ couponId: 'draw', targetOddsMin: d(2.9) });
    expect(
      (await harness({ legs: [combo, favourite] }).service.getToday('u', NOW))
        .heroId,
    ).toBe('fav');
    expect(
      (await harness({ legs: [draw, combo] }).service.getToday('u', NOW))
        .heroId,
    ).toBe('combo');
    // Then the Coupon cote 2, then the first hunter present.
    expect(
      (await harness({ legs: [draw] }).service.getToday('u', NOW)).heroId,
    ).toBe('draw');
    expect((await harness({}).service.getToday('u', NOW)).heroId).toBeNull();
  });

  it('a followed coupon of yesterday never becomes the hero', async () => {
    const { service } = harness({
      legs: [
        leg({
          couponId: 'yesterday-fav',
          forDate: new Date('2026-10-29T00:00:00.000Z'),
          followedByMe: true,
        }),
        leg({ couponId: 'combo', targetOddsMin: d(1.2) }),
      ],
    });
    expect((await service.getToday('u', NOW)).heroId).toBe('combo');
  });

  it('on Monday, « Ta semaine » comes with the screen; not on other days', async () => {
    const monday = new Date('2026-11-02T08:00:00.000Z');
    const { service, productWeek } = harness({});
    const screen = await service.getToday('u', monday);
    expect(productWeek.getWeek).toHaveBeenCalledWith('2026-10-26');
    expect(screen.week).toEqual({
      week: '2026-10-26',
      products: [
        { product: 'FAVOURITE', won: 5, played: 6 },
        { product: 'COMBO', won: 4, played: 6 },
      ],
    });
    const other = harness({});
    expect((await other.service.getToday('u', NOW)).week).toBeNull();
    expect(other.productWeek.getWeek).not.toHaveBeenCalled();
  });
});

describe('TodayService.couponById', () => {
  it('a published coupon of any day, in the shape of the sheet; otherwise 404', async () => {
    const found = harness({ legs: [leg({})] });
    const coupon = await found.service.couponById(
      { userId: 'u1', couponId: 'cp-1' },
      NOW,
    );
    expect(coupon.legs).toHaveLength(1);
    expect(found.repository.findPublishedCouponLegs).toHaveBeenCalledWith({
      userId: 'u1',
      couponId: 'cp-1',
    });
    const missing = harness({ legs: [] });
    await expect(
      missing.service.couponById({ userId: 'u1', couponId: 'cp-x' }, NOW),
    ).rejects.toThrow('Coupon introuvable');
  });
});
