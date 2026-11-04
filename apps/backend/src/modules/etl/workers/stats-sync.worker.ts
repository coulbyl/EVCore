import { Injectable } from '@nestjs/common';
import { XgSource } from '@evcore/db';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { ApiFootballClient } from '../api-football.client';
import { FixtureByIdStatisticsSchema } from '../schemas/fixture-full.schema';
import { loadFixturesByIds } from '../fixtures-by-ids.loader';
import { FixtureService } from '../../fixture/fixture.service';
import {
  ETL_CONSTANTS,
  DEFAULT_SEASON_START_MONTH,
  STATS_BACKFILL,
} from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  seasonFallbackEndDate,
  seasonFallbackStartDate,
} from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import {
  loadActiveCompetition,
  toUpsertCompetitionInput,
} from './etl-worker.utils';
import { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import { fetchLeagueSeasonDates } from '../league-season-dates';
import { FixtureStatisticsService } from '../../fixture-statistics/fixture-statistics.service';
import { FixtureEventsService } from '../../fixture-events/fixture-events.service';
import type { FixtureDetailRejectionCause } from '../../fixture-events/fixture-events.types';

export type StatsSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
  syncScope?: 'routine' | 'backfill';
};

export type PendingStatisticsFixture = {
  externalId: number;
  homeTeam: { externalId: number };
  awayTeam: { externalId: number };
};

export type StatsSyncMode = 'all' | 'details-only';

export type StatsSyncBatchResult = {
  updated: number;
  skipped: number;
  statisticRows: number;
  // Fixtures now flagged statisticsUnavailable (API returned nothing usable).
  statisticsUnavailable: number;
  xgUnavailableIds: number[];
  // Skipped on a network or non-quota HTTP error, a rejected answer or a
  // fixture missing from it — left pending, retryable.
  failedExternalIds: number[];
  // Events, lineups and player statistics of the same answers.
  details: {
    written: number;
    // Of which marked eventsSyncedAt (nothing left to fetch).
    synced: number;
    // Block missing, team mismatch or failed write: nothing written, left
    // pending; each with its cause, for the operators' alert.
    rejections: DetailRejection[];
    // Invalid events, lineups or player blocks left out of written matches.
    dropped: number;
    // Missing, failed or rejected — what the events backfill counts.
    failedExternalIds: number[];
  };
  // /fixtures?ids= calls spent.
  calls: number;
  // Calls whose answer failed the envelope schema.
  rejectedCalls: number;
  abortReason: 'quota' | null;
};

export type DetailRejection = {
  externalId: number;
  cause: FixtureDetailRejectionCause;
  match: string | null;
};

const logger = createLogger('stats-sync-worker');

@Injectable()
export class StatsSyncWorker {
  // Routine sync: non-quota failures per fixture since process start.
  private readonly failedAttempts = new Map<number, number>();
  // UTC day of the last alert on rejected answers: one a day at most.
  private rejectionAlertDay: string | null = null;

  // eslint-disable-next-line max-params -- worker orchestrates focused feature services.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly apiFootball: ApiFootballClient,
    private readonly notification: NotificationService,
    private readonly prisma: PrismaService,
    private readonly rollingStatsService: RollingStatsService,
    private readonly fixtureStatistics: FixtureStatisticsService,
    private readonly fixtureEvents: FixtureEventsService,
  ) {}

  async process(job: Job<StatsSyncJobData>): Promise<void> {
    const {
      season,
      competitionCode,
      leagueId: leagueIdNum,
      syncScope = 'routine',
    } = job.data;
    const leagueId = String(leagueIdNum);

    logger.info({ competitionCode, season }, 'Starting stats sync');

    const competitionMeta = await loadActiveCompetition(
      this.prisma,
      competitionCode,
      { allowInactive: syncScope === 'backfill' },
    );
    if (!competitionMeta) {
      logger.info(
        { competitionCode, season },
        'Competition inactive — skipping stats sync job',
      );
      return;
    }

    // Resolve the internal seasonId (idempotent — same as fixtures-sync).
    // Authoritative-dates-first, heuristic-fallback — must agree with
    // fixtures-sync.worker.ts or it clobbers the dates that worker wrote
    // (see league-season-dates.ts).
    const competition = await this.fixtureService.upsertCompetition(
      toUpsertCompetitionInput(competitionMeta),
    );
    const seasonStartMonth =
      competitionMeta.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH;
    const seasonName = seasonNameFromYear(
      season,
      seasonStartMonth,
      competitionCode,
    );
    const apiSeasonDates = await fetchLeagueSeasonDates(
      this.apiFootball,
      leagueId,
      season,
    );
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonName,
      startDate:
        apiSeasonDates?.startDate ??
        seasonFallbackStartDate(season, seasonStartMonth),
      endDate:
        apiSeasonDates?.endDate ??
        seasonFallbackEndDate(season, seasonStartMonth),
    });

    // A fixture that keeps failing (missing from the answer, rejected call)
    // is left alone after MAX_FIXTURE_ATTEMPTS until the next restart: it
    // must not hold the 20 oldest places of every routine call. Never marked
    // unavailable on that basis (the backfill retries it on its own count).
    const pendingFixtures = (
      await this.fixtureService.findFinishedWithoutStatistics(seasonRecord.id)
    ).filter(
      ({ externalId }) =>
        (this.failedAttempts.get(externalId) ?? 0) <
        STATS_BACKFILL.MAX_FIXTURE_ATTEMPTS,
    );
    const maxPerJob =
      syncScope === 'backfill'
        ? ETL_CONSTANTS.STATS_BACKFILL_MAX_FIXTURES_PER_JOB
        : ETL_CONSTANTS.STATS_ROUTINE_MAX_FIXTURES_PER_JOB;
    const fixtures = pendingFixtures.slice(0, maxPerJob);

    logger.info(
      {
        season,
        count: fixtures.length,
        backlog: pendingFixtures.length,
        remainingAfterJob: pendingFixtures.length - fixtures.length,
        maxPerJob,
        syncScope,
      },
      'Fetching unpersisted final statistics for finished fixtures',
    );

    const {
      updated,
      skipped,
      statisticRows,
      xgUnavailableIds,
      details,
      calls,
      abortReason,
      failedExternalIds,
    } = await this.syncFixtures(fixtures);
    for (const externalId of failedExternalIds) {
      this.failedAttempts.set(
        externalId,
        (this.failedAttempts.get(externalId) ?? 0) + 1,
      );
    }

    if (abortReason !== null) {
      logger.warn(
        { competitionCode, season, abortReason, updated },
        'Stats sync aborted — API-Football refused further requests',
      );
    }

    logger.info(
      {
        season,
        seasonName,
        updated,
        skipped,
        statisticRows,
        calls,
        eventsWritten: details.written,
        eventsSynced: details.synced,
        eventsRejected: details.rejections.length,
      },
      'Stats sync complete',
    );

    if (updated > 0) {
      // Existing team_stats rows predate the newly persisted raw statistics.
      // A normal refresh only looks for missing rows and would therefore skip
      // them; backfillSeason recomputes all snapshots but writes only changes.
      await this.rollingStatsService.backfillSeason(seasonRecord.id);
    }

    if (xgUnavailableIds.length > 0) {
      await this.notification.sendXgUnavailableReport(
        seasonNameFromYear(season, seasonStartMonth, competitionCode),
        xgUnavailableIds,
      );
    }
  }

  // Fetches and persists, for the given fixtures, their final team
  // statistics, events, lineups and player statistics: one /fixtures?ids=
  // call per FIXTURES_BY_IDS_BATCH_SIZE fixtures. Stops at the first
  // quota/rate-limit signal: API-Football answers an exhausted daily quota
  // with a 200 whose `errors` is an object and whose `response` is empty —
  // left unchecked, that body failed Zod and the fixtures were marked
  // statisticsUnavailable for good. Nothing is marked on abort, nor for a
  // fixture missing from an answer (skipped, retried later).
  // `details-only` (events backfill) leaves fixture_statistic and the xG
  // untouched: those fixtures already have them.
  async syncFixtures(
    fixtures: PendingStatisticsFixture[],
    mode: StatsSyncMode = 'all',
  ): Promise<StatsSyncBatchResult> {
    const tally: StatsSyncBatchResult = {
      updated: 0,
      skipped: 0,
      statisticRows: 0,
      statisticsUnavailable: 0,
      xgUnavailableIds: [],
      failedExternalIds: [],
      details: {
        written: 0,
        synced: 0,
        rejections: [],
        dropped: 0,
        failedExternalIds: [],
      },
      calls: 0,
      rejectedCalls: 0,
      abortReason: null,
    };
    const fail = (externalId: number): void => {
      tally.skipped++;
      tally.failedExternalIds.push(externalId);
      tally.details.failedExternalIds.push(externalId);
    };

    const load = await loadFixturesByIds({
      apiFootball: this.apiFootball,
      externalIds: fixtures.map((fixture) => fixture.externalId),
      logger,
    });
    tally.calls = load.calls;
    tally.rejectedCalls = load.rejectedCalls;

    // Nothing is marked for a fixture left without its answer: retried.
    const observedAt = new Date();
    for (const fixture of fixtures) {
      const entry = load.entries.get(fixture.externalId);
      if (entry === undefined) {
        if (load.missed.has(fixture.externalId)) fail(fixture.externalId);
        continue;
      }
      if (mode === 'all') {
        await this.persistStatistics({ fixture, entry, tally });
      }
      await this.persistDetails({ fixture, entry, observedAt, tally });
    }

    await this.alertOnRejections(tally);
    return load.quotaReached ? { ...tally, abortReason: 'quota' } : tally;
  }

  // CLAUDE.md: a Zod failure on ETL data triggers an alert. One a day at
  // most (every routine job and backfill tick share this worker): a schema
  // drift would otherwise send one per competition or per five minutes.
  private async alertOnRejections(tally: StatsSyncBatchResult): Promise<void> {
    if (tally.rejectedCalls === 0 && tally.details.rejections.length === 0) {
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    if (this.rejectionAlertDay === day) return;
    this.rejectionAlertDay = day;
    try {
      await this.notification.sendEtlFailureAlert(
        'stats-sync',
        'fixtures-by-ids',
        rejectionAlertMessage({
          rejectedCalls: tally.rejectedCalls,
          rejections: tally.details.rejections,
        }),
      );
    } catch (error) {
      logger.error({ err: error }, 'Rejection alert could not be sent');
    }
  }

  // Team statistics and xG, exactly as /fixtures/statistics was handled:
  // anything but two teams matching the fixture marks it unavailable.
  private async persistStatistics(input: {
    fixture: PendingStatisticsFixture;
    entry: unknown;
    tally: StatsSyncBatchResult;
  }): Promise<void> {
    const { fixture, tally } = input;
    const { externalId, homeTeam, awayTeam } = fixture;
    const markUnavailable = async (): Promise<void> => {
      await this.fixtureService.markXgUnavailable(externalId);
      await this.fixtureStatistics.markUnavailable(externalId);
      tally.xgUnavailableIds.push(externalId);
      tally.statisticsUnavailable++;
      tally.skipped++;
    };

    const statistics = FixtureByIdStatisticsSchema.safeParse(
      (input.entry as { statistics?: unknown }).statistics,
    );
    if (!statistics.success) {
      logger.warn(
        { externalId, issues: statistics.error.issues },
        'Zod validation failed — marking xgUnavailable',
      );
      await markUnavailable();
      return;
    }

    const homeStats = statistics.data.find(
      (team) => team.team.id === homeTeam.externalId,
    );
    const awayStats = statistics.data.find(
      (team) => team.team.id === awayTeam.externalId,
    );
    if (!homeStats || !awayStats) {
      logger.warn(
        {
          externalId,
          expectedTeamIds: [homeTeam.externalId, awayTeam.externalId],
          receivedTeamIds: statistics.data.map((team) => team.team.id),
        },
        'Statistics teams do not match fixture — marking unavailable',
      );
      await markUnavailable();
      return;
    }

    const homeXg = extractXg(homeStats.statistics);
    const awayXg = extractXg(awayStats.statistics);

    if (homeXg === null || awayXg === null) {
      logger.warn(
        { externalId },
        'xG unavailable in statistics payload — marking fixture unavailable',
      );
      await this.fixtureService.markXgUnavailable(externalId);
      tally.xgUnavailableIds.push(externalId);
    } else {
      await this.fixtureService.updateXg({
        externalId,
        homeXg: homeXg.value,
        awayXg: awayXg.value,
        homeXgSource: homeXg.source,
        awayXgSource: awayXg.source,
      });
    }

    tally.statisticRows += await this.fixtureStatistics.persistFinalStatistics({
      fixtureExternalId: externalId,
      observedAt: new Date(),
      teams: statistics.data.map((team) => ({
        externalTeamId: team.team.id,
        statistics: team.statistics,
      })),
    });
    tally.updated++;
  }

  // Events, lineups and player statistics, through their one writer. A
  // rejection leaves the match pending (never unavailable) and never
  // touches its team statistics.
  private async persistDetails(input: {
    fixture: PendingStatisticsFixture;
    entry: unknown;
    observedAt: Date;
    tally: StatsSyncBatchResult;
  }): Promise<void> {
    const { tally } = input;
    const { externalId } = input.fixture;
    const written = await this.fixtureEvents.writeEntry({
      fixtureExternalId: externalId,
      observedAt: input.observedAt,
      entry: input.entry,
    });
    if (written.status === 'rejected') {
      tally.details.rejections.push({
        externalId,
        cause: written.cause,
        match: written.match,
      });
      tally.details.failedExternalIds.push(externalId);
      return;
    }
    const { events, lineups, players } = written.dropped;
    tally.details.dropped += events + lineups + players;
    tally.details.written++;
    if (written.synced) tally.details.synced++;
  }
}

const REJECTION_CAUSE_LABELS: Record<FixtureDetailRejectionCause, string> = {
  'unknown-team': 'unknown team',
  'missing-block': 'events, lineups or players block missing',
  'write-failed': 'database write failed',
  'unknown-fixture': 'fixture not in the database',
};

// How many matches the alert names per cause before « and N more ».
const ALERT_MATCHES_PER_CAUSE = 5;

/**
 * The stats-sync alert, readable in the admin bell: the rejected calls,
 * then the matches left without events grouped by cause, each named.
 */
export function rejectionAlertMessage(input: {
  rejectedCalls: number;
  rejections: readonly DetailRejection[];
}): string {
  const parts: string[] = [];
  if (input.rejectedCalls > 0) {
    parts.push(
      `${input.rejectedCalls} /fixtures?ids= answer(s) rejected whole by the schema (Zod), every match left pending`,
    );
  }
  const byCause = new Map<FixtureDetailRejectionCause, DetailRejection[]>();
  for (const rejection of input.rejections) {
    const group = byCause.get(rejection.cause) ?? [];
    group.push(rejection);
    byCause.set(rejection.cause, group);
  }
  if (byCause.size > 0) {
    const groups = [...byCause].map(([cause, group]) => {
      const named = group
        .slice(0, ALERT_MATCHES_PER_CAUSE)
        .map(({ externalId, match }) =>
          match === null ? `#${externalId}` : `${match} (#${externalId})`,
        );
      const more = group.length - named.length;
      return `${REJECTION_CAUSE_LABELS[cause]} — ${group.length}: ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
    });
    parts.push(
      `${input.rejections.length} match(es) without their events, lineups and player statistics, left pending. ${groups.join('. ')}`,
    );
  }
  return `${parts.join('. ')}.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the xG for a team's statistics array.
// Priority 1: native expected_goals field (API-Football, available from mid-2022-23 onwards).
// Priority 2: shots proxy fallback (Shots on Goal × factor) for older fixtures
//             where the API did not yet track expected_goals.
export function extractXg(
  statistics: { type: string; value: number | string | null }[],
): { value: number; source: XgSource } | null {
  const xgEntry = statistics.find((s) => s.type === 'expected_goals');
  if (xgEntry !== undefined && xgEntry.value !== null) {
    const parsed = parseFloat(String(xgEntry.value));
    return isNaN(parsed)
      ? null
      : { value: parsed, source: XgSource.API_FOOTBALL };
  }
  // Field absent or null (e.g. lower divisions) → fall back to shots proxy
  const shotsOnTarget = extractShotsOnTarget(statistics);
  return shotsOnTarget === null
    ? null
    : {
        value: shotsOnTarget * ETL_CONSTANTS.XG_SHOTS_PROXY_FACTOR,
        source: XgSource.SHOTS_PROXY,
      };
}

function extractShotsOnTarget(
  statistics: { type: string; value: number | string | null }[],
): number | null {
  const entry = statistics.find((s) => s.type === 'Shots on Goal');
  if (!entry || entry.value === null) return null;
  const parsed = parseInt(String(entry.value), 10);
  return isNaN(parsed) ? null : parsed;
}
