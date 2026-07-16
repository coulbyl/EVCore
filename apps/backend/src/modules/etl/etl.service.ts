import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { JobSchedulerJson } from 'bullmq';
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
  ROLLING_HORIZON_DEFAULTS,
  estimateApiFootballDailyCalls,
  getCurrentCsvSeasonCode,
  csvSeasonCodes,
} from '../../config/etl.constants';
import { addDays } from 'date-fns';
import { formatDateUtc } from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import { RollingStatsService } from '../rolling-stats/rolling-stats.service';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { EloSyncJobData } from './workers/elo-sync.worker';
import type { StaleScheduledSyncJobData } from './workers/stale-scheduled-sync.worker';
import type { OddsPrematchSyncJobData } from './workers/odds-prematch-sync.worker';
import type { PendingBetsSettlementJobData } from './workers/pending-bets-settlement.worker';
import type { BettingEngineAnalysisJobData } from './workers/betting-engine-analysis.worker';
import type { BettingEngineRebuildJobData } from './workers/betting-engine-rebuild.worker';
import type { RollingHorizonJobData } from './workers/rolling-horizon.worker';
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

type SchedulerEntry = {
  queueName: string;
  key: string;
  name: string;
  pattern?: string;
  every?: number;
  next?: number;
};

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
  private readonly rollingHorizonEnabled: boolean;
  private readonly rollingHorizonDays: number;
  private readonly quotaAlertPct: number;
  private readonly dailyQuota: number;
  private readonly avgScheduledFixturesPerLeaguePerDay: number;
  private readonly avgFinishedFixturesWithoutXgPerLeaguePerDay: number;
  private competitionPlans: CompetitionPlan[] = [];
  private readonly cronSchedules: Record<
    keyof typeof ETL_CRON_SCHEDULES,
    string
  >;
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
    @InjectQueue(BULLMQ_QUEUES.BETTING_ENGINE)
    private readonly bettingEngineQueue: Queue<BettingEngineAnalysisJobData>,
    @InjectQueue(BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT)
    private readonly oddsHistoricalImportQueue: Queue<OddsHistoricalImportJobData>,
    @InjectQueue(BULLMQ_QUEUES.ROLLING_HORIZON)
    private readonly rollingHorizonQueue: Queue<RollingHorizonJobData>,
    @InjectQueue(BULLMQ_QUEUES.ML_TRAINING)
    private readonly mlTrainingQueue: Queue,
    @InjectQueue(BULLMQ_QUEUES.ML_SCHEDULER)
    private readonly mlSchedulerQueue: Queue,
    @InjectQueue(BULLMQ_QUEUES.BETTING_ENGINE_REBUILD)
    private readonly bettingEngineRebuildQueue: Queue<BettingEngineRebuildJobData>,
    @InjectQueue(BULLMQ_QUEUES.AI_ENGINE)
    private readonly aiEngineQueue: Queue,
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rollingStatsService: RollingStatsService,
  ) {
    this.schedulingEnabled =
      config.get<string>('ETL_SCHEDULING_ENABLED', 'true') !== 'false';
    this.rollingHorizonEnabled =
      config.get<string>('ETL_ENABLE_ROLLING_HORIZON', 'false') !== 'false';
    this.rollingHorizonDays = Number(
      config.get<string>(
        'ETL_ROLLING_HORIZON_DAYS',
        String(ROLLING_HORIZON_DEFAULTS.HORIZON_DAYS),
      ),
    );
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
    this.cronSchedules = {
      FIXTURES_SYNC: config.get<string>(
        'ETL_FIXTURES_SYNC_CRON',
        ETL_CRON_SCHEDULES.FIXTURES_SYNC,
      ),
      PENDING_BETS_SETTLEMENT: config.get<string>(
        'ETL_PENDING_BETS_SETTLEMENT_CRON',
        ETL_CRON_SCHEDULES.PENDING_BETS_SETTLEMENT,
      ),
      STALE_SCHEDULED_SYNC: config.get<string>(
        'ETL_STALE_SCHEDULED_SYNC_CRON',
        ETL_CRON_SCHEDULES.STALE_SCHEDULED_SYNC,
      ),
      STATS_SYNC: config.get<string>(
        'ETL_STATS_SYNC_CRON',
        ETL_CRON_SCHEDULES.STATS_SYNC,
      ),
      INJURIES_SYNC: config.get<string>(
        'ETL_INJURIES_SYNC_CRON',
        ETL_CRON_SCHEDULES.INJURIES_SYNC,
      ),
      ODDS_CSV_IMPORT: config.get<string>(
        'ETL_ODDS_CSV_IMPORT_CRON',
        ETL_CRON_SCHEDULES.ODDS_CSV_IMPORT,
      ),
      ELO_SYNC: config.get<string>(
        'ETL_ELO_SYNC_CRON',
        ETL_CRON_SCHEDULES.ELO_SYNC,
      ),
      ODDS_PREMATCH_SYNC: config.get<string>(
        'ETL_ODDS_PREMATCH_SYNC_CRON',
        ETL_CRON_SCHEDULES.ODDS_PREMATCH_SYNC,
      ),
      BETTING_ENGINE_ANALYSIS: config.get<string>(
        'ETL_BETTING_ENGINE_ANALYSIS_CRON',
        ETL_CRON_SCHEDULES.BETTING_ENGINE_ANALYSIS,
      ),
      ROLLING_HORIZON: config.get<string>(
        'ETL_ROLLING_HORIZON_CRON',
        ETL_CRON_SCHEDULES.ROLLING_HORIZON,
      ),
    };
    this.leagueSeasonSyncs = {
      fixtures: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:fixtures`,
        cronPattern: this.cronSchedules.FIXTURES_SYNC,
        syncType: 'fixtures',
        jobName: (competitionCode, season) =>
          `fixtures-sync-${competitionCode}-${season}`,
        scheduledSeasons: 'current',
      },
      stats: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:stats`,
        cronPattern: this.cronSchedules.STATS_SYNC,
        syncType: 'stats',
        jobName: (competitionCode, season) =>
          `stats-sync-${competitionCode}-${season}`,
        scheduledSeasons: 'current',
      },
      injuries: {
        queue: this.leagueSyncQueue,
        schedulerKey: `${ETL_SCHEDULER_KEYS.LEAGUE_SYNC}:injuries`,
        cronPattern: this.cronSchedules.INJURIES_SYNC,
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
            { pattern: this.cronSchedules.ODDS_CSV_IMPORT },
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
      { pattern: this.cronSchedules.ODDS_PREMATCH_SYNC },
      {
        name: 'odds-prematch-sync',
        data: {} satisfies OddsPrematchSyncJobData,
      },
    );

    await this.bettingEngineQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.BETTING_ENGINE_ANALYSIS,
      { pattern: this.cronSchedules.BETTING_ENGINE_ANALYSIS },
      {
        name: 'betting-engine-analysis',
        data: {} satisfies BettingEngineAnalysisJobData,
      },
    );

    if (this.rollingHorizonEnabled) {
      await this.rollingHorizonQueue.upsertJobScheduler(
        ETL_SCHEDULER_KEYS.ROLLING_HORIZON,
        { pattern: this.cronSchedules.ROLLING_HORIZON },
        {
          name: 'rolling-horizon',
          data: {
            startOffsetDays: ROLLING_HORIZON_DEFAULTS.START_OFFSET_DAYS,
            horizonDays: this.rollingHorizonDays,
          } satisfies RollingHorizonJobData,
        },
      );
      logger.info(
        { horizonDays: this.rollingHorizonDays },
        'Rolling horizon scheduler registered',
      );
    }

    await this.eloSyncQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.ELO_SYNC,
      { pattern: this.cronSchedules.ELO_SYNC },
      {
        name: 'elo-sync',
        data: {} satisfies EloSyncJobData,
      },
    );

    await this.staleScheduledSyncQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.STALE_SCHEDULED_SYNC,
      { pattern: this.cronSchedules.STALE_SCHEDULED_SYNC },
      {
        name: 'stale-scheduled-sync',
        data: {} satisfies StaleScheduledSyncJobData,
      },
    );

    await this.pendingBetsSettlementQueue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.PENDING_BETS_SETTLEMENT,
      { pattern: this.cronSchedules.PENDING_BETS_SETTLEMENT },
      {
        name: 'pending-bets-settlement-sync',
        data: {} satisfies PendingBetsSettlementJobData,
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
      const supported = Object.keys(THE_ODDS_API_SPORT_KEYS).join(', ');
      throw new Error(
        `${competitionCode} is not supported for historical odds import. Supported: ${supported}`,
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

  // Bulk variant of triggerOddsHistoricalImport: enqueues every (competition, season)
  // pair across the requested competitions (default: all of THE_ODDS_API_SPORT_KEYS),
  // with a single delay counter spanning the whole batch — staggering per-competition
  // instead would replay a delay=0 burst once per competition and blow past the
  // provider's rate limit once more than a couple of leagues are requested at once.
  async triggerOddsHistoricalImportFull(
    seasons: number[],
    competitionCodes?: string[],
  ): Promise<string[]> {
    const codes = competitionCodes ?? Object.keys(THE_ODDS_API_SPORT_KEYS);
    const invalid = codes.filter((c) => !(c in THE_ODDS_API_SPORT_KEYS));
    if (invalid.length > 0) {
      const supported = Object.keys(THE_ODDS_API_SPORT_KEYS).join(', ');
      throw new Error(
        `Unsupported competition code(s) for historical odds import: ${invalid.join(', ')}. Supported: ${supported}`,
      );
    }

    let jobIndex = 0;
    for (const code of codes as (keyof typeof THE_ODDS_API_SPORT_KEYS)[]) {
      for (const seasonYear of seasons) {
        await this.oddsHistoricalImportQueue.add(
          `odds-historical-${code}-${seasonYear}`,
          {
            competitionCode: code,
            seasonYear,
          } satisfies OddsHistoricalImportJobData,
          { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: jobIndex * 1_000 },
        );
        jobIndex++;
      }
    }

    return codes;
  }

  async triggerOddsCsvImportForSeasons(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const competition = await this.loadCompetition(competitionCode);
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

  async triggerBettingEngineAnalysis(date?: string): Promise<void> {
    await this.bettingEngineQueue.add(
      'betting-engine-analysis',
      { date } satisfies BettingEngineAnalysisJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  }

  // Historical rebuild: queues one idempotent rebuild job per season. Each job
  // re-runs the engine only on FINISHED fixtures without a ModelRun, so the
  // whole set can be safely re-queued after a partial run.
  async triggerBettingEngineRebuild(
    window: { from?: string; to?: string } = {},
  ): Promise<{ queued: number; seasonIds: string[] }> {
    const { from, to } = window;
    const seasons = await this.prisma.client.season.findMany({
      select: { id: true },
    });

    const jobs = await this.bettingEngineRebuildQueue.addBulk(
      seasons.map(({ id }) => ({
        name: 'betting-engine-rebuild',
        data: { seasonId: id, from, to } satisfies BettingEngineRebuildJobData,
        opts: BULLMQ_DEFAULT_JOB_OPTIONS,
      })),
    );

    return { queued: jobs.length, seasonIds: seasons.map((s) => s.id) };
  }

  async triggerEloSync(): Promise<void> {
    await this.eloSyncQueue.add(
      'elo-sync',
      {} satisfies EloSyncJobData,
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

  async getQueueStatus(): Promise<Record<string, Record<string, number>>> {
    const entries = await Promise.all(
      Object.entries(this.buildQueueMap()).map(async ([name, queue]) => {
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

  async cleanQueueFailed(queueName: string): Promise<number> {
    const queue = this.buildQueueMap()[queueName];
    if (!queue) {
      throw new NotFoundException(`Queue not found: ${queueName}`);
    }
    const removed = await queue.clean(0, 1000, 'failed');
    return removed.length;
  }

  async getSchedulerStatus(): Promise<SchedulerEntry[]> {
    const results = await Promise.all(
      Object.entries(this.buildQueueMap()).map(async ([queueName, queue]) => {
        const schedulers: JobSchedulerJson[] = await queue.getJobSchedulers();
        return schedulers.map((s) => ({
          queueName,
          key: s.key,
          name: s.name,
          pattern: s.pattern,
          every: s.every,
          next: s.next,
        }));
      }),
    );
    return results.flat();
  }

  private buildQueueMap(): Record<string, Queue> {
    return {
      [BULLMQ_QUEUES.LEAGUE_SYNC]: this.leagueSyncQueue,
      [BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT]: this.pendingBetsSettlementQueue,
      [BULLMQ_QUEUES.STALE_SCHEDULED_SYNC]: this.staleScheduledSyncQueue,
      [BULLMQ_QUEUES.ODDS_CSV_IMPORT]: this.oddsCsvQueue,
      [BULLMQ_QUEUES.ELO_SYNC]: this.eloSyncQueue,
      [BULLMQ_QUEUES.ODDS_PREMATCH_SYNC]: this.oddsPrematchQueue,
      [BULLMQ_QUEUES.BETTING_ENGINE]: this.bettingEngineQueue,
      [BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT]: this.oddsHistoricalImportQueue,
      [BULLMQ_QUEUES.ROLLING_HORIZON]: this.rollingHorizonQueue,
      [BULLMQ_QUEUES.AI_ENGINE]: this.aiEngineQueue,
      [BULLMQ_QUEUES.ML_TRAINING]: this.mlTrainingQueue,
      [BULLMQ_QUEUES.ML_SCHEDULER]: this.mlSchedulerQueue,
      [BULLMQ_QUEUES.BETTING_ENGINE_REBUILD]: this.bettingEngineRebuildQueue,
    };
  }

  async triggerFixturesSyncForLeague(competitionCode: string): Promise<void> {
    await this.triggerLeagueSeasonSyncForLeague('fixtures', competitionCode);
  }

  async triggerFixturesBackfillForSeasons(
    competitionCode: string,
    seasons: number[],
  ): Promise<void> {
    const competition = await this.loadCompetition(competitionCode);
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
    const competition = await this.loadCompetition(competitionCode);
    const jobs: LeagueSyncJobData[] = seasons.map((season) => ({
      syncType: 'stats',
      season,
      competitionCode,
      leagueId: competition.leagueId,
      syncScope: 'backfill',
    }));
    await this.enqueueLeagueSeasonJobs('stats', jobs);
  }

  async triggerInjuriesSyncForLeague(competitionCode: string): Promise<void> {
    await this.triggerLeagueSeasonSyncForLeague('injuries', competitionCode);
  }

  async triggerRollingHorizonAnalysis(options?: {
    startOffsetDays?: number;
    horizonDays?: number;
  }): Promise<{ enqueuedDates: string[] }> {
    const startOffset =
      options?.startOffsetDays ?? ROLLING_HORIZON_DEFAULTS.START_OFFSET_DAYS;
    const horizonDays = options?.horizonDays ?? this.rollingHorizonDays;

    const today = new Date();
    const enqueuedDates = Array.from({ length: horizonDays }, (_, i) =>
      formatDateUtc(addDays(today, startOffset + i)),
    );

    logger.info(
      { enqueuedDates, startOffset, horizonDays },
      'Triggering rolling horizon analysis',
    );

    await this.rollingHorizonQueue.add(
      'rolling-horizon',
      {
        startOffsetDays: startOffset,
        horizonDays,
      } satisfies RollingHorizonJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );

    return { enqueuedDates };
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
    await this.triggerBettingEngineAnalysis();
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

  private async loadCompetition(
    competitionCode: string,
  ): Promise<CompetitionRow> {
    const competition = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode },
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
      throw new Error(`Unknown competition: ${competitionCode}`);
    }
    return competition;
  }
}
