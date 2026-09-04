import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { Market } from '@evcore/db';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import {
  RiskService,
  type ActiveMarketSuspension,
  type RiskAlert,
} from './risk.service';
import { MarketParamDto } from './dto/market-param.dto';
import { RoiCheckResponseDto } from './dto/roi-check-response.dto';
import { SuspensionResponseDto } from './dto/suspension-response.dto';
import { WeeklyReportResponseDto } from './dto/weekly-report-response.dto';

const RECENT_ALERTS_DEFAULT_DAYS = 7;

@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Post('check/:market')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'market', enum: Market, enumName: 'Market' })
  async checkMarket(
    @Param() { market }: MarketParamDto,
  ): Promise<RoiCheckResponseDto> {
    const result = await this.risk.checkMarketRoi(market);
    return {
      market: result.market,
      betCount: result.betCount,
      roi: result.roi.toFixed(4),
      action: result.action,
    };
  }

  @Get('suspension/:market')
  @ApiParam({ name: 'market', enum: Market, enumName: 'Market' })
  async getSuspension(
    @Param() { market }: MarketParamDto,
  ): Promise<SuspensionResponseDto> {
    const suspended = await this.risk.isMarketSuspended(market);
    return { market, suspended };
  }

  @Get('calibration-curve')
  async calibrationCurve() {
    return this.risk.getCalibrationCurve();
  }

  // Admin-only surfacing of the risk garde-fous (docs/dashboard-operator-
  // admin-redesign-2026-09-04.md étape 2) — unlike the routes above, these
  // two are read-only views for the admin dashboard, not internal/cron
  // targets, so they're guarded explicitly rather than following this
  // controller's existing unguarded routes.
  @Get('suspensions/active')
  @UseGuards(AuthSessionGuard, AdminGuard)
  async activeSuspensions(): Promise<ActiveMarketSuspension[]> {
    return this.risk.listActiveSuspensions();
  }

  @Get('alerts/recent')
  @UseGuards(AuthSessionGuard, AdminGuard)
  async recentAlerts(@Query('days') days?: string): Promise<RiskAlert[]> {
    const parsed = days ? Number.parseInt(days, 10) : NaN;
    const windowDays =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : RECENT_ALERTS_DEFAULT_DAYS;
    return this.risk.getRecentAlerts(windowDays);
  }

  @Post('report/weekly')
  @HttpCode(HttpStatus.OK)
  async weeklyReport(): Promise<WeeklyReportResponseDto> {
    const result = await this.risk.generateWeeklyReport();
    return {
      roiOneXTwo: result.roiOneXTwo.toFixed(4),
      betsPlaced: result.betsPlaced,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
    };
  }
}
