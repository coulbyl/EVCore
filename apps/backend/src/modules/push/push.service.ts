import { Injectable, Optional } from '@nestjs/common';
import { IntegrationsService } from '@modules/integrations/integrations.service';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { UserRole, type PushSubscription } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { PushRepository } from './push.repository';

const logger = createLogger('push-service');

export type PushPayload = {
  title: string;
  body: string;
  // Opened when the user taps the notification (defaults to the dashboard root).
  url?: string;
  /** The bell's row this push announces: tapping it marks the row read. */
  notificationId?: string;
};

type Vapid = { publicKey: string; privateKey: string; subject: string };

@Injectable()
export class PushService {
  constructor(
    private readonly config: ConfigService,
    private readonly repo: PushRepository,
    @Optional() private readonly integrations?: IntegrationsService,
  ) {}

  /** A field: stored in Réglages › Intégrations, else its .env variable. */
  private async value(field: string, env: string): Promise<string | undefined> {
    return (
      (await this.integrations?.get(`push.${field}`)) ??
      this.config.get<string>(env)
    );
  }

  /** The VAPID keys that serve now, or null (push disabled). */
  private async vapid(): Promise<Vapid | null> {
    const [publicKey, privateKey, subject] = await Promise.all([
      this.value('publicKey', 'VAPID_PUBLIC_KEY'),
      this.value('privateKey', 'VAPID_PRIVATE_KEY'),
      this.value('subject', 'VAPID_SUBJECT'),
    ]);
    if (!publicKey || !privateKey || !subject) return null;
    return { publicKey, privateKey, subject };
  }

  async getPublicKey(): Promise<string | null> {
    return (await this.value('publicKey', 'VAPID_PUBLIC_KEY')) ?? null;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const vapid = await this.vapid();
    if (!vapid) return;
    const subscriptions = await this.repo.findByUserId(userId);
    await this.deliver({ subscriptions, payload, vapid });
  }

  async sendToRole(role: UserRole, payload: PushPayload): Promise<void> {
    const vapid = await this.vapid();
    if (!vapid) return;
    const subscriptions = await this.repo.findByRole(role);
    await this.deliver({ subscriptions, payload, vapid });
  }

  // Broadcast audience — announcements, not a per-user conversation.
  async sendToAllUsers(
    payload: PushPayload,
    excludeUserId?: string,
  ): Promise<void> {
    const vapid = await this.vapid();
    if (!vapid) return;
    const subscriptions = await this.repo.findAll(excludeUserId);
    await this.deliver({ subscriptions, payload, vapid });
  }

  private async deliver(input: {
    subscriptions: PushSubscription[];
    payload: PushPayload;
    vapid: Vapid;
  }): Promise<void> {
    const { subscriptions, payload, vapid } = input;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            // Per send: a key changed in Réglages › Intégrations serves at once.
            { vapidDetails: vapid },
          );
        } catch (error) {
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? (error as { statusCode: number }).statusCode
              : null;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or the user revoked permission — prune it.
            await this.repo.deleteByEndpoint(sub.endpoint);
            return;
          }
          logger.warn(
            {
              endpoint: sub.endpoint,
              error: error instanceof Error ? error.message : String(error),
            },
            'Push delivery failed',
          );
        }
      }),
    );
  }
}
