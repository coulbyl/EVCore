import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { SupportService } from './support.service';
import {
  RequestAttachmentUploadUrlDto,
  SendMessageDto,
} from './dto/send-message.dto';

// User-facing: every operator has exactly one conversation with the team,
// resolved implicitly from their session — no conversationId in the URL.
@Controller('support')
@UseGuards(AuthSessionGuard)
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get('conversation')
  getOwnConversation(@CurrentSession() session: AuthSession) {
    return this.service.getOwnConversation(session.user.id);
  }

  // "Load older messages" — the thread only ever opens with the latest
  // page (see getOwnConversation); this fetches the page before a given
  // message id.
  @Get('messages/before/:messageId')
  loadOlderMessages(
    @CurrentSession() session: AuthSession,
    @Param('messageId') messageId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.loadOlderMessagesForUser(
      session.user.id,
      messageId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentSession() session: AuthSession,
  ): Promise<{ count: number }> {
    const count = await this.service.getUnreadCountForUser(session.user.id);
    return { count };
  }

  @Post('messages')
  @HttpCode(200)
  sendMessage(
    @CurrentSession() session: AuthSession,
    @Body() body: SendMessageDto,
  ) {
    return this.service.sendAsUser(session.user.id, body);
  }

  // Returns a presigned URL the client PUTs the file to directly — see
  // StorageService. The returned objectKey is then passed back in the
  // `attachment` field of a subsequent POST /support/messages.
  @Post('attachments/upload-url')
  @HttpCode(200)
  requestUploadUrl(
    @CurrentSession() session: AuthSession,
    @Body() body: RequestAttachmentUploadUrlDto,
  ) {
    return this.service.createAttachmentUploadUrlForUser(session.user.id, body);
  }

  @Post('read')
  @HttpCode(200)
  async markRead(
    @CurrentSession() session: AuthSession,
  ): Promise<{ ok: true }> {
    await this.service.markReadByUser(session.user.id);
    return { ok: true };
  }
}
