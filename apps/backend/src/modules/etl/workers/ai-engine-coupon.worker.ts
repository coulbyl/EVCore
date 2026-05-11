import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';
import type { AiEngineJobData } from './betting-engine-analysis.worker';

const logger = createLogger('ai-engine-coupon-worker');

@Processor(BULLMQ_QUEUES.AI_ENGINE)
export class AiEngineCouponWorker extends WorkerHost {
  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<AiEngineJobData>): Promise<void> {
    const { date } = job.data;
    logger.info({ date }, 'Starting AI engine coupon generation');
    await this.aiEngine.generateCoupons(date);
    logger.info({ date }, 'AI engine coupon generation complete');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiEngineJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.AI_ENGINE,
      job,
      error,
      logger,
    });
  }
}
