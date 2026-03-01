import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import pino from 'pino';
import { Market, NotificationType, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const logger = pino({ name: 'notification-service' });

export type WeeklyReportPayload = {
  roiOneXTwo: number;
  betsPlaced: number;
  brierScore: number;
  periodStart: Date;
  periodEnd: Date;
};

@Injectable()
export class NotificationService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private readonly smtpEnabled: boolean;
  private readonly smtpFrom: string;
  private readonly smtpTo: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.smtpEnabled = config.get<string>('SMTP_ENABLED', 'false') !== 'false';
    this.smtpFrom = config.get<string>('SMTP_FROM', 'evcore@localhost');
    this.smtpTo = config.get<string>('SMTP_TO', '');
  }

  onModuleInit(): void {
    if (!this.smtpEnabled) return;

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: this.config.get<string>('SMTP_SECURE', 'false') !== 'false',
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });

    logger.info(
      {
        host: this.config.get('SMTP_HOST'),
        port: this.config.get('SMTP_PORT'),
      },
      'SMTP transporter initialized',
    );
  }

  async sendRoiAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `ROI Alert — ${market}`;
    const body = `ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -10%)`;
    await this.save(NotificationType.ROI_ALERT, title, body, {
      market,
      roi,
      betCount,
    });
    await this.sendEmail(title, body);
  }

  async sendMarketSuspensionAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `Market Suspended — ${market}`;
    const body = `Market auto-suspended: ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -15%)`;
    await this.save(NotificationType.MARKET_SUSPENSION, title, body, {
      market,
      roi,
      betCount,
    });
    await this.sendEmail(title, body);
  }

  async sendBrierScoreAlert(
    seasonId: string,
    brierScore: number,
  ): Promise<void> {
    const title = `Brier Score Alert — Season ${seasonId}`;
    const body = `Brier score ${brierScore.toFixed(4)} exceeds alert threshold (${brierScore.toFixed(4)} > 0.30)`;
    await this.save(NotificationType.BRIER_ALERT, title, body, {
      seasonId,
      brierScore,
    });
    await this.sendEmail(title, body);
  }

  async sendEtlFailureAlert(
    queue: string,
    jobName: string,
    errorMessage: string,
  ): Promise<void> {
    const title = `ETL Failure — ${queue}`;
    const body = `Job "${jobName}" permanently failed: ${errorMessage}`;
    await this.save(NotificationType.ETL_FAILURE, title, body, {
      queue,
      jobName,
      errorMessage,
    });
    await this.sendEmail(title, body);
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
    await this.save(NotificationType.WEIGHT_ADJUSTMENT, title, body, {
      ...payload,
    });
    await this.sendEmail(title, body);
  }

  async sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
    const title = `Weekly Report — ${payload.periodStart.toISOString().slice(0, 10)} → ${payload.periodEnd.toISOString().slice(0, 10)}`;
    const body = [
      `ROI (1X2): ${(payload.roiOneXTwo * 100).toFixed(2)}%`,
      `Bets placed: ${payload.betsPlaced}`,
      `Brier score: ${payload.brierScore.toFixed(4)}`,
    ].join('\n');
    await this.save(NotificationType.WEEKLY_REPORT, title, body, {
      roiOneXTwo: payload.roiOneXTwo,
      betsPlaced: payload.betsPlaced,
      brierScore: payload.brierScore,
      periodStart: payload.periodStart.toISOString(),
      periodEnd: payload.periodEnd.toISOString(),
    });
    await this.sendEmail(title, body);
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

  private async save(
    type: NotificationType,
    title: string,
    body: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
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

  private async sendEmail(subject: string, text: string): Promise<void> {
    if (!this.smtpEnabled || !this.transporter || !this.smtpTo) {
      logger.debug(
        { subject },
        'SMTP disabled or unconfigured — skipping email',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to: this.smtpTo,
        subject: `[EVCore] ${subject}`,
        text,
      });
      logger.info({ subject }, 'Email sent');
    } catch (error) {
      logger.error(
        {
          subject,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send email',
      );
    }
  }
}
