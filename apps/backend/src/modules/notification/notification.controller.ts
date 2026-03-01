import { Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import type { Notification } from '@evcore/db';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationService } from './notification.service';

type PaginatedNotifications = {
  data: Notification[];
  total: number;
  limit: number;
  offset: number;
};

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@Query() query: NotificationQueryDto): Promise<PaginatedNotifications> {
    return this.notificationService.list({
      limit: query.limit,
      offset: query.offset,
      unread: query.unread,
    });
  }

  @Patch('read-all')
  @HttpCode(204)
  markAllRead(): Promise<void> {
    return this.notificationService.markAllRead();
  }

  @Patch(':id/read')
  @HttpCode(204)
  markRead(@Param('id') id: string): Promise<void> {
    return this.notificationService.markRead(id);
  }
}
