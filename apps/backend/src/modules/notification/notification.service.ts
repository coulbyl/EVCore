import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import {
  Market,
  type Notification,
  NotificationType,
  type Prisma,
  UserRole,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { MailService } from '@modules/mail/mail.service';

const logger = createLogger('notification-service');

const OPERATOR_TYPES: NotificationType[] = [
  NotificationType.ROI_ALERT,
  NotificationType.MARKET_SUSPENSION,
  NotificationType.WEEKLY_REPORT,
];

export type NotificationView = Omit<Notification, 'read' | 'readAt'> & {
  isRead: boolean;
};

type SaveNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  payload: Prisma.InputJsonValue;
};

export type WeeklyReportPayload = {
  roiOneXTwo: number;
  betsPlaced: number;
  brierScore: number;
  periodStart: Date;
  periodEnd: Date;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private allowedTypes(role: UserRole): NotificationType[] {
    return role === UserRole.ADMIN
      ? Object.values(NotificationType)
      : OPERATOR_TYPES;
  }

  async sendRoiAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `ROI Alert — ${market}`;
    const body = `ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -10%)`;
    await this.save({
      type: NotificationType.ROI_ALERT,
      title,
      body,
      payload: { market, roi, betCount },
    });
    await this.mail.sendRoiAlert({ market: String(market), roi, betCount });
  }

  async sendMarketSuspensionAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `Market Suspended — ${market}`;
    const body = `Market auto-suspended: ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -15%)`;
    await this.save({
      type: NotificationType.MARKET_SUSPENSION,
      title,
      body,
      payload: { market, roi, betCount },
    });
    await this.mail.sendMarketSuspension({
      market: String(market),
      roi,
      betCount,
    });
  }

  async sendBrierScoreAlert(
    seasonId: string,
    brierScore: number,
  ): Promise<void> {
    const title = `Brier Score Alert — Season ${seasonId}`;
    const body = `Brier score ${brierScore.toFixed(4)} exceeds alert threshold (> 0.25)`;
    await this.save({
      type: NotificationType.BRIER_ALERT,
      title,
      body,
      payload: { seasonId, brierScore },
    });
    await this.mail.sendBrierAlert({ seasonId, brierScore });
  }

  async sendEtlFailureAlert(
    queue: string,
    jobName: string,
    errorMessage: string,
  ): Promise<void> {
    const title = `ETL Failure — ${queue}`;
    const body = `Job "${jobName}" permanently failed: ${errorMessage}`;
    await this.save({
      type: NotificationType.ETL_FAILURE,
      title,
      body,
      payload: { queue, jobName, errorMessage },
    });
    await this.mail.sendEtlFailure({ queue, jobName, errorMessage });
  }

  async sendWeightAdjustmentAlert(payload: {
    proposalId: string;
    isRollback: boolean;
    brierScore?: number;
    meanError?: number;
    rolledBackProposalId?: string;
  }): Promise<void> {
    const action = payload.isRollback ? 'rolled back' : 'auto-applied';
    const title = `Weight Adjustment ${action} — Proposal ${payload.proposalId}`;
    const body = payload.isRollback
      ? `Proposal ${payload.rolledBackProposalId} rolled back by proposal ${payload.proposalId}`
      : `Weights auto-applied: brierScore=${payload.brierScore?.toFixed(4)}, meanError=${payload.meanError?.toFixed(4)}`;
    await this.save({
      type: NotificationType.WEIGHT_ADJUSTMENT,
      title,
      body,
      payload: { ...payload },
    });
    await this.mail.sendWeightAdjustment(payload);
  }

  async sendXgUnavailableReport(
    season: string,
    externalIds: number[],
  ): Promise<void> {
    const unavailableCount = externalIds.length;
    const title = `Stats Sync — ${unavailableCount} fixtures sans xG (${season})`;
    const body = `${unavailableCount} fixtures marquées xgUnavailable : ${externalIds.join(', ')}`;
    await this.save({
      type: NotificationType.XG_UNAVAILABLE_REPORT,
      title,
      body,
      payload: { season, unavailableCount, externalIds },
    });
    await this.mail.sendXgUnavailableReport({
      season,
      unavailableCount,
      externalIds,
    });
  }

  async sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
    const title = `Weekly Report — ${payload.periodStart.toISOString().slice(0, 10)} → ${payload.periodEnd.toISOString().slice(0, 10)}`;
    const body = [
      `ROI (1X2): ${(payload.roiOneXTwo * 100).toFixed(2)}%`,
      `Bets placed: ${payload.betsPlaced}`,
      `Brier score: ${payload.brierScore.toFixed(4)}`,
    ].join('\n');
    await this.save({
      type: NotificationType.WEEKLY_REPORT,
      title,
      body,
      payload: {
        roiOneXTwo: payload.roiOneXTwo,
        betsPlaced: payload.betsPlaced,
        brierScore: payload.brierScore,
        periodStart: payload.periodStart.toISOString(),
        periodEnd: payload.periodEnd.toISOString(),
      },
    });
    await this.mail.sendWeeklyReport({
      roiOneXTwo: payload.roiOneXTwo,
      betsPlaced: payload.betsPlaced,
      brierScore: payload.brierScore,
      periodStart: payload.periodStart.toISOString(),
      periodEnd: payload.periodEnd.toISOString(),
    });
  }

  async list(query: {
    limit: number;
    offset: number;
    unread?: boolean;
    userId: string;
    role: UserRole;
  }): Promise<{
    data: NotificationView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const types = this.allowedTypes(query.role);
    const where: Prisma.NotificationWhereInput = {
      type: { in: types },
      ...(query.unread ? { reads: { none: { userId: query.userId } } } : {}),
    };
    const [raw, total] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          reads: { where: { userId: query.userId }, select: { readAt: true } },
        },
      }),
      this.prisma.client.notification.count({ where }),
    ]);
    const data: NotificationView[] = raw.map(
      ({ reads, read: _r, readAt: _ra, ...n }) => ({
        ...n,
        isRead: reads.length > 0,
      }),
    );
    return { data, total, limit: query.limit, offset: query.offset };
  }

  async unreadCount(
    userId: string,
    role: UserRole,
  ): Promise<{ count: number }> {
    const types = this.allowedTypes(role);
    const count = await this.prisma.client.notification.count({
      where: {
        type: { in: types },
        reads: { none: { userId } },
      },
    });
    return { count };
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.client.userNotificationRead.upsert({
      where: { userId_notificationId: { userId, notificationId } },
      create: { userId, notificationId },
      update: {},
    });
  }

  async markAllRead(userId: string, role: UserRole): Promise<void> {
    const types = this.allowedTypes(role);
    const unread = await this.prisma.client.notification.findMany({
      where: { type: { in: types }, reads: { none: { userId } } },
      select: { id: true },
    });
    if (unread.length === 0) return;
    await this.prisma.client.userNotificationRead.createMany({
      data: unread.map((n) => ({ userId, notificationId: n.id })),
      skipDuplicates: true,
    });
  }

  private async save(input: SaveNotificationInput): Promise<void> {
    const { type, title, body, payload } = input;
    try {
      await this.prisma.client.notification.create({
        data: { type, title, body, payload },
      });
    } catch (error) {
      logger.error(
        { type, error: error instanceof Error ? error.message : String(error) },
        'Failed to persist notification',
      );
    }
  }
}
