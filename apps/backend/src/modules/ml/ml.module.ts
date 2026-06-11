import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';
import { MlRepository } from './ml.repository';
import { MlBackfillService } from './ml.backfill.service';
import { MlBackfillWorker } from './ml.backfill.worker';
import { MlSchedulerWorker } from './ml.scheduler.worker';
import { MlTrainingEventsListener } from './ml.training-events.listener';
import { MlInferenceModule } from './ml.inference.module';
import {
  ML_CRON_SCHEDULES,
  ML_SCHEDULER_KEYS,
  ML_TRAINING_JOB_OPTIONS,
} from './ml.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_TRAINING }),
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_BACKFILL }),
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_SCHEDULER }),
    AuthModule,
    BettingEngineModule,
    NotificationModule,
    MlInferenceModule,
  ],
  controllers: [MlController],
  providers: [
    MlService,
    MlRepository,
    MlBackfillService,
    MlBackfillWorker,
    MlSchedulerWorker,
    MlTrainingEventsListener,
  ],
  exports: [MlService],
})
export class MlModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(BULLMQ_QUEUES.ML_SCHEDULER)
    private readonly schedulerQueue: Queue,
    private readonly mlService: MlService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.schedulerQueue.upsertJobScheduler(
      ML_SCHEDULER_KEYS.RETRAIN_CHECK,
      { pattern: ML_CRON_SCHEDULES.RETRAIN_CHECK },
      { name: 'ml-retrain-check', data: {}, opts: ML_TRAINING_JOB_OPTIONS },
    );
    // Catch up on any models trained while the backend was down (QueueEvents starts at $)
    await this.mlService.catchUpAutoSwitch();
  }
}
