import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AnnouncementsController } from './announcements.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
