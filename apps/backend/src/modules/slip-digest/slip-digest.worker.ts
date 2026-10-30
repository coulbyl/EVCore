import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { createLogger } from '@utils/logger';
import { SlipDigestService, previousUtcDay } from './slip-digest.service';
import {
  WeeklyStatementService,
  previousIsoWeek,
} from './weekly-statement.service';
import { FollowedSettledService } from './followed-settled.service';

/**
 * `day` (matinée) ou `week` (relevé du lundi, son lundi) forcé pour un
 * rattrapage manuel ; sinon la veille, ou la semaine passée.
 */
export type SlipDigestJobData = { day?: string; week?: string };

const logger = createLogger('slip-digest-worker');

@Processor(SLIP_DIGEST.QUEUE)
export class SlipDigestWorker extends WorkerHost {
  constructor(
    private readonly service: SlipDigestService,
    private readonly weekly: WeeklyStatementService,
    private readonly followed: FollowedSettledService,
  ) {
    super();
  }

  async process(
    job: Job<SlipDigestJobData>,
  ): Promise<{ sent: number; skippedPaused: number }> {
    if (job.name === SLIP_DIGEST.FOLLOWED_JOB) {
      return this.followed.notifyEvening(new Date());
    }
    if (job.name === SLIP_DIGEST.WEEKLY_JOB) {
      return this.weekly.sendStatements(
        job.data.week ?? previousIsoWeek(new Date()),
      );
    }
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
