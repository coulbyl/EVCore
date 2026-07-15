import { Injectable } from '@nestjs/common';
import { SupportConversationStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
  sender: { select: { username: true, role: true } },
} as const;

@Injectable()
export class SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversationByUserId(userId: string) {
    return this.prisma.client.supportConversation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
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
    const existing = await this.findConversationByUserId(userId);
    if (existing) return existing;
    return this.createConversation(userId);
  }

  listMessages(conversationId: string) {
    return this.prisma.client.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: MESSAGE_SELECT,
    });
  }

  async createMessage(input: {
    conversationId: string;
    senderId: string;
    content: string;
  }) {
    const [message] = await this.prisma.client.$transaction([
      this.prisma.client.supportMessage.create({
        data: input,
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

  // Count of admin messages the user hasn't read yet — powers the Inbox nav
  // badge for operators.
  async countUnreadForUser(userId: string): Promise<number> {
    const conversation = await this.findConversationByUserId(userId);
    if (!conversation) return 0;
    return this.prisma.client.supportMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
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
