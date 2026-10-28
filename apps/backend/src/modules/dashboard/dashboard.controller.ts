import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { DashboardService } from './dashboard.service';
import type {
  AiTrackRecord,
  ChannelCompetitionStatItem,
  ChannelHealthItem,
  ChannelStatsItem,
  TrackRecordSummary,
} from './dashboard.types';

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

// The track-record view (aggregate channel ROI/hit-rate) lives inside the
// authenticated dashboard, not a public page — every route here requires at
// least a free-tier session. Never reuse these for a logged-out surface;
// add a dedicated public endpoint instead if that's needed later.
@Controller('dashboard')
@UseGuards(AuthSessionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseGuards(AdminGuard)
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query.pnlDate);
  }

  @Get('track-record-summary')
  getTrackRecordSummary(
    @Query() query: PnlQueryDto,
  ): Promise<TrackRecordSummary> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getTrackRecordSummary(from, to);
  }

  @Get('competition-stats')
  @UseGuards(AdminGuard)
  getCompetitionStats(@Query('canal') canal?: string) {
    const canalFilter =
      canal === 'VALUE' || canal === 'SAFE' ? canal : undefined;
    return this.dashboardService.getCompetitionStats(canalFilter);
  }

  @Get('leaderboard')
  @UseGuards(AdminGuard)
  getLeaderboard() {
    return this.dashboardService.getLeaderboard();
  }

  @Get('channel-health')
  getChannelHealth(@Query() query: PnlQueryDto): Promise<ChannelHealthItem[]> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getChannelHealth(from, to);
  }

  @Get('channel-stats')
  getChannelStats(@Query() query: PnlQueryDto): Promise<ChannelStatsItem[]> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getChannelStats(from, to);
  }

  /** Bilan de l'IA : joueurs compris, comme les autres bilans publics. */
  @Get('ai-track-record')
  getAiTrackRecord(@Query() query: PnlQueryDto): Promise<AiTrackRecord> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getAiTrackRecord(from, to);
  }

  @Get('channel-stats-by-competition')
  getChannelStatsByCompetition(
    @Query() query: PnlQueryDto,
  ): Promise<ChannelCompetitionStatItem[]> {
    const { from, to } = this.defaultRange(query);
    return this.dashboardService.getChannelStatsByCompetition(from, to);
  }

  private defaultRange(query: PnlQueryDto): { from: string; to: string } {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { from: query.from ?? thirtyDaysAgo, to: query.to ?? today };
  }
}
