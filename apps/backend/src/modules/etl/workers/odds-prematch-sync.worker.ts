import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
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
import { notifyOnWorkerFailure } from './etl-worker.utils';

// Passing date as job data makes the worker testable and supports backfill.
// When absent, defaults to tomorrow (standard daily cron use case).
export type OddsPrematchSyncJobData = { date?: string };

const logger = createLogger('odds-prematch-sync-worker');

// lockDuration: 10 min — the job fetches odds per fixture with 6 s API delay between
// each call, so 10+ fixtures easily exceeds the default 30 s lock timeout.
@Processor(BULLMQ_QUEUES.ODDS_PREMATCH_SYNC, { lockDuration: 600_000 })
export class OddsPrematchSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsPrematchSyncJobData>): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const targetDate = job.data.date ? new Date(job.data.date) : tomorrowUtc();
    const dateLabel = formatDateUtc(targetDate);

    logger.info({ date: dateLabel }, 'Starting odds prematch sync');

    const fixtures = await this.fixtureService.findScheduledForDate(targetDate);

    if (fixtures.length === 0) {
      logger.info({ date: dateLabel }, 'No scheduled fixtures — nothing to do');
      return;
    }

    logger.info(
      { count: fixtures.length, date: dateLabel },
      'Fetching prematch odds per fixture',
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

      const body: unknown = await res.json();

      if (isQuotaExceededError(body)) {
        logger.error(
          { externalId },
          'API-Football daily quota exceeded — aborting job',
        );
        await this.notification.sendEtlFailureAlert(
          BULLMQ_QUEUES.ODDS_PREMATCH_SYNC,
          'odds-prematch-sync',
          'API-Football daily quota exceeded',
        );
        throw new Error('API-Football daily quota exceeded');
      }

      const parsed = ApiFootballOddsResponseSchema.safeParse(body);

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
          'No priority bookmaker Match Winner odds — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const snapshotAt = new Date(match.update);

      const additionalOdds = extractAdditionalMarketOdds(
        match.bookmakers,
        odds.bookmaker,
      );

      await this.fixtureService.upsertOddsSnapshot({
        fixtureId,
        bookmaker: odds.bookmaker,
        snapshotAt,
        homeOdds: odds.homeOdds,
        drawOdds: odds.drawOdds,
        awayOdds: odds.awayOdds,
        overOdds: additionalOdds.overOdds,
        underOdds: additionalOdds.underOdds,
        bttsYesOdds: additionalOdds.bttsYesOdds,
        bttsNoOdds: additionalOdds.bttsNoOdds,
        htftOdds: additionalOdds.htftOdds,
      });

      // Store secondary market odds from all other priority bookmakers.
      // Each bookmaker's OVER_UNDER/BTTS/HTFT data is stored independently
      // so the engine can pick the best available per market.
      const SECONDARY_IDS = [
        API_FOOTBALL_BOOKMAKERS.PINNACLE,
        API_FOOTBALL_BOOKMAKERS.BET365,
        API_FOOTBALL_BOOKMAKERS.UNIBET,
        API_FOOTBALL_BOOKMAKERS.MARATHONBET,
        API_FOOTBALL_BOOKMAKERS.BWIN,
      ];
      for (const id of SECONDARY_IDS) {
        const bk = match.bookmakers.find((b) => b.id === id);
        if (!bk || bk.name === odds.bookmaker) continue;
        const secondary = extractAdditionalMarketOdds(
          match.bookmakers,
          bk.name,
        );
        const hasData =
          secondary.overOdds !== null ||
          secondary.bttsYesOdds !== null ||
          Object.keys(secondary.htftOdds).length > 0;
        if (!hasData) continue;
        await this.fixtureService.upsertSecondaryMarketOdds({
          fixtureId,
          bookmaker: bk.name,
          snapshotAt,
          overOdds: secondary.overOdds,
          underOdds: secondary.underOdds,
          bttsYesOdds: secondary.bttsYesOdds,
          bttsNoOdds: secondary.bttsNoOdds,
          htftOdds: secondary.htftOdds,
        });
      }

      synced++;
      await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
    }

    logger.info(
      { synced, skipped, date: dateLabel },
      'Odds prematch sync complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OddsPrematchSyncJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ODDS_PREMATCH_SYNC,
      job,
      error,
      logger,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type OneXTwoOdds = {
  bookmaker: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

type AdditionalMarketOdds = {
  overOdds: number | null;
  underOdds: number | null;
  bttsYesOdds: number | null;
  bttsNoOdds: number | null;
  htftOdds: Record<string, number>;
};

// Extracts Over/Under 2.5 and BTTS odds from the same bookmaker used for 1X2.
// Returns null for each market when the bookmaker doesn't provide it.
export function extractAdditionalMarketOdds(
  bookmakers: OddsBookmaker[],
  selectedBookmakerName: string,
): AdditionalMarketOdds {
  const bk = bookmakers.find((b) => b.name === selectedBookmakerName);
  if (!bk) {
    return {
      overOdds: null,
      underOdds: null,
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
    };
  }

  const ouBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.OVER_UNDER_25,
  );
  const bttsBet = bk.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.BTTS);

  const overOdds =
    ouBet?.values.find((v) => v.value === 'Over 2.5')?.odd ?? null;
  const underOdds =
    ouBet?.values.find((v) => v.value === 'Under 2.5')?.odd ?? null;
  const bttsYesOdds =
    bttsBet?.values.find((v) => v.value === 'Yes')?.odd ?? null;
  const bttsNoOdds = bttsBet?.values.find((v) => v.value === 'No')?.odd ?? null;
  const htftOdds = extractHalfTimeFullTimeOdds(bk);

  return { overOdds, underOdds, bttsYesOdds, bttsNoOdds, htftOdds };
}

// Extracts Match Winner odds with bookmaker priority: Pinnacle → Bet365 → Unibet → Marathonbet → Bwin.
// Returns null if no bookmaker has Match Winner data.
export function extractOneXTwoOdds(
  bookmakers: OddsBookmaker[],
): OneXTwoOdds | null {
  const PRIORITY_IDS = [
    API_FOOTBALL_BOOKMAKERS.PINNACLE,
    API_FOOTBALL_BOOKMAKERS.BET365,
    API_FOOTBALL_BOOKMAKERS.UNIBET,
    API_FOOTBALL_BOOKMAKERS.MARATHONBET,
    API_FOOTBALL_BOOKMAKERS.BWIN,
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

function extractHalfTimeFullTimeOdds(
  bookmaker: OddsBookmaker,
): Record<string, number> {
  const htftBet = bookmaker.bets.find(
    (bet) =>
      bet.id === API_FOOTBALL_BET_IDS.HALF_TIME_FULL_TIME ||
      normalizeLabel(bet.name) === 'HALFTIME/FULLTIME',
  );
  if (!htftBet) return {};

  const odds: Record<string, number> = {};
  for (const value of htftBet.values) {
    const mapped = mapHalfTimeFullTimePick(value.value);
    if (!mapped) continue;
    odds[mapped] = value.odd;
  }
  return odds;
}

function mapHalfTimeFullTimePick(value: string): string | null {
  switch (normalizeLabel(value)) {
    case 'HOME/HOME':
      return 'HOME_HOME';
    case 'HOME/DRAW':
      return 'HOME_DRAW';
    case 'HOME/AWAY':
      return 'HOME_AWAY';
    case 'DRAW/HOME':
      return 'DRAW_HOME';
    case 'DRAW/DRAW':
      return 'DRAW_DRAW';
    case 'DRAW/AWAY':
      return 'DRAW_AWAY';
    case 'AWAY/HOME':
      return 'AWAY_HOME';
    case 'AWAY/DRAW':
      return 'AWAY_DRAW';
    case 'AWAY/AWAY':
      return 'AWAY_AWAY';
    default:
      return null;
  }
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function isQuotaExceededError(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'errors' in body &&
    typeof (body as Record<string, unknown>)['errors'] === 'object' &&
    !Array.isArray((body as Record<string, unknown>)['errors']) &&
    (body as Record<string, unknown>)['errors'] !== null
  );
}
