import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PushModule } from '@modules/push/push.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AnnouncementsController } from './announcements.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule, NotificationModule],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService, AnnouncementsRepository],
})
export class AnnouncementsModule {}
