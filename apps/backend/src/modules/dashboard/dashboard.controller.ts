import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { DashboardService } from './dashboard.service';
import type { PnlPeriod } from './dashboard.types';

class DashboardSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  pnlDate?: string;
}

class PnlQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'all'])
  period?: PnlPeriod;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query.pnlDate);
  }

  @Get('pnl')
  getPnlByCanal(@Query() query: PnlQueryDto) {
    return this.dashboardService.getPnlByCanal(query.period ?? '30d');
  }

  @Get('competition-stats')
  @UseGuards(AuthSessionGuard)
  getCompetitionStats(
    @CurrentSession() session: AuthSession,
    @Query('canal') canal?: string,
  ) {
    const canalFilter = canal === 'EV' || canal === 'SV' ? canal : undefined;
    return this.dashboardService.getCompetitionStats(
      session.user.id,
      canalFilter,
    );
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.dashboardService.getLeaderboard();
  }
}
