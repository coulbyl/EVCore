import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createLogger } from '@utils/logger';
import {
  renderBrierAlert,
  renderEmailVerification,
  renderEtlFailure,
  renderMarketSuspension,
  renderPasswordReset,
  renderRoiAlert,
  renderWeightAdjustment,
  renderWeeklyReport,
  renderXgUnavailableReport,
  type BrierAlertProps,
  type EmailVerificationProps,
  type EtlFailureProps,
  type MarketSuspensionProps,
  type PasswordResetProps,
  type RoiAlertProps,
  type WeightAdjustmentProps,
  type WeeklyReportProps,
  type XgUnavailableReportProps,
} from '@evcore/transactional';

const logger = createLogger('mail-service');

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private readonly smtpEnabled: boolean;
  private readonly smtpFrom: string;
  private readonly smtpAdminTo: string;

  constructor(private readonly config: ConfigService) {
    this.smtpEnabled = config.get<string>('SMTP_ENABLED', 'false') !== 'false';
    this.smtpFrom = config.get<string>('SMTP_FROM', 'evcore@localhost');
    this.smtpAdminTo = config.get<string>('SMTP_TO', '');
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
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    logger.info(
      {
        host: this.config.get('SMTP_HOST'),
        port: this.config.get('SMTP_PORT'),
        secure: this.config.get('SMTP_SECURE'),
        user: this.config.get('SMTP_USER'),
        from: this.smtpFrom,
      },
      'SMTP transporter initialized — verifying connection',
    );

    this.transporter.verify((error) => {
      if (error) {
        logger.error(
          {
            host: this.config.get('SMTP_HOST'),
            port: this.config.get('SMTP_PORT'),
            error: error instanceof Error ? error.message : String(error),
          },
          'SMTP connection check FAILED — emails will not be delivered',
        );
      } else {
        logger.info(
          {
            host: this.config.get('SMTP_HOST'),
            port: this.config.get('SMTP_PORT'),
          },
          'SMTP connection check OK — ready to send',
        );
      }
    });
  }

  async sendEmailVerification(
    to: string,
    props: EmailVerificationProps,
  ): Promise<void> {
    const { html, text } = await renderEmailVerification(props);
    await this.sendTo(to, 'Vérification de votre email', { html, text });
  }

  async sendPasswordReset(
    to: string,
    props: PasswordResetProps,
  ): Promise<void> {
    const { html, text } = await renderPasswordReset(props);
    await this.sendTo(to, 'Réinitialisation de votre mot de passe', {
      html,
      text,
    });
  }

  async sendRoiAlert(props: RoiAlertProps): Promise<void> {
    const { html, text } = await renderRoiAlert(props);
    await this.sendToAdmin(`ROI Alert — ${props.market}`, html, text);
  }

  async sendMarketSuspension(props: MarketSuspensionProps): Promise<void> {
    const { html, text } = await renderMarketSuspension(props);
    await this.sendToAdmin(`Market Suspended — ${props.market}`, html, text);
  }

  async sendBrierAlert(props: BrierAlertProps): Promise<void> {
    const { html, text } = await renderBrierAlert(props);
    await this.sendToAdmin(
      `Brier Score Alert — Season ${props.seasonId}`,
      html,
      text,
    );
  }

  async sendEtlFailure(props: EtlFailureProps): Promise<void> {
    const { html, text } = await renderEtlFailure(props);
    await this.sendToAdmin(`ETL Failure — ${props.queue}`, html, text);
  }

  async sendWeightAdjustment(props: WeightAdjustmentProps): Promise<void> {
    const action = props.isRollback ? 'rolled back' : 'auto-applied';
    const { html, text } = await renderWeightAdjustment(props);
    await this.sendToAdmin(
      `Weight Adjustment ${action} — ${props.proposalId}`,
      html,
      text,
    );
  }

  async sendWeeklyReport(props: WeeklyReportProps): Promise<void> {
    const period = `${props.periodStart.slice(0, 10)} → ${props.periodEnd.slice(0, 10)}`;
    const { html, text } = await renderWeeklyReport(props);
    await this.sendToAdmin(`Weekly Report — ${period}`, html, text);
  }

  async sendXgUnavailableReport(
    props: XgUnavailableReportProps,
  ): Promise<void> {
    const { html, text } = await renderXgUnavailableReport(props);
    await this.sendToAdmin(
      `Stats Sync — ${props.unavailableCount} fixtures sans xG (${props.season})`,
      html,
      text,
    );
  }

  private async sendToAdmin(
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.smtpAdminTo) {
      logger.debug(
        { subject },
        'SMTP_TO not configured — skipping admin email',
      );
      return;
    }
    await this.sendTo(this.smtpAdminTo, subject, { html, text });
  }

  private async sendTo(
    to: string,
    subject: string,
    body: { html: string; text: string },
  ): Promise<void> {
    if (!this.smtpEnabled || !this.transporter) {
      logger.debug(
        { subject, to },
        'SMTP disabled or unconfigured — skipping email',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to,
        subject: `[EVCore] ${subject}`,
        html: body.html,
        text: body.text,
      });
      logger.info({ subject, to }, 'Email sent successfully');
    } catch (error) {
      logger.error(
        {
          subject,
          to,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send email — message NOT delivered',
      );
    }
  }
}
