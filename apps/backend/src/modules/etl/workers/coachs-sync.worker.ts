import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import { sleep } from '@utils/async.utils';
import { PrismaService } from '@/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { ApiFootballClient } from '../api-football.client';
import {
  ApiFootballCoachsResponseSchema,
  type ApiFootballCareerEntry,
} from '../schemas/coachs.schema';
import { notifyOnWorkerFailure } from './etl-worker.utils';

// docs/h2h-service-v2-plan.md §3.4 (v2.3a) — one GET /coachs?team={id} per
// tracked team gives that coach's FULL career, so a single pass over all
// teams backfills the whole `coach_tenure` table (no per-season/per-fixture
// scoping needed, unlike injuries-sync.worker.ts). Verified live 2026-07-23
// on Real Madrid (id=541): 3 coaches, 7 career legs, some referencing teams
// outside our tracked set (filtered out below — no FK to store them under).
export type CoachSyncJobData = Record<string, never>;

const logger = createLogger('coachs-sync-worker');

@Processor(BULLMQ_QUEUES.COACH_SYNC)
export class CoachSyncWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiFootball: ApiFootballClient,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(_: Job<CoachSyncJobData>): Promise<void> {
    logger.info('Starting coach tenure sync');

    const teams = await this.prisma.client.team.findMany({
      select: { id: true, externalId: true },
    });
    const teamIdByExternalId = new Map(
      teams.map((team) => [team.externalId, team.id]),
    );

    let teamsProcessed = 0;
    let tenuresUpserted = 0;
    let skipped = 0;

    for (const team of teams) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/coachs?team=${team.externalId}`;
      const result = await this.apiFootball.fetchJson(url);

      if (result.response === null) {
        logger.warn(
          { teamExternalId: team.externalId },
          'Transient network error — skipping team',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      if (result.response.status < 200 || result.response.status >= 300) {
        logger.warn(
          { teamExternalId: team.externalId, status: result.response.status },
          'API-FOOTBALL coachs request failed — skipping team',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const parsed = ApiFootballCoachsResponseSchema.safeParse(
        result.response.body,
      );
      if (!parsed.success) {
        logger.warn(
          { teamExternalId: team.externalId, issues: parsed.error.issues },
          'Zod validation failed for coachs payload — skipping team',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      for (const coach of parsed.data.response) {
        if (!coach.name) continue;
        for (const leg of coach.career) {
          const tenureTeamId = teamIdByExternalId.get(leg.team.id);
          if (!tenureTeamId || !leg.start) continue;

          await this.upsertTenure({
            teamId: tenureTeamId,
            coachName: coach.name,
            leg,
          });
          tenuresUpserted++;
        }
      }

      teamsProcessed++;
      await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
    }

    logger.info(
      { teamsProcessed, tenuresUpserted, skipped, totalTeams: teams.length },
      'Coach tenure sync complete',
    );
  }

  private async upsertTenure(input: {
    teamId: string;
    coachName: string;
    leg: ApiFootballCareerEntry;
  }): Promise<void> {
    const { teamId, coachName, leg } = input;
    const startDate = new Date(leg.start as string);
    if (Number.isNaN(startDate.getTime())) return;
    const endDate = leg.end ? new Date(leg.end) : null;

    await this.prisma.client.coachTenure.upsert({
      where: {
        teamId_coachName_startDate: { teamId, coachName, startDate },
      },
      create: { teamId, coachName, startDate, endDate },
      update: { endDate },
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CoachSyncJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.COACH_SYNC,
      job,
      error,
      logger,
    });
  }
}
