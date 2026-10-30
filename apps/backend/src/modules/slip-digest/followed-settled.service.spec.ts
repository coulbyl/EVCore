import { describe, expect, it, vi } from 'vitest';
import { NotificationType, Prisma } from '@evcore/db';
import type { NotificationService } from '@modules/notification/notification.service';
import type { PushService } from '@modules/push/push.service';
import type {
  FollowedSettledRepository,
  FollowedSettledRow,
} from './followed-settled.repository';
import { FollowedSettledService, eveningOf } from './followed-settled.service';

const EVENING = new Date('2026-10-30T21:10:00.000Z');

function row(overrides: Partial<FollowedSettledRow>): FollowedSettledRow {
  return {
    userId: 'u1',
    pausedUntil: null,
    couponId: 'fav',
    targetOddsMin: new Prisma.Decimal(1.1),
    source: 'PRICE_COMPOSER',
    result: 'WON',
    home: 'PSG',
    away: 'Lens',
    homeScore: 2,
    awayScore: 0,
    scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
    isCorrect: true,
    operatorOdds: new Prisma.Decimal('1.24'),
    ...overrides,
  };
}

function harness(input: {
  rows?: FollowedSettledRow[];
  announced?: string[];
  recorded?: boolean;
}) {
  const repository = {
    findSettledSince: vi.fn().mockResolvedValue(input.rows ?? []),
    findAnnounced: vi.fn().mockResolvedValue(new Set(input.announced ?? [])),
  } as unknown as FollowedSettledRepository;
  const notification = {
    notifyUser: vi.fn().mockResolvedValue(input.recorded ?? true),
  } as unknown as NotificationService;
  const push = {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushService;
  return {
    service: new FollowedSettledService(repository, notification, push),
    repository,
    notification,
    push,
  };
}

describe('eveningOf', () => {
  it('is open from 20:00 to 01:00 UTC, dated by the day it started', () => {
    expect(eveningOf(new Date('2026-10-30T19:59:00.000Z'))).toBeNull();
    expect(eveningOf(new Date('2026-10-30T20:00:00.000Z'))).toEqual(
      new Date('2026-10-30T00:00:00.000Z'),
    );
    expect(eveningOf(new Date('2026-10-31T00:50:00.000Z'))).toEqual(
      new Date('2026-10-30T00:00:00.000Z'),
    );
    expect(eveningOf(new Date('2026-10-31T01:00:00.000Z'))).toBeNull();
    expect(eveningOf(new Date('2026-10-31T08:00:00.000Z'))).toBeNull();
  });
});

describe('FollowedSettledService.notifyEvening', () => {
  it('sends nothing, and reads nothing, outside the evening', async () => {
    const { service, repository } = harness({ rows: [row({})] });
    expect(
      await service.notifyEvening(new Date('2026-10-30T15:00:00.000Z')),
    ).toEqual({ sent: 0, skippedPaused: 0 });
    expect(repository.findSettledSince).not.toHaveBeenCalled();
  });

  it('announces each followed coupon settled since the evening day began', async () => {
    const { service, repository, notification, push } = harness({
      rows: [
        row({}),
        row({
          userId: 'u2',
          couponId: 'combo',
          targetOddsMin: new Prisma.Decimal(1.2),
          source: 'ENGINE',
          result: 'LOST',
          isCorrect: false,
          home: 'Lazio',
          away: 'Torino',
          homeScore: 1,
          awayScore: 0,
        }),
        row({
          userId: 'u2',
          couponId: 'combo',
          targetOddsMin: new Prisma.Decimal(1.2),
          source: 'ENGINE',
          result: 'LOST',
          scheduledAt: new Date('2026-10-30T21:00:00.000Z'),
        }),
      ],
    });
    expect(await service.notifyEvening(EVENING)).toEqual({
      sent: 2,
      skippedPaused: 0,
    });
    expect(repository.findSettledSince).toHaveBeenCalledWith({
      since: new Date('2026-10-30T00:00:00.000Z'),
      forDateFrom: new Date('2026-10-28T00:00:00.000Z'),
    });
    expect(notification.notifyUser).toHaveBeenCalledWith({
      userId: 'u2',
      type: NotificationType.FOLLOWED_SETTLED,
      title: 'Ton Combiné a perdu ✗',
      body: 'cassé sur Lazio – Torino 1-0',
      payload: { couponProposalId: 'combo', evening: '2026-10-30' },
    });
    expect(push.sendToUser).toHaveBeenCalledWith('u1', {
      title: 'Ton Favori est passé ✓',
      body: 'PSG – Lens 2-0 · 1,24',
      url: '/me?coupon=fav',
    });
  });

  it('a second run sends nothing already announced', async () => {
    const { service, notification, repository } = harness({
      rows: [row({})],
      announced: ['u1:fav'],
    });
    expect((await service.notifyEvening(EVENING)).sent).toBe(0);
    expect(notification.notifyUser).not.toHaveBeenCalled();
    // A coupon announced yesterday evening and corrected today is not sent
    // again either.
    expect(repository.findAnnounced).toHaveBeenCalledWith({
      userIds: ['u1'],
      since: new Date('2026-10-29T00:00:00.000Z'),
    });
  });

  it('never during a pause', async () => {
    const { service, notification } = harness({
      rows: [row({ pausedUntil: new Date('2026-11-06T00:00:00.000Z') })],
    });
    expect(await service.notifyEvening(EVENING)).toEqual({
      sent: 0,
      skippedPaused: 1,
    });
    expect(notification.notifyUser).not.toHaveBeenCalled();
  });

  it('no record written, no push: the next run tries again', async () => {
    const { service, push } = harness({ rows: [row({})], recorded: false });
    expect((await service.notifyEvening(EVENING)).sent).toBe(0);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
