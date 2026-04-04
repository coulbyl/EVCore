import { execFile } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS } from '@config/etl.constants';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  seasonFallbackEndDate,
  seasonFallbackStartDate,
} from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import { ApiFootballInjuriesResponseSchema } from '../schemas/injuries.schema';
import {
  loadActiveCompetition,
  toUpsertCompetitionInput,
} from './etl-worker.utils';

export type InjuriesSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
};

const logger = createLogger('injuries-sync-worker');
const CURL_HTTP_CODE_MARKER = '__EVCORE_HTTP_CODE__';

type ShadowInjuries = {
  home: number;
  away: number;
  total: number;
};

@Injectable()
export class InjuriesSyncWorker {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async process(job: Job<InjuriesSyncJobData>): Promise<void> {
    const { season, competitionCode } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info({ competitionCode, season }, 'Starting injuries sync');

    const competitionMeta = await loadActiveCompetition(
      this.prisma,
      competitionCode,
    );
    if (!competitionMeta) {
      logger.info(
        { competitionCode, season },
        'Competition inactive — skipping injuries sync job',
      );
      return;
    }

    const competitionRecord = await this.fixtureService.upsertCompetition(
      toUpsertCompetitionInput(competitionMeta),
    );
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competitionRecord.id,
      name: seasonNameFromYear(season),
      startDate: seasonFallbackStartDate(season),
      endDate: seasonFallbackEndDate(season),
    });

    const fixtures = await this.fixtureService.findScheduledBySeason(
      seasonRecord.id,
    );
    const targetFixtures = fixtures.filter((fixture) =>
      isWithinTodayAndTomorrowUtc(fixture.scheduledAt),
    );

    let updated = 0;
    let skipped = 0;

    for (const fixture of targetFixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/injuries?fixture=${fixture.externalId}`;
      const curlResult = await fetchJsonViaCurl(url, apiKey);

      if (curlResult.response === null) {
        logger.warn(
          { fixtureExternalId: fixture.externalId },
          'Transient network error — skipping fixture',
        );
        skipped++;
        continue;
      }
      const res = curlResult.response;

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { fixtureExternalId: fixture.externalId, status: res.status },
          'API-FOOTBALL injuries request failed — skipping fixture',
        );
        skipped++;
        continue;
      }

      const parsed = ApiFootballInjuriesResponseSchema.safeParse(res.body);

      if (!parsed.success) {
        logger.warn(
          {
            fixtureExternalId: fixture.externalId,
            issues: parsed.error.issues,
          },
          'Zod validation failed for injuries payload — skipping fixture',
        );
        skipped++;
        continue;
      }

      const shadowInjuries = countShadowInjuries(
        parsed.data.response,
        fixture.homeTeam.externalId,
        fixture.awayTeam.externalId,
      );

      const didUpdate = await this.updateLatestModelRunShadowInjuries(
        fixture.id,
        shadowInjuries,
      );
      if (didUpdate) {
        updated++;
      } else {
        skipped++;
      }
    }

    logger.info(
      {
        competitionCode,
        season,
        fixtures: targetFixtures.length,
        updated,
        skipped,
      },
      'Injuries sync complete',
    );
  }
  private async updateLatestModelRunShadowInjuries(
    fixtureId: string,
    shadowInjuries: ShadowInjuries,
  ): Promise<boolean> {
    const latestModelRun = await this.prisma.client.modelRun.findFirst({
      where: { fixtureId },
      orderBy: { analyzedAt: 'desc' },
      select: { id: true, features: true },
    });

    if (!latestModelRun) {
      return false;
    }

    const currentFeatures = isObjectRecord(latestModelRun.features)
      ? latestModelRun.features
      : {};

    await this.prisma.client.modelRun.update({
      where: { id: latestModelRun.id },
      data: {
        features: {
          ...currentFeatures,
          shadow_injuries: shadowInjuries,
        },
      },
    });

    return true;
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

function countShadowInjuries(
  response: { team: { id: number } }[],
  homeTeamExternalId: number,
  awayTeamExternalId: number,
): ShadowInjuries {
  let home = 0;
  let away = 0;

  for (const item of response) {
    if (item.team.id === homeTeamExternalId) home++;
    else if (item.team.id === awayTeamExternalId) away++;
  }

  return { home, away, total: home + away };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isWithinTodayAndTomorrowUtc(
  scheduledAt: Date,
  now = new Date(),
): boolean {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(23, 59, 59, 999);

  return scheduledAt >= start && scheduledAt <= end;
}
