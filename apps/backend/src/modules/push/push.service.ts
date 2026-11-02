import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { IntegrationsService } from '@modules/integrations/integrations.service';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { UserRole, type PushSubscription } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { PUSH_DELIVERY } from '@config/push.constants';
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

export type Vapid = { publicKey: string; privateKey: string; subject: string };

/** One device to reach: the worker reads its keys when it sends. */
export type PushDeliveryJobData = {
  subscriptionId: string;
  payload: PushPayload;
};

@Injectable()
export class PushService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the env, the devices, the delivery queue, the integrations
  constructor(
    private readonly config: ConfigService,
    private readonly repo: PushRepository,
    @InjectQueue(PUSH_DELIVERY.QUEUE)
    private readonly queue: Queue<PushDeliveryJobData>,
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
  async vapid(): Promise<Vapid | null> {
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
    await this.enqueue(() => this.repo.findByUserId(userId), payload);
  }

  async sendToRole(role: UserRole, payload: PushPayload): Promise<void> {
    await this.enqueue(() => this.repo.findByRole(role), payload);
  }

  // Broadcast audience — announcements, not a per-user conversation.
  async sendToAllUsers(
    payload: PushPayload,
    excludeUserId?: string,
  ): Promise<void> {
    await this.enqueue(() => this.repo.findAll(excludeUserId), payload);
  }

  /**
   * One job per device on the delivery queue (PushDeliveryWorker, in the
   * worker process): the caller — a request, a pass — never waits on a push
   * service. Nothing is queued while push is not configured.
   */
  private async enqueue(
    audience: () => Promise<PushSubscription[]>,
    payload: PushPayload,
  ): Promise<void> {
    if (!(await this.vapid())) return;
    const subscriptions = await audience();
    if (subscriptions.length === 0) return;
    await this.queue.addBulk(
      subscriptions.map((sub) => ({
        name: PUSH_DELIVERY.JOB,
        data: { subscriptionId: sub.id, payload },
        opts: {
          attempts: PUSH_DELIVERY.ATTEMPTS,
          backoff: { type: 'exponential', delay: PUSH_DELIVERY.BACKOFF_MS },
          removeOnComplete: PUSH_DELIVERY.KEEP_COMPLETED,
          removeOnFail: PUSH_DELIVERY.KEEP_FAILED,
        },
      })),
    );
  }

  /**
   * Sends one push now (PushDeliveryWorker). A gone subscription (404/410)
   * is deleted; a push service that is busy or down (429, 5xx, no answer)
   * throws, and the queue tries again later; any other refusal is logged,
   * not retried.
   */
  async deliverOne(input: {
    subscription: PushSubscription;
    payload: PushPayload;
    vapid: Vapid;
  }): Promise<'sent' | 'gone' | 'refused'> {
    const { subscription: sub, payload, vapid } = input;
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
      return 'sent';
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : null;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or the user revoked permission — prune it.
        await this.repo.deleteByEndpoint(sub.endpoint);
        return 'gone';
      }
      if (statusCode === null || statusCode === 429 || statusCode >= 500) {
        throw error;
      }
      logger.warn(
        {
          endpoint: sub.endpoint,
          statusCode,
          error: error instanceof Error ? error.message : String(error),
        },
        'Push refused',
      );
      return 'refused';
    }
  }

  findSubscription(id: string): Promise<PushSubscription | null> {
    return this.repo.findById(id);
  }
}
