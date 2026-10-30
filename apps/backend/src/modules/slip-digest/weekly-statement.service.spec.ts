import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import type { NotificationService } from '@modules/notification/notification.service';
import type { MailService } from '@modules/mail/mail.service';
import type { PushService } from '@modules/push/push.service';
import type {
  ProductWeek,
  ProductWeekService,
} from '@modules/coupon/product-day/product-week.service';
import type {
  DigestFollow,
  SlipDigestRepository,
} from './slip-digest.repository';
import {
  WeeklyStatementService,
  previousIsoWeek,
} from './weekly-statement.service';

// Lundi 2026-10-26, 08:00 UTC : la semaine relevée va du 19 au 25.
const NOW = new Date('2026-10-26T08:00:00.000Z');
const WEEK = '2026-10-19';

function follow(userId: string, result: 'WON' | 'LOST'): DigestFollow {
  return {
    user: { id: userId, pausedUntil: null },
    couponProposal: {
      id: `coupon-${result}`,
      result,
      targetOddsMin: new Decimal(1.2),
    },
  };
}

function makeHarness(opts: {
  follows?: DigestFollow[];
  recipients?: {
    id: string;
    pausedUntil?: Date | null;
    emailVerified?: boolean;
    emailNotificationsEnabled?: boolean;
  }[];
  products?: ProductWeek['products'];
  alreadySent?: boolean;
}) {
  const repository = {
    findWeeklyRecipients: vi.fn().mockResolvedValue(
      (opts.recipients ?? [{ id: 'u1' }]).map((r) => ({
        id: r.id,
        pausedUntil: r.pausedUntil ?? null,
        email: `${r.id}@example.com`,
        emailVerified: r.emailVerified ?? false,
        emailNotificationsEnabled: r.emailNotificationsEnabled ?? true,
      })),
    ),
    findSettledFollows: vi.fn().mockResolvedValue(opts.follows ?? []),
    findNotifiedUserIds: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Set(opts.alreadySent ? ['u1'] : [])),
      ),
  } as unknown as SlipDigestRepository;
  const coupons = {
    getWeek: vi.fn().mockResolvedValue({
      week: WEEK,
      days: [],
      products: opts.products ?? [],
    }),
  } as unknown as ProductWeekService;
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
    service: new WeeklyStatementService(
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

describe('WeeklyStatementService.sendStatements', () => {
  it('reads the previous ISO week, whatever the day it runs', () => {
    expect(previousIsoWeek(NOW)).toBe(WEEK);
    expect(previousIsoWeek(new Date('2026-11-01T23:00:00Z'))).toBe(WEEK);
  });

  it('closes the week and reads our products from the shared week', async () => {
    const { service, notification, push, coupons } = makeHarness({
      follows: [follow('u1', 'WON'), follow('u1', 'LOST')],
      products: [
        { product: 'FAVOURITE', won: 5, played: 7 },
        { product: 'COMBO', won: 4, played: 6 },
      ],
    });
    const result = await service.sendStatements(WEEK, NOW);
    expect(result).toEqual({ sent: 1, skippedPaused: 0 });
    expect(coupons.getWeek).toHaveBeenCalledWith(WEEK);
    const [input] = vi.mocked(notification.notifyUser).mock.calls[0] ?? [];
    expect(input).toMatchObject({
      userId: 'u1',
      type: NotificationType.WEEKLY_STATEMENT,
      title: 'Ta semaine EVCore',
      payload: { week: WEEK },
    });
    expect(input?.body).toBe(
      'Coupons suivis : 1 gagné sur 2. Nos coupons : Favori 5 jours gagnés sur 7 · Combiné 4 jours gagnés sur 6.',
    );
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ url: '/dashboard?from=weekly' }),
    );
  });

  it('emails the statement to a verified address that asked for it', async () => {
    const { service, mail } = makeHarness({
      follows: [follow('u1', 'LOST')],
      recipients: [{ id: 'u1', emailVerified: true }],
    });
    await service.sendStatements(WEEK, NOW);
    expect(mail.sendPlayerDigest).toHaveBeenCalledWith(
      'u1@example.com',
      expect.objectContaining({
        title: expect.any(String),
        path: '/dashboard?from=weekly',
      }),
    );
  });

  it('tells only our products to a player who followed nothing', async () => {
    const { service, notification } = makeHarness({
      products: [{ product: 'FAVOURITE', won: 5, played: 7 }],
    });
    await service.sendStatements(WEEK, NOW);
    const [input] = vi.mocked(notification.notifyUser).mock.calls[0] ?? [];
    expect(input?.body).toBe('Nos coupons : Favori 5 jours gagnés sur 7.');
  });

  it('skips a paused player, a repeated run and an empty week', async () => {
    const products = [{ product: 'FAVOURITE', won: 5, played: 7 }];
    const paused = makeHarness({
      products,
      recipients: [{ id: 'u1', pausedUntil: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(await paused.service.sendStatements(WEEK, NOW)).toEqual({
      sent: 0,
      skippedPaused: 1,
    });

    const again = makeHarness({ products, alreadySent: true });
    await again.service.sendStatements(WEEK, NOW);
    expect(again.notification.notifyUser).not.toHaveBeenCalled();

    const empty = makeHarness({});
    await empty.service.sendStatements(WEEK, NOW);
    expect(empty.notification.notifyUser).not.toHaveBeenCalled();
  });
});
