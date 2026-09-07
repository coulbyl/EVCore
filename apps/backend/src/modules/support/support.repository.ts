import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SupportAttachmentKind,
  SupportConversationStatus,
  SupportMessageKind,
} from '@evcore/db';
import type { SupportConversation } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { SUPPORT_MESSAGES_PAGINATION } from '@/config/pagination.constants';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  kind: true,
  content: true,
  createdAt: true,
  // Null for an AUTOMATED message (no human sender) — the service layer
  // maps that to a "system" sender rather than a real username/role.
  sender: { select: { username: true, role: true } },
  attachment: {
    select: {
      kind: true,
      objectKey: true,
      mimeType: true,
      sizeBytes: true,
      fileName: true,
      durationMs: true,
      width: true,
      height: true,
    },
  },
} as const;

type CreateMessageInput = {
  conversationId: string;
  senderId: string;
  content: string | null;
  attachment?: {
    kind: SupportAttachmentKind;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    fileName?: string | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  };
};

@Injectable()
export class SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversationByUserId(userId: string) {
    return this.prisma.client.supportConversation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Returns null when the user has no email or has opted out of support
  // notification emails — callers treat a null email as "don't send".
  async findUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, emailSupportNotificationsEnabled: true },
    });
    if (!user || !user.emailSupportNotificationsEnabled) return null;
    return user.email;
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user !== null;
  }

  findConversationById(id: string) {
    return this.prisma.client.supportConversation.findUnique({
      where: { id },
    });
  }

  createConversation(userId: string) {
    return this.prisma.client.supportConversation.create({
      data: { userId },
    });
  }

  async getOrCreateConversationForUser(userId: string) {
    const { conversation } = await this.resolveConversationForUser(userId);
    return conversation;
  }

  // Same as getOrCreateConversationForUser, but also reports whether this
  // call is the one that created the row — the one signal
  // SupportAutomationService needs to decide whether to fire "first
  // contact" automations (welcome message today). Race-safe: two
  // concurrent callers (a socket connect and a REST fetch landing at the
  // same instant, say) can both pass the initial findFirst and both
  // attempt to create — the @@unique([userId]) constraint lets exactly one
  // create() succeed, the other catches the conflict and re-fetches.
  async resolveConversationForUser(
    userId: string,
  ): Promise<{ conversation: SupportConversation; isNew: boolean }> {
    const existing = await this.findConversationByUserId(userId);
    if (existing) return { conversation: existing, isNew: false };
    try {
      const conversation = await this.createConversation(userId);
      return { conversation, isNew: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const conversation = await this.findConversationByUserId(userId);
      // Should always exist at this point (the constraint only rejects our
      // insert because a concurrent insert just committed one) — but never
      // silently swallow a genuine "still missing" state.
      if (!conversation) throw error;
      return { conversation, isNew: false };
    }
  }

  // Most recent page, in display order (oldest→newest). `id` is a uuidv7
  // (time-ordered by construction), so ordering/filtering by it is
  // equivalent to createdAt but collision-free under concurrent sends —
  // see the schema comment on SupportMessage.
  async listRecentMessages(
    conversationId: string,
    limit: number = SUPPORT_MESSAGES_PAGINATION.defaultLimit,
  ) {
    const rows = await this.prisma.client.supportMessage.findMany({
      where: { conversationId },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: MESSAGE_SELECT,
    });
    const hasMore = rows.length > limit;
    return { messages: rows.slice(0, limit).reverse(), hasMore };
  }

  // "Load older messages" — strictly before the given message, same page
  // shape as listRecentMessages.
  async listMessagesBefore(
    conversationId: string,
    beforeMessageId: string,
    limit: number = SUPPORT_MESSAGES_PAGINATION.defaultLimit,
  ) {
    const rows = await this.prisma.client.supportMessage.findMany({
      where: { conversationId, id: { lt: beforeMessageId } },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: MESSAGE_SELECT,
    });
    const hasMore = rows.length > limit;
    return { messages: rows.slice(0, limit).reverse(), hasMore };
  }

  async createMessage(input: CreateMessageInput) {
    const { attachment, ...messageInput } = input;
    const [message] = await this.prisma.client.$transaction([
      this.prisma.client.supportMessage.create({
        data: {
          ...messageInput,
          ...(attachment ? { attachment: { create: attachment } } : {}),
        },
        select: MESSAGE_SELECT,
      }),
      this.prisma.client.supportConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          status: SupportConversationStatus.OPEN,
        },
      }),
    ]);
    return message;
  }

  // Idempotent by construction: the @@unique([conversationId, automationKey])
  // constraint means at most one row for a given automation ever exists per
  // conversation. A conflict (already sent — reconnect, retry, a race
  // between two trigger points) is swallowed and reported as `null` rather
  // than thrown; the caller treats that as "nothing to emit", not an error.
  async createAutomatedMessageIfAbsent(input: {
    conversationId: string;
    automationKey: string;
    content: string;
  }) {
    try {
      const [message] = await this.prisma.client.$transaction([
        this.prisma.client.supportMessage.create({
          data: {
            conversationId: input.conversationId,
            kind: SupportMessageKind.AUTOMATED,
            automationKey: input.automationKey,
            content: input.content,
            // senderId intentionally omitted — null, no human sender.
          },
          select: MESSAGE_SELECT,
        }),
        this.prisma.client.supportConversation.update({
          where: { id: input.conversationId },
          data: { lastMessageAt: new Date() },
        }),
      ]);
      return message;
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  markReadByUser(conversationId: string) {
    return this.prisma.client.supportConversation.update({
      where: { id: conversationId },
      data: { userReadAt: new Date() },
    });
  }

  markReadByAdmin(conversationId: string) {
    return this.prisma.client.supportConversation.update({
      where: { id: conversationId },
      data: { adminReadAt: new Date() },
    });
  }

  setStatus(conversationId: string, status: SupportConversationStatus) {
    return this.prisma.client.supportConversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  // Count of admin (+ automated) messages the user hasn't read yet — powers
  // the Inbox nav badge for operators. `senderId: { not: userId }` alone
  // would silently exclude AUTOMATED messages: NULL compared with `<>` is
  // neither true nor false in SQL, so a plain "not equals" drops NULL rows
  // instead of counting them — the explicit `OR` below is what makes a
  // welcome/automated message actually show up as unread.
  async countUnreadForUser(userId: string): Promise<number> {
    const conversation = await this.findConversationByUserId(userId);
    if (!conversation) return 0;
    return this.prisma.client.supportMessage.count({
      where: {
        conversationId: conversation.id,
        OR: [{ senderId: null }, { senderId: { not: userId } }],
        ...(conversation.userReadAt
          ? { createdAt: { gt: conversation.userReadAt } }
          : {}),
      },
    });
  }

  // Sum of per-conversation unread counts across every conversation — powers
  // the Inbox nav badge for admins. Same per-conversation definition as
  // listConversationsForAdmin, just totalled instead of listed.
  async countUnreadForAdmin(): Promise<number> {
    const conversations = await this.prisma.client.supportConversation.findMany(
      { select: { id: true, userId: true, adminReadAt: true } },
    );
    const counts = await Promise.all(
      conversations.map((conversation) =>
        this.prisma.client.supportMessage.count({
          where: {
            conversationId: conversation.id,
            senderId: conversation.userId,
            ...(conversation.adminReadAt
              ? { createdAt: { gt: conversation.adminReadAt } }
              : {}),
          },
        }),
      ),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }

  // Inbox listing — one row per conversation, with the last message and an
  // unread count (messages from the user created after the admin's read
  // watermark). Kept as two queries rather than a single complex join since
  // volume is tiny (one row per conversation, not per message).
  async listConversationsForAdmin() {
    const conversations = await this.prisma.client.supportConversation.findMany(
      {
        orderBy: { lastMessageAt: 'desc' },
        include: {
          user: {
            select: { username: true, fullName: true, avatarUrl: true },
          },
        },
      },
    );

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const [lastMessage, unreadCount] = await Promise.all([
          this.prisma.client.supportMessage.findFirst({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            select: MESSAGE_SELECT,
          }),
          this.prisma.client.supportMessage.count({
            where: {
              conversationId: conversation.id,
              senderId: conversation.userId,
              ...(conversation.adminReadAt
                ? { createdAt: { gt: conversation.adminReadAt } }
                : {}),
            },
          }),
        ]);
        return { conversation, lastMessage, unreadCount };
      }),
    );

    return results;
  }
}
