import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
  // DashboardService.getChannelHealth (calibrationRatio) is reused by
  // SubscriptionsService.getCatalog — see subscriptions.module.ts.
  exports: [DashboardService],
})
export class DashboardModule {}
