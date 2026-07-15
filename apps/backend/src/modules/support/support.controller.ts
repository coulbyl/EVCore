import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { SupportService } from './support.service';
import { SendMessageDto } from './dto/send-message.dto';

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
    return this.service.sendAsUser(session.user.id, body.content);
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
