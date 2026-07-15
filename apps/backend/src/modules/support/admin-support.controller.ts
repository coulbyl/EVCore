import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { SupportService } from './support.service';
import { SendMessageDto } from './dto/send-message.dto';
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

  @Post('conversations/:id/messages')
  @HttpCode(200)
  sendMessage(
    @Param('id') conversationId: string,
    @CurrentSession() session: AuthSession,
    @Body() body: SendMessageDto,
  ) {
    return this.service.sendAsAdmin(
      conversationId,
      session.user.id,
      body.content,
    );
  }

  @Post('conversations/:id/read')
  @HttpCode(200)
  async markRead(@Param('id') conversationId: string): Promise<{ ok: true }> {
    await this.service.markReadByAdmin(conversationId);
    return { ok: true };
  }
}
