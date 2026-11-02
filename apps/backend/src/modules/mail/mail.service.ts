import { Injectable, Optional } from '@nestjs/common';
import { IntegrationsService } from '@modules/integrations/integrations.service';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { createLogger } from '@utils/logger';
import {
  renderEmailVerification,
  renderEmailChangeCode,
  renderEmailChanged,
  renderEmailChangeTaken,
  renderEtlFailure,
  renderOpsLightRed,
  renderMarketSuspension,
  renderPasswordReset,
  renderRoiAlert,
  renderWeightAdjustment,
  renderSupportMessage,
  renderPlayerDigest,
  type EmailVerificationProps,
  type EmailChangeCodeProps,
  type EmailChangedProps,
  type EtlFailureProps,
  type OpsLightRedProps,
  type MarketSuspensionProps,
  type PasswordResetProps,
  type RoiAlertProps,
  type SupportMessageProps,
  type PlayerDigestProps,
  type WeightAdjustmentProps,
} from '@evcore/transactional';

const logger = createLogger('mail-service');

@Injectable()
export class MailService {
  // One client per key: rebuilt when the key changes in Réglages ›
  // Intégrations, without a restart.
  private resend: { apiKey: string; client: Resend } | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly integrations?: IntegrationsService,
  ) {}

  /** A field: stored in Réglages › Intégrations, else its .env variable. */
  private async value(field: string, env: string): Promise<string | undefined> {
    return (
      (await this.integrations?.get(`email.${field}`)) ??
      this.config.get<string>(env)
    );
  }

  private async client(): Promise<Resend | null> {
    const apiKey = await this.value('apiKey', 'RESEND_API_KEY');
    if (!apiKey) return null;
    if (this.resend?.apiKey !== apiKey) {
      this.resend = { apiKey, client: new Resend(apiKey) };
    }
    return this.resend.client;
  }

  async sendEmailVerification(
    to: string,
    props: EmailVerificationProps,
  ): Promise<void> {
    const { html, text } = await renderEmailVerification(props);
    await this.sendTo(to, 'Vérification de votre email', { html, text });
  }

  /** Code envoyé à la nouvelle adresse demandée (changement d'e-mail). */
  async sendEmailChangeCode(
    to: string,
    props: EmailChangeCodeProps,
  ): Promise<void> {
    const { html, text } = await renderEmailChangeCode(props);
    await this.sendTo(to, 'Confirme ta nouvelle adresse', { html, text });
  }

  /** Adresse déjà rattachée à un compte : prévenue, sans code. */
  async sendEmailChangeTaken(to: string): Promise<void> {
    const { html, text } = await renderEmailChangeTaken();
    await this.sendTo(to, 'Cette adresse a déjà un compte EVCore', {
      html,
      text,
    });
  }

  /** Prévient l'ancienne adresse une fois le changement confirmé. */
  async sendEmailChanged(to: string, props: EmailChangedProps): Promise<void> {
    const { html, text } = await renderEmailChanged(props);
    await this.sendTo(to, 'Ton adresse e-mail a changé', { html, text });
  }

  /**
   * La matinée ou la semaine par e-mail (« Par e-mail aussi », 09 § 5).
   * `path` est l'écran où mène la notification, rendu absolu ici.
   */
  async sendPlayerDigest(
    to: string,
    props: Omit<PlayerDigestProps, 'url'> & { path: string },
  ): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const { html, text } = await renderPlayerDigest({
      title: props.title,
      body: props.body,
      url: `${appUrl}${props.path}`,
    });
    await this.sendTo(to, props.title, { html, text });
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

  async sendEtlFailure(props: EtlFailureProps): Promise<void> {
    const { html, text } = await renderEtlFailure(props);
    await this.sendToAdmin(`ETL Failure — ${props.queue}`, html, text);
  }

  /** A light of the admin turned red: once per transition (console-watch). */
  async sendOpsLightRed(props: OpsLightRedProps): Promise<void> {
    const { html, text } = await renderOpsLightRed(props);
    await this.sendToAdmin(`${props.light} au rouge`, html, text);
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

  // Support chat notification — routed to the admin inbox address when an
  // operator writes, or to the specific user's email when the team replies.
  async sendSupportMessage(
    props: SupportMessageProps & { to?: string },
  ): Promise<void> {
    const { html, text } = await renderSupportMessage(props);
    if (props.recipientKind === 'ADMIN') {
      await this.sendToAdmin(`Support — ${props.fromUsername}`, html, text);
      return;
    }
    if (!props.to) return;
    await this.sendTo(props.to, 'Réponse de l’équipe EVCore', { html, text });
  }

  private async sendToAdmin(
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const adminTo = (await this.value('adminTo', 'RESEND_ADMIN_TO')) ?? '';
    if (!adminTo) {
      logger.debug(
        { subject },
        'RESEND_ADMIN_TO not configured — skipping admin email',
      );
      return;
    }
    await this.sendTo(adminTo, subject, { html, text });
  }

  private async sendTo(
    to: string,
    subject: string,
    body: { html: string; text: string },
  ): Promise<void> {
    const resend = await this.client();
    if (!resend) {
      logger.debug({ subject, to }, 'Resend not configured — skipping email');
      return;
    }
    const from =
      (await this.value('from', 'RESEND_FROM')) ?? 'evcore@localhost';

    const { error } = await resend.emails.send({
      from,
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
