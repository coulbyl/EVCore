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
  getActiveCompetitionPlans,
  getActiveCsvCompetitions,
} from '../../config/etl.constants';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';
import type { OddsLiveSyncJobData } from './workers/odds-live-sync.worker';

const logger = pino({ name: 'etl-service' });

@Injectable()
export class EtlService implements OnApplicationBootstrap {
  private readonly schedulingEnabled: boolean;

  // eslint-disable-next-line max-params -- Explicit queue injection keeps queue wiring transparent.
  constructor(
    @InjectQueue(BULLMQ_QUEUES.FIXTURES_SYNC)
    private readonly fixturesQueue: Queue<FixturesSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.RESULTS_SYNC)
    private readonly resultsQueue: Queue<ResultsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.STATS_SYNC)
    private readonly statsQueue: Queue<StatsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
    private readonly oddsCsvQueue: Queue<OddsCsvImportJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_LIVE_SYNC)
    private readonly oddsLiveQueue: Queue<OddsLiveSyncJobData>,
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

    const currentSeasonCode =
      ETL_CONSTANTS.CSV_ODDS_SEASONS[ETL_CONSTANTS.CSV_ODDS_SEASONS.length - 1];
    const activePlans = getActiveCompetitionPlans();

    await Promise.all(
      activePlans.map(async ({ competition, seasons }) => {
        const currentSeason = seasons[seasons.length - 1];

        await this.fixturesQueue.upsertJobScheduler(
          `${ETL_SCHEDULER_KEYS.FIXTURES_SYNC}:${competition.code}`,
          { pattern: ETL_CRON_SCHEDULES.FIXTURES_SYNC },
          {
            name: `fixtures-sync-${competition.code}-${currentSeason}`,
            data: {
              season: currentSeason,
              competitionCode: competition.code,
            } satisfies FixturesSyncJobData,
          },
        );

        await this.resultsQueue.upsertJobScheduler(
          `${ETL_SCHEDULER_KEYS.RESULTS_SYNC}:${competition.code}`,
          { pattern: ETL_CRON_SCHEDULES.RESULTS_SYNC },
          {
            name: `results-sync-${competition.code}-${currentSeason}`,
            data: {
              season: currentSeason,
              competitionCode: competition.code,
            } satisfies ResultsSyncJobData,
          },
        );

        await this.statsQueue.upsertJobScheduler(
          `${ETL_SCHEDULER_KEYS.STATS_SYNC}:${competition.code}`,
          { pattern: ETL_CRON_SCHEDULES.STATS_SYNC },
          {
            name: `stats-sync-${competition.code}-${currentSeason}`,
            data: {
              season: currentSeason,
              competitionCode: competition.code,
            } satisfies StatsSyncJobData,
          },
        );

        if (competition.csvDivisionCode) {
          await this.oddsCsvQueue.upsertJobScheduler(
            `${ETL_SCHEDULER_KEYS.ODDS_CSV_IMPORT}:${competition.code}`,
            { pattern: ETL_CRON_SCHEDULES.ODDS_CSV_IMPORT },
            {
              name: `odds-csv-import-${competition.code}-${currentSeasonCode}`,
              data: {
                competitionCode: competition.code,
                seasonCode: currentSeasonCode,
                divisionCode: competition.csvDivisionCode,
              } satisfies OddsCsvImportJobData,
            },
          );
        }
      }),
    );

    await this.oddsLiveQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ODDS_LIVE_SYNC,
      { pattern: ETL_CRON_SCHEDULES.ODDS_LIVE_SYNC },
      {
        name: 'odds-live-sync',
        data: {} satisfies OddsLiveSyncJobData,
      },
    );

    logger.info('ETL job schedulers registered');
  }

  async triggerFixturesSync(): Promise<void> {
    const activePlans = getActiveCompetitionPlans();
    for (const { competition, seasons } of activePlans) {
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        // Stagger jobs by rate limit delay to respect API-FOOTBALL quotas
        const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
        await this.fixturesQueue.add(
          `fixtures-sync-${competition.code}-${season}`,
          {
            season,
            competitionCode: competition.code,
          } satisfies FixturesSyncJobData,
          { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
        );
      }
    }
  }

  async triggerResultsSync(): Promise<void> {
    const activePlans = getActiveCompetitionPlans();
    for (const { competition, seasons } of activePlans) {
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
        await this.resultsQueue.add(
          `results-sync-${competition.code}-${season}`,
          {
            season,
            competitionCode: competition.code,
          } satisfies ResultsSyncJobData,
          { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
        );
      }
    }
  }

  async triggerStatsSync(): Promise<void> {
    const activePlans = getActiveCompetitionPlans();
    for (const { competition, seasons } of activePlans) {
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        const delay = i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;
        await this.statsQueue.add(
          `stats-sync-${competition.code}-${season}`,
          {
            season,
            competitionCode: competition.code,
          } satisfies StatsSyncJobData,
          { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
        );
      }
    }
  }

  async triggerOddsCsvImport(): Promise<void> {
    const csvCompetitions = getActiveCsvCompetitions();

    for (const competition of csvCompetitions) {
      for (let i = 0; i < ETL_CONSTANTS.CSV_ODDS_SEASONS.length; i++) {
        const seasonCode = ETL_CONSTANTS.CSV_ODDS_SEASONS[i];
        // Stagger by 2s — football-data.co.uk has no strict rate limit but be polite
        const delay = i * 2_000;
        await this.oddsCsvQueue.add(
          `odds-csv-import-${competition.code}-${seasonCode}`,
          {
            competitionCode: competition.code,
            seasonCode,
            divisionCode: competition.csvDivisionCode,
          } satisfies OddsCsvImportJobData,
          { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay },
        );
      }
    }
  }

  async triggerOddsLiveSync(date?: string): Promise<void> {
    await this.oddsLiveQueue.add(
      'odds-live-sync',
      { date } satisfies OddsLiveSyncJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  async getQueueStatus(): Promise<Record<string, Record<string, number>>> {
    const queues = {
      [BULLMQ_QUEUES.FIXTURES_SYNC]: this.fixturesQueue,
      [BULLMQ_QUEUES.RESULTS_SYNC]: this.resultsQueue,
      [BULLMQ_QUEUES.STATS_SYNC]: this.statsQueue,
      [BULLMQ_QUEUES.ODDS_CSV_IMPORT]: this.oddsCsvQueue,
      [BULLMQ_QUEUES.ODDS_LIVE_SYNC]: this.oddsLiveQueue,
    };

    const entries = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        const counts = await queue.getJobCounts(
          'active',
          'waiting',
          'completed',
          'failed',
          'delayed',
        );
        return [name, counts] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  async triggerFullSync(): Promise<void> {
    await this.triggerFixturesSync();
    await this.triggerResultsSync();
    await this.triggerStatsSync();
    await this.triggerOddsCsvImport();
    await this.triggerOddsLiveSync();
  }
}
