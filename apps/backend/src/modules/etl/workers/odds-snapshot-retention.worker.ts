import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { FixtureService } from '@modules/fixture/fixture.service';
import { NotificationService } from '@modules/notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type OddsSnapshotRetentionJobData = {
  retentionDays?: number;
};

const logger = createLogger('odds-snapshot-retention-worker');

@Processor(BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION)
export class OddsSnapshotRetentionWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsSnapshotRetentionJobData>): Promise<void> {
    const fallbackRetentionDays = Number(
      this.config.get<string>('ODDS_SNAPSHOT_RETENTION_DAYS', '30'),
    );
    const retentionDays = job.data.retentionDays ?? fallbackRetentionDays;

    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error(
        'ODDS_SNAPSHOT_RETENTION_DAYS must be a positive integer',
      );
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

    const deleted =
      await this.fixtureService.deleteOddsSnapshotsOlderThan(cutoff);

    logger.info(
      {
        retentionDays,
        cutoff: cutoff.toISOString(),
        deleted,
      },
      'Odds snapshot cleanup completed',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<OddsSnapshotRetentionJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION,
      job,
      error,
      logger,
    });
  }
}
