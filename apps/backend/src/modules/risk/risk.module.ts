import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskRepository } from './risk.repository';

@Module({
  imports: [PrismaModule, NotificationModule, AuthModule],
  controllers: [RiskController],
  providers: [RiskService, RiskRepository],
  exports: [RiskService],
})
export class RiskModule {}
