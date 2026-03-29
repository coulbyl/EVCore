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
  fetchOrSkip,
  loadActiveCompetition,
  toUpsertCompetitionInput,
} from './etl-worker.utils';

export type InjuriesSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
};

const logger = createLogger('injuries-sync-worker');

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
      const res = await fetchOrSkip(url, {
        headers: { 'x-apisports-key': apiKey },
      });

      if (res === null) {
        logger.warn(
          { fixtureExternalId: fixture.externalId },
          'Transient network error — skipping fixture',
        );
        skipped++;
        continue;
      }

      if (!res.ok) {
        logger.warn(
          { fixtureExternalId: fixture.externalId, status: res.status },
          'API-FOOTBALL injuries request failed — skipping fixture',
        );
        skipped++;
        continue;
      }

      const parsed = ApiFootballInjuriesResponseSchema.safeParse(
        await res.json(),
      );

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
