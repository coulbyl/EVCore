import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

@Module({
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
