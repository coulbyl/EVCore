import { Controller, Get, Query } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { DashboardService } from './dashboard.service';

class DashboardSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  pnlDate?: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query.pnlDate);
  }
}
