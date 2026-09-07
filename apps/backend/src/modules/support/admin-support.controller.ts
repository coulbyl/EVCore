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
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { SupportService } from './support.service';
import {
  RequestAttachmentUploadUrlDto,
  SendMessageDto,
} from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

// Admin inbox — one conversation per operator, all visible here.
@Controller('admin/support')
@UseGuards(AuthSessionGuard, AdminGuard)
export class AdminSupportController {
  constructor(private readonly service: SupportService) {}

  @Get('conversations')
  listConversations() {
    return this.service.listConversationsForAdmin();
  }

  @Get('unread-count')
  async getUnreadCount(): Promise<{ count: number }> {
    const count = await this.service.getUnreadCountForAdmin();
    return { count };
  }

  // Admin-initiated contact — starts (or resumes) a conversation with a
  // chosen user without waiting for them to write first.
  @Post('conversations')
  @HttpCode(200)
  startConversation(@Body() body: StartConversationDto) {
    return this.service.startConversationWithUser(body.userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') conversationId: string) {
    return this.service.getMessagesForAdmin(conversationId);
  }

  // "Load older messages" — the thread only ever opens with the latest page
  // (see getMessages); this fetches the page before a given message id.
  @Get('conversations/:id/messages/before/:messageId')
  loadOlderMessages(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.loadOlderMessages(
      conversationId,
      messageId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('conversations/:id/messages')
  @HttpCode(200)
  sendMessage(
    @Param('id') conversationId: string,
    @CurrentSession() session: AuthSession,
    @Body() body: SendMessageDto,
  ) {
    return this.service.sendAsAdmin(conversationId, session.user.id, body);
  }

  // Returns a presigned URL the client PUTs the file to directly — see
  // StorageService.
  @Post('conversations/:id/attachments/upload-url')
  @HttpCode(200)
  requestUploadUrl(
    @Param('id') conversationId: string,
    @Body() body: RequestAttachmentUploadUrlDto,
  ) {
    return this.service.createAttachmentUploadUrl({ conversationId, ...body });
  }

  @Post('conversations/:id/read')
  @HttpCode(200)
  async markRead(@Param('id') conversationId: string): Promise<{ ok: true }> {
    await this.service.markReadByAdmin(conversationId);
    return { ok: true };
  }
}
