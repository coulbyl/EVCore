import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Response } from 'express';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import type { AuthenticatedRequest } from '@modules/auth/auth.types';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { ChatService } from './chat.service';
import {
  ConversationParamDto,
  CreateConversationDto,
  CreateMessageDto,
} from './dto/create-message.dto';
import type { ChatStreamEvent } from './chat.types';

type ChatRequest = AuthenticatedRequest & {
  params: { id: string };
};

@ApiTags('chat')
@UseGuards(AuthSessionGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create an EVA conversation' })
  createConversation(
    @CurrentSession() session: AuthSession,
    @Body() body: CreateConversationDto,
  ) {
    return this.chat.createConversation({
      userId: session.user.id,
      content: body.content,
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user EVA conversations' })
  listConversations(@CurrentSession() session: AuthSession) {
    return this.chat.listConversations(session.user.id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages for one EVA conversation' })
  listMessages(
    @CurrentSession() session: AuthSession,
    @Param() params: ConversationParamDto,
  ) {
    return this.chat.listMessages({
      userId: session.user.id,
      conversationId: params.id,
    });
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one EVA conversation' })
  async deleteConversation(
    @CurrentSession() session: AuthSession,
    @Param() params: ConversationParamDto,
  ) {
    await this.chat.deleteConversation({
      userId: session.user.id,
      conversationId: params.id,
    });
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message to EVA and stream SSE events' })
  @ApiOkResponse({ description: 'text/event-stream' })
  async streamMessage(
    @Req() request: ChatRequest,
    @Body() body: CreateMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    const session = request.authSession;
    if (!session) throw new NotFoundException('Session introuvable');

    // Validate before any SSE header is flushed so failures stay clean HTTP
    // errors (the @Req signature bypasses ConversationParamDto).
    const conversationId = request.params.id;
    if (!isUUID(conversationId)) {
      throw new BadRequestException('Identifiant de conversation invalide');
    }
    await this.chat.ensureUserConversation({
      userId: session.user.id,
      conversationId,
    });
    await this.chat.assertChatQuota(session.user.id);

    response.setHeader('content-type', 'text/event-stream; charset=utf-8');
    response.setHeader('cache-control', 'no-cache, no-transform');
    response.setHeader('connection', 'keep-alive');
    response.flushHeaders?.();

    const write = (event: ChatStreamEvent) => {
      if (response.destroyed || response.writableEnded) return;
      response.write(`event: ${event.event}\n`);
      response.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    await this.chat.sendMessage({
      user: {
        id: session.user.id,
        role: session.user.role,
        currency: session.user.currency,
      },
      conversationId,
      content: body.content,
      write,
      isAborted: () => response.destroyed || response.writableEnded,
    });

    response.end();
  }

  // The actual interruption happens when the client aborts the SSE request
  // (sendMessage checks the connection state); this endpoint is just an ack.
  @Post('conversations/:id/stop')
  @HttpCode(202)
  @ApiOperation({ summary: 'Acknowledge an EVA generation stop' })
  async stopGeneration(
    @CurrentSession() session: AuthSession,
    @Param() params: ConversationParamDto,
  ) {
    await this.chat.ensureUserConversation({
      userId: session.user.id,
      conversationId: params.id,
    });
    return { accepted: true };
  }
}
