import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { GridSearchService } from './grid-search.service';
import { InvestmentBacktestService } from './investment-backtest.service';

@Module({
  imports: [PrismaModule, BettingEngineModule],
  controllers: [BacktestController],
  providers: [BacktestService, GridSearchService, InvestmentBacktestService],
  exports: [BacktestService, InvestmentBacktestService],
})
export class BacktestModule {}
