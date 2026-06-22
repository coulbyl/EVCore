import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { GridSearchService } from './grid-search.service';
import { ChannelBacktestService } from './channel-backtest.service';
import { ModelCalibrationService } from './model-calibration.service';
import { ChannelTuningService } from './channel-tuning.service';

@Controller('backtest')
export class BacktestController {
  // eslint-disable-next-line max-params -- Explicit NestJS service injection.
  constructor(
    private readonly backtestService: BacktestService,
    private readonly gridSearchService: GridSearchService,
    private readonly channelBacktest: ChannelBacktestService,
    private readonly modelCalibration: ModelCalibrationService,
    private readonly channelTuning: ChannelTuningService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  runAll() {
    return this.backtestService.runAllCompetitions();
  }

  // Per-channel × competition backtest (redesigned, reads channel_selection).
  @Post('channels')
  @HttpCode(HttpStatus.OK)
  runChannels(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('competitionCode') competitionCode?: string,
  ) {
    return this.channelBacktest.run({ from, to, competitionCode });
  }

  // Offline threshold tuning → recommends CHANNEL_STRATEGY_CONFIG (advisory).
  @Post('tuning')
  @HttpCode(HttpStatus.OK)
  runTuning(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('competitionCode') competitionCode?: string,
  ) {
    return this.channelTuning.run({ from, to, competitionCode });
  }

  // Model-quality (Brier/ECE) backtest — channel-agnostic, reads model_run.
  @Post('calibration')
  @HttpCode(HttpStatus.OK)
  runCalibration(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('competitionCode') competitionCode?: string,
  ) {
    return this.modelCalibration.run({ from, to, competitionCode });
  }

  // Declared before `:competitionCode` so NestJS matches the static path first.
  @Post('grid-search/:competitionCode')
  @HttpCode(HttpStatus.OK)
  runGridSearch(@Param('competitionCode') competitionCode: string) {
    return this.gridSearchService.runGridSearch(competitionCode);
  }

  @Post('safe-value')
  @HttpCode(HttpStatus.OK)
  runSafeValueBacktest() {
    return this.backtestService.runAllSeasonsSafeValueBacktest();
  }

  @Post(':competitionCode')
  @HttpCode(HttpStatus.OK)
  runCompetition(@Param('competitionCode') competitionCode: string) {
    return this.backtestService.runCompetitionBacktest(competitionCode);
  }

  @Post(':competitionCode/:seasonName')
  @HttpCode(HttpStatus.OK)
  runCompetitionSeason(
    @Param('competitionCode') competitionCode: string,
    @Param('seasonName') seasonName: string,
  ) {
    return this.backtestService.runCompetitionBacktest(
      competitionCode,
      seasonName,
    );
  }
}
