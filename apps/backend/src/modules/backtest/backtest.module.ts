import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BacktestController } from './backtest.controller';
import { BacktestRepository } from './backtest.repository';
import { ChannelBacktestService } from './channel-backtest.service';
import { ModelCalibrationService } from './model-calibration.service';
import { ChannelTuningService } from './channel-tuning.service';

@Module({
  imports: [PrismaModule],
  controllers: [BacktestController],
  providers: [
    BacktestRepository,
    ChannelBacktestService,
    ModelCalibrationService,
    ChannelTuningService,
  ],
})
export class BacktestModule {}
