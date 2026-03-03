import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { FixtureService } from '../../fixture/fixture.service';
import {
  ETL_CONSTANTS,
  BULLMQ_QUEUES,
  getCompetitionByCodeOrThrow,
} from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  seasonFallbackEndDate,
  seasonFallbackStartDate,
} from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import { ApiFootballInjuriesResponseSchema } from '../schemas/injuries.schema';

export type InjuriesSyncJobData = { season: number; competitionCode: string };

const logger = pino({ name: 'injuries-sync-worker' });

type ShadowInjuries = {
  home: number;
  away: number;
  total: number;
};

@Processor(BULLMQ_QUEUES.INJURIES_SYNC)
export class InjuriesSyncWorker extends WorkerHost {
  // eslint-disable-next-line max-params -- Prisma + services are required to persist shadow data.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<InjuriesSyncJobData>): Promise<void> {
    const { season, competitionCode } = job.data;
    const competition = getCompetitionByCodeOrThrow(competitionCode);
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info({ competitionCode, season }, 'Starting injuries sync');

    const competitionRecord = await this.fixtureService.upsertCompetition({
      name: competition.name,
      code: competition.code,
      country: competition.country,
    });
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competitionRecord.id,
      name: seasonNameFromYear(season),
      startDate: seasonFallbackStartDate(season),
      endDate: seasonFallbackEndDate(season),
    });

    const fixtures = await this.fixtureService.findScheduledBySeason(
      seasonRecord.id,
    );

    let updated = 0;
    let skipped = 0;

    for (const fixture of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/injuries?fixture=${fixture.externalId}`;
      const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

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
        fixtures: fixtures.length,
        updated,
        skipped,
      },
      'Injuries sync complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InjuriesSyncJobData> | undefined, error: Error): void {
    const isFinalAttempt =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      logger.error(
        { jobName: job.name, attempts: job.attemptsMade },
        'Job permanently failed — sending alert',
      );
      void this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.INJURIES_SYNC,
        job.name,
        error.message,
      );
    } else {
      logger.warn(
        { jobName: job?.name, attempt: job?.attemptsMade },
        'Job attempt failed — will retry',
      );
    }
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
