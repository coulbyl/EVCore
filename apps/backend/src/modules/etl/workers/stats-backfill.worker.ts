import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import {
  BULLMQ_QUEUES,
  FIXTURE_EVENTS,
  STATS_BACKFILL,
} from '@config/etl.constants';
import { NotificationService } from '@modules/notification/notification.service';
import { FixtureService } from '../../fixture/fixture.service';
import { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import {
  fixturesWithinBudget,
  isStatsBackfillParked,
  rankStatsBackfillSeasons,
  statsBackfillLotSize,
  type RankedStatsBackfillSeason,
} from '../stats-backfill.plan';
import { StatsBackfillService } from '../stats-backfill.service';
import {
  SquadsSyncService,
  type SquadsLotResult,
} from '../squads-sync.service';
import {
  StatsSyncWorker,
  type PendingStatisticsFixture,
} from './stats-sync.worker';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type StatsBackfillJobData = Record<string, never>;

// The events lot of a tick: fixtures with team statistics but without
// events, lineups and player statistics, in what the stats lot left of the
// budget.
export type EventsBackfillLotResult = {
  status: 'lot-done' | 'lot-aborted' | 'nothing-left';
  count: number;
  written: number;
  synced: number;
  calls: number;
};

export type StatsBackfillTickResult =
  | {
      status: 'routine-stats-sync' | 'quota-unknown' | 'budget-exhausted';
    }
  | {
      status: 'nothing-left';
      squads?: SquadsLotResult;
      events?: EventsBackfillLotResult;
    }
  | {
      status: 'lot-done' | 'lot-aborted';
      competitionCode: string;
      seasonName: string;
      updated: number;
      remainingAfterJob: number;
      squads?: SquadsLotResult;
      events?: EventsBackfillLotResult;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

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
  // Same rule for the events lot (missing from the answer, rejected).
  private readonly failedEventAttempts = new Map<number, number>();
  // When each fixture was last asked in an events lot: a recent match not
  // yet reported is asked again only once NOT_REPORTED_RETRY_MINUTES passed.
  private readonly eventsAskedAt = new Map<number, number>();

  // eslint-disable-next-line max-params -- worker orchestrates focused feature services.
  constructor(
    private readonly statsBackfill: StatsBackfillService,
    private readonly fixtureService: FixtureService,
    private readonly statsSync: StatsSyncWorker,
    private readonly rollingStatsService: RollingStatsService,
    private readonly notification: NotificationService,
    private readonly squadsSync: SquadsSyncService,
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

    const stats = await this.runStatsPart(budget);
    // A quota stop ends the tick: nothing more is spent.
    if (stats.result.status === 'lot-aborted') return stats.result;

    // Squads before the events catch-up: the odds of the coming days need
    // them, the events of past matches can wait a tick.
    let left = budget - stats.calls;
    const squads = left > 0 ? await this.squadsSync.syncDue(left) : null;
    if (squads?.status === 'lot-aborted') {
      return { ...stats.result, squads };
    }
    left -= squads?.calls ?? 0;
    const events = left > 0 ? await this.runEventsLot(left) : null;
    return {
      ...stats.result,
      ...(squads && squads.status !== 'nothing-left' ? { squads } : {}),
      ...(events && events.status !== 'nothing-left' ? { events } : {}),
    };
  }

  private async runStatsPart(budget: number): Promise<{
    result: Extract<
      StatsBackfillTickResult,
      { status: 'nothing-left' | 'lot-done' | 'lot-aborted' }
    >;
    calls: number;
  }> {
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
    return { result: { status: 'nothing-left' }, calls: 0 };
  }

  // Events, lineups and player statistics, most recent first, 20 per call:
  // fixtures the stats sync is done with past the grace period, and recent
  // ones with no event written yet (findEventsBackfillPending), each asked
  // at most every NOT_REPORTED_RETRY_MINUTES.
  private async runEventsLot(budget: number): Promise<EventsBackfillLotResult> {
    const lotSize = Math.min(
      FIXTURE_EVENTS.BACKFILL_MAX_FIXTURES_PER_LOT,
      fixturesWithinBudget(budget),
    );
    const now = Date.now();
    const retryAfter = now - FIXTURE_EVENTS.NOT_REPORTED_RETRY_MINUTES * 60_000;
    for (const [externalId, askedAt] of this.eventsAskedAt) {
      if (askedAt <= retryAfter) this.eventsAskedAt.delete(externalId);
    }
    const excluded = [
      ...[...this.failedEventAttempts.entries()]
        .filter(
          ([, attempts]) => attempts >= STATS_BACKFILL.MAX_FIXTURE_ATTEMPTS,
        )
        .map(([externalId]) => externalId),
      ...this.eventsAskedAt.keys(),
    ];
    const lot = await this.fixtureService.findEventsBackfillPending({
      before: new Date(now - FIXTURE_EVENTS.INCOMPLETE_GRACE_DAYS * DAY_MS),
      notReportedSince: new Date(
        now - FIXTURE_EVENTS.NOT_REPORTED_WINDOW_HOURS * 3_600_000,
      ),
      limit: lotSize,
      excludeExternalIds: [...new Set(excluded)],
    });
    if (lot.length === 0) {
      return {
        status: 'nothing-left',
        count: 0,
        written: 0,
        synced: 0,
        calls: 0,
      };
    }

    const result = await this.statsSync.syncFixtures(lot, 'details-only');
    // A quota stop asked nothing: those fixtures are not held back.
    if (result.abortReason === null) {
      for (const { externalId } of lot) this.eventsAskedAt.set(externalId, now);
    }
    for (const externalId of result.details.failedExternalIds) {
      this.failedEventAttempts.set(
        externalId,
        (this.failedEventAttempts.get(externalId) ?? 0) + 1,
      );
    }

    const events: EventsBackfillLotResult = {
      status: result.abortReason === null ? 'lot-done' : 'lot-aborted',
      count: lot.length,
      written: result.details.written,
      synced: result.details.synced,
      calls: result.calls,
    };
    logger.info(
      {
        ...events,
        rejected: result.details.rejected,
        failed: result.details.failedExternalIds.length,
        abortReason: result.abortReason,
      },
      'Events backfill lot complete',
    );
    return events;
  }

  private async runLot(input: {
    season: RankedStatsBackfillSeason;
    pending: PendingStatisticsFixture[];
    lotSize: number;
  }): Promise<{
    result: Extract<
      StatsBackfillTickResult,
      { status: 'lot-done' | 'lot-aborted' }
    >;
    calls: number;
  }> {
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
      result: {
        status: result.abortReason === null ? 'lot-done' : 'lot-aborted',
        competitionCode: season.competitionCode,
        seasonName: season.seasonName,
        updated: result.updated,
        remainingAfterJob,
      },
      calls: result.calls,
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
