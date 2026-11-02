import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PUSH_DELIVERY } from '@config/push.constants';
import { createLogger } from '@utils/logger';
import { PushService, type PushDeliveryJobData } from './push.service';

const logger = createLogger('push-delivery-worker');

/** Sends the queued pushes, one device per job (worker process only). */
@Processor(PUSH_DELIVERY.QUEUE, { concurrency: PUSH_DELIVERY.CONCURRENCY })
export class PushDeliveryWorker extends WorkerHost {
  constructor(private readonly push: PushService) {
    super();
  }

  async process(
    job: Job<PushDeliveryJobData>,
  ): Promise<'sent' | 'gone' | 'refused' | 'skipped'> {
    const [subscription, vapid] = await Promise.all([
      this.push.findSubscription(job.data.subscriptionId),
      this.push.vapid(),
    ]);
    // Unsubscribed since, or push turned off: nothing to send.
    if (!subscription || !vapid) return 'skipped';
    return this.push.deliverOne({
      subscription,
      payload: job.data.payload,
      vapid,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PushDeliveryJobData> | undefined, error: Error): void {
    logger.warn(
      {
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: error.message,
      },
      'Push delivery failed',
    );
  }
}
