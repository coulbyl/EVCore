import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
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

  @Get('competition-stats')
  @UseGuards(AuthSessionGuard)
  getCompetitionStats(@CurrentSession() session: AuthSession) {
    return this.dashboardService.getCompetitionStats(session.user.id);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.dashboardService.getLeaderboard();
  }
}
