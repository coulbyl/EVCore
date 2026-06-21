import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { GridSearchService } from './grid-search.service';

@Module({
  imports: [PrismaModule, BettingEngineModule],
  controllers: [BacktestController],
  providers: [BacktestService, GridSearchService],
  exports: [BacktestService],
})
export class BacktestModule {}
