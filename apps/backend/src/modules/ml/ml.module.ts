import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { MlService } from './ml.service';
import { MlRepository } from './ml.repository';
import { MlSchedulerWorker } from './ml.scheduler.worker';
import { MlTrainingEventsListener } from './ml.training-events.listener';
import { MlInferenceModule } from './ml.inference.module';
import { ML_SCHEDULER_KEYS } from './ml.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_TRAINING }),
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_SCHEDULER }),
    AuthModule,
    BettingEngineModule,
    NotificationModule,
    MlInferenceModule,
  ],
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
    // The ML is retired (ML-UTILITE § 4, decided again on 2026-11-01): the
    // correction is off and the ml-worker container is no longer deployed,
    // so nothing is scheduled. The schedulers a running deployment holds
    // in Redis are removed; the code stays until the ML v2 batch.
    for (const key of Object.values(ML_SCHEDULER_KEYS)) {
      await this.schedulerQueue.removeJobScheduler(key);
    }
  }
}
