import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { MailModule } from '@modules/mail/mail.module';
import { PushModule } from '@modules/push/push.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PrismaModule, MailModule, PushModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
