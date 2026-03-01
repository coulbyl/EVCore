import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import pino from 'pino';
import {
  renderBrierAlert,
  renderEtlFailure,
  renderMarketSuspension,
  renderRoiAlert,
  renderWeightAdjustment,
  renderWeeklyReport,
  type BrierAlertProps,
  type EtlFailureProps,
  type MarketSuspensionProps,
  type RoiAlertProps,
  type WeightAdjustmentProps,
  type WeeklyReportProps,
} from '@evcore/transactional';

const logger = pino({ name: 'mail-service' });

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private readonly smtpEnabled: boolean;
  private readonly smtpFrom: string;
  private readonly smtpTo: string;

  constructor(private readonly config: ConfigService) {
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

  async sendRoiAlert(props: RoiAlertProps): Promise<void> {
    const { html, text } = await renderRoiAlert(props);
    await this.send(`ROI Alert — ${props.market}`, html, text);
  }

  async sendMarketSuspension(props: MarketSuspensionProps): Promise<void> {
    const { html, text } = await renderMarketSuspension(props);
    await this.send(`Market Suspended — ${props.market}`, html, text);
  }

  async sendBrierAlert(props: BrierAlertProps): Promise<void> {
    const { html, text } = await renderBrierAlert(props);
    await this.send(`Brier Score Alert — Season ${props.seasonId}`, html, text);
  }

  async sendEtlFailure(props: EtlFailureProps): Promise<void> {
    const { html, text } = await renderEtlFailure(props);
    await this.send(`ETL Failure — ${props.queue}`, html, text);
  }

  async sendWeightAdjustment(props: WeightAdjustmentProps): Promise<void> {
    const action = props.isRollback ? 'rolled back' : 'auto-applied';
    const { html, text } = await renderWeightAdjustment(props);
    await this.send(
      `Weight Adjustment ${action} — ${props.proposalId}`,
      html,
      text,
    );
  }

  async sendWeeklyReport(props: WeeklyReportProps): Promise<void> {
    const period = `${props.periodStart.slice(0, 10)} → ${props.periodEnd.slice(0, 10)}`;
    const { html, text } = await renderWeeklyReport(props);
    await this.send(`Weekly Report — ${period}`, html, text);
  }

  private async send(
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
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
        html,
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
