import { Controller, Get, Param, Post } from '@nestjs/common';
import { BacktestService } from './backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post('run/:seasonId')
  runSeason(@Param('seasonId') seasonId: string) {
    return this.backtestService.runBacktest(seasonId);
  }

  @Post('run-all')
  runAllSeasons() {
    return this.backtestService.runAllSeasons();
  }

  @Get('validation-report')
  getValidationReport() {
    return this.backtestService.getValidationReport();
  }
}
