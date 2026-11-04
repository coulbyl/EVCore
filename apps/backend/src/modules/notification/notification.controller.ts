import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthSession } from '@modules/auth/auth.types';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationReadAllDto } from './dto/notification-read-all.dto';
import {
  NotificationService,
  type NotificationView,
} from './notification.service';

type PaginatedNotifications = {
  data: NotificationView[];
  total: number;
  limit: number;
  offset: number;
};

@Controller('notifications')
@UseGuards(AuthSessionGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @Query() query: NotificationQueryDto,
    @CurrentSession() session: AuthSession,
  ): Promise<PaginatedNotifications> {
    return this.notificationService.list({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      category: query.category,
      type: query.type,
      userId: session.user.id,
      role: session.user.role,
    });
  }

  @Get('unread-count')
  unreadCount(
    @CurrentSession() session: AuthSession,
  ): Promise<{ count: number }> {
    return this.notificationService.unreadCount(
      session.user.id,
      session.user.role,
    );
  }

  /** « Tout marquer comme lu » (the screen's kind filter in the query). */
  @Post('read-all')
  @HttpCode(200)
  markAllRead(
    @Query() query: NotificationReadAllDto,
    @CurrentSession() session: AuthSession,
  ): Promise<{ marked: number }> {
    return this.notificationService.markAllRead({
      userId: session.user.id,
      role: session.user.role,
      category: query.category,
    });
  }

  @Patch(':id/read')
  @HttpCode(204)
  markRead(
    @Param('id') id: string,
    @CurrentSession() session: AuthSession,
  ): Promise<void> {
    return this.notificationService.markRead(id, session.user.id);
  }
}
