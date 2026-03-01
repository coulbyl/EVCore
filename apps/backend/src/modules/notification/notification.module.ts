import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { MailModule } from '@modules/mail/mail.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
