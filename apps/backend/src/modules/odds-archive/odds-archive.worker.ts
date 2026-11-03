import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ODDS_ARCHIVE } from '@config/odds-archive.constants';
import { createLogger } from '@utils/logger';
import {
  OddsArchiveService,
  type OddsArchiveRun,
} from './odds-archive.service';

const logger = createLogger('odds-archive-worker');

// One night's archive at a time: a partition swap never races another.
@Processor(ODDS_ARCHIVE.QUEUE, { concurrency: 1 })
export class OddsArchiveWorker extends WorkerHost {
  constructor(private readonly service: OddsArchiveService) {
    super();
  }

  async process(): Promise<OddsArchiveRun> {
    return this.service.run();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Odds archive failed',
    );
  }
}
