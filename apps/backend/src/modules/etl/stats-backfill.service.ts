import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createLogger } from '@utils/logger';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  BULLMQ_QUEUES,
  ETL_SCHEDULER_KEYS,
  STATS_BACKFILL,
} from '@config/etl.constants';
import { FixtureService } from '../fixture/fixture.service';
import { ApiFootballClient } from './api-football.client';
import {
  rankStatsBackfillSeasons,
  statsBackfillBudget,
  statsBackfillDailyReserve,
} from './stats-backfill.plan';
import type { StatsBackfillJobData } from './workers/stats-backfill.worker';

const logger = createLogger('stats-backfill-service');
const STATUS_QUEUE_PREVIEW = 10;

type StatsBackfillSeasonView = {
  competitionCode: string;
  seasonName: string;
  wave: number;
  pending: number;
  synced: number;
  unavailable: number;
};

export type StatsBackfillStatus = {
  scheduled: boolean;
  paused: boolean;
  reserve: number;
  quota: { current: number; limitDay: number; budget: number } | null;
  totals: {
    seasons: number;
    completedSeasons: number;
    pending: number;
    synced: number;
    unavailable: number;
  };
  next: StatsBackfillSeasonView[];
  parked: StatsBackfillSeasonView[];
};

@Injectable()
export class StatsBackfillService implements OnApplicationBootstrap {
  private readonly scheduled: boolean;
  private readonly reserve: number;
  private readonly cronPattern: string;

  // eslint-disable-next-line max-params -- queue + config + two read dependencies.
  constructor(
    @InjectQueue(BULLMQ_QUEUES.STATS_BACKFILL)
    private readonly queue: Queue<StatsBackfillJobData>,
    config: ConfigService,
    private readonly fixtureService: FixtureService,
    private readonly apiFootball: ApiFootballClient,
  ) {
    this.scheduled =
      config.get<string>('ETL_SCHEDULING_ENABLED', 'true') !== 'false' &&
      config.get<string>('STATS_BACKFILL_ENABLED', 'true') !== 'false';
    this.reserve = statsBackfillDailyReserve(config);
    this.cronPattern = config.get<string>(
      'ETL_STATS_BACKFILL_CRON',
      STATS_BACKFILL.CRON,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.scheduled) {
      await this.queue.removeJobScheduler(ETL_SCHEDULER_KEYS.STATS_BACKFILL);
      logger.info('Automatic stats backfill disabled');
      return;
    }

    await this.queue.upsertJobScheduler(
      ETL_SCHEDULER_KEYS.STATS_BACKFILL,
      { pattern: this.cronPattern },
      {
        name: 'stats-backfill',
        data: {} satisfies StatsBackfillJobData,
        opts: { removeOnComplete: 100, removeOnFail: 200 },
      },
    );
    logger.info(
      { pattern: this.cronPattern, reserve: this.reserve },
      'Automatic stats backfill scheduler registered',
    );
  }

  // Persisted in Redis: survives restarts until resumed.
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async runNow(): Promise<void> {
    await this.queue.add('stats-backfill', {} satisfies StatsBackfillJobData, {
      ...BULLMQ_DEFAULT_JOB_OPTIONS,
      attempts: 1,
    });
  }

  async getStatus(): Promise<StatsBackfillStatus> {
    const [paused, usage, candidates] = await Promise.all([
      this.queue.isPaused(),
      this.apiFootball.getQuotaUsage(),
      this.fixtureService.findStatsBackfillCandidates(
        new Date(STATS_BACKFILL.MIN_SEASON_START),
      ),
    ]);
    const ranked = rankStatsBackfillSeasons(candidates, new Date());
    const view = (
      season: (typeof ranked)[number],
    ): StatsBackfillSeasonView => ({
      competitionCode: season.competitionCode,
      seasonName: season.seasonName,
      wave: season.wave,
      pending: season.pending,
      synced: season.synced,
      unavailable: season.unavailable,
    });
    const open = ranked.filter((season) => season.pending > 0);

    return {
      scheduled: this.scheduled,
      paused,
      reserve: this.reserve,
      quota:
        usage === null
          ? null
          : { ...usage, budget: statsBackfillBudget(usage, this.reserve) },
      totals: {
        seasons: ranked.length,
        completedSeasons: ranked.length - open.length,
        pending: sum(open.filter((s) => !s.parked).map((s) => s.pending)),
        synced: sum(ranked.map((s) => s.synced)),
        unavailable: sum(ranked.map((s) => s.unavailable)),
      },
      next: open
        .filter((season) => !season.parked)
        .slice(0, STATUS_QUEUE_PREVIEW)
        .map(view),
      parked: open.filter((season) => season.parked).map(view),
    };
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
