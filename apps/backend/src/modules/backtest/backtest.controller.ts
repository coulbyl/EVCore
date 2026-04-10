import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { BacktestService } from './backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Get('validation-report')
  getValidationReport() {
    const report = this.backtestService.getLatestValidationReport();
    if (!report) {
      throw new NotFoundException(
        'No cached validation report available. Trigger /etl/sync/backtest first.',
      );
    }

    return report;
  }

  @Post('safe-value')
  @HttpCode(HttpStatus.OK)
  runSafeValueBacktest() {
    return this.backtestService.runAllSeasonsSafeValueBacktest();
  }
}
