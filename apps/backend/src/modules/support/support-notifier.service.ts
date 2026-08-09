import { Injectable } from '@nestjs/common';
import { NotificationType, UserRole } from '@evcore/db';
import { MailService } from '@modules/mail/mail.service';
import { PushService } from '@modules/push/push.service';
import { NotificationService } from '@modules/notification/notification.service';
import type { SupportMessageDto } from './support.types';

// Groups the out-of-app / in-app notification channels for support messages
// so SupportService only needs one collaborator here (keeps its constructor
// at 3 params — see max-params rule). Push fires whenever a subscription
// exists; email always fires too — it's the one channel that still works
// with zero setup (no permission prompt, no PWA install), so it stays as a
// baseline rather than a fallback-only path.
@Injectable()
export class SupportNotifierService {
  constructor(
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly notification: NotificationService,
  ) {}

  async notifyAdmin(message: SupportMessageDto): Promise<void> {
    await Promise.all([
      this.mail.sendSupportMessage({
        recipientKind: 'ADMIN',
        fromUsername: message.senderUsername,
        preview: message.content,
      }),
      this.push.sendToRole(UserRole.ADMIN, {
        title: `Support — ${message.senderUsername}`,
        body: message.content,
        url: `/dashboard/inbox/${message.conversationId}`,
      }),
    ]);
  }

  async notifyUser(
    userId: string,
    email: string | null,
    message: SupportMessageDto,
  ): Promise<void> {
    const title = "Nouveau message de l'équipe EVCore";
    await Promise.all([
      email
        ? this.mail.sendSupportMessage({
            recipientKind: 'USER',
            to: email,
            fromUsername: message.senderUsername,
            preview: message.content,
          })
        : Promise.resolve(),
      this.push.sendToUser(userId, {
        title,
        body: message.content,
        url: '/dashboard/inbox',
      }),
      this.notification.notifyUser({
        userId,
        type: NotificationType.SUPPORT_MESSAGE,
        title,
        body: message.content,
        payload: { conversationId: message.conversationId },
      }),
    ]);
  }
}
