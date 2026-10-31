import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { ME_SETTLED_PAGE_SIZE } from '@config/screens.constants';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { SupportRepository } from '@modules/support/support.repository';
import type { AuthSessionUser } from '@modules/auth/auth.types';
import type { MeFollowedRow, MeRepository } from './me.repository';
import type { TodayLegRow, TodayRepository } from './today.repository';
import { MeService, decodeCursor, encodeCursor } from './me.service';

const NOW = new Date('2026-10-30T15:00:00.000Z');
const d = (value: number | string) => new Prisma.Decimal(value);

/** One leg per coupon: a Favori (1.10) of day `n` of October. */
function leg(
  couponId: string,
  dayOfMonth: number,
  settled: boolean,
): TodayLegRow {
  const date = `2026-10-${String(dayOfMonth).padStart(2, '0')}`;
  return {
    couponId,
    forDate: new Date(`${date}T00:00:00.000Z`),
    targetOddsMin: d(1.1),
    combinedOdds: d('1.280'),
    realizedOdds: settled ? d('1.250') : null,
    probability: d('0.8100'),
    oddsSnapshot: d('1.280'),
    operatorFairProbability: d('0.7700'),
    result: settled ? 'WON' : null,
    followedByMe: true,
    legId: `leg-${couponId}`,
    market: 'ONE_X_TWO',
    pick: 'HOME',
    line: null,
    operatorOdds: d('1.250'),
    fact: null,
    isCorrect: settled ? true : null,
    settledAt: settled ? new Date(`${date}T21:00:00.000Z`) : null,
    fixtureId: `fx-${couponId}`,
    scheduledAt: new Date(`${date}T19:00:00.000Z`),
    fixtureStatus: settled ? 'FINISHED' : 'SCHEDULED',
    homeScore: settled ? 2 : null,
    awayScore: settled ? 0 : null,
    homeName: 'Paris Saint-Germain',
    homeShortName: 'PSG',
    homeLogoUrl: null,
    awayName: 'Lens',
    awayShortName: 'LEN',
    awayLogoUrl: null,
    competitionCode: 'FL1',
    competitionName: 'Ligue 1',
  };
}

const ID = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

function harness(opts: { inProgress: number[]; settled: number[] }) {
  const rows: MeFollowedRow[] = [
    ...opts.inProgress.map((day) => ({
      couponId: ID(day),
      lastKickoffAt: new Date(`2026-10-${day}T19:00:00.000Z`),
      settled: false,
    })),
    ...opts.settled.map((day) => ({
      couponId: ID(day),
      lastKickoffAt: new Date(
        `2026-10-${String(day).padStart(2, '0')}T19:00:00.000Z`,
      ),
      settled: true,
    })),
  ];
  const me = {
    findFollowed: vi.fn().mockResolvedValue(rows),
  } as unknown as MeRepository;
  const today = {
    findCouponLegsByIds: vi.fn(({ couponIds }: { couponIds: string[] }) =>
      Promise.resolve(
        couponIds.map((id) => {
          const day = Number(id.slice(-2));
          return leg(id, day, opts.settled.includes(day));
        }),
      ),
    ),
  } as unknown as TodayRepository;
  const support = {
    countUnreadForUser: vi.fn().mockResolvedValue(1),
  } as unknown as SupportRepository;
  const coupons = {
    getFollowedSummary: vi.fn().mockResolvedValue({
      won: 7,
      lost: 4,
      refunded: 1,
      since: '2026-10-13T09:00:00.000Z',
    }),
  } as unknown as CouponService;
  return { service: new MeService(me, today, support, coupons), me, today };
}

const USER = {
  id: 'user-1',
  fullName: 'Kouassi',
  pausedUntil: null,
} as AuthSessionUser;

describe('MeService.getMe', () => {
  it('answers the first level of Moi in one call', async () => {
    const { service } = harness({ inProgress: [31, 30], settled: [29, 28] });
    const screen = await service.getMe(USER, NOW);
    expect(screen.firstName).toBe('Kouassi');
    expect(screen.record).toEqual({
      won: 7,
      lost: 4,
      refunded: 1,
      since: '2026-10-13T09:00:00.000Z',
    });
    // En cours : premier coup d'envoi d'abord ; Réglés : le plus récent d'abord.
    expect(screen.inProgress.map((c) => c.id)).toEqual([ID(30), ID(31)]);
    expect(screen.inProgress[0]?.state).toBe('upcoming');
    expect(screen.settled.coupons.map((c) => c.id)).toEqual([ID(29), ID(28)]);
    expect(screen.settled.coupons[0]?.state).toBe('won');
    expect(screen.settled.nextCursor).toBeNull();
    expect(screen.unreadReplies).toBe(1);
    expect(screen.pausedUntil).toBeNull();
  });

  it('gives a cursor only when a page is full and more remain', async () => {
    const days = Array.from(
      { length: ME_SETTLED_PAGE_SIZE + 1 },
      (_, i) => ME_SETTLED_PAGE_SIZE + 1 - i,
    );
    const { service, today } = harness({ inProgress: [], settled: days });
    const screen = await service.getMe(USER, NOW);
    expect(screen.settled.coupons).toHaveLength(ME_SETTLED_PAGE_SIZE);
    // La ligne de trop dit seulement qu'il en reste : ses jambes ne sont pas lues.
    const ids = vi.mocked(today.findCouponLegsByIds).mock.calls[0]?.[0]
      .couponIds;
    expect(ids).toHaveLength(ME_SETTLED_PAGE_SIZE);
    const last = screen.settled.coupons.at(-1);
    expect(screen.settled.nextCursor).toBe(
      encodeCursor({
        lastKickoffAt: new Date('2026-10-02T19:00:00.000Z'),
        couponId: last?.id ?? '',
      }),
    );
  });

  it('shows the pause only while it runs', async () => {
    const { service } = harness({ inProgress: [], settled: [] });
    const running = await service.getMe(
      { ...USER, pausedUntil: '2026-11-05T00:00:00.000Z' },
      NOW,
    );
    expect(running.pausedUntil).toBe('2026-11-05T00:00:00.000Z');
    const over = await service.getMe(
      { ...USER, pausedUntil: '2026-10-01T00:00:00.000Z' },
      NOW,
    );
    expect(over.pausedUntil).toBeNull();
  });
});

describe('MeService.getSettled', () => {
  it('reads the page after the cursor, without the coupons in progress', async () => {
    const { service, me } = harness({ inProgress: [], settled: [12] });
    const cursor = encodeCursor({
      lastKickoffAt: new Date('2026-10-13T19:00:00.000Z'),
      couponId: ID(13),
    });
    const page = await service.getSettled({
      userId: 'user-1',
      cursor,
      now: NOW,
    });
    expect(me.findFollowed).toHaveBeenCalledWith(
      expect.objectContaining({
        withInProgress: false,
        after: decodeCursor(cursor),
      }),
    );
    expect(page.coupons.map((c) => c.id)).toEqual([ID(12)]);
  });

  it('refuses a cursor it did not write', () => {
    expect(() => decodeCursor('2026-10-13|abc')).toThrow(BadRequestException);
  });
});
