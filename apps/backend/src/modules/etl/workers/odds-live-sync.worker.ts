import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import {
  ApiFootballOddsResponseSchema,
  type OddsBookmaker,
} from '../schemas/odds.schema';
import { FixtureService } from '../../fixture/fixture.service';
import {
  ETL_CONSTANTS,
  BULLMQ_QUEUES,
  API_FOOTBALL_BOOKMAKERS,
  API_FOOTBALL_BET_IDS,
} from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { tomorrowUtc, formatDateUtc } from '@utils/date.utils';
import { sleep } from '@utils/async.utils';

// Passing date as job data makes the worker testable and supports backfill.
// When absent, defaults to tomorrow (standard daily cron use case).
export type OddsLiveSyncJobData = { date?: string };

const logger = pino({ name: 'odds-live-sync-worker' });

@Processor(BULLMQ_QUEUES.ODDS_LIVE_SYNC)
export class OddsLiveSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsLiveSyncJobData>): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const targetDate = job.data.date ? new Date(job.data.date) : tomorrowUtc();
    const dateLabel = formatDateUtc(targetDate);

    logger.info({ date: dateLabel }, 'Starting odds live sync');

    const fixtures = await this.fixtureService.findScheduledForDate(targetDate);

    if (fixtures.length === 0) {
      logger.info({ date: dateLabel }, 'No scheduled fixtures — nothing to do');
      return;
    }

    logger.info(
      { count: fixtures.length, date: dateLabel },
      'Fetching live odds per fixture',
    );

    let synced = 0;
    let skipped = 0;

    for (const { id: fixtureId, externalId } of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/odds?fixture=${externalId}`;
      const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

      if (!res.ok) {
        logger.warn(
          { externalId, status: res.status },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const parsed = ApiFootballOddsResponseSchema.safeParse(await res.json());

      if (!parsed.success) {
        logger.warn(
          { externalId, issues: parsed.error.issues },
          'Zod validation failed — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const match = parsed.data.response[0];

      if (!match) {
        logger.warn({ externalId }, 'No odds data returned — skipping fixture');
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const odds = extractOneXTwoOdds(match.bookmakers);

      if (!odds) {
        logger.warn(
          { externalId },
          'No Pinnacle/Bet365 Match Winner odds — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      await this.fixtureService.upsertOneXTwoOddsSnapshot({
        fixtureId,
        bookmaker: odds.bookmaker,
        snapshotAt: new Date(match.update),
        homeOdds: odds.homeOdds,
        drawOdds: odds.drawOdds,
        awayOdds: odds.awayOdds,
      });

      synced++;
      await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
    }

    logger.info(
      { synced, skipped, date: dateLabel },
      'Odds live sync complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OddsLiveSyncJobData> | undefined, error: Error): void {
    const isFinalAttempt =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      logger.error(
        { jobName: job.name, attempts: job.attemptsMade },
        'Job permanently failed — sending alert',
      );
      void this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.ODDS_LIVE_SYNC,
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

type OneXTwoOdds = {
  bookmaker: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

// Extracts Match Winner odds with bookmaker priority: Pinnacle → Bet365.
// Returns null if neither bookmaker has Match Winner data.
export function extractOneXTwoOdds(
  bookmakers: OddsBookmaker[],
): OneXTwoOdds | null {
  const PRIORITY_IDS = [
    API_FOOTBALL_BOOKMAKERS.PINNACLE,
    API_FOOTBALL_BOOKMAKERS.BET365,
  ] as const;

  for (const bookmakerId of PRIORITY_IDS) {
    const bk = bookmakers.find((b) => b.id === bookmakerId);
    if (!bk) continue;

    const matchWinner = bk.bets.find(
      (b) => b.id === API_FOOTBALL_BET_IDS.MATCH_WINNER,
    );
    if (!matchWinner) continue;

    const home = matchWinner.values.find((v) => v.value === 'Home');
    const draw = matchWinner.values.find((v) => v.value === 'Draw');
    const away = matchWinner.values.find((v) => v.value === 'Away');

    if (!home || !draw || !away) continue;

    return {
      bookmaker: bk.name,
      homeOdds: home.odd,
      drawOdds: draw.odd,
      awayOdds: away.odd,
    };
  }

  return null;
}
