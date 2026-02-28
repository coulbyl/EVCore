import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Market } from '@evcore/db';
import { RiskService } from './risk.service';

@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Post('check/:market')
  @HttpCode(HttpStatus.OK)
  async checkMarket(
    @Param('market') market: Market,
  ): Promise<{
    market: Market;
    betCount: number;
    roi: string;
    action: string;
  }> {
    const result = await this.risk.checkMarketRoi(market);
    return {
      market: result.market,
      betCount: result.betCount,
      roi: result.roi.toFixed(4),
      action: result.action,
    };
  }

  @Get('suspension/:market')
  async getSuspension(
    @Param('market') market: Market,
  ): Promise<{ market: Market; suspended: boolean }> {
    const suspended = await this.risk.isMarketSuspended(market);
    return { market, suspended };
  }

  @Post('report/weekly')
  @HttpCode(HttpStatus.OK)
  async weeklyReport(): Promise<{
    roiOneXTwo: string;
    betsPlaced: number;
    periodStart: string;
    periodEnd: string;
  }> {
    const result = await this.risk.generateWeeklyReport();
    return {
      roiOneXTwo: result.roiOneXTwo.toFixed(4),
      betsPlaced: result.betsPlaced,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
    };
  }
}
