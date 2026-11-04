import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Market, NotificationType, UserRole } from '@evcore/db';
import { NotificationService } from './notification.service';
import type { PushService } from '@modules/push/push.service';
import { PUSH_POLICY } from '@config/push.constants';
import { NotificationRepository } from './notification.repository';
import type { PrismaService } from '@/prisma.service';
import type { MailService } from '@modules/mail/mail.service';

function makePrisma(): PrismaService {
  return {
    client: {
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
        findMany: vi.fn().mockResolvedValue([]),
        // Broadcast par défaut (userId null) — matche le comportement des
        // notifications existantes avant l'ajout des notifs personnelles.
        findUnique: vi.fn().mockResolvedValue({ userId: null }),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      userNotificationRead: {
        upsert: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      announcement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      announcementRead: {
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
  } as unknown as MailService;
}

function makePush(): PushService {
  return {
    sendToUser: vi.fn().mockResolvedValue(undefined),
    sendToAllUsers: vi.fn().mockResolvedValue(undefined),
    sendToRole: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushService;
}

describe('NotificationService — persistence', () => {
  it('persists a ROI alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

    await service.sendRoiAlert(Market.ONE_X_TWO, -0.12, 32);

    expect(prisma.client.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.ROI_ALERT,
        title: expect.stringContaining('ROI Alert'),
        body: expect.stringContaining('-12.00%'),
      }),
      select: { id: true },
    });
  });

  it('persists an ETL failure alert to the database', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

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
      select: { id: true },
    });
  });
});

describe("NotificationService — operations alerts on the admins' phones", () => {
  it('pushes an ETL failure to the admins, one tag per queue', async () => {
    const push = makePush();
    const service = new NotificationService(
      new NotificationRepository(makePrisma()),
      makeMail(),
      push,
    );

    await service.sendEtlFailureAlert('odds-prematch-sync', 'sync', 'quota');

    expect(push.sendToRole).toHaveBeenCalledWith(
      UserRole.ADMIN,
      expect.objectContaining({
        url: '/admin/exploitation',
        tag: 'etl-odds-prematch-sync',
      }),
      PUSH_POLICY.OPERATIONS,
    );
  });

  // No e-mail either: MailService has no sender for it any more.
  it('keeps the xG report to the bell: no push', async () => {
    const prisma = makePrisma();
    const push = makePush();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      push,
    );

    await service.sendXgUnavailableReport('2026', [1, 2]);

    expect(prisma.client.notification.create).toHaveBeenCalledTimes(1);
    expect(push.sendToRole).not.toHaveBeenCalled();
  });
});

describe('NotificationService — the bell reads 90 days', () => {
  it('counts no unread notification older than the window', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    const before = Date.now();

    await service.unreadCount('user-1', UserRole.OPERATOR);

    const [args] =
      vi.mocked(prisma.client.notification.count).mock.calls[0] ?? [];
    const since = (args as { where: { AND: [{ createdAt: { gte: Date } }] } })
      .where.AND[0].createdAt.gte;
    const days = (before - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(89.99);
    expect(days).toBeLessThan(90.01);
  });
});

describe('NotificationService — mail delegation', () => {
  let prisma: PrismaService;
  let mail: MailService;
  let service: NotificationService;

  beforeEach(() => {
    prisma = makePrisma();
    mail = makeMail();
    service = new NotificationService(
      new NotificationRepository(prisma),
      mail,
      makePush(),
    );
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

    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    const result = await service.list({
      limit: 20,
      offset: 0,
      status: 'unread',
      userId: 'user-1',
      role: UserRole.OPERATOR,
    });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.isRead).toBe(false);
  });

  it('filters to ANNOUNCEMENT_PUBLISHED only when category is "announcement"', async () => {
    const prisma = makePrisma();

    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.list({
      limit: 20,
      offset: 0,
      category: 'announcement',
      userId: 'user-1',
      role: UserRole.OPERATOR,
    });

    expect(prisma.client.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { type: NotificationType.ANNOUNCEMENT_PUBLISHED },
          ]),
        }),
      }),
    );
  });

  it('excludes ANNOUNCEMENT_PUBLISHED when category is "alert"', async () => {
    const prisma = makePrisma();

    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.list({
      limit: 20,
      offset: 0,
      category: 'alert',
      userId: 'user-1',
      role: UserRole.OPERATOR,
    });

    expect(prisma.client.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { type: { not: NotificationType.ANNOUNCEMENT_PUBLISHED } },
          ]),
        }),
      }),
    );
  });

  it('marks a single notification as read via upsert', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

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

  it('marks a personal notification as read directly, without the shared read table', async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findUnique).mockResolvedValue({
      userId: 'user-1',
    } as never);
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

    await service.markRead('notif-id-1', 'user-1');

    expect(prisma.client.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-id-1', userId: 'user-1' },
      data: { read: true, readAt: expect.any(Date) },
    });
    expect(prisma.client.userNotificationRead.upsert).not.toHaveBeenCalled();
  });

  it('writes a personal notification, then pushes it with its id', async () => {
    const prisma = makePrisma();
    const push = makePush();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      push,
    );

    const recorded = await service.deliverToUser({
      userId: 'user-1',
      type: NotificationType.SUPPORT_MESSAGE,
      title: "Nouveau message de l'équipe EVCore",
      body: 'Bonjour',
      payload: { conversationId: 'conv-1' },
      url: '/me/messages',
      tag: 'support-conv-1',
    });

    expect(recorded).toBe(true);
    expect(prisma.client.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: NotificationType.SUPPORT_MESSAGE,
        title: "Nouveau message de l'équipe EVCore",
        body: 'Bonjour',
        payload: { conversationId: 'conv-1' },
      },
      select: { id: true },
    });
    expect(push.sendToUser).toHaveBeenCalledWith(
      'user-1',
      {
        title: "Nouveau message de l'équipe EVCore",
        body: 'Bonjour',
        url: '/me/messages',
        notificationId: 'notif-1',
        tag: 'support-conv-1',
      },
      PUSH_POLICY.SUPPORT_MESSAGE,
    );
  });

  it('stays true, and throws nothing, when the push cannot be queued', async () => {
    const push = makePush();
    vi.mocked(push.sendToUser).mockRejectedValue(new Error('redis down'));
    const service = new NotificationService(
      new NotificationRepository(makePrisma()),
      makeMail(),
      push,
    );
    await expect(
      service.deliverToUser({
        userId: 'user-1',
        type: NotificationType.MORNING_BRIEF,
        title: 'Ta matinée',
        body: '…',
        url: '/today?from=morning',
        tag: 'morning-brief',
      }),
    ).resolves.toBe(true);
  });

  it('pushes nothing when the row could not be written', async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.create).mockRejectedValue(
      new Error('db down'),
    );
    const push = makePush();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      push,
    );

    const recorded = await service.deliverToUser({
      userId: 'user-1',
      type: NotificationType.MORNING_BRIEF,
      title: 'Ta matinée',
      body: '…',
      url: '/today?from=morning',
      tag: 'morning-brief',
    });

    expect(recorded).toBe(false);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});

describe('NotificationService — ce que chaque rôle voit des diffusions', () => {
  function typesPassedToPrisma(prisma: PrismaService): NotificationType[] {
    const count = (prisma.client.notification.count as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0] as {
      where: {
        AND: [
          unknown,
          unknown,
          unknown,
          { OR: [{ type: { in: NotificationType[] } }] },
        ];
      };
    };
    return count.where.AND[3].OR[0].type.in;
  }

  it("un opérateur ne reçoit que les annonces parmi les diffusions — jamais les alertes d'ingénierie", async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.unreadCount('user-1', UserRole.OPERATOR);
    const types = typesPassedToPrisma(prisma);
    expect(types).toEqual([NotificationType.ANNOUNCEMENT_PUBLISHED]);
    expect(types).not.toContain(NotificationType.ROI_ALERT);
    expect(types).not.toContain(NotificationType.MARKET_SUSPENSION);
    expect(types).not.toContain(NotificationType.WEEKLY_REPORT);
  });

  it('un administrateur voit tous les types', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.unreadCount('admin-1', UserRole.ADMIN);
    expect(typesPassedToPrisma(prisma)).toEqual(
      Object.values(NotificationType),
    );
  });
});

describe('NotificationService — messages retirés et un seul état « lu »', () => {
  function personalTypesOf(prisma: PrismaService): {
    in?: NotificationType[];
    notIn?: NotificationType[];
  } {
    const where = (prisma.client.notification.count as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0] as {
      where: {
        AND: [
          unknown,
          unknown,
          unknown,
          {
            OR: [
              unknown,
              {
                type: { in?: NotificationType[]; notIn?: NotificationType[] };
              },
            ];
          },
        ];
      };
    };
    return where.where.AND[3].OR[1].type;
  }

  it('la cloche du joueur ne reçoit que ses cinq sortes (09 § 6)', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.unreadCount('user-1', UserRole.OPERATOR);
    expect(personalTypesOf(prisma)).toEqual({
      in: [
        NotificationType.MORNING_BRIEF,
        NotificationType.WEEKLY_STATEMENT,
        NotificationType.FOLLOWED_SETTLED,
        NotificationType.SUPPORT_MESSAGE,
      ],
    });
  });

  it("un administrateur garde ses messages personnels, sauf l'abonnement retiré", async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
    await service.unreadCount('admin-1', UserRole.ADMIN);
    expect(personalTypesOf(prisma)).toEqual({
      notIn: [
        NotificationType.SUBSCRIPTION_EVENTS_ADDED,
        NotificationType.SUBSCRIPTION_SETTLED,
      ],
    });
  });

  it("lire la notification d'une annonce marque l'annonce lue", async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findUnique).mockResolvedValue({
      userId: null,
      type: NotificationType.ANNOUNCEMENT_PUBLISHED,
      payload: { announcementId: 'ann-1', href: null },
    } as never);
    vi.mocked(prisma.client.announcement.findMany).mockResolvedValue([
      { id: 'ann-1' } as never,
    ]);
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

    await service.markRead('notif-1', 'user-1');

    expect(prisma.client.announcementRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', announcementId: 'ann-1' }],
      skipDuplicates: true,
    });
  });

  it("ouvrir l'annonce marque sa notification lue", async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findMany).mockResolvedValue([
      { id: 'notif-1' } as never,
    ]);
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

    await service.markAnnouncementRead('user-1', 'ann-1');

    expect(prisma.client.userNotificationRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', notificationId: 'notif-1' }],
      skipDuplicates: true,
    });
  });

  it('ouvrir la conversation marque les réponses du support lues', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );

    await service.markSupportMessagesRead('user-1');

    expect(prisma.client.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        type: NotificationType.SUPPORT_MESSAGE,
        read: false,
      },
      data: { read: true, readAt: expect.any(Date) },
    });
  });
});

describe('NotificationService — the badge, the list and « tout marquer comme lu » cover one set', () => {
  function serviceWith(prisma: PrismaService): NotificationService {
    return new NotificationService(
      new NotificationRepository(prisma),
      makeMail(),
      makePush(),
    );
  }

  it('the badge counts exactly what the « Non lues » list counts', async () => {
    const prisma = makePrisma();
    const service = serviceWith(prisma);

    await service.unreadCount('user-1', UserRole.ADMIN);
    await service.list({
      limit: 20,
      offset: 0,
      status: 'unread',
      userId: 'user-1',
      role: UserRole.ADMIN,
    });

    const calls = vi.mocked(prisma.client.notification.count).mock.calls;
    // The window's date differs by milliseconds between the two calls.
    const shape = (call: unknown) =>
      JSON.stringify(call, (key, value: unknown) =>
        key === 'gte' ? 'window' : value,
      );
    expect(shape(calls[0]?.[0])).toBe(shape(calls[1]?.[0]));
  });

  it('« Lues » keeps the broadcasts this player read and the personal rows marked read', async () => {
    const prisma = makePrisma();
    await serviceWith(prisma).list({
      limit: 20,
      offset: 0,
      status: 'read',
      userId: 'user-1',
      role: UserRole.OPERATOR,
    });

    const [args] =
      vi.mocked(prisma.client.notification.findMany).mock.calls[0] ?? [];
    const or = (
      args as {
        where: { AND: [unknown, unknown, unknown, { OR: unknown[] }] };
      }
    ).where.AND[3].OR;
    expect(or[0]).toMatchObject({
      userId: null,
      reads: { some: { userId: 'user-1' } },
    });
    expect(or[1]).toMatchObject({ userId: 'user-1', read: true });
  });

  it('« Alertes techniques » holds the engineering alerts only', async () => {
    const prisma = makePrisma();
    await serviceWith(prisma).list({
      limit: 20,
      offset: 0,
      category: 'technical',
      userId: 'admin-1',
      role: UserRole.ADMIN,
    });

    const [args] =
      vi.mocked(prisma.client.notification.findMany).mock.calls[0] ?? [];
    const category = (args as { where: { AND: [unknown, unknown] } }).where
      .AND[1] as { type: { in: NotificationType[] } };
    expect(category.type.in).toContain(NotificationType.ETL_FAILURE);
    expect(category.type.in).toContain(NotificationType.XG_UNAVAILABLE_REPORT);
    expect(category.type.in).not.toContain(
      NotificationType.ANNOUNCEMENT_PUBLISHED,
    );
    expect(category.type.in).not.toContain(NotificationType.MORNING_BRIEF);
  });

  it('marks every unread broadcast and personal row read, the announcement with it', async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.client.notification.findMany).mockResolvedValue([
      { id: 'b1', type: NotificationType.ETL_FAILURE, payload: null },
      {
        id: 'b2',
        type: NotificationType.ANNOUNCEMENT_PUBLISHED,
        payload: { announcementId: 'ann-1' },
      },
    ] as never);
    vi.mocked(prisma.client.notification.updateMany).mockResolvedValue({
      count: 3,
    });
    vi.mocked(prisma.client.announcement.findMany).mockResolvedValue([
      { id: 'ann-1' },
    ] as never);

    const result = await serviceWith(prisma).markAllRead({
      userId: 'user-1',
      role: UserRole.ADMIN,
    });

    expect(result).toEqual({ marked: 5 });
    expect(prisma.client.userNotificationRead.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', notificationId: 'b1' },
        { userId: 'user-1', notificationId: 'b2' },
      ],
      skipDuplicates: true,
    });
    const [update] =
      vi.mocked(prisma.client.notification.updateMany).mock.calls[0] ?? [];
    expect(update?.where).toMatchObject({
      AND: [expect.anything(), { userId: 'user-1' }],
    });
    expect(prisma.client.announcementRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', announcementId: 'ann-1' }],
      skipDuplicates: true,
    });
  });

  it('a second pass finds nothing left and writes nothing more', async () => {
    const prisma = makePrisma();
    const result = await serviceWith(prisma).markAllRead({
      userId: 'user-1',
      role: UserRole.OPERATOR,
      category: 'player',
    });

    expect(result).toEqual({ marked: 0 });
    expect(
      prisma.client.userNotificationRead.createMany,
    ).not.toHaveBeenCalled();
    expect(prisma.client.announcementRead.createMany).not.toHaveBeenCalled();
  });
});
