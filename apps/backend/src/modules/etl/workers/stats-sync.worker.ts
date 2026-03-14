import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { ApiFootballStatisticsResponseSchema } from '../schemas/stats.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { sleep } from '@utils/async.utils';
import { NotificationService } from '../../notification/notification.service';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  seasonFallbackEndDate,
  seasonFallbackStartDate,
} from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';

export type StatsSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
};

const logger = createLogger('stats-sync-worker');

@Processor(BULLMQ_QUEUES.STATS_SYNC)
export class StatsSyncWorker extends WorkerHost {
  // eslint-disable-next-line max-params -- Prisma required to resolve competition from DB.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<StatsSyncJobData>): Promise<void> {
    const { season, competitionCode } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info({ competitionCode, season }, 'Starting stats sync');

    const competitionMeta = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode },
    });
    if (!competitionMeta) {
      throw new Error(`Competition not found in DB: ${competitionCode}`);
    }

    // Resolve the internal seasonId (idempotent — same as fixtures-sync)
    const competition = await this.fixtureService.upsertCompetition({
      leagueId: competitionMeta.leagueId,
      name: competitionMeta.name,
      code: competitionMeta.code,
      country: competitionMeta.country,
      isActive: competitionMeta.isActive,
      csvDivisionCode: competitionMeta.csvDivisionCode ?? undefined,
      seasonStartMonth: competitionMeta.seasonStartMonth ?? undefined,
      activeSeasonsCount: competitionMeta.activeSeasonsCount ?? undefined,
    });
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
      const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

      if (!res.ok) {
        logger.warn(
          { externalId, status: res.status },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const parsed = ApiFootballStatisticsResponseSchema.safeParse(
        await res.json(),
      );

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

    if (xgUnavailableIds.length > 0) {
      await this.notification.sendXgUnavailableReport(
        seasonNameFromYear(season),
        xgUnavailableIds,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<StatsSyncJobData> | undefined, error: Error): void {
    const isFinalAttempt =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      logger.error(
        { jobName: job.name, attempts: job.attemptsMade },
        'Job permanently failed — sending alert',
      );
      void this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.STATS_SYNC,
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
  if (xgEntry !== undefined) {
    if (xgEntry.value === null) return null;
    const parsed = parseFloat(String(xgEntry.value));
    return isNaN(parsed) ? null : parsed;
  }
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
