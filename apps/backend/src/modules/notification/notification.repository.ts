import { Injectable } from '@nestjs/common';
import { type Notification, NotificationType, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type NotificationWithReads = Notification & {
  reads: { readAt: Date }[];
};

export type NotificationReadTarget = {
  userId: string | null;
  type: NotificationType;
  payload: Prisma.JsonValue | null;
};

export type BroadcastNotificationRef = {
  id: string;
  type: NotificationType;
  payload: Prisma.JsonValue | null;
};

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.NotificationUncheckedCreateInput): Promise<void> {
    await this.prisma.client.notification.create({ data });
  }

  findPage(query: {
    where: Prisma.NotificationWhereInput;
    limit: number;
    offset: number;
    userId: string;
  }): Promise<NotificationWithReads[]> {
    return this.prisma.client.notification.findMany({
      where: query.where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: {
        reads: { where: { userId: query.userId }, select: { readAt: true } },
      },
    });
  }

  count(where: Prisma.NotificationWhereInput): Promise<number> {
    return this.prisma.client.notification.count({ where });
  }

  findReadTarget(
    notificationId: string,
  ): Promise<NotificationReadTarget | null> {
    return this.prisma.client.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true, type: true, payload: true },
    });
  }

  /** Personnelle : seul le destinataire peut la marquer lue. */
  async markPersonalRead(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markBroadcastRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.prisma.client.userNotificationRead.upsert({
      where: { userId_notificationId: { userId, notificationId } },
      create: { userId, notificationId },
      update: {},
    });
  }

  async markBroadcastsRead(
    userId: string,
    notificationIds: readonly string[],
  ): Promise<void> {
    if (notificationIds.length === 0) return;
    await this.prisma.client.userNotificationRead.createMany({
      data: notificationIds.map((notificationId) => ({
        userId,
        notificationId,
      })),
      skipDuplicates: true,
    });
  }

  findUnreadBroadcasts(
    userId: string,
    types: readonly NotificationType[],
  ): Promise<BroadcastNotificationRef[]> {
    return this.prisma.client.notification.findMany({
      where: {
        userId: null,
        type: { in: [...types] },
        reads: { none: { userId } },
      },
      select: { id: true, type: true, payload: true },
    });
  }

  async findAnnouncementNotificationIds(
    announcementId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.client.notification.findMany({
      where: {
        userId: null,
        type: NotificationType.ANNOUNCEMENT_PUBLISHED,
        payload: { path: ['announcementId'], equals: announcementId },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async markAllPersonalRead(userId: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async markPersonalReadByType(
    userId: string,
    type: NotificationType,
  ): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { userId, type, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  /** Annonces encore en base parmi `announcementIds`. */
  async findExistingAnnouncementIds(
    announcementIds: readonly string[],
  ): Promise<string[]> {
    const rows = await this.prisma.client.announcement.findMany({
      where: { id: { in: [...announcementIds] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async markAnnouncementsRead(
    userId: string,
    announcementIds: readonly string[],
  ): Promise<void> {
    if (announcementIds.length === 0) return;
    await this.prisma.client.announcementRead.createMany({
      data: announcementIds.map((announcementId) => ({
        userId,
        announcementId,
      })),
      skipDuplicates: true,
    });
  }
}
