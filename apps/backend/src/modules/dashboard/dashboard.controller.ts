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

  // Worker health + unread alerts — internal ops data, never public.
  @Get('summary')
  @UseGuards(AuthSessionGuard)
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query.pnlDate);
  }

  // Aggregate channel ROI — intentionally unauthenticated: this is the same
  // class of data the public track-record page surfaces. Keep it that way;
  // don't fold in operator/admin-only fields here, add a new endpoint instead.
  @Get('pnl')
  getPnlByCanal(@Query() query: PnlQueryDto) {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getPnlByCanal(from, to);
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

  // Public — username + ROI only, no PII.
  @Get('leaderboard')
  getLeaderboard() {
    return this.dashboardService.getLeaderboard();
  }

  // Public — aggregate per-channel ROI/hit-rate, same class as `pnl` above.
  @Get('channel-health')
  getChannelHealth(@Query() query: PnlQueryDto): Promise<ChannelHealthItem[]> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getChannelHealth(from, to);
  }

  // Public — aggregate per-channel ROI/hit-rate, same class as `pnl` above.
  @Get('channel-stats')
  getChannelStats(@Query() query: PnlQueryDto): Promise<ChannelStatsItem[]> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getChannelStats(from, to);
  }

  private defaultRange(query: PnlQueryDto): { from: string; to: string } {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { from: query.from ?? thirtyDaysAgo, to: query.to ?? today };
  }
}
