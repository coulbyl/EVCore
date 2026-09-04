import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [PrismaModule, NotificationModule, AuthModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
