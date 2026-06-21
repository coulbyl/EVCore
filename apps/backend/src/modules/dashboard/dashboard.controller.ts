import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { DashboardService } from './dashboard.service';
import type { ChannelHealthItem, ChannelStatsItem } from './dashboard.types';

class DashboardSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  pnlDate?: string;
}

class PnlQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
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
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return this.dashboardService.getPnlByCanal(
      query.from ?? thirtyDaysAgo,
      query.to ?? today,
    );
  }

  @Get('competition-stats')
  @UseGuards(AuthSessionGuard)
  getCompetitionStats(
    @CurrentSession() session: AuthSession,
    @Query('canal') canal?: string,
  ) {
    const canalFilter =
      canal === 'VALUE' || canal === 'SAFE' ? canal : undefined;
    return this.dashboardService.getCompetitionStats(
      session.user.id,
      canalFilter,
    );
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.dashboardService.getLeaderboard();
  }

  @Get('channel-health')
  getChannelHealth(): Promise<ChannelHealthItem[]> {
    return this.dashboardService.getChannelHealth();
  }

  @Get('channel-stats')
  getChannelStats(): Promise<ChannelStatsItem[]> {
    return this.dashboardService.getChannelStats();
  }
}
