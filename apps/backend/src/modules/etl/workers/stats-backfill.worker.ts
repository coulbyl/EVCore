import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, STATS_BACKFILL } from '@config/etl.constants';
import { NotificationService } from '@modules/notification/notification.service';
import { FixtureService } from '../../fixture/fixture.service';
import { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import {
  isStatsBackfillParked,
  rankStatsBackfillSeasons,
  statsBackfillLotSize,
  type RankedStatsBackfillSeason,
} from '../stats-backfill.plan';
import { StatsBackfillService } from '../stats-backfill.service';
import {
  StatsSyncWorker,
  type PendingStatisticsFixture,
} from './stats-sync.worker';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type StatsBackfillJobData = Record<string, never>;

export type StatsBackfillTickResult =
  | {
      status:
        | 'routine-stats-sync'
        | 'quota-unknown'
        | 'budget-exhausted'
        | 'nothing-left';
    }
  | {
      status: 'lot-done' | 'lot-aborted';
      competitionCode: string;
      seasonName: string;
      updated: number;
      remainingAfterJob: number;
    };

const logger = createLogger('stats-backfill-worker');

// Automates the stats backfill (docs/backfill-statistiques-automatique.md):
// one lot per tick, on the highest-priority season still missing final
// statistics, within the API-Football budget left above the production
// reserve. Dedicated queue, default concurrency 1 — two lots never overlap.
@Processor(BULLMQ_QUEUES.STATS_BACKFILL)
export class StatsBackfillWorker extends WorkerHost {
  // Non-quota failures per fixture since process start. Past
  // MAX_FIXTURE_ATTEMPTS a fixture is left alone so a permanently failing id
  // neither blocks its season nor burns a call on every tick.
  private readonly failedAttempts = new Map<number, number>();

  // eslint-disable-next-line max-params -- worker orchestrates focused feature services.
  constructor(
    private readonly statsBackfill: StatsBackfillService,
    private readonly fixtureService: FixtureService,
    private readonly statsSync: StatsSyncWorker,
    private readonly rollingStatsService: RollingStatsService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(
    _: Job<StatsBackfillJobData>,
  ): Promise<StatsBackfillTickResult> {
    if (await this.statsBackfill.isRoutineStatsSyncImminent()) {
      logger.info('Routine stats sync running or due — skipping backfill tick');
      return { status: 'routine-stats-sync' };
    }

    // Never spend blind: without a readable counter, wait for the next tick.
    const quota = await this.statsBackfill.readBudget();
    if (quota === null) {
      logger.warn('API-Football quota unreadable — skipping backfill tick');
      return { status: 'quota-unknown' };
    }

    const { usage, budget, reserve } = quota;
    if (budget === 0) {
      logger.info(
        { current: usage.current, limitDay: usage.limitDay, reserve },
        'Stats backfill budget exhausted — waiting for quota reset',
      );
      return { status: 'budget-exhausted' };
    }

    const seasons = rankStatsBackfillSeasons(
      await this.fixtureService.findStatsBackfillCandidates(
        new Date(STATS_BACKFILL.MIN_SEASON_START),
      ),
      new Date(),
    );

    for (const season of seasons) {
      if (season.pending === 0 || season.parked) continue;

      const pending = await this.retryablePending(season.seasonId);
      if (pending.length === 0) continue;

      return this.runLot({
        season,
        pending,
        lotSize: statsBackfillLotSize(season, budget),
      });
    }

    logger.debug('Stats backfill — no season left to process');
    return { status: 'nothing-left' };
  }

  private async runLot(input: {
    season: RankedStatsBackfillSeason;
    pending: PendingStatisticsFixture[];
    lotSize: number;
  }): Promise<StatsBackfillTickResult> {
    const { season, pending, lotSize } = input;
    const lot = pending.slice(0, lotSize);

    logger.info(
      {
        competitionCode: season.competitionCode,
        seasonName: season.seasonName,
        wave: season.wave,
        seasonRank: season.seasonRank,
        count: lot.length,
        backlog: pending.length,
      },
      'Stats backfill lot starting',
    );

    const result = await this.statsSync.syncFixtures(lot);
    for (const externalId of result.failedExternalIds) {
      this.failedAttempts.set(
        externalId,
        (this.failedAttempts.get(externalId) ?? 0) + 1,
      );
    }

    const remainingAfterJob = (await this.retryablePending(season.seasonId))
      .length;
    const synced = season.synced + result.updated;
    const unavailable = season.unavailable + result.statisticsUnavailable;

    logger.info(
      {
        competitionCode: season.competitionCode,
        seasonName: season.seasonName,
        count: lot.length,
        backlog: pending.length,
        remainingAfterJob,
        updated: result.updated,
        skipped: result.skipped,
        statisticRows: result.statisticRows,
        abortReason: result.abortReason,
      },
      'Stats backfill lot complete',
    );

    // Recomputing rolling stats rewrites the whole season: do it after every
    // lot only while the season still feeds upcoming predictions, otherwise
    // once, when the season is drained.
    const drained = remainingAfterJob === 0;
    if (
      (season.inProgress && result.updated > 0) ||
      (!season.inProgress && drained && synced > 0)
    ) {
      await this.rollingStatsService.backfillSeason(season.seasonId);
    }

    if (!season.parked && isStatsBackfillParked({ synced, unavailable })) {
      const message = `${season.competitionCode} ${season.seasonName}: ${synced} synced / ${synced + unavailable} attempted — API-Football does not cover its statistics, season skipped by the automatic backfill`;
      logger.warn(
        {
          competitionCode: season.competitionCode,
          seasonName: season.seasonName,
          synced,
          unavailable,
        },
        'Stats backfill season parked — low statistics coverage',
      );
      await this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.STATS_BACKFILL,
        'stats-backfill',
        message,
      );
    }

    return {
      status: result.abortReason === null ? 'lot-done' : 'lot-aborted',
      competitionCode: season.competitionCode,
      seasonName: season.seasonName,
      updated: result.updated,
      remainingAfterJob,
    };
  }

  private async retryablePending(
    seasonId: string,
  ): Promise<PendingStatisticsFixture[]> {
    const pending =
      await this.fixtureService.findFinishedWithoutStatistics(seasonId);
    return pending.filter(
      ({ externalId }) =>
        (this.failedAttempts.get(externalId) ?? 0) <
        STATS_BACKFILL.MAX_FIXTURE_ATTEMPTS,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<StatsBackfillJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.STATS_BACKFILL,
      job,
      error,
      logger,
    });
  }
}
