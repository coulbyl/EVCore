import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import type { NotificationService } from '@modules/notification/notification.service';
import type { MailService } from '@modules/mail/mail.service';
import type { PushService } from '@modules/push/push.service';
import { SlipDigestService, previousUtcDay } from './slip-digest.service';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { DayCoupon, SlipDigestRepository } from './slip-digest.repository';

const NOW = new Date('2026-10-28T08:00:00.000Z');
const DAY = '2026-10-27';

let slipSeq = 0;

function slip(opts: {
  userId: string;
  kickoffs: string[];
  status?: 'WON' | 'LOST' | 'PENDING';
  pausedUntil?: Date | null;
  id?: string;
}) {
  slipSeq += 1;
  return {
    id: opts.id ?? `slip-${slipSeq}`,
    type: 'SIMPLE' as const,
    unitStake: new Decimal(1000),
    user: {
      id: opts.userId,
      currency: 'XOF',
      pausedUntil: opts.pausedUntil ?? null,
    },
    items: opts.kickoffs.map((at) => ({
      stakeOverride: null,
      fixture: { scheduledAt: new Date(at) },
      bet: { status: opts.status ?? 'LOST', oddsSnapshot: new Decimal('1.5') },
    })),
  };
}

type Follow = {
  user: { id: string; currency: string; pausedUntil: Date | null };
  couponProposal: {
    id: string;
    result: 'WON' | 'LOST';
    targetOddsMin: Decimal;
  };
};

function follow(
  userId: string,
  couponId: string,
  result: 'WON' | 'LOST',
): Follow {
  return {
    user: { id: userId, currency: 'XOF', pausedUntil: null },
    // targetOddsMin 2 : la classe « Coupon cote 2 ».
    couponProposal: { id: couponId, result, targetOddsMin: new Decimal(2) },
  };
}

function makeHarness(
  slips: ReturnType<typeof slip>[],
  opts: {
    alreadySent?: boolean;
    reported?: string[];
    follows?: Follow[];
    reportedFollows?: string[];
    /** Joueurs ayant gardé la matinée ; par défaut ceux des coupons. */
    recipients?: {
      id: string;
      pausedUntil?: Date | null;
      emailVerified?: boolean;
      emailNotificationsEnabled?: boolean;
    }[];
    coupons?: DayCoupon[];
    abstentions?: { couponClass: string; reason: string | null }[];
  } = {},
) {
  const recipients: NonNullable<typeof opts.recipients> = opts.recipients ?? [
    ...new Map(
      [
        ...slips.map((s) => s.user),
        ...(opts.follows ?? []).map((f) => f.user),
      ].map((u) => [u.id, u]),
    ).values(),
  ];
  const repository = {
    findSlipsTouching: vi.fn().mockResolvedValue(slips),
    findSettledFollows: vi.fn().mockResolvedValue(opts.follows ?? []),
    findReported: vi.fn().mockResolvedValue({
      slipIds: new Set(opts.reported ?? []),
      followedIds: new Set(opts.reportedFollows ?? []),
    }),
    findNotifiedUserIds: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Set(opts.alreadySent ? ['u1'] : [])),
      ),
    findMorningRecipients: vi.fn().mockResolvedValue(
      recipients.map((r) => ({
        id: r.id,
        currency: 'XOF',
        pausedUntil: r.pausedUntil ?? null,
        email: `${r.id}@example.com`,
        emailVerified: r.emailVerified ?? false,
        emailNotificationsEnabled: r.emailNotificationsEnabled ?? true,
      })),
    ),
    findDayCoupons: vi.fn().mockResolvedValue(opts.coupons ?? []),
  } as unknown as SlipDigestRepository;
  const coupons = {
    getAbstentions: vi.fn().mockResolvedValue(opts.abstentions ?? []),
  } as unknown as CouponService;
  const notification = {
    notifyUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const push = {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushService;
  const mail = {
    sendPlayerDigest: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;
  return {
    service: new SlipDigestService(
      repository,
      notification,
      push,
      mail,
      coupons,
    ),
    mail,
    repository,
    coupons,
    notification,
    push,
  };
}

describe('SlipDigestService.sendDigests', () => {
  it('reads yesterday in UTC', () => {
    expect(previousUtcDay(NOW)).toBe(DAY);
  });

  it('notifies once per player, in-app and push, linking to the home page', async () => {
    const { service, notification, push } = makeHarness([
      slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'] }),
      slip({ userId: 'u1', kickoffs: ['2026-10-27T21:00:00Z'], status: 'WON' }),
    ]);
    const result = await service.sendDigests(DAY, NOW);
    expect(result.sent).toBe(1);
    expect(notification.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: NotificationType.MORNING_BRIEF,
        payload: expect.objectContaining({ day: DAY, settled: 2 }),
      }),
    );
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ url: '/dashboard?from=morning' }),
    );
  });

  it('sends the email copy only to a verified address that asked for it', async () => {
    const { service, mail } = makeHarness(
      [
        slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'] }),
        slip({ userId: 'u2', kickoffs: ['2026-10-27T19:00:00Z'] }),
        slip({ userId: 'u3', kickoffs: ['2026-10-27T19:00:00Z'] }),
      ],
      {
        recipients: [
          { id: 'u1', emailVerified: true },
          { id: 'u2', emailVerified: false },
          { id: 'u3', emailVerified: true, emailNotificationsEnabled: false },
        ],
      },
    );
    await service.sendDigests(DAY, NOW);
    expect(mail.sendPlayerDigest).toHaveBeenCalledTimes(1);
    expect(mail.sendPlayerDigest).toHaveBeenCalledWith(
      'u1@example.com',
      expect.objectContaining({ path: '/dashboard?from=morning' }),
    );
  });

  it('skips a paused player entirely', async () => {
    const { service, notification, push } = makeHarness([
      slip({
        userId: 'u1',
        kickoffs: ['2026-10-27T19:00:00Z'],
        pausedUntil: new Date('2026-11-01T00:00:00Z'),
      }),
    ]);
    const result = await service.sendDigests(DAY, NOW);
    expect(result).toEqual({ sent: 0, skippedPaused: 1 });
    expect(notification.notifyUser).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('leaves a coupon whose last leg is today for tomorrow', async () => {
    const { service, notification } = makeHarness([
      slip({
        userId: 'u1',
        kickoffs: ['2026-10-27T19:00:00Z', '2026-10-28T19:00:00Z'],
      }),
    ]);
    await service.sendDigests(DAY, NOW);
    expect(notification.notifyUser).not.toHaveBeenCalled();
  });

  it('never sends the same day twice', async () => {
    const { service, notification } = makeHarness(
      [slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'] })],
      { alreadySent: true },
    );
    await service.sendDigests(DAY, NOW);
    expect(notification.notifyUser).not.toHaveBeenCalled();
  });

  it('announces a coupon settled late, once, and records it', async () => {
    const late = slip({
      userId: 'u1',
      kickoffs: ['2026-10-25T23:30:00Z'],
      status: 'WON',
      id: 'late',
    });
    const { service, notification } = makeHarness([late]);
    await service.sendDigests(DAY, NOW);
    expect(notification.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ settled: 1, slipIds: ['late'] }),
      }),
    );

    const again = makeHarness([late], { reported: ['late'] });
    await again.service.sendDigests(DAY, NOW);
    expect(again.notification.notifyUser).not.toHaveBeenCalled();
  });

  it("counts only the day's own coupons as still pending", async () => {
    const { service, notification } = makeHarness([
      slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'], status: 'WON' }),
      slip({
        userId: 'u1',
        kickoffs: ['2026-10-25T19:00:00Z'],
        status: 'PENDING',
      }),
    ]);
    await service.sendDigests(DAY, NOW);
    const [input] = vi.mocked(notification.notifyUser).mock.calls[0] ?? [];
    expect(input?.body).not.toContain('en attente');
  });

  it('announces a followed coupon once, without any amount', async () => {
    const followed = follow('u2', 'coupon-9', 'WON');
    const { service, notification } = makeHarness([], { follows: [followed] });
    await service.sendDigests(DAY, NOW);
    expect(notification.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u2',
        body: 'Coupon suivi : Coupon cote 2 gagné.',
        payload: expect.objectContaining({ followedIds: ['coupon-9'] }),
      }),
    );

    const again = makeHarness([], {
      follows: [followed],
      reportedFollows: ['coupon-9'],
    });
    await again.service.sendDigests(DAY, NOW);
    expect(again.notification.notifyUser).not.toHaveBeenCalled();
  });

  it("brings the day's coupons to a player without results, 1xBet odds first", async () => {
    const coupon = (
      source: DayCoupon['source'],
      [targetOddsMin, combinedOdds]: [number, number],
      legs: (number | null)[],
    ): DayCoupon => ({
      source,
      targetOddsMin: new Decimal(targetOddsMin),
      combinedOdds: new Decimal(combinedOdds),
      legs: legs.map((o) => ({
        operatorOdds: o === null ? null : new Decimal(o),
      })),
    });
    const { service, notification, coupons } = makeHarness([], {
      recipients: [{ id: 'u3' }],
      coupons: [
        // L'IA pour la même classe : le générateur déterministe passe devant.
        coupon('LLM', [2, 2.4], [1.5, 1.6]),
        coupon('PRICE_COMPOSER', [2, 2.2], [1.4, 1.5]),
        coupon('PRICE_COMPOSER', [1.1, 1.3], [null]),
      ],
      abstentions: [
        { couponClass: 'HUNTER_DRAW', reason: 'no_candidate_in_band' },
      ],
    });
    const result = await service.sendDigests(DAY, NOW);
    expect(result.sent).toBe(1);
    expect(coupons.getAbstentions).toHaveBeenCalledWith('2026-10-28');
    const [input] = vi.mocked(notification.notifyUser).mock.calls[0] ?? [];
    expect(input?.title).toBe('Ta matinée EVCore');
    expect(input?.body).toContain('Favori 1,30 · Coupon cote 2 2,10');
    expect(input?.body).toContain("Pas de Chasseur Nul aujourd'hui");
  });

  it('stays silent for a player with nothing to read', async () => {
    const { service, notification } = makeHarness([], {
      recipients: [{ id: 'u3' }],
    });
    expect(await service.sendDigests(DAY, NOW)).toEqual({
      sent: 0,
      skippedPaused: 0,
    });
    expect(notification.notifyUser).not.toHaveBeenCalled();
  });

  it('respects a player who switched the morning off', async () => {
    const { service, notification } = makeHarness(
      [slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'] })],
      { recipients: [] },
    );
    await service.sendDigests(DAY, NOW);
    expect(notification.notifyUser).not.toHaveBeenCalled();
  });
});
