import { Injectable } from '@nestjs/common';
import { NotificationType, UserRole } from '@evcore/db';
import { MailService } from '@modules/mail/mail.service';
import { PushService } from '@modules/push/push.service';
import { NotificationService } from '@modules/notification/notification.service';
import type { SupportMessageDto } from './support.types';

// A voice note or a bare file has no text — every notification channel
// still needs a one-line body, so fall back to a label describing what was
// sent instead of the (absent) caption.
function notificationBody(message: SupportMessageDto): string {
  if (message.content) return message.content;
  switch (message.attachment?.kind) {
    case 'AUDIO':
      return '🎙️ Message vocal';
    case 'IMAGE':
      return '📷 Photo';
    case 'FILE':
      return `📎 ${message.attachment.fileName ?? 'Fichier'}`;
    default:
      return 'Nouveau message';
  }
}

// Groups the out-of-app / in-app notification channels for support messages
// so SupportService only needs one collaborator here (keeps its constructor
// at 3 params — see max-params rule). The team is told by email and push;
// a player by the bell and push only (notifyUser).
@Injectable()
export class SupportNotifierService {
  constructor(
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly notification: NotificationService,
  ) {}

  /** Le joueur a ouvert sa conversation : ses notifications de réponse sont lues. */
  clearUserNotifications(userId: string): Promise<void> {
    return this.notification.markSupportMessagesRead(userId);
  }

  async notifyAdmin(message: SupportMessageDto): Promise<void> {
    await Promise.all([
      this.mail.sendSupportMessage({
        recipientKind: 'ADMIN',
        fromUsername: message.senderUsername,
        preview: notificationBody(message),
      }),
      this.push.sendToRole(UserRole.ADMIN, {
        title: `Support — ${message.senderUsername}`,
        body: notificationBody(message),
        url: `/dashboard/inbox/${message.conversationId}`,
      }),
    ]);
  }

  /**
   * A team reply: the bell and the push, never an email (refonte 10 § 3:
   * the email copy is the morning and the week only). What the player wrote
   * to support, and what the team answered, stay in the app.
   */
  async notifyUser(userId: string, message: SupportMessageDto): Promise<void> {
    const title = "Nouveau message de l'équipe EVCore";
    await Promise.all([
      this.push.sendToUser(userId, {
        title,
        body: notificationBody(message),
        url: '/me/messages',
      }),
      this.notification.notifyUser({
        userId,
        type: NotificationType.SUPPORT_MESSAGE,
        title,
        body: notificationBody(message),
        payload: { conversationId: message.conversationId },
      }),
    ]);
  }
}
