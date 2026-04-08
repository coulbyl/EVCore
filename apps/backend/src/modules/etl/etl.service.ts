import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { activeSeasons } from '@utils/date.utils';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
  DEFAULT_SEASON_START_MONTH,
  ETL_CONSTANTS,
  ETL_CRON_SCHEDULES,
  ETL_SCHEDULER_KEYS,
  estimateApiFootballDailyCalls,
  getCurrentCsvSeasonCode,
  csvSeasonCodes,
} from '../../config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { BacktestService } from '../backtest/backtest.service';
import { RollingStatsService } from '../rolling-stats/rolling-stats.service';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { EloSyncJobData } from './workers/elo-sync.worker';
import type { StaleScheduledSyncJobData } from './workers/stale-scheduled-sync.worker';
import type { OddsPrematchSyncJobData } from './workers/odds-prematch-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';
import type { PendingBetsSettlementJobData } from './workers/pending-bets-settlement.worker';
import type {
  LeagueSyncJobData,
  LeagueSyncType,
} from './workers/league-sync.worker';
import type { OddsHistoricalImportJobData } from './workers/odds-historical-import.worker';
import { THE_ODDS_API_SPORT_KEYS } from '../../config/etl.constants';

const logger = createLogger('etl-service');
const LEAGUE_SEASON_SYNC_KINDS: LeagueSyncType[] = [
  'fixtures',
  'stats',
  'injuries',
];

type CompetitionRow = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  csvDivisionCode: string | null;
  seasonStartMonth: number | null;
  apiSeasonOverride: number | null;
};

type CompetitionPlan = {
  competition: CompetitionRow;
  seasons: readonly number[];
};

type LeagueSeasonQueue<T extends LeagueSyncJobData> = Pick<
  Queue<T>,
  'add' | 'upsertJobScheduler' | 'removeJobScheduler'
>;

type LeagueSeasonSyncConfig<T extends LeagueSyncJobData> = {
  queue: LeagueSeasonQueue<T>;
  schedulerKey: string;
  cronPattern: string;
  syncType: LeagueSyncType;
  jobName: (competitionCode: string, season: number) => string;
  scheduledSeasons: 'current' | 'active';
};

function computeSeasons(
  competition: CompetitionRow,
  now = new Date(),
): readonly number[] {
  if (competition.apiSeasonOverride !== null) {
    return [competition.apiSeasonOverride];
  }
  return activeSeasons(
    competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
    1,
    now,
  );
}

function toCompetitionPlan(competition: CompetitionRow): CompetitionPlan {
  return {
    competition,
    seasons: computeSeasons(competition),
  };
}

@Injectable()
export class EtlService implements OnApplicationBootstrap {
  private readonly schedulingEnabled: boolean;
  private readonly quotaAlertPct: number;
  private readonly dailyQuota: number;
  private readonly avgScheduledFixturesPerLeaguePerDay: number;
  private readonly avgFinishedFixturesWithoutXgPerLeaguePerDay: number;
  private competitionPlans: CompetitionPlan[] = [];
  private readonly leagueSeasonSyncs: Record<
    LeagueSyncType,
    LeagueSeasonSyncConfig<LeagueSyncJobData>
  >;

  // eslint-disable-next-line max-params -- Explicit queue injection keeps queue wiring transparent.
  constructor(
    @InjectQueue(BULLMQ_QUEUES.LEAGUE_SYNC)
    private readonly leagueSyncQueue: Queue<LeagueSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT)
    private readonly pendingBetsSettlementQueue: Queue<PendingBetsSettlementJobData>,
    @InjectQueue(BULLMQ_QUEUES.STALE_SCHEDULED_SYNC)
    private readonly staleScheduledSyncQueue: Queue<StaleScheduledSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
    private readonly oddsCsvQueue: Queue<OddsCsvImportJobData>,
    @InjectQueue(BULLMQ_QUEUES.ELO_SYNC)
    private readonly eloSyncQueue: Queue<EloSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_PREMATCH_SYNC)
    private readonly oddsPrematchQueue: Queue<OddsPrematchSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION)
    private readonly oddsSnapshotRetentionQueue: Queue<OddsSnapshotRetentionJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT)
    private readonly oddsHistoricalImportQueue: Queue<OddsHistoricalImportJobData>,
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly backtestService: BacktestService,
    private readonly rollingStatsService: RollingStatsService,
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
    this.leagueSeasonSyncs = {
      fixtures: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:fixtures`,
        cronPattern: ETL_CRON_SCHEDULES.FIXTURES_SYNC,
        syncType: 'fixtures',
        jobName: (competitionCode, season) =>
          `fixtures-sync-${competitionCode}-${season}`,
        scheduledSeasons: 'current',
      },
      stats: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:stats`,
        cronPattern: ETL_CRON_SCHEDULES.STATS_SYNC,
        syncType: 'stats',
        jobName: (competitionCode, season) =>
          `stats-sync-${competitionCode}-${season}`,
        scheduledSeasons: 'current',
      },
      injuries: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:injuries`,
        cronPattern: ETL_CRON_SCHEDULES.INJURIES_SYNC,
        syncType: 'injuries',
        jobName: (competitionCode, season) =>
          `injuries-sync-${competitionCode}-${season}`,
        scheduledSeasons: 'current',
      },
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.schedulingEnabled) {
      logger.info('ETL scheduling disabled — skipping job scheduler setup');
      return;
    }

    await this.refreshCompetitionPlans();
    await this.cleanupInactiveSchedulers();

    const currentSeasonCode = getCurrentCsvSeasonCode();

    this.logApiFootballBudget(this.competitionPlans);

    await Promise.all(
      this.competitionPlans.map(async ({ competition, seasons }) => {
        const currentSeason = seasons[seasons.length - 1];

        await Promise.all(
          LEAGUE_SEASON_SYNC_KINDS.map((kind) =>
            this.upsertLeagueSeasonScheduler(kind, competition, currentSeason),
          ),
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

    await this.oddsPrematchQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ODDS_PREMATCH_SYNC,
      { pattern: ETL_CRON_SCHEDULES.ODDS_PREMATCH_SYNC },
      {
        name: 'odds-prematch-sync',
        data: {} satisfies OddsPrematchSyncJobData,
      },
    );

    await this.eloSyncQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ELO_SYNC,
      { pattern: ETL_CRON_SCHEDULES.ELO_SYNC },
      {
        name: 'elo-sync',
        data: {} satisfies EloSyncJobData,
      },
    );

    await this.staleScheduledSyncQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.STALE_SCHEDULED_SYNC,
      { pattern: ETL_CRON_SCHEDULES.STALE_SCHEDULED_SYNC },
      {
        name: 'stale-scheduled-sync',
        data: {} satisfies StaleScheduledSyncJobData,
      },
    );

    await this.pendingBetsSettlementQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.PENDING_BETS_SETTLEMENT,
      { pattern: ETL_CRON_SCHEDULES.PENDING_BETS_SETTLEMENT },
      {
        name: 'pending-bets-settlement-sync',
        data: {} satisfies PendingBetsSettlementJobData,
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

  private async refreshCompetitionPlans(): Promise<void> {
    const competitions = await this.prisma.client.competition.findMany({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        apiSeasonOverride: true,
      },
    });
    this.competitionPlans = competitions.map(toCompetitionPlan);
  }

  private async cleanupInactiveSchedulers(): Promise<void> {
    const competitions = await this.prisma.client.competition.findMany({
      select: {
        code: true,
        isActive: true,
        csvDivisionCode: true,
      },
    });

    const inactiveCompetitionCodes = competitions
      .filter((competition) => !competition.isActive)
      .map((competition) => competition.code);
    const nonCsvCompetitionCodes = competitions
      .filter(
        (competition) =>
          !competition.isActive || competition.csvDivisionCode == null,
      )
      .map((competition) => competition.code);

    const leagueSeasonSyncs = Object.values(this.leagueSeasonSyncs);

    await Promise.all(
      inactiveCompetitionCodes.flatMap((competitionCode) =>
        leagueSeasonSyncs.map((sync) =>
          sync.queue.removeJobScheduler(
            `${sync.schedulerKey}:${competitionCode}`,
          ),
        ),
      ),
    );

    await Promise.all(
      nonCsvCompetitionCodes.map((competitionCode) =>
        this.oddsCsvQueue.removeJobScheduler(
          `${ETL_SCHEDULER_KEYS.ODDS_CSV_IMPORT}:${competitionCode}`,
        ),
      ),
    );
  }

  private logApiFootballBudget(plans: CompetitionPlan[]): void {
    const estimate = estimateApiFootballDailyCalls({
      leagueCount: plans.length,
      seasonJobCount: plans.length,
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
        settlementSync: estimate.settlementSyncCalls,
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
    await this.triggerLeagueSeasonSync('fixtures');
  }

  async triggerPendingBetsSettlementSync(): Promise<void> {
    await this.pendingBetsSettlementQueue.add(
      'pending-bets-settlement-sync',
      {} satisfies PendingBetsSettlementJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  async triggerStaleScheduledSync(lookbackDays?: number): Promise<void> {
    await this.staleScheduledSyncQueue.add(
      'stale-scheduled-sync',
      { lookbackDays } satisfies StaleScheduledSyncJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  async triggerStatsSync(): Promise<void> {
    await this.triggerLeagueSeasonSync('stats');
  }

  async triggerInjuriesSync(): Promise<void> {
    await this.triggerLeagueSeasonSync('injuries');
  }

  async triggerOddsCsvImport(): Promise<void> {
    await this.refreshCompetitionPlans();
    const seasonCode = getCurrentCsvSeasonCode();
    const csvCompetitions = this.competitionPlans
      .filter((p) => p.competition.csvDivisionCode != null)
      .map(
        (p) => p.competition as CompetitionRow & { csvDivisionCode: string },
      );

    for (const competition of csvCompetitions) {
      await this.oddsCsvQueue.add(
        `odds-csv-import-${competition.code}-${seasonCode}`,
        {
          competitionCode: competition.code,
          seasonCode,
          divisionCode: competition.csvDivisionCode,
        } satisfies OddsCsvImportJobData,
        BULLMQ_DEFAULT_JOB_OPTIONS,
      );
    }
  }

  async triggerOddsHistoricalImport(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const code =
      competitionCode.toUpperCase() as keyof typeof THE_ODDS_API_SPORT_KEYS;
    if (!(code in THE_ODDS_API_SPORT_KEYS)) {
      throw new Error(
        `${competitionCode} is not a supported UEFA competition for historical import. Use UCL, UEL or UECL.`,
      );
    }
    for (const [i, seasonYear] of seasons.entries()) {
      await this.oddsHistoricalImportQueue.add(
        `odds-historical-${code}-${seasonYear}`,
        {
          competitionCode: code,
          seasonYear,
        } satisfies OddsHistoricalImportJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: i * 1_000 },
      );
    }
  }

  async triggerOddsCsvImportForSeasons(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const competition = await this.loadActiveCompetition(competitionCode);
    if (!competition.csvDivisionCode) {
      throw new Error(
        `Competition ${competitionCode} has no CSV division code configured`,
      );
    }
    const codes = csvSeasonCodes(seasons);
    for (const [i, seasonCode] of codes.entries()) {
      await this.oddsCsvQueue.add(
        `odds-csv-import-${competitionCode}-${seasonCode}`,
        {
          competitionCode,
          seasonCode,
          divisionCode: competition.csvDivisionCode,
        } satisfies OddsCsvImportJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: i * 2_000 },
      );
    }
  }

  async triggerOddsPrematchSync(date?: string): Promise<void> {
    await this.oddsPrematchQueue.add(
      'odds-prematch-sync',
      { date } satisfies OddsPrematchSyncJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  async triggerEloSync(): Promise<void> {
    await this.eloSyncQueue.add(
      'elo-sync',
      {} satisfies EloSyncJobData,
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

  async triggerRollingStatsSeason(
    competitionCode: string,
    season: number,
    mode: 'refresh' | 'rebuild' = 'refresh',
  ): Promise<void> {
    if (mode === 'rebuild') {
      await this.rollingStatsService.backfillSeasonYear(
        season,
        competitionCode,
      );
      return;
    }

    await this.rollingStatsService.refreshSeasonYear(season, competitionCode);
  }

  async triggerBacktestAllSeasons(): Promise<void> {
    await this.backtestService.runAllSeasons();
    await this.backtestService.getValidationReport();
  }

  async triggerBacktestSeason(seasonId: string): Promise<void> {
    await this.backtestService.runBacktest(seasonId);
  }

  async getQueueStatus(): Promise<Record<string, Record<string, number>>> {
    const queues = {
      [BULLMQ_QUEUES.LEAGUE_SYNC]: this.leagueSyncQueue,
      [BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT]: this.pendingBetsSettlementQueue,
      [BULLMQ_QUEUES.STALE_SCHEDULED_SYNC]: this.staleScheduledSyncQueue,
      [BULLMQ_QUEUES.ODDS_CSV_IMPORT]: this.oddsCsvQueue,
      [BULLMQ_QUEUES.ELO_SYNC]: this.eloSyncQueue,
      [BULLMQ_QUEUES.ODDS_PREMATCH_SYNC]: this.oddsPrematchQueue,
      [BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION]: this.oddsSnapshotRetentionQueue,
      [BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT]: this.oddsHistoricalImportQueue,
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

  async triggerFixturesSyncForLeague(competitionCode: string): Promise<void> {
    await this.triggerLeagueSeasonSyncForLeague('fixtures', competitionCode);
  }

  async triggerFixturesBackfillForSeasons(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const competition = await this.loadActiveCompetition(competitionCode);
    const jobs: LeagueSyncJobData[] = seasons.map((season) => ({
      syncType: 'fixtures',
      season,
      competitionCode,
      leagueId: competition.leagueId,
      syncScope: 'backfill',
    }));
    await this.enqueueLeagueSeasonJobs('fixtures', jobs);
  }

  async triggerStatsSyncForLeague(competitionCode: string): Promise<void> {
    await this.triggerLeagueSeasonSyncForLeague('stats', competitionCode);
  }

  async triggerStatsSyncForSeasons(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const competition = await this.loadActiveCompetition(competitionCode);
    const jobs: LeagueSyncJobData[] = seasons.map((season) => ({
      syncType: 'stats',
      season,
      competitionCode,
      leagueId: competition.leagueId,
    }));
    await this.enqueueLeagueSeasonJobs('stats', jobs);
  }

  async triggerInjuriesSyncForLeague(competitionCode: string): Promise<void> {
    await this.triggerLeagueSeasonSyncForLeague('injuries', competitionCode);
  }

  async triggerFullSync(): Promise<void> {
    await this.triggerFixturesSync();
    await this.triggerPendingBetsSettlementSync();
    await this.triggerStaleScheduledSync();
    await this.triggerStatsSync();
    await this.triggerInjuriesSync();
    await this.triggerOddsCsvImport();
    await this.triggerEloSync();
    await this.triggerOddsPrematchSync();
  }

  private async upsertLeagueSeasonScheduler(
    kind: LeagueSyncType,
    competition: CompetitionRow,
    season: number,
  ): Promise<void> {
    const sync = this.leagueSeasonSyncs[kind];
    await sync.queue.upsertJobScheduler(
      `${sync.schedulerKey}:${competition.code}`,
      { pattern: sync.cronPattern },
      {
        name: sync.jobName(competition.code, season),
        data: {
          syncType: sync.syncType,
          season,
          competitionCode: competition.code,
          leagueId: competition.leagueId,
          ...(kind === 'fixtures'
            ? ({ syncScope: 'routine' } satisfies Partial<LeagueSyncJobData>)
            : {}),
        } satisfies LeagueSyncJobData,
      },
    );
  }

  private async triggerLeagueSeasonSync(kind: LeagueSyncType): Promise<void> {
    await this.refreshCompetitionPlans();
    const jobs = this.competitionPlans.flatMap(({ competition, seasons }) => {
      const selectedSeasons =
        this.leagueSeasonSyncs[kind].scheduledSeasons === 'current'
          ? [seasons[seasons.length - 1]]
          : seasons;

      return selectedSeasons.map((season) => ({
        syncType: kind,
        season,
        competitionCode: competition.code,
        leagueId: competition.leagueId,
        ...(kind === 'fixtures'
          ? ({ syncScope: 'routine' } satisfies Partial<LeagueSyncJobData>)
          : {}),
      }));
    });
    await this.enqueueLeagueSeasonJobs(kind, jobs);
  }

  private async triggerLeagueSeasonSyncForLeague(
    kind: LeagueSyncType,
    competitionCode: string,
  ): Promise<void> {
    const competition = await this.loadActiveCompetition(competitionCode);
    const jobs = computeSeasons(competition).map((season) => ({
      syncType: kind,
      season,
      competitionCode,
      leagueId: competition.leagueId,
      ...(kind === 'fixtures'
        ? ({ syncScope: 'backfill' } satisfies Partial<LeagueSyncJobData>)
        : {}),
    }));
    await this.enqueueLeagueSeasonJobs(kind, jobs);
  }

  private async enqueueLeagueSeasonJobs(
    kind: LeagueSyncType,
    jobs: LeagueSyncJobData[],
  ): Promise<void> {
    const sync = this.leagueSeasonSyncs[kind];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await sync.queue.add(sync.jobName(job.competitionCode, job.season), job, {
        ...BULLMQ_DEFAULT_JOB_OPTIONS,
        delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
      });
    }
  }

  private async loadActiveCompetition(
    competitionCode: string,
  ): Promise<CompetitionRow> {
    const competition = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode, isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        apiSeasonOverride: true,
      },
    });
    if (!competition) {
      throw new Error(`Unknown or inactive competition: ${competitionCode}`);
    }
    return competition;
  }
}
