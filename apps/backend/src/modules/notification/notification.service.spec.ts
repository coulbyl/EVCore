import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Market, NotificationType } from '@evcore/db';
import { NotificationService } from './notification.service';
import type { PrismaService } from '@/prisma.service';

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
  const mockCreateTransport = vi
    .fn()
    .mockReturnValue({ sendMail: mockSendMail });
  return { mockSendMail, mockCreateTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    SMTP_ENABLED: 'false',
    SMTP_FROM: 'evcore@localhost',
    SMTP_TO: 'admin@example.com',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

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
    },
  } as unknown as PrismaService;
}

describe('NotificationService — persistence', () => {
  beforeEach(() => {
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    } as unknown);
  });

  it('persists a ROI alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

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
    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

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
    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

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

describe('NotificationService — email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    } as unknown);
  });

  it('does NOT send email when SMTP_ENABLED=false', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      prisma,
      makeConfig({ SMTP_ENABLED: 'false' }),
    );
    service.onModuleInit();

    await service.sendRoiAlert(Market.ONE_X_TWO, -0.12, 32);

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('sends email when SMTP_ENABLED=true', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      prisma,
      makeConfig({ SMTP_ENABLED: 'true' }),
    );
    service.onModuleInit();

    await service.sendRoiAlert(Market.ONE_X_TWO, -0.12, 32);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'evcore@localhost',
        to: 'admin@example.com',
        subject: expect.stringContaining('ROI Alert'),
      }),
    );
  });

  it('does NOT send email when SMTP_TO is empty', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      prisma,
      makeConfig({ SMTP_ENABLED: 'true', SMTP_TO: '' }),
    );
    service.onModuleInit();

    await service.sendMarketSuspensionAlert(Market.ONE_X_TWO, -0.16, 55);

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('NotificationService — list & mark read', () => {
  it('returns paginated notifications', async () => {
    const fakeNotif = {
      id: 'n1',
      type: NotificationType.ROI_ALERT,
      title: 'ROI Alert',
      body: 'body',
      payload: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
    };
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findMany).mockResolvedValue([
      fakeNotif,
    ]);
    vi.mocked(prisma.client.notification.count).mockResolvedValue(1);

    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

    const result = await service.list({ limit: 20, offset: 0, unread: true });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(prisma.client.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { read: false }, take: 20, skip: 0 }),
    );
  });

  it('marks a single notification as read', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

    await service.markRead('notif-id-1');

    expect(prisma.client.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-id-1' },
      data: expect.objectContaining({ read: true, readAt: expect.any(Date) }),
    });
  });

  it('marks all notifications as read', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma, makeConfig());
    service.onModuleInit();

    await service.markAllRead();

    expect(prisma.client.notification.updateMany).toHaveBeenCalledWith({
      where: { read: false },
      data: expect.objectContaining({ read: true }),
    });
  });
});
