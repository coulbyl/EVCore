import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { MailModule } from '@modules/mail/mail.module';
import { SupportController } from './support.controller';
import { AdminSupportController } from './admin-support.controller';
import { SupportService } from './support.service';
import { SupportRepository } from './support.repository';
import { SupportGateway } from './support.gateway';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, SupportRepository, SupportGateway],
})
export class SupportModule {}
