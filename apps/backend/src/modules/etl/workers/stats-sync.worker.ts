import { Injectable } from '@nestjs/common';
import { XgSource } from '@evcore/db';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import {
  ApiFootballClient,
  isQuotaExceededError,
} from '../api-football.client';
import {
  ApiFootballFixturesByIdsResponseSchema,
  FixtureByIdDetailsSchema,
  FixtureByIdIdentitySchema,
  FixtureByIdStatisticsSchema,
} from '../schemas/fixture-full.schema';
import { FixtureService } from '../../fixture/fixture.service';
import {
  ETL_CONSTANTS,
  DEFAULT_SEASON_START_MONTH,
} from '@config/etl.constants';
import { sleep } from '@utils/async.utils';
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
    // Zod or team mismatch: nothing written, left pending.
    rejected: number;
    // Missing, failed or rejected — what the events backfill counts.
    failedExternalIds: number[];
  };
  // /fixtures?ids= calls spent.
  calls: number;
  abortReason: 'quota' | null;
};

const logger = createLogger('stats-sync-worker');

@Injectable()
export class StatsSyncWorker {
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

    const pendingFixtures =
      await this.fixtureService.findFinishedWithoutStatistics(seasonRecord.id);
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
    } = await this.syncFixtures(fixtures);

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
        eventsRejected: details.rejected,
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
        rejected: 0,
        failedExternalIds: [],
      },
      calls: 0,
      abortReason: null,
    };
    const fail = (externalId: number): void => {
      tally.skipped++;
      tally.failedExternalIds.push(externalId);
      tally.details.failedExternalIds.push(externalId);
    };

    const batchSize = ETL_CONSTANTS.FIXTURES_BY_IDS_BATCH_SIZE;
    for (let start = 0; start < fixtures.length; start += batchSize) {
      const batch = fixtures.slice(start, start + batchSize);
      if (start > 0) await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);

      const ids = batch.map((fixture) => fixture.externalId);
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?ids=${ids.join('-')}`;
      const curlResult = await this.apiFootball.fetchJson(url);
      tally.calls++;

      if (curlResult.response === null) {
        logger.warn({ ids }, 'Transient network error — skipping batch');
        ids.forEach(fail);
        continue;
      }
      const res = curlResult.response;

      if (res.status === 429 || isQuotaExceededError(res.body)) {
        logger.warn(
          { ids, status: res.status, body: res.body },
          'API-FOOTBALL quota or rate limit reached — aborting batch',
        );
        return { ...tally, abortReason: 'quota' };
      }

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { ids, status: res.status },
          'API-FOOTBALL error — skipping batch',
        );
        ids.forEach(fail);
        continue;
      }

      // The envelope is the whole call: rejected, nothing is written and
      // nothing is marked — every fixture stays pending.
      const envelope = ApiFootballFixturesByIdsResponseSchema.safeParse(
        res.body,
      );
      if (!envelope.success) {
        logger.warn(
          { ids, issues: envelope.error.issues },
          'Zod validation failed on /fixtures?ids= — skipping batch',
        );
        ids.forEach(fail);
        continue;
      }

      const entries = new Map<number, unknown>();
      for (const entry of envelope.data.response) {
        const identity = FixtureByIdIdentitySchema.safeParse(entry);
        if (identity.success) entries.set(identity.data.fixture.id, entry);
      }

      const observedAt = new Date();
      for (const fixture of batch) {
        const entry = entries.get(fixture.externalId);
        if (entry === undefined) {
          logger.warn(
            { externalId: fixture.externalId },
            'Fixture missing from /fixtures?ids= answer — left pending',
          );
          fail(fixture.externalId);
          continue;
        }
        if (mode === 'all') {
          await this.persistStatistics({ fixture, entry, tally });
        }
        await this.persistDetails({ fixture, entry, observedAt, tally });
      }
    }

    return tally;
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

  // Events, lineups and player statistics: validated together, written
  // together. A rejection leaves the match pending (never unavailable) and
  // never touches its team statistics.
  private async persistDetails(input: {
    fixture: PendingStatisticsFixture;
    entry: unknown;
    observedAt: Date;
    tally: StatsSyncBatchResult;
  }): Promise<void> {
    const { fixture, tally } = input;
    const { externalId } = fixture;
    const details = FixtureByIdDetailsSchema.safeParse(input.entry);
    if (!details.success) {
      logger.warn(
        { externalId, issues: details.error.issues.slice(0, 5) },
        'Zod validation failed on events/lineups/players — left pending',
      );
      tally.details.rejected++;
      tally.details.failedExternalIds.push(externalId);
      return;
    }

    const written = await this.fixtureEvents.persistDetails({
      fixtureExternalId: externalId,
      observedAt: input.observedAt,
      details: details.data,
    });
    if (written.status === 'rejected') {
      logger.warn(
        { externalId, reason: written.reason },
        'Events/lineups/players rejected — left pending',
      );
      tally.details.rejected++;
      tally.details.failedExternalIds.push(externalId);
      return;
    }
    tally.details.written++;
    if (written.synced) tally.details.synced++;
  }
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
