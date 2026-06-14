import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { createLogger } from '@utils/logger';
import { MlService } from './ml.service';

const logger = createLogger('ml-scheduler-worker');

@Processor(BULLMQ_QUEUES.ML_SCHEDULER)
export class MlSchedulerWorker extends WorkerHost {
  constructor(private readonly ml: MlService) {
    super();
  }

  async process(job: Job): Promise<void> {
    logger.info({ jobName: job.name }, 'ML scheduler job received');
    if (job.name === 'ml-retrain-check') {
      const result = await this.ml.triggerRetrainIfNeeded(
        `scheduler:${job.id}`,
      );
      logger.info(result, 'ML retrain check complete');
    } else if (job.name === 'ml-catch-up-switch') {
      await this.ml.catchUpAutoSwitch();
      logger.info('ML catch-up auto-switch complete');
    }
  }
}
