import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import {
  FixturesSyncWorker,
  type FixturesSyncJobData,
} from './fixtures-sync.worker';
import {
  ResultsSyncWorker,
  type ResultsSyncJobData,
} from './results-sync.worker';
import { StatsSyncWorker, type StatsSyncJobData } from './stats-sync.worker';
import {
  InjuriesSyncWorker,
  type InjuriesSyncJobData,
} from './injuries-sync.worker';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type LeagueSyncType = 'fixtures' | 'results' | 'stats' | 'injuries';

export type LeagueSyncJobData = {
  syncType: LeagueSyncType;
  season: number;
  competitionCode: string;
  leagueId: number;
};

const logger = createLogger('league-sync-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.LEAGUE_SYNC)
export class LeagueSyncWorker extends WorkerHost {
  @Inject(FixturesSyncWorker)
  private fixturesSyncWorker!: FixturesSyncWorker;

  @Inject(ResultsSyncWorker)
  private resultsSyncWorker!: ResultsSyncWorker;

  @Inject(StatsSyncWorker)
  private statsSyncWorker!: StatsSyncWorker;

  @Inject(InjuriesSyncWorker)
  private injuriesSyncWorker!: InjuriesSyncWorker;

  @Inject(NotificationService)
  private notification!: NotificationService;

  constructor() {
    super();
  }

  async process(job: Job<LeagueSyncJobData>): Promise<void> {
    switch (job.data.syncType) {
      case 'fixtures':
        await this.fixturesSyncWorker.process(
          job as Job<FixturesSyncJobData & { syncType: LeagueSyncType }>,
        );
        return;
      case 'results':
        await this.resultsSyncWorker.process(
          job as Job<ResultsSyncJobData & { syncType: LeagueSyncType }>,
        );
        return;
      case 'stats':
        await this.statsSyncWorker.process(
          job as Job<StatsSyncJobData & { syncType: LeagueSyncType }>,
        );
        return;
      case 'injuries':
        await this.injuriesSyncWorker.process(
          job as Job<InjuriesSyncJobData & { syncType: LeagueSyncType }>,
        );
        return;
      default: {
        throw new Error('Unsupported league sync type');
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LeagueSyncJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.LEAGUE_SYNC,
      job,
      error,
      logger,
    });
  }
}
