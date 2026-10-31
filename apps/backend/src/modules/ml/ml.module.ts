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
    MlSchedulerWorker,
    MlTrainingEventsListener,
  ],
  exports: [MlService],
})
export class MlModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(BULLMQ_QUEUES.ML_SCHEDULER)
    private readonly schedulerQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // No scheduled retraining (docs/audits/2026-10-29/ML-UTILITE.md § 4):
    // the correction is off and no new source is collected, so Monday's
    // retrain only spent a pass. The scheduler a running deployment holds
    // in Redis is removed; a manual train stays possible from the admin.
    await this.schedulerQueue.removeJobScheduler(
      ML_SCHEDULER_KEYS.RETRAIN_CHECK,
    );
    await this.schedulerQueue.upsertJobScheduler(
      ML_SCHEDULER_KEYS.CATCH_UP_SWITCH,
      { pattern: ML_CRON_SCHEDULES.CATCH_UP_SWITCH },
      { name: 'ml-catch-up-switch', data: {}, opts: ML_TRAINING_JOB_OPTIONS },
    );
    await this.schedulerQueue.upsertJobScheduler(
      ML_SCHEDULER_KEYS.HEALTH_CHECK,
      { pattern: ML_CRON_SCHEDULES.HEALTH_CHECK },
      { name: 'ml-health-check', data: {}, opts: ML_TRAINING_JOB_OPTIONS },
    );
  }
}
