import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { EtlService } from '../etl.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type SeasonRolloverSyncJobData = Record<string, never>;

const logger = createLogger('season-rollover-sync-worker');

// See ETL_CRON_SCHEDULES.SEASON_ROLLOVER_SYNC (etl.constants.ts) for why
// this exists: upsertJobScheduler bakes `season` into a recurring job's
// template once, at the time it's called — it never recomputes on its own.
// This worker periodically calls EtlService.refreshLeagueSeasonSchedulers()
// so a competition's season rollover (e.g. Aug 1) gets picked up without
// requiring a process restart.
@Injectable()
@Processor(BULLMQ_QUEUES.SEASON_ROLLOVER_SYNC)
export class SeasonRolloverSyncWorker extends WorkerHost {
  @Inject(NotificationService)
  private notification!: NotificationService;

  constructor(private readonly etlService: EtlService) {
    super();
  }

  async process(_: Job<SeasonRolloverSyncJobData>): Promise<void> {
    logger.info('Refreshing league-season job schedulers');
    const result = await this.etlService.refreshLeagueSeasonSchedulers();
    logger.info(result, 'League-season job schedulers refreshed');
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<SeasonRolloverSyncJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.SEASON_ROLLOVER_SYNC,
      job,
      error,
      logger,
    });
  }
}
