import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import {
  type Bet,
  CouponStatus,
  Market,
  NotificationType,
  type Prisma,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { MailService } from '@modules/mail/mail.service';

const logger = createLogger('notification-service');

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
      payload: {
        market,
        roi,
        betCount,
      },
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
      payload: {
        market,
        roi,
        betCount,
      },
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
      payload: {
        seasonId,
        brierScore,
      },
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
      payload: {
        queue,
        jobName,
        errorMessage,
      },
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
      payload: {
        ...payload,
      },
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
      payload: {
        season,
        unavailableCount,
        externalIds,
      },
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
  }): Promise<{
    data: Awaited<ReturnType<typeof this.prisma.client.notification.findMany>>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const where = query.unread === true ? { read: false } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.client.notification.count({ where }),
    ]);
    return { data, total, limit: query.limit, offset: query.offset };
  }

  async markRead(id: string): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async sendDailyCoupon(coupon: {
    id: string;
    date: Date;
    legCount: number;
    bets: (Bet & {
      modelRun: {
        fixture: {
          scheduledAt: Date;
          homeTeam: { name: string };
          awayTeam: { name: string };
        };
      };
    })[];
  }): Promise<void> {
    const dateStr = coupon.date.toISOString().slice(0, 10);
    const title = `Daily Coupon — ${dateStr} (${coupon.legCount} leg${coupon.legCount !== 1 ? 's' : ''})`;
    const body = coupon.bets
      .map((b) =>
        b.comboMarket
          ? `${b.market} ${b.pick} + ${b.comboMarket} ${b.comboPick ?? ''}`
          : `${b.market} ${b.pick}`,
      )
      .join('\n');
    await this.save({
      type: NotificationType.DAILY_COUPON,
      title,
      body,
      payload: { id: coupon.id, date: dateStr, legCount: coupon.legCount },
    });
    await this.mail.sendDailyCoupon({
      id: coupon.id,
      date: dateStr,
      legCount: coupon.legCount,
      legs: coupon.bets.map((b) => ({
        homeTeam: b.modelRun.fixture.homeTeam.name,
        awayTeam: b.modelRun.fixture.awayTeam.name,
        scheduledAt:
          b.modelRun.fixture.scheduledAt
            .toISOString()
            .replace('T', ' ')
            .slice(0, 16) + ' UTC',
        market: b.market,
        pick: b.pick,
        odds: b.oddsSnapshot !== null ? Number(b.oddsSnapshot) : null,
        ev: Number(b.ev),
        comboMarket: b.comboMarket ?? null,
        comboPick: b.comboPick ?? null,
      })),
    });
  }

  async sendNoBetToday(date: Date): Promise<void> {
    const dateStr = date.toISOString().slice(0, 10);
    const title = `No Bet Today — ${dateStr}`;
    const body = 'No qualified picks found for today.';
    await this.save({
      type: NotificationType.NO_BET_TODAY,
      title,
      body,
      payload: { date: dateStr },
    });
    await this.mail.sendNoBetToday({ date: dateStr });
  }

  async sendCouponResult(couponId: string): Promise<void> {
    const coupon = await this.prisma.client.dailyCoupon.findUnique({
      where: { id: couponId },
      select: { id: true, status: true, legCount: true },
    });

    if (!coupon) {
      logger.warn(
        { couponId },
        'Coupon not found — skipping coupon result alert',
      );
      return;
    }

    if (
      coupon.status !== CouponStatus.WON &&
      coupon.status !== CouponStatus.LOST &&
      coupon.status !== CouponStatus.SETTLED
    ) {
      return;
    }

    const title = `Coupon Result — ${coupon.status}`;
    const body = `Coupon ${coupon.id} settled as ${coupon.status} (${coupon.legCount} leg${coupon.legCount !== 1 ? 's' : ''}).`;
    await this.save({
      type: NotificationType.COUPON_RESULT,
      title,
      body,
      payload: { couponId: coupon.id, status: coupon.status },
    });
    await this.mail.sendCouponResult({
      couponId: coupon.id,
      status: coupon.status,
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
