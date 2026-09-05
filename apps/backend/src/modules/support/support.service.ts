import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupportAttachmentKind, UserRole } from '@evcore/db';
import { SUPPORT_MESSAGES_PAGINATION } from '@/config/pagination.constants';
import { SUPPORT_ATTACHMENT_LIMITS } from '@/config/storage.constants';
import { StorageService } from '@modules/storage/storage.service';
import { SupportRepository } from './support.repository';
import { SupportGateway } from './support.gateway';
import { SupportNotifierService } from './support-notifier.service';
import {
  assertValidAttachmentRequest,
  extensionForMimeType,
} from './support-attachment.util';
import type {
  AttachmentUploadUrlDto,
  SupportAttachmentDto,
  SupportConversationSummaryDto,
  SupportMessageDto,
  SupportMessagePageDto,
} from './support.types';

type RawAttachment = {
  kind: SupportAttachmentKind;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

type RawMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  createdAt: Date;
  sender: { username: string; role: UserRole };
  attachment: RawAttachment | null;
};

// The ref the client sends alongside (or instead of) text — objectKey comes
// back from a prior "request upload URL" call, everything else is metadata
// the client already knows about the file it just recorded/picked.
type AttachmentRef = {
  objectKey: string;
  kind: SupportAttachmentKind;
  fileName?: string;
  durationMs?: number;
  width?: number;
  height?: number;
};

@Injectable()
export class SupportService {
  // eslint-disable-next-line max-params -- Explicit service injection keeps support-chat dependencies transparent.
  constructor(
    private readonly repo: SupportRepository,
    private readonly notifier: SupportNotifierService,
    private readonly gateway: SupportGateway,
    private readonly storage: StorageService,
  ) {}

  private async toMessageDto(raw: RawMessage): Promise<SupportMessageDto> {
    return {
      id: raw.id,
      conversationId: raw.conversationId,
      senderId: raw.senderId,
      senderRole: raw.sender.role === UserRole.ADMIN ? 'ADMIN' : 'OPERATOR',
      senderUsername: raw.sender.username,
      content: raw.content,
      attachment: await this.toAttachmentDto(raw.attachment),
      createdAt: raw.createdAt,
    };
  }

  private async toAttachmentDto(
    attachment: RawAttachment | null,
  ): Promise<SupportAttachmentDto | null> {
    if (!attachment) return null;
    return {
      kind: attachment.kind,
      url: await this.storage.createDownloadUrl(attachment.objectKey),
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      fileName: attachment.fileName,
      durationMs: attachment.durationMs,
      width: attachment.width,
      height: attachment.height,
    };
  }

  private async toPageDto(page: {
    messages: RawMessage[];
    hasMore: boolean;
  }): Promise<SupportMessagePageDto> {
    const messages = await Promise.all(
      page.messages.map((m) => this.toMessageDto(m)),
    );
    return { messages, hasMore: page.hasMore };
  }

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
    const page = await this.repo.listRecentMessages(
      conversation.id,
      SUPPORT_MESSAGES_PAGINATION.defaultLimit,
    );
    const { messages, hasMore } = await this.toPageDto(page);
    return { conversation, messages, hasMore };
  }

  // "Load older messages" for whichever side is asking — the caller already
  // knows conversationId (own conversation for a user, the :id param for an
  // admin) and the oldest message currently on screen.
  async loadOlderMessages(
    conversationId: string,
    beforeMessageId: string,
    limit: number = SUPPORT_MESSAGES_PAGINATION.defaultLimit,
  ): Promise<SupportMessagePageDto> {
    const cappedLimit = Math.min(limit, SUPPORT_MESSAGES_PAGINATION.maxLimit);
    const page = await this.repo.listMessagesBefore(
      conversationId,
      beforeMessageId,
      cappedLimit,
    );
    return this.toPageDto(page);
  }

  async loadOlderMessagesForUser(
    userId: string,
    beforeMessageId: string,
    limit?: number,
  ): Promise<SupportMessagePageDto> {
    const conversation = await this.repo.getOrCreateConversationForUser(userId);
    return this.loadOlderMessages(conversation.id, beforeMessageId, limit);
  }

  // Validates the upload request against the allowlist/size limits, then
  // hands back a presigned PUT the client uploads straight to — never
  // proxied through this process. objectKey is generated here (never
  // trusted from the client) and namespaced under the conversation so a
  // later sendAsUser/sendAsAdmin can verify the attachment actually belongs
  // to the conversation it's being attached to.
  async createAttachmentUploadUrl(input: {
    conversationId: string;
    kind: SupportAttachmentKind;
    mimeType: string;
    sizeBytes: number;
  }): Promise<AttachmentUploadUrlDto> {
    if (!this.storage.isEnabled()) {
      throw new BadRequestException(
        "L'envoi de fichiers n'est pas disponible pour le moment",
      );
    }
    assertValidAttachmentRequest(input);

    const objectKey = `support/${input.conversationId}/${randomUUID()}${extensionForMimeType(input.mimeType)}`;
    const uploadUrl = await this.storage.createUploadUrl({
      objectKey,
      contentType: input.mimeType,
      contentLength: input.sizeBytes,
    });
    return {
      objectKey,
      uploadUrl,
      expiresInSeconds: SUPPORT_ATTACHMENT_LIMITS.UPLOAD_URL_EXPIRY_SECONDS,
    };
  }

  async createAttachmentUploadUrlForUser(
    userId: string,
    request: {
      kind: SupportAttachmentKind;
      mimeType: string;
      sizeBytes: number;
    },
  ): Promise<AttachmentUploadUrlDto> {
    const conversation = await this.repo.getOrCreateConversationForUser(userId);
    return this.createAttachmentUploadUrl({
      conversationId: conversation.id,
      ...request,
    });
  }

  // Confirms the upload actually happened (HeadObject) and reads back the
  // authoritative size/type RustFS stored — never re-trusts what the client
  // said when it asked for the upload URL. Throws if the objectKey wasn't
  // issued for this conversation or nothing was ever uploaded to it.
  private async resolveAttachment(
    conversationId: string,
    ref: AttachmentRef | undefined,
  ) {
    if (!ref) return undefined;
    if (!ref.objectKey.startsWith(`support/${conversationId}/`)) {
      throw new BadRequestException(
        'Pièce jointe invalide pour cette conversation',
      );
    }
    const head = await this.storage.headObject(ref.objectKey);
    if (!head.exists) {
      throw new BadRequestException("Le fichier n'a pas été téléversé");
    }
    return {
      kind: ref.kind,
      objectKey: ref.objectKey,
      mimeType: head.contentType ?? 'application/octet-stream',
      sizeBytes: head.contentLength ?? 0,
      fileName: ref.fileName ?? null,
      durationMs: ref.durationMs ?? null,
      width: ref.width ?? null,
      height: ref.height ?? null,
    };
  }

  async sendAsUser(
    userId: string,
    input: { content?: string; attachment?: AttachmentRef },
  ): Promise<SupportMessageDto> {
    const conversation = await this.repo.getOrCreateConversationForUser(userId);
    const content = this.requireContentOrAttachment(input);
    const attachment = await this.resolveAttachment(
      conversation.id,
      input.attachment,
    );
    const raw = await this.repo.createMessage({
      conversationId: conversation.id,
      senderId: userId,
      content,
      attachment,
    });
    const dto = await this.toMessageDto(raw);
    this.gateway.emitMessage(conversation.id, dto);
    await this.notifier.notifyAdmin(dto);
    return dto;
  }

  async sendAsAdmin(
    conversationId: string,
    adminId: string,
    input: { content?: string; attachment?: AttachmentRef },
  ): Promise<SupportMessageDto> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    const content = this.requireContentOrAttachment(input);
    const attachment = await this.resolveAttachment(
      conversationId,
      input.attachment,
    );
    const raw = await this.repo.createMessage({
      conversationId,
      senderId: adminId,
      content,
      attachment,
    });
    const dto = await this.toMessageDto(raw);
    this.gateway.emitMessage(conversationId, dto);
    const email = await this.repo.findUserEmail(conversation.userId);
    await this.notifier.notifyUser(conversation.userId, email, dto);
    return dto;
  }

  private requireContentOrAttachment(input: {
    content?: string;
    attachment?: AttachmentRef;
  }): string | null {
    const content = input.content?.trim() || null;
    if (!content && !input.attachment) {
      throw new BadRequestException(
        'Un message doit contenir du texte ou une pièce jointe',
      );
    }
    return content;
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
    const page = await this.repo.listRecentMessages(
      conversationId,
      SUPPORT_MESSAGES_PAGINATION.defaultLimit,
    );
    return this.toPageDto(page);
  }

  async listConversationsForAdmin(): Promise<SupportConversationSummaryDto[]> {
    const rows = await this.repo.listConversationsForAdmin();
    return Promise.all(
      rows.map(async ({ conversation, lastMessage, unreadCount }) => ({
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
        lastMessage: lastMessage ? await this.toMessageDto(lastMessage) : null,
        unreadCount,
      })),
    );
  }
}
