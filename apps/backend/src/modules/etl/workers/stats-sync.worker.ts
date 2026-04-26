import { execFile } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { ApiFootballStatisticsResponseSchema } from '../schemas/stats.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS } from '@config/etl.constants';
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

export type StatsSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
  syncScope?: 'routine' | 'backfill';
};

const logger = createLogger('stats-sync-worker');
const CURL_HTTP_CODE_MARKER = '__EVCORE_HTTP_CODE__';

@Injectable()
export class StatsSyncWorker {
  // eslint-disable-next-line max-params -- Prisma required to resolve competition from DB.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
    private readonly prisma: PrismaService,
    private readonly rollingStatsService: RollingStatsService,
  ) {}

  async process(job: Job<StatsSyncJobData>): Promise<void> {
    const { season, competitionCode, syncScope = 'routine' } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

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

    // Resolve the internal seasonId (idempotent — same as fixtures-sync)
    const competition = await this.fixtureService.upsertCompetition(
      toUpsertCompetitionInput(competitionMeta),
    );
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonNameFromYear(season),
      startDate: seasonFallbackStartDate(season),
      endDate: seasonFallbackEndDate(season),
    });

    const fixtures = await this.fixtureService.findFinishedWithoutXg(
      seasonRecord.id,
    );

    logger.info(
      { season, count: fixtures.length },
      'Fetching statistics for finished fixtures without xG',
    );

    let updated = 0;
    let skipped = 0;
    const xgUnavailableIds: number[] = [];

    for (const { externalId } of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures/statistics?fixture=${externalId}`;
      const curlResult = await fetchJsonViaCurl(url, apiKey);

      if (curlResult.response === null) {
        logger.warn(
          { externalId },
          'Transient network error — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }
      const res = curlResult.response;

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { externalId, status: res.status },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
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
        xgUnavailableIds.push(externalId);
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const [homeStats, awayStats] = parsed.data.response;
      const homeXg = extractXg(homeStats.statistics);
      const awayXg = extractXg(awayStats.statistics);

      if (homeXg === null || awayXg === null) {
        logger.warn(
          { externalId },
          'xG unavailable in statistics payload — marking fixture unavailable',
        );
        await this.fixtureService.markXgUnavailable(externalId);
        xgUnavailableIds.push(externalId);
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      await this.fixtureService.updateXg(externalId, homeXg, awayXg);
      updated++;

      await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
    }

    logger.info({ season, updated, skipped }, 'Stats sync complete');

    if (updated > 0) {
      await this.rollingStatsService.refreshSeason(seasonRecord.id);
    }

    if (xgUnavailableIds.length > 0) {
      await this.notification.sendXgUnavailableReport(
        seasonNameFromYear(season),
        xgUnavailableIds,
      );
    }
  }
}

type CurlJsonResponse = {
  status: number;
  body: unknown;
};

type CurlJsonResult = {
  response: CurlJsonResponse | null;
  transientErrorCode?: string;
};

async function fetchJsonViaCurl(
  url: string,
  apiKey: string,
): Promise<CurlJsonResult> {
  try {
    const stdout = await runCurlJsonRequest(url, apiKey);
    const lastMarker = stdout.lastIndexOf(`\n${CURL_HTTP_CODE_MARKER}:`);
    if (lastMarker === -1) {
      throw new Error('curl output missing HTTP code marker');
    }

    const bodyText = stdout.slice(0, lastMarker);
    const statusText = stdout
      .slice(lastMarker + `\n${CURL_HTTP_CODE_MARKER}:`.length)
      .trim();
    const status = Number.parseInt(statusText, 10);

    if (Number.isNaN(status)) {
      throw new Error(`curl returned invalid HTTP code: ${statusText}`);
    }

    let body: unknown = null;
    if (bodyText.trim().length > 0) {
      body = JSON.parse(bodyText);
    }

    return { response: { status, body } };
  } catch (error) {
    const transientErrorCode = getCurlTransientErrorCode(error);
    if (transientErrorCode !== undefined) {
      return { response: null, transientErrorCode };
    }
    throw error;
  }
}

function runCurlJsonRequest(url: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--write-out',
        `\n${CURL_HTTP_CODE_MARKER}:%{http_code}`,
        '-H',
        `x-apisports-key: ${apiKey}`,
        url,
      ],
      (error, stdout) => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function getCurlTransientErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message.toLowerCase();
  if (message.includes('timed out')) return 'ETIMEDOUT';
  if (message.includes('could not resolve host')) return 'ENOTFOUND';
  if (message.includes('connection reset')) return 'ECONNRESET';

  const exitCode = 'code' in error ? (error.code as number | undefined) : null;
  if (exitCode === 28) return 'ETIMEDOUT';
  if (exitCode === 6) return 'ENOTFOUND';
  if (exitCode === 56) return 'ECONNRESET';

  return undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the xG for a team's statistics array.
// Priority 1: native expected_goals field (API-Football, available from mid-2022-23 onwards).
// Priority 2: shots proxy fallback (Shots on Goal × factor) for older fixtures
//             where the API did not yet track expected_goals.
function extractXg(
  statistics: { type: string; value: number | string | null }[],
): number | null {
  const xgEntry = statistics.find((s) => s.type === 'expected_goals');
  if (xgEntry !== undefined && xgEntry.value !== null) {
    const parsed = parseFloat(String(xgEntry.value));
    return isNaN(parsed) ? null : parsed;
  }
  // Field absent or null (e.g. lower divisions) → fall back to shots proxy
  return extractShotsOnTarget(statistics) * ETL_CONSTANTS.XG_SHOTS_PROXY_FACTOR;
}

function extractShotsOnTarget(
  statistics: { type: string; value: number | string | null }[],
): number {
  const entry = statistics.find((s) => s.type === 'Shots on Goal');
  if (!entry || entry.value === null) return 0;
  const parsed = parseInt(String(entry.value), 10);
  return isNaN(parsed) ? 0 : parsed;
}
