import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
  ETL_CRON_SCHEDULES,
  ETL_SCHEDULER_KEYS,
} from '../../config/etl.constants';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';

const logger = pino({ name: 'etl-service' });

@Injectable()
export class EtlService implements OnApplicationBootstrap {
  private readonly schedulingEnabled: boolean;

  constructor(
    @InjectQueue(BULLMQ_QUEUES.FIXTURES_SYNC)
    private readonly fixturesQueue: Queue<FixturesSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.RESULTS_SYNC)
    private readonly resultsQueue: Queue<ResultsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.STATS_SYNC)
    private readonly statsQueue: Queue<StatsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
    private readonly oddsCsvQueue: Queue<OddsCsvImportJobData>,
    private readonly config: ConfigService,
  ) {
    this.schedulingEnabled =
      config.get<string>('ETL_SCHEDULING_ENABLED', 'true') !== 'false';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.schedulingEnabled) {
      logger.info('ETL scheduling disabled — skipping job scheduler setup');
      return;
    }

    const currentSeason =
      ETL_CONSTANTS.EPL_SEASONS[ETL_CONSTANTS.EPL_SEASONS.length - 1];
    const currentSeasonCode =
      ETL_CONSTANTS.CSV_ODDS_SEASONS[ETL_CONSTANTS.CSV_ODDS_SEASONS.length - 1];

    await this.fixturesQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.FIXTURES_SYNC,
      { pattern: ETL_CRON_SCHEDULES.FIXTURES_SYNC },
      {
        name: `fixtures-sync-${currentSeason}`,
        data: { season: currentSeason } satisfies FixturesSyncJobData,
      },
    );

    await this.resultsQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.RESULTS_SYNC,
      { pattern: ETL_CRON_SCHEDULES.RESULTS_SYNC },
      {
        name: `results-sync-${currentSeason}`,
        data: { season: currentSeason } satisfies ResultsSyncJobData,
      },
    );

    await this.statsQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.STATS_SYNC,
      { pattern: ETL_CRON_SCHEDULES.STATS_SYNC },
      {
        name: `stats-sync-${currentSeason}`,
        data: { season: currentSeason } satisfies StatsSyncJobData,
      },
    );

    await this.oddsCsvQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ODDS_CSV_IMPORT,
      { pattern: ETL_CRON_SCHEDULES.ODDS_CSV_IMPORT },
      {
        name: `odds-csv-import-${currentSeasonCode}`,
        data: { seasonCode: currentSeasonCode } satisfies OddsCsvImportJobData,
      },
    );

    logger.info('ETL job schedulers registered');
  }

  async triggerFixturesSync(): Promise<void> {
    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      // Stagger jobs by rate limit delay to respect API-FOOTBALL quotas
      const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
      await this.fixturesQueue.add(
        `fixtures-sync-${season}`,
        { season } satisfies FixturesSyncJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
      );
    }
  }

  async triggerResultsSync(): Promise<void> {
    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
      await this.resultsQueue.add(
        `results-sync-${season}`,
        { season } satisfies ResultsSyncJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
      );
    }
  }

  async triggerStatsSync(): Promise<void> {
    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
      await this.statsQueue.add(
        `stats-sync-${season}`,
        { season } satisfies StatsSyncJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
      );
    }
  }

  async triggerOddsCsvImport(): Promise<void> {
    for (let i = 0; i < ETL_CONSTANTS.CSV_ODDS_SEASONS.length; i++) {
      const seasonCode = ETL_CONSTANTS.CSV_ODDS_SEASONS[i];
      // Stagger by 2s — football-data.co.uk has no strict rate limit but be polite
      const delay = i * 2_000;
      await this.oddsCsvQueue.add(
        `odds-csv-import-${seasonCode}`,
        { seasonCode } satisfies OddsCsvImportJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
      );
    }
  }

  async triggerFullSync(): Promise<void> {
    await this.triggerFixturesSync();
    await this.triggerResultsSync();
    await this.triggerStatsSync();
    await this.triggerOddsCsvImport();
  }
}
