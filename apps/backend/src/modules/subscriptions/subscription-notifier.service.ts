import { Injectable } from '@nestjs/common';
import type { NotificationType, Prisma } from '@evcore/db';
import { PushService } from '@modules/push/push.service';
import { NotificationService } from '@modules/notification/notification.service';

// Groupe les deux canaux de notification personnelle (push + persistée en
// base) pour les abonnements — permet à SubscriptionMatchingService et
// SubscriptionSettlementService de n'avoir qu'un seul collaborateur ici au
// lieu de deux (voir max-params côté eslint, même logique que
// SupportNotifierService pour les messages support).
@Injectable()
export class SubscriptionNotifierService {
  constructor(
    private readonly push: PushService,
    private readonly notification: NotificationService,
  ) {}

  async notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    url: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    await Promise.all([
      this.push.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        url: input.url,
      }),
      this.notification.notifyUser({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
      }),
    ]);
  }
}
