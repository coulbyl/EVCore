import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

type CreateMessageInput = {
  conversationId: string;
  role: string;
  content: string;
  toolName?: string | null;
  toolArgs?: Prisma.InputJsonValue;
  inputTokens?: number;
  outputTokens?: number;
  model?: string | null;
  promptVersion?: string | null;
};

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  createConversation(input: { userId: string; title?: string | null }) {
    return this.prisma.client.chatConversation.create({
      data: {
        userId: input.userId,
        title: input.title ?? null,
      },
    });
  }

  findUserConversations(userId: string) {
    return this.prisma.client.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
    });
  }

  findUserConversation(input: { userId: string; conversationId: string }) {
    return this.prisma.client.chatConversation.findFirst({
      where: { id: input.conversationId, userId: input.userId },
    });
  }

  async deleteUserConversation(input: {
    userId: string;
    conversationId: string;
  }): Promise<boolean> {
    const conversation = await this.findUserConversation(input);
    if (!conversation) return false;
    await this.prisma.client.chatConversation.delete({
      where: { id: input.conversationId },
    });
    return true;
  }

  findMessages(conversationId: string, take = 50) {
    return this.prisma.client.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  findRecentMessages(conversationId: string, take: number) {
    return this.prisma.client.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async createMessage(input: CreateMessageInput) {
    const message = await this.prisma.client.chatMessage.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        toolName: input.toolName ?? null,
        toolArgs: input.toolArgs ?? Prisma.JsonNull,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        model: input.model ?? null,
        promptVersion: input.promptVersion ?? null,
      },
    });

    await this.prisma.client.chatConversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getUsageRequests(input: {
    userId: string;
    day: Date;
  }): Promise<number> {
    const usage = await this.prisma.client.chatUsage.findUnique({
      where: { userId_day: { userId: input.userId, day: input.day } },
      select: { requests: true },
    });
    return usage?.requests ?? 0;
  }

  async incrementUsage(input: {
    userId: string;
    day: Date;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    await this.prisma.client.chatUsage.upsert({
      where: { userId_day: { userId: input.userId, day: input.day } },
      create: {
        userId: input.userId,
        day: input.day,
        requests: 1,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      },
      update: {
        requests: { increment: 1 },
        inputTokens: { increment: input.inputTokens },
        outputTokens: { increment: input.outputTokens },
      },
    });
  }
}
