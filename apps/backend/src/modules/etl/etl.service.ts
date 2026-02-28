import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
} from '../../config/etl.constants';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';

@Injectable()
export class EtlService {
  constructor(
    @InjectQueue(BULLMQ_QUEUES.FIXTURES_SYNC)
    private readonly fixturesQueue: Queue<FixturesSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.RESULTS_SYNC)
    private readonly resultsQueue: Queue<ResultsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.STATS_SYNC)
    private readonly statsQueue: Queue<StatsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
    private readonly oddsCsvQueue: Queue<OddsCsvImportJobData>,
  ) {}

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
