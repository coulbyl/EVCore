import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@evcore/db';
import type { CouponRepository } from '@modules/coupon/coupon.repository';
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
    jointProbability: d('0.8100'),
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
  attempts?: { pass: string; outcome: string; reason: string | null }[];
}) {
  const repository = {
    findCouponLegs: vi.fn().mockResolvedValue(input.legs ?? []),
    findProductDays: vi.fn().mockResolvedValue(input.days ?? []),
  } as unknown as TodayRepository;
  const coupons = {
    findLatestAttempts: vi.fn().mockResolvedValue(input.attempts ?? []),
  } as unknown as CouponRepository;
  return {
    service: new TodayService(repository, coupons),
    repository,
    coupons,
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
    expect(coupons.findLatestAttempts).toHaveBeenCalledWith(TODAY);
  });

  it('groups legs into coupons, in screen order, priced at 1xBet', async () => {
    const { service } = harness({
      legs: [
        // The Combiné comes first in the rows (earlier kick-off)…
        leg({
          couponId: 'combo',
          targetOddsMin: d(1.2),
          combinedOdds: d('1.450'),
          jointProbability: d('0.6200'),
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
      probability: 0.81,
      firstKickoffAt: '2026-10-30T19:00:00.000Z',
    });
    // 1,18 × 1,21 = 1,4278, in decimal.js: never 1,4277999…
    expect(combo).toMatchObject({
      state: 'live',
      canFollow: false,
      odds: 1.428,
      firstKickoffAt: '2026-10-30T13:00:00.000Z',
    });
    expect(combo?.legs.map((l) => l.state)).toEqual(['live', 'upcoming']);
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

  it('says which products abstained and why, never one that has a coupon', async () => {
    const { service } = harness({
      legs: [leg({ couponId: 'combo', targetOddsMin: d(1.2) })],
      attempts: [
        {
          pass: 'favourite',
          outcome: 'abstained',
          reason: 'no_home_favourite_in_band',
        },
        {
          pass: 'engine-combo',
          outcome: 'abstained',
          reason: 'not_enough_calibrated_short_legs',
        },
        { pass: 'double', outcome: 'composed', reason: null },
        // The long coupon and the LLM passes are not products of the screen.
        { pass: 'engine-long', outcome: 'abstained', reason: 'x' },
        { pass: 'EVENING', outcome: 'ABSTAINED', reason: 'y' },
      ],
    });
    const { absences } = await service.getToday('user-1', NOW);
    expect(absences).toEqual([
      { product: 'FAVOURITE', reason: 'no_home_favourite_in_band' },
    ]);
  });
});
