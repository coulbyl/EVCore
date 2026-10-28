import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { createLogger } from '@utils/logger';
import { SlipDigestService, previousUtcDay } from './slip-digest.service';

/** `day` forcé pour un rattrapage manuel ; sinon la veille du passage. */
export type SlipDigestJobData = { day?: string };

const logger = createLogger('slip-digest-worker');

@Processor(SLIP_DIGEST.QUEUE)
export class SlipDigestWorker extends WorkerHost {
  constructor(private readonly service: SlipDigestService) {
    super();
  }

  async process(
    job: Job<SlipDigestJobData>,
  ): Promise<{ sent: number; skippedPaused: number }> {
    return this.service.sendDigests(job.data.day ?? previousUtcDay(new Date()));
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SlipDigestJobData> | undefined, error: Error): void {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Slip digest failed',
    );
  }
}
