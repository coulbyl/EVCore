import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { RiskService } from './risk.service';
import { RiskRepository } from './risk.repository';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [RiskService, RiskRepository],
  exports: [RiskService],
})
export class RiskModule {}
