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
  estimateApiFootballDailyCalls,
  getActiveCompetitionPlans,
  getActiveCsvCompetitions,
  getActiveCsvSeasonCodes,
} from '../../config/etl.constants';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';
import type { OddsLiveSyncJobData } from './workers/odds-live-sync.worker';
import type { InjuriesSyncJobData } from './workers/injuries-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';

const logger = pino({ name: 'etl-service' });

@Injectable()
export class EtlService implements OnApplicationBootstrap {
  private readonly schedulingEnabled: boolean;
  private readonly quotaAlertPct: number;
  private readonly dailyQuota: number;
  private readonly avgScheduledFixturesPerLeaguePerDay: number;
  private readonly avgFinishedFixturesWithoutXgPerLeaguePerDay: number;

  // eslint-disable-next-line max-params -- Explicit queue injection keeps queue wiring transparent.
  constructor(
    @InjectQueue(BULLMQ_QUEUES.FIXTURES_SYNC)
    private readonly fixturesQueue: Queue<FixturesSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.RESULTS_SYNC)
    private readonly resultsQueue: Queue<ResultsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.STATS_SYNC)
    private readonly statsQueue: Queue<StatsSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.INJURIES_SYNC)
    private readonly injuriesQueue: Queue<InjuriesSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
    private readonly oddsCsvQueue: Queue<OddsCsvImportJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_LIVE_SYNC)
    private readonly oddsLiveQueue: Queue<OddsLiveSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION)
    private readonly oddsSnapshotRetentionQueue: Queue<OddsSnapshotRetentionJobData>,
    config: ConfigService,
  ) {
    this.schedulingEnabled =
      config.get<string>('ETL_SCHEDULING_ENABLED', 'true') !== 'false';
    this.quotaAlertPct = Number(
      config.get<string>('API_FOOTBALL_QUOTA_ALERT_PCT', '80'),
    );
    this.dailyQuota = Number(
      config.get<string>('API_FOOTBALL_DAILY_QUOTA', '7500'),
    );
    this.avgScheduledFixturesPerLeaguePerDay = Number(
      config.get<string>('API_FOOTBALL_AVG_DAILY_FIXTURES_PER_LEAGUE', '10'),
    );
    this.avgFinishedFixturesWithoutXgPerLeaguePerDay = Number(
      config.get<string>(
        'API_FOOTBALL_AVG_DAILY_STATS_FIXTURES_PER_LEAGUE',
        '2',
      ),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.schedulingEnabled) {
      logger.info('ETL scheduling disabled — skipping job scheduler setup');
      return;
    }

    const csvSeasonCodes = getActiveCsvSeasonCodes();
    const currentSeasonCode = csvSeasonCodes[csvSeasonCodes.length - 1];
    const activePlans = getActiveCompetitionPlans();

    this.logApiFootballBudget(activePlans);

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

        await this.injuriesQueue.upsertJobScheduler(
          `${ETL_SCHEDULER_KEYS.INJURIES_SYNC}:${competition.code}`,
          { pattern: ETL_CRON_SCHEDULES.INJURIES_SYNC },
          {
            name: `injuries-sync-${competition.code}-${currentSeason}`,
            data: {
              season: currentSeason,
              competitionCode: competition.code,
            } satisfies InjuriesSyncJobData,
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

    await this.oddsSnapshotRetentionQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ODDS_SNAPSHOT_RETENTION,
      { pattern: ETL_CRON_SCHEDULES.ODDS_SNAPSHOT_RETENTION },
      {
        name: 'odds-snapshot-retention',
        data: {} satisfies OddsSnapshotRetentionJobData,
      },
    );

    logger.info('ETL job schedulers registered');
  }

  private logApiFootballBudget(
    activePlans: ReturnType<typeof getActiveCompetitionPlans>,
  ): void {
    const estimate = estimateApiFootballDailyCalls({
      activeCompetitionPlans: activePlans,
      avgScheduledFixturesPerLeaguePerDay:
        this.avgScheduledFixturesPerLeaguePerDay,
      avgFinishedFixturesWithoutXgPerLeaguePerDay:
        this.avgFinishedFixturesWithoutXgPerLeaguePerDay,
    });

    const threshold = Math.floor((this.dailyQuota * this.quotaAlertPct) / 100);
    const usagePct =
      this.dailyQuota > 0 ? (estimate.totalCalls / this.dailyQuota) * 100 : 0;

    const payload = {
      leagues: estimate.leagueCount,
      seasonJobs: estimate.seasonJobCount,
      callsPerDay: estimate.totalCalls,
      dailyQuota: this.dailyQuota,
      threshold,
      usagePct: Number(usagePct.toFixed(1)),
      assumptions: {
        avgScheduledFixturesPerLeaguePerDay:
          this.avgScheduledFixturesPerLeaguePerDay,
        avgFinishedFixturesWithoutXgPerLeaguePerDay:
          this.avgFinishedFixturesWithoutXgPerLeaguePerDay,
      },
      breakdown: {
        fixturesSync: estimate.fixturesSyncCalls,
        resultsSync: estimate.resultsSyncCalls,
        statsSync: estimate.statsSyncCalls,
        injuriesSync: estimate.injuriesSyncCalls,
        oddsLiveSync: estimate.oddsLiveSyncCalls,
      },
    };

    if (estimate.totalCalls >= threshold) {
      logger.warn(
        payload,
        'API-Football daily budget is near configured quota',
      );
      return;
    }

    logger.info(payload, 'API-Football daily budget estimate');
  }

  async triggerFixturesSync(): Promise<void> {
    // Flatten all (competition × season) pairs so the stagger index is global,
    // not per-competition — prevents simultaneous API calls when multiple leagues are active.
    const jobs = getActiveCompetitionPlans().flatMap(
      ({ competition, seasons }) =>
        seasons.map((season) => ({
          season,
          competitionCode: competition.code,
        })),
    );
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await this.fixturesQueue.add(
        `fixtures-sync-${job.competitionCode}-${job.season}`,
        job satisfies FixturesSyncJobData,
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  }

  async triggerResultsSync(): Promise<void> {
    const jobs = getActiveCompetitionPlans().flatMap(
      ({ competition, seasons }) =>
        seasons.map((season) => ({
          season,
          competitionCode: competition.code,
        })),
    );
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await this.resultsQueue.add(
        `results-sync-${job.competitionCode}-${job.season}`,
        job satisfies ResultsSyncJobData,
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  }

  async triggerStatsSync(): Promise<void> {
    const jobs = getActiveCompetitionPlans().flatMap(
      ({ competition, seasons }) =>
        seasons.map((season) => ({
          season,
          competitionCode: competition.code,
        })),
    );
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await this.statsQueue.add(
        `stats-sync-${job.competitionCode}-${job.season}`,
        job satisfies StatsSyncJobData,
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  }

  async triggerInjuriesSync(): Promise<void> {
    const jobs = getActiveCompetitionPlans().flatMap(
      ({ competition, seasons }) =>
        seasons.map((season) => ({
          season,
          competitionCode: competition.code,
        })),
    );
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await this.injuriesQueue.add(
        `injuries-sync-${job.competitionCode}-${job.season}`,
        job satisfies InjuriesSyncJobData,
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  }

  async triggerOddsCsvImport(): Promise<void> {
    const csvCompetitions = getActiveCsvCompetitions();

    const csvSeasonCodes = getActiveCsvSeasonCodes();
    for (const competition of csvCompetitions) {
      for (let i = 0; i < csvSeasonCodes.length; i++) {
        const seasonCode = csvSeasonCodes[i];
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

  async triggerOddsSnapshotRetention(retentionDays?: number): Promise<void> {
    await this.oddsSnapshotRetentionQueue.add(
      'odds-snapshot-retention',
      { retentionDays } satisfies OddsSnapshotRetentionJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  async getQueueStatus(): Promise<Record<string, Record<string, number>>> {
    const queues = {
      [BULLMQ_QUEUES.FIXTURES_SYNC]: this.fixturesQueue,
      [BULLMQ_QUEUES.RESULTS_SYNC]: this.resultsQueue,
      [BULLMQ_QUEUES.STATS_SYNC]: this.statsQueue,
      [BULLMQ_QUEUES.INJURIES_SYNC]: this.injuriesQueue,
      [BULLMQ_QUEUES.ODDS_CSV_IMPORT]: this.oddsCsvQueue,
      [BULLMQ_QUEUES.ODDS_LIVE_SYNC]: this.oddsLiveQueue,
      [BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION]: this.oddsSnapshotRetentionQueue,
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
    await this.triggerInjuriesSync();
    await this.triggerOddsCsvImport();
    await this.triggerOddsLiveSync();
  }
}
