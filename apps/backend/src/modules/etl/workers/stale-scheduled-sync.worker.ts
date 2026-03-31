import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FixtureStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import {
  ApiFootballFixturesResponseSchema,
  type ApiFootballFixture,
  type ApiFootballStatus,
} from '../schemas/fixture.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type StaleScheduledSyncJobData = {
  lookbackDays?: number;
};

const logger = createLogger('stale-scheduled-sync-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.STALE_SCHEDULED_SYNC)
export class StaleScheduledSyncWorker extends WorkerHost {
  @Inject(NotificationService)
  private notification!: NotificationService;

  @Inject(ConfigService)
  private config!: ConfigService;

  constructor(private readonly fixtureService: FixtureService) {
    super();
  }

  async process(job: Job<StaleScheduledSyncJobData>): Promise<void> {
    const lookbackDays =
      job.data.lookbackDays ??
      Number(
        this.config.get<string>('STALE_SCHEDULED_SYNC_LOOKBACK_DAYS', '14'),
      );
    if (!Number.isInteger(lookbackDays) || lookbackDays < 1) {
      throw new Error(
        'STALE_SCHEDULED_SYNC_LOOKBACK_DAYS must be a positive integer',
      );
    }

    const now = new Date();
    const fixtures = await this.fixtureService.findPastScheduledFixtures(
      now,
      lookbackDays,
    );
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info(
      { fixtureCount: fixtures.length, lookbackDays },
      'Starting stale scheduled fixtures sync',
    );

    let updated = 0;

    for (const fixture of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?id=${fixture.externalId}`;
      const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

      if (!res.ok) {
        throw new Error(
          `API-FOOTBALL responded ${res.status} for fixture ${fixture.externalId}`,
        );
      }

      const parsed = ApiFootballFixturesResponseSchema.safeParse(
        await res.json(),
      );

      if (!parsed.success) {
        logger.error(
          { externalId: fixture.externalId, issues: parsed.error.issues },
          'Zod validation failed — rejecting stale fixture payload',
        );
        throw new Error(
          `Zod validation failed for fixture ${fixture.externalId}`,
        );
      }

      const apiFixture = parsed.data.response[0];
      if (!apiFixture) {
        logger.warn(
          { externalId: fixture.externalId },
          'Fixture not returned by API-FOOTBALL during stale scheduled sync',
        );
        continue;
      }

      const nextState = mapFixtureState(apiFixture);
      await this.fixtureService.syncFixtureState({
        externalId: fixture.externalId,
        scheduledAt: nextState.scheduledAt,
        status: nextState.status,
        homeScore: nextState.homeScore,
        awayScore: nextState.awayScore,
        homeHtScore: nextState.homeHtScore,
        awayHtScore: nextState.awayHtScore,
      });
      updated++;
    }

    logger.info(
      { fixtureCount: fixtures.length, updated, lookbackDays },
      'Stale scheduled fixtures sync complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<StaleScheduledSyncJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.STALE_SCHEDULED_SYNC,
      job,
      error,
      logger,
    });
  }
}

function mapFixtureState(item: ApiFootballFixture): {
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
} {
  return {
    scheduledAt: new Date(item.fixture.date),
    status: mapStatus(item.fixture.status.short),
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    homeHtScore: item.score.halftime.home,
    awayHtScore: item.score.halftime.away,
  };
}

function mapStatus(status: ApiFootballStatus): FixtureStatus {
  switch (status) {
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
      return 'FINISHED';
    case 'PST':
      return 'POSTPONED';
    case 'CANC':
    case 'ABD':
      return 'CANCELLED';
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'INT':
      return 'IN_PROGRESS';
    default:
      return 'SCHEDULED';
  }
}
