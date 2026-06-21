import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { GridSearchService } from './grid-search.service';
import { BacktestRepository } from './backtest.repository';
import { ChannelBacktestService } from './channel-backtest.service';
import { ModelCalibrationService } from './model-calibration.service';

@Module({
  imports: [PrismaModule, BettingEngineModule],
  controllers: [BacktestController],
  providers: [
    BacktestService,
    GridSearchService,
    BacktestRepository,
    ChannelBacktestService,
    ModelCalibrationService,
  ],
  exports: [BacktestService],
})
export class BacktestModule {}
