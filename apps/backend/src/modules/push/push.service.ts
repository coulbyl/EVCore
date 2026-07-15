import { Injectable, OnModuleInit } from '@nestjs/common';
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
};

@Injectable()
export class PushService implements OnModuleInit {
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly repo: PushRepository,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');

    if (!publicKey || !privateKey || !subject) {
      logger.warn('VAPID keys not configured — push notifications disabled');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
    logger.info('Web push configured');
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.repo.findByUserId(userId);
    await this.deliver(subscriptions, payload);
  }

  async sendToRole(role: UserRole, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.repo.findByRole(role);
    await this.deliver(subscriptions, payload);
  }

  // Broadcast audience — announcements, not a per-user conversation.
  async sendToAllUsers(
    payload: PushPayload,
    excludeUserId?: string,
  ): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.repo.findAll(excludeUserId);
    await this.deliver(subscriptions, payload);
  }

  private async deliver(
    subscriptions: PushSubscription[],
    payload: PushPayload,
  ): Promise<void> {
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
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
