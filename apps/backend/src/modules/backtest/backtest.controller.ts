import { Controller, HttpCode, HttpStatus, Query, Post } from '@nestjs/common';
import { ChannelBacktestService } from './channel-backtest.service';
import { ModelCalibrationService } from './model-calibration.service';
import { ChannelTuningService } from './channel-tuning.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly channelBacktest: ChannelBacktestService,
    private readonly modelCalibration: ModelCalibrationService,
    private readonly channelTuning: ChannelTuningService,
  ) {}

  // Per-channel × competition backtest (reads channel_selection).
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
}
