import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';
import { MlRepository } from './ml.repository';
import { MlBackfillService } from './ml.backfill.service';
import { MlBackfillWorker } from './ml.backfill.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_TRAINING }),
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_BACKFILL }),
    AuthModule,
    BettingEngineModule,
  ],
  controllers: [MlController],
  providers: [MlService, MlRepository, MlBackfillService, MlBackfillWorker],
  exports: [MlService],
})
export class MlModule {}
