import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { MailModule } from '@modules/mail/mail.module';
import { PushModule } from '@modules/push/push.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { StorageModule } from '@modules/storage/storage.module';
import { SupportController } from './support.controller';
import { AdminSupportController } from './admin-support.controller';
import { SupportService } from './support.service';
import { SupportRepository } from './support.repository';
import { SupportGateway } from './support.gateway';
import { SupportNotifierService } from './support-notifier.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    PushModule,
    NotificationModule,
    StorageModule,
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [
    SupportService,
    SupportRepository,
    SupportGateway,
    SupportNotifierService,
  ],
})
export class SupportModule {}
