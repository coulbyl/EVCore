import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/prisma.module';
import { BankrollModule } from '@modules/bankroll/bankroll.module';
import { PredictionModule } from '@modules/prediction/prediction.module';
import { MlInferenceModule } from '@modules/ml/ml.inference.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { BettingEngineService } from './betting-engine.service';
import { BettingEngineController } from './betting-engine.controller';
import { ChannelDecisionController } from './channel-decision.controller';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';
import { FriModelService } from './fri-model/fri-model.service';
import { ChannelDecisionRepository } from './channel-decision.repository';
import { ChannelDecisionService } from './channel-decision.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BankrollModule,
    PredictionModule,
    MlInferenceModule,
    AuthModule,
    BullModule.registerQueue({ name: BULLMQ_QUEUES.BETTING_ENGINE }),
  ],
  controllers: [BettingEngineController, ChannelDecisionController],
  providers: [
    BettingEngineService,
    H2HService,
    CongestionService,
    FriModelService,
    ChannelDecisionRepository,
    ChannelDecisionService,
  ],
  exports: [BettingEngineService, FriModelService],
})
export class BettingEngineModule {}
