import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Market, NotificationType, UserRole } from '@evcore/db';
import { NotificationService } from './notification.service';
import type { PrismaService } from '@/prisma.service';
import type { MailService } from '@modules/mail/mail.service';

function makePrisma(): PrismaService {
  return {
    client: {
      notification: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      userNotificationRead: {
        upsert: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  } as unknown as PrismaService;
}

function makeMail(): MailService {
  return {
    sendRoiAlert: vi.fn().mockResolvedValue(undefined),
    sendMarketSuspension: vi.fn().mockResolvedValue(undefined),
    sendBrierAlert: vi.fn().mockResolvedValue(undefined),
    sendEtlFailure: vi.fn().mockResolvedValue(undefined),
    sendWeightAdjustment: vi.fn().mockResolvedValue(undefined),
    sendWeeklyReport: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;
}

describe('NotificationService — persistence', () => {
  it('persists a ROI alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeMail());

    await service.sendRoiAlert(Market.ONE_X_TWO, -0.12, 32);

    expect(prisma.client.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.ROI_ALERT,
        title: expect.stringContaining('ROI Alert'),
        body: expect.stringContaining('-12.00%'),
      }),
    });
  });

  it('persists a Brier Score alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeMail());

    await service.sendBrierScoreAlert('season-123', 0.32);

    expect(prisma.client.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.BRIER_ALERT,
        title: expect.stringContaining('season-123'),
      }),
    });
  });

  it('persists an ETL failure alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeMail());

    await service.sendEtlFailureAlert(
      'fixtures-queue',
      'fixture-sync',
      'timeout',
    );

    expect(prisma.client.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.ETL_FAILURE,
        body: expect.stringContaining('timeout'),
      }),
    });
  });
});

describe('NotificationService — mail delegation', () => {
  let prisma: PrismaService;
  let mail: MailService;
  let service: NotificationService;

  beforeEach(() => {
    prisma = makePrisma();
    mail = makeMail();
    service = new NotificationService(prisma, mail);
  });

  it('delegates to mail.sendRoiAlert with stringified market', async () => {
    await service.sendRoiAlert(Market.ONE_X_TWO, -0.12, 32);

    expect(mail.sendRoiAlert).toHaveBeenCalledWith({
      market: 'ONE_X_TWO',
      roi: -0.12,
      betCount: 32,
    });
  });

  it('delegates to mail.sendMarketSuspension', async () => {
    await service.sendMarketSuspensionAlert(Market.ONE_X_TWO, -0.16, 55);

    expect(mail.sendMarketSuspension).toHaveBeenCalledWith({
      market: 'ONE_X_TWO',
      roi: -0.16,
      betCount: 55,
    });
  });

  it('delegates to mail.sendBrierAlert', async () => {
    await service.sendBrierScoreAlert('2024-2025', 0.2731);

    expect(mail.sendBrierAlert).toHaveBeenCalledWith({
      seasonId: '2024-2025',
      brierScore: 0.2731,
    });
  });

  it('delegates to mail.sendEtlFailure', async () => {
    await service.sendEtlFailureAlert('fixtures', 'fetch-ligue1', 'timeout');

    expect(mail.sendEtlFailure).toHaveBeenCalledWith({
      queue: 'fixtures',
      jobName: 'fetch-ligue1',
      errorMessage: 'timeout',
    });
  });

  it('delegates to mail.sendWeightAdjustment', async () => {
    const payload = {
      proposalId: 'prop-1',
      isRollback: false,
      brierScore: 0.26,
    };
    await service.sendWeightAdjustmentAlert(payload);

    expect(mail.sendWeightAdjustment).toHaveBeenCalledWith(payload);
  });

  it('delegates to mail.sendWeeklyReport with ISO date strings', async () => {
    const start = new Date('2025-03-03');
    const end = new Date('2025-03-09');
    await service.sendWeeklyReport({
      roiOneXTwo: 0.04,
      betsPlaced: 87,
      brierScore: 0.22,
      periodStart: start,
      periodEnd: end,
    });

    expect(mail.sendWeeklyReport).toHaveBeenCalledWith(
      expect.objectContaining({
        roiOneXTwo: 0.04,
        betsPlaced: 87,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      }),
    );
  });
});

describe('NotificationService — list & mark read', () => {
  it('returns paginated notifications with isRead derived from reads', async () => {
    const fakeNotif = {
      id: 'n1',
      type: NotificationType.ROI_ALERT,
      title: 'ROI Alert',
      body: 'body',
      payload: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
      reads: [],
    };
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findMany).mockResolvedValue([
      fakeNotif as never,
    ]);
    vi.mocked(prisma.client.notification.count).mockResolvedValue(1);

    const service = new NotificationService(prisma, makeMail());
    const result = await service.list({
      limit: 20,
      offset: 0,
      unread: true,
      userId: 'user-1',
      role: UserRole.OPERATOR,
    });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.isRead).toBe(false);
  });

  it('marks a single notification as read via upsert', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeMail());

    await service.markRead('notif-id-1', 'user-1');

    expect(prisma.client.userNotificationRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_notificationId: {
            userId: 'user-1',
            notificationId: 'notif-id-1',
          },
        },
      }),
    );
  });

  it('marks all visible notifications as read', async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findMany).mockResolvedValue([
      { id: 'n1' } as never,
      { id: 'n2' } as never,
    ]);
    const service = new NotificationService(prisma, makeMail());

    await service.markAllRead('user-1', UserRole.OPERATOR);

    expect(prisma.client.userNotificationRead.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', notificationId: 'n1' },
        { userId: 'user-1', notificationId: 'n2' },
      ],
      skipDuplicates: true,
    });
  });
});
