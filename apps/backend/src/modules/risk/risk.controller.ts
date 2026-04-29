import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { Market } from '@evcore/db';
import { RiskService } from './risk.service';
import { MarketParamDto } from './dto/market-param.dto';
import { RoiCheckResponseDto } from './dto/roi-check-response.dto';
import { SuspensionResponseDto } from './dto/suspension-response.dto';
import { WeeklyReportResponseDto } from './dto/weekly-report-response.dto';

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
