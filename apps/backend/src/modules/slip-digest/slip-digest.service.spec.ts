import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import type { NotificationService } from '@modules/notification/notification.service';
import type { PushService } from '@modules/push/push.service';
import { SlipDigestService, previousUtcDay } from './slip-digest.service';
import type { SlipDigestRepository } from './slip-digest.repository';

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

function makeHarness(
  slips: ReturnType<typeof slip>[],
  opts: { alreadySent?: boolean; reported?: string[] } = {},
) {
  const repository = {
    findSlipsTouching: vi.fn().mockResolvedValue(slips),
    findReportedSlipIds: vi
      .fn()
      .mockResolvedValue(new Set(opts.reported ?? [])),
    hasDigest: vi.fn().mockResolvedValue(opts.alreadySent ?? false),
  } as unknown as SlipDigestRepository;
  const notification = {
    notifyUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const push = {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushService;
  return {
    service: new SlipDigestService(repository, notification, push),
    notification,
    push,
  };
}

describe('SlipDigestService.sendDigests', () => {
  it('reads yesterday in UTC', () => {
    expect(previousUtcDay(NOW)).toBe(DAY);
  });

  it('notifies once per player, in-app and push, linking to Mes coupons', async () => {
    const { service, notification, push } = makeHarness([
      slip({ userId: 'u1', kickoffs: ['2026-10-27T19:00:00Z'] }),
      slip({ userId: 'u1', kickoffs: ['2026-10-27T21:00:00Z'], status: 'WON' }),
    ]);
    const result = await service.sendDigests(DAY, NOW);
    expect(result.sent).toBe(1);
    expect(notification.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: NotificationType.SLIPS_SETTLED_DIGEST,
        payload: expect.objectContaining({ day: DAY, settled: 2 }),
      }),
    );
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ url: '/dashboard/bet-slips' }),
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
});
