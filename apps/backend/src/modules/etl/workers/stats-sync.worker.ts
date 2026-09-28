import { Injectable } from '@nestjs/common';
import { XgSource } from '@evcore/db';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import {
  ApiFootballClient,
  isQuotaExceededError,
} from '../api-football.client';
import { ApiFootballStatisticsResponseSchema } from '../schemas/stats.schema';
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

export type StatsSyncBatchResult = {
  updated: number;
  skipped: number;
  statisticRows: number;
  // Fixtures now flagged statisticsUnavailable (API returned nothing usable).
  statisticsUnavailable: number;
  xgUnavailableIds: number[];
  // Skipped on a network or non-quota HTTP error — left pending, retryable.
  failedExternalIds: number[];
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

    const { updated, skipped, statisticRows, xgUnavailableIds, abortReason } =
      await this.syncFixtures(fixtures);

    if (abortReason !== null) {
      logger.warn(
        { competitionCode, season, abortReason, updated },
        'Stats sync aborted — API-Football refused further requests',
      );
    }

    logger.info(
      { season, seasonName, updated, skipped, statisticRows },
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

  // Fetches and persists final statistics for the given fixtures, one call
  // each. Stops at the first quota/rate-limit signal: API-Football answers an
  // exhausted daily quota with a 200 whose `errors` is an object and whose
  // `response` is empty — left unchecked, that body failed Zod and the
  // fixture was marked statisticsUnavailable for good. Nothing is marked on
  // abort.
  async syncFixtures(
    fixtures: PendingStatisticsFixture[],
  ): Promise<StatsSyncBatchResult> {
    let updated = 0;
    let skipped = 0;
    let statisticRows = 0;
    let statisticsUnavailable = 0;
    const xgUnavailableIds: number[] = [];
    const failedExternalIds: number[] = [];
    const result = (abortReason: 'quota' | null): StatsSyncBatchResult => ({
      updated,
      skipped,
      statisticRows,
      statisticsUnavailable,
      xgUnavailableIds,
      failedExternalIds,
      abortReason,
    });

    for (const { externalId, homeTeam, awayTeam } of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures/statistics?fixture=${externalId}`;
      const curlResult = await this.apiFootball.fetchJson(url);

      if (curlResult.response === null) {
        logger.warn(
          { externalId },
          'Transient network error — skipping fixture',
        );
        skipped++;
        failedExternalIds.push(externalId);
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }
      const res = curlResult.response;

      if (res.status === 429 || isQuotaExceededError(res.body)) {
        logger.warn(
          { externalId, status: res.status, body: res.body },
          'API-FOOTBALL quota or rate limit reached — aborting batch',
        );
        return result('quota');
      }

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { externalId, status: res.status },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
        failedExternalIds.push(externalId);
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const parsed = ApiFootballStatisticsResponseSchema.safeParse(res.body);

      if (!parsed.success) {
        logger.warn(
          { externalId, issues: parsed.error.issues },
          'Zod validation failed — marking xgUnavailable',
        );
        await this.fixtureService.markXgUnavailable(externalId);
        await this.fixtureStatistics.markUnavailable(externalId);
        xgUnavailableIds.push(externalId);
        statisticsUnavailable++;
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const homeStats = parsed.data.response.find(
        (team) => team.team.id === homeTeam.externalId,
      );
      const awayStats = parsed.data.response.find(
        (team) => team.team.id === awayTeam.externalId,
      );
      if (!homeStats || !awayStats) {
        logger.warn(
          {
            externalId,
            expectedTeamIds: [homeTeam.externalId, awayTeam.externalId],
            receivedTeamIds: parsed.data.response.map((team) => team.team.id),
          },
          'Statistics teams do not match fixture — marking unavailable',
        );
        await this.fixtureService.markXgUnavailable(externalId);
        await this.fixtureStatistics.markUnavailable(externalId);
        xgUnavailableIds.push(externalId);
        statisticsUnavailable++;
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const homeXg = extractXg(homeStats.statistics);
      const awayXg = extractXg(awayStats.statistics);

      if (homeXg === null || awayXg === null) {
        logger.warn(
          { externalId },
          'xG unavailable in statistics payload — marking fixture unavailable',
        );
        await this.fixtureService.markXgUnavailable(externalId);
        xgUnavailableIds.push(externalId);
      } else {
        await this.fixtureService.updateXg({
          externalId,
          homeXg: homeXg.value,
          awayXg: awayXg.value,
          homeXgSource: homeXg.source,
          awayXgSource: awayXg.source,
        });
      }

      statisticRows += await this.fixtureStatistics.persistFinalStatistics({
        fixtureExternalId: externalId,
        observedAt: new Date(),
        teams: parsed.data.response.map((team) => ({
          externalTeamId: team.team.id,
          statistics: team.statistics,
        })),
      });
      updated++;

      await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
    }

    return result(null);
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
