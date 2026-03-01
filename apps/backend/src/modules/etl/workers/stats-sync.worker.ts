import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { ApiFootballStatisticsResponseSchema } from '../schemas/stats.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  eplSeasonFallbackEndDate,
  eplSeasonFallbackStartDate,
} from '@utils/date.utils';

export type StatsSyncJobData = { season: number };

const logger = pino({ name: 'stats-sync-worker' });

@Processor(BULLMQ_QUEUES.STATS_SYNC)
export class StatsSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<StatsSyncJobData>): Promise<void> {
    const { season } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const leagueId =
      this.config.get<string>('API_FOOTBALL_LEAGUE_ID') ??
      String(ETL_CONSTANTS.EPL_LEAGUE_ID);

    logger.info({ season }, 'Starting stats sync');

    // Resolve the internal seasonId (idempotent — same as fixtures-sync)
    const competition = await this.fixtureService.upsertCompetition({
      name: ETL_CONSTANTS.EPL_COMPETITION_NAME,
      code: ETL_CONSTANTS.EPL_COMPETITION_CODE,
      country: ETL_CONSTANTS.EPL_COMPETITION_COUNTRY,
    });
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonNameFromYear(season),
      startDate: eplSeasonFallbackStartDate(season),
      endDate: eplSeasonFallbackEndDate(season),
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

    for (const { externalId } of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures/statistics?fixture=${externalId}&league=${leagueId}&season=${season}`;
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
          'Zod validation failed — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
        continue;
      }

      const [homeStats, awayStats] = parsed.data.response;
      const homeXg =
        extractShotsOnTarget(homeStats.statistics) *
        ETL_CONSTANTS.XG_SHOTS_CONVERSION_FACTOR;
      const awayXg =
        extractShotsOnTarget(awayStats.statistics) *
        ETL_CONSTANTS.XG_SHOTS_CONVERSION_FACTOR;

      await this.fixtureService.updateXg(externalId, homeXg, awayXg);
      updated++;

      await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);
    }

    logger.info({ season, updated, skipped }, 'Stats sync complete');
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

function extractShotsOnTarget(
  statistics: { type: string; value: number | string | null }[],
): number {
  const entry = statistics.find((s) => s.type === 'Shots on Goal');
  if (!entry || entry.value === null || typeof entry.value !== 'number') {
    return 0;
  }
  return entry.value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
