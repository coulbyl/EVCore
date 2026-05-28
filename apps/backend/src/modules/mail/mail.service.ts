import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
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
  private resend: Resend | null = null;
  private readonly from: string;
  private readonly adminTo: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('RESEND_FROM', 'evcore@localhost');
    this.adminTo = config.get<string>('RESEND_ADMIN_TO', '');
  }

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      logger.warn('RESEND_API_KEY not set — email sending disabled');
      return;
    }
    this.resend = new Resend(apiKey);
    logger.info({ from: this.from }, 'Resend email client ready');
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
    if (!this.adminTo) {
      logger.debug(
        { subject },
        'RESEND_ADMIN_TO not configured — skipping admin email',
      );
      return;
    }
    await this.sendTo(this.adminTo, subject, { html, text });
  }

  private async sendTo(
    to: string,
    subject: string,
    body: { html: string; text: string },
  ): Promise<void> {
    if (!this.resend) {
      logger.debug({ subject, to }, 'Resend not configured — skipping email');
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: `[EVCore] ${subject}`,
      html: body.html,
      text: body.text,
    });

    if (error) {
      logger.error(
        { subject, to, error: error.message },
        'Failed to send email — message NOT delivered',
      );
    } else {
      logger.info({ subject, to }, 'Email sent successfully');
    }
  }
}
