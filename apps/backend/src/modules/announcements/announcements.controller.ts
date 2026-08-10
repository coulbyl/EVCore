import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { AnnouncementsService } from './announcements.service';

@Controller('dashboard/announcements')
@UseGuards(AuthSessionGuard)
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  listPublished(@CurrentSession() session: AuthSession) {
    return this.service.listPublishedForUser(session.user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentSession() session: AuthSession) {
    return this.service.unreadCountForUser(session.user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ) {
    await this.service.markRead(session.user.id, id);
    return { status: 'ok' as const };
  }
}
