import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@evcore/db';
import { MailService } from '@modules/mail/mail.service';
import { SupportRepository } from './support.repository';
import { SupportGateway } from './support.gateway';
import type {
  SupportConversationSummaryDto,
  SupportMessageDto,
} from './support.types';

type RawMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender: { username: string; role: UserRole };
};

function toMessageDto(raw: RawMessage): SupportMessageDto {
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    senderRole: raw.sender.role === UserRole.ADMIN ? 'ADMIN' : 'OPERATOR',
    senderUsername: raw.sender.username,
    content: raw.content,
    createdAt: raw.createdAt,
  };
}

@Injectable()
export class SupportService {
  constructor(
    private readonly repo: SupportRepository,
    private readonly mail: MailService,
    private readonly gateway: SupportGateway,
  ) {}

  // Admin-initiated contact — the operator doesn't need to have opened their
  // Inbox or sent anything first; get-or-create means calling this twice for
  // the same user is safe and just returns the existing conversation.
  async startConversationWithUser(userId: string) {
    const exists = await this.repo.userExists(userId);
    if (!exists) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.repo.getOrCreateConversationForUser(userId);
  }

  async getOwnConversation(userId: string) {
    const conversation = await this.repo.getOrCreateConversationForUser(userId);
    const rawMessages = await this.repo.listMessages(conversation.id);
    return {
      conversation,
      messages: rawMessages.map(toMessageDto),
    };
  }

  async sendAsUser(
    userId: string,
    content: string,
  ): Promise<SupportMessageDto> {
    const conversation = await this.repo.getOrCreateConversationForUser(userId);
    const raw = await this.repo.createMessage({
      conversationId: conversation.id,
      senderId: userId,
      content,
    });
    const dto = toMessageDto(raw);
    this.gateway.emitMessage(conversation.id, dto);
    await this.notifyAdmin(dto);
    return dto;
  }

  async sendAsAdmin(
    conversationId: string,
    adminId: string,
    content: string,
  ): Promise<SupportMessageDto> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    const raw = await this.repo.createMessage({
      conversationId,
      senderId: adminId,
      content,
    });
    const dto = toMessageDto(raw);
    this.gateway.emitMessage(conversationId, dto);
    await this.notifyUser(conversation.userId, dto);
    return dto;
  }

  async markReadByUser(userId: string): Promise<void> {
    const conversation = await this.repo.findConversationByUserId(userId);
    if (!conversation) return;
    await this.repo.markReadByUser(conversation.id);
  }

  async markReadByAdmin(conversationId: string) {
    return this.repo.markReadByAdmin(conversationId);
  }

  getUnreadCountForUser(userId: string): Promise<number> {
    return this.repo.countUnreadForUser(userId);
  }

  getUnreadCountForAdmin(): Promise<number> {
    return this.repo.countUnreadForAdmin();
  }

  async getMessagesForAdmin(conversationId: string) {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    const rawMessages = await this.repo.listMessages(conversationId);
    return rawMessages.map(toMessageDto);
  }

  async listConversationsForAdmin(): Promise<SupportConversationSummaryDto[]> {
    const rows = await this.repo.listConversationsForAdmin();
    return rows.map(({ conversation, lastMessage, unreadCount }) => ({
      id: conversation.id,
      userId: conversation.userId,
      status: conversation.status,
      userReadAt: conversation.userReadAt,
      adminReadAt: conversation.adminReadAt,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      username: conversation.user.username,
      fullName: conversation.user.fullName,
      avatarUrl: conversation.user.avatarUrl,
      lastMessage: lastMessage ? toMessageDto(lastMessage) : null,
      unreadCount,
    }));
  }

  private async notifyAdmin(message: SupportMessageDto): Promise<void> {
    await this.mail.sendSupportMessage({
      recipientKind: 'ADMIN',
      fromUsername: message.senderUsername,
      preview: message.content,
    });
  }

  private async notifyUser(
    userId: string,
    message: SupportMessageDto,
  ): Promise<void> {
    const email = await this.repo.findUserEmail(userId);
    if (!email) return;
    await this.mail.sendSupportMessage({
      recipientKind: 'USER',
      to: email,
      fromUsername: message.senderUsername,
      preview: message.content,
    });
  }
}
