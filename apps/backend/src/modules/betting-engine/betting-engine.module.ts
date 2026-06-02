import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/prisma.module';
import { BankrollModule } from '@modules/bankroll/bankroll.module';
import { PredictionModule } from '@modules/prediction/prediction.module';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { BettingEngineService } from './betting-engine.service';
import { BettingEngineController } from './betting-engine.controller';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';
import { FriModelService } from './fri-model/fri-model.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BankrollModule,
    PredictionModule,
    BullModule.registerQueue({ name: BULLMQ_QUEUES.BETTING_ENGINE }),
  ],
  controllers: [BettingEngineController],
  providers: [
    BettingEngineService,
    H2HService,
    CongestionService,
    FriModelService,
  ],
  exports: [BettingEngineService, FriModelService],
})
export class BettingEngineModule {}
