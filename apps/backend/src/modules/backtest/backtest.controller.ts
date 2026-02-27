import { Controller, Param, Post } from '@nestjs/common';
import { BacktestService } from './backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post('run/:seasonId')
  runSeason(@Param('seasonId') seasonId: string) {
    return this.backtestService.runBacktest(seasonId);
  }
}
