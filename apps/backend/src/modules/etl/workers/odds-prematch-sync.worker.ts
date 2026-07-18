import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
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
import { formatDateUtc } from '@utils/date.utils';
import { addDays } from 'date-fns';
import { sleep } from '@utils/async.utils';
import { notifyOnWorkerFailure } from './etl-worker.utils';
import {
  ApiFootballClient,
  isQuotaExceededError,
} from '../api-football.client';

// Passing date as job data makes the worker testable and supports backfill:
// with `date` the job syncs that single day; otherwise it covers tomorrow up
// to J+`horizonDays` (default ODDS_PREMATCH_HORIZON_DAYS) so each fixture
// accumulates multiple snapshots before kickoff (line-movement feed).
export type OddsPrematchSyncJobData = { date?: string; horizonDays?: number };

const logger = createLogger('odds-prematch-sync-worker');
const ODDS_FETCH_ATTEMPTS = 2;

// lockDuration: 10 min — the job fetches odds per fixture with 6 s API delay between
// each call, so 10+ fixtures easily exceeds the default 30 s lock timeout.
@Processor(BULLMQ_QUEUES.ODDS_PREMATCH_SYNC, { lockDuration: 600_000 })
export class OddsPrematchSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly apiFootball: ApiFootballClient,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsPrematchSyncJobData>): Promise<void> {
    const targetDates = resolveTargetDates(job.data);
    const dateLabel = targetDates.map(formatDateUtc).join(',');

    logger.info({ dates: dateLabel }, 'Starting odds prematch sync');

    const fixtures = (
      await Promise.all(
        targetDates.map((d) => this.fixtureService.findScheduledForDate(d)),
      )
    ).flat();

    if (fixtures.length === 0) {
      logger.info(
        { dates: dateLabel },
        'No scheduled fixtures — nothing to do',
      );
      return;
    }

    logger.info(
      { count: fixtures.length, dates: dateLabel },
      'Fetching prematch odds per fixture',
    );

    let synced = 0;
    let skipped = 0;

    for (const { id: fixtureId, externalId } of fixtures) {
      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/odds?fixture=${externalId}`;
      const fetchStartedAt = performance.now();

      const result = await this.apiFootball.fetchJson(url, ODDS_FETCH_ATTEMPTS);
      const res = result.response;
      const durationMs = Math.round(performance.now() - fetchStartedAt);

      if (res === null) {
        logger.warn(
          {
            externalId,
            networkCode: result.transientErrorCode ?? 'UNKNOWN',
            durationMs,
            url,
          },
          'Provider timeout persisted across retries — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { externalId, status: res.status, durationMs, url },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      const body: unknown = res.body;

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

      const allOneXTwo = extractAllOneXTwoOdds(match.bookmakers);
      const odds = allOneXTwo[0] ?? null;

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

      // A DB write failure for one fixture (e.g. an out-of-range odds value —
      // CORRECT_SCORE on an obscure scoreline can spike well past three
      // digits) must not abort the whole run: skip this fixture and keep
      // going, same as the network/validation skip paths above.
      try {
        // 1X2 from every priority bookmaker (not only the primary one): the
        // engine derives a median implied probability across books for the
        // model↔market coherence gate — a single book is too easy an outlier.
        for (const bookOdds of allOneXTwo.slice(1)) {
          await this.fixtureService.upsertOneXTwoOddsSnapshot({
            fixtureId,
            bookmaker: bookOdds.bookmaker,
            snapshotAt,
            homeOdds: bookOdds.homeOdds,
            drawOdds: bookOdds.drawOdds,
            awayOdds: bookOdds.awayOdds,
          });
        }

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
          overUnderOdds: additionalOdds.overUnderOdds,
          bttsYesOdds: additionalOdds.bttsYesOdds,
          bttsNoOdds: additionalOdds.bttsNoOdds,
          htftOdds: additionalOdds.htftOdds,
          ouHtOdds: additionalOdds.ouHtOdds,
          firstHalfWinnerOdds: additionalOdds.firstHalfWinnerOdds,
          doubleChanceOdds: additionalOdds.doubleChanceOdds,
          correctScoreOdds: additionalOdds.correctScoreOdds,
          drawNoBetOdds: additionalOdds.drawNoBetOdds,
          teamTotalHomeOdds: additionalOdds.teamTotalHomeOdds,
          teamTotalAwayOdds: additionalOdds.teamTotalAwayOdds,
          cleanSheetHomeOdds: additionalOdds.cleanSheetHomeOdds,
          cleanSheetAwayOdds: additionalOdds.cleanSheetAwayOdds,
          winToNilHomeOdds: additionalOdds.winToNilHomeOdds,
          winToNilAwayOdds: additionalOdds.winToNilAwayOdds,
          winEitherHalfOdds: additionalOdds.winEitherHalfOdds,
        });

        // Store secondary market odds from all other priority bookmakers.
        // Each bookmaker's OVER_UNDER/BTTS/HTFT/OU_HT/FHW data is stored
        // independently so the engine can pick the best available per market.
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
            Object.keys(secondary.overUnderOdds).length > 0 ||
            secondary.bttsYesOdds !== null ||
            Object.keys(secondary.htftOdds).length > 0 ||
            Object.keys(secondary.ouHtOdds).length > 0 ||
            secondary.firstHalfWinnerOdds !== null ||
            secondary.doubleChanceOdds !== null ||
            Object.keys(secondary.correctScoreOdds).length > 0 ||
            secondary.drawNoBetOdds !== null ||
            Object.keys(secondary.teamTotalHomeOdds).length > 0 ||
            Object.keys(secondary.teamTotalAwayOdds).length > 0 ||
            secondary.cleanSheetHomeOdds !== null ||
            secondary.cleanSheetAwayOdds !== null ||
            secondary.winToNilHomeOdds !== null ||
            secondary.winToNilAwayOdds !== null ||
            secondary.winEitherHalfOdds !== null;
          if (!hasData) continue;
          await this.fixtureService.upsertSecondaryMarketOdds({
            fixtureId,
            bookmaker: bk.name,
            snapshotAt,
            overUnderOdds: secondary.overUnderOdds,
            bttsYesOdds: secondary.bttsYesOdds,
            bttsNoOdds: secondary.bttsNoOdds,
            htftOdds: secondary.htftOdds,
            ouHtOdds: secondary.ouHtOdds,
            firstHalfWinnerOdds: secondary.firstHalfWinnerOdds,
            doubleChanceOdds: secondary.doubleChanceOdds,
            correctScoreOdds: secondary.correctScoreOdds,
            drawNoBetOdds: secondary.drawNoBetOdds,
            teamTotalHomeOdds: secondary.teamTotalHomeOdds,
            teamTotalAwayOdds: secondary.teamTotalAwayOdds,
            cleanSheetHomeOdds: secondary.cleanSheetHomeOdds,
            cleanSheetAwayOdds: secondary.cleanSheetAwayOdds,
            winToNilHomeOdds: secondary.winToNilHomeOdds,
            winToNilAwayOdds: secondary.winToNilAwayOdds,
            winEitherHalfOdds: secondary.winEitherHalfOdds,
          });
        }
      } catch (err) {
        logger.warn(
          {
            externalId,
            error: err instanceof Error ? err.message : String(err),
          },
          'Failed to persist odds snapshot for fixture — skipping',
        );
        skipped++;
        await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
        continue;
      }

      synced++;
      await sleep(ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS);
    }

    logger.info(
      { synced, skipped, dates: dateLabel },
      'Odds prematch sync complete',
    );

    await this.checkQuotaUsage();
  }

  // Best-effort quota observability — the multi-day horizon and 2×/day cron
  // consume more requests than the old single-day run; alert before the cap
  // instead of discovering it via failing jobs.
  private async checkQuotaUsage(): Promise<void> {
    const usage = await this.apiFootball.getQuotaUsage();
    if (usage === null || usage.limitDay <= 0) return;

    const ratio = usage.current / usage.limitDay;
    logger.info(
      { current: usage.current, limitDay: usage.limitDay },
      'API-Football daily quota usage',
    );

    if (ratio >= ETL_CONSTANTS.API_FOOTBALL_QUOTA_ALERT_RATIO) {
      logger.warn(
        { current: usage.current, limitDay: usage.limitDay, ratio },
        'API-Football quota above alert threshold',
      );
      await this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.ODDS_PREMATCH_SYNC,
        'odds-prematch-sync',
        `API-Football quota at ${usage.current}/${usage.limitDay} (≥ ${Math.round(ETL_CONSTANTS.API_FOOTBALL_QUOTA_ALERT_RATIO * 100)}%)`,
      );
    }
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
  overUnderOdds: Partial<
    Record<
      | 'OVER_1_5'
      | 'UNDER_1_5'
      | 'OVER'
      | 'UNDER'
      | 'OVER_3_5'
      | 'UNDER_3_5'
      | 'OVER_4_5'
      | 'UNDER_4_5',
      number
    >
  >;
  bttsYesOdds: number | null;
  bttsNoOdds: number | null;
  htftOdds: Record<string, number>;
  ouHtOdds: Partial<
    Record<'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5', number>
  >;
  firstHalfWinnerOdds: { home: number; draw: number; away: number } | null;
  doubleChanceOdds: { '1X': number; X2: number; '12': number | null } | null;
  // Full-time exact score: scoreline "H:A" → odds. Observation-only market.
  correctScoreOdds: Record<string, number>;
  // Draw No Bet — API-Football calls this bet "Home/Away" (id 2); it is DNB
  // (draw refunded), distinct from the true Double Chance market (id 12).
  drawNoBetOdds: { home: number; away: number } | null;
  teamTotalHomeOdds: TeamTotalOdds;
  teamTotalAwayOdds: TeamTotalOdds;
  cleanSheetHomeOdds: YesNoOdds;
  cleanSheetAwayOdds: YesNoOdds;
  winToNilHomeOdds: YesNoOdds;
  winToNilAwayOdds: YesNoOdds;
  // Two-way market (Home/Away only, no third "Neither" value observed).
  winEitherHalfOdds: { home: number; away: number } | null;
};

type YesNoOdds = { yes: number; no: number } | null;

// Sparse map: only lines the bookmaker actually prices are present.
type TeamTotalOdds = Partial<
  Record<
    | 'OVER_0_5'
    | 'UNDER_0_5'
    | 'OVER_1_5'
    | 'UNDER_1_5'
    | 'OVER_2_5'
    | 'UNDER_2_5'
    | 'OVER_3_5'
    | 'UNDER_3_5'
    | 'OVER_4_5'
    | 'UNDER_4_5'
    | 'OVER_5_5'
    | 'UNDER_5_5'
    | 'OVER_6_5'
    | 'UNDER_6_5',
    number
  >
>;

// Resolves the days this run covers: an explicit `date` wins (backfill /
// tests); otherwise tomorrow through J+horizonDays.
export function resolveTargetDates(data: OddsPrematchSyncJobData): Date[] {
  if (data.date) return [new Date(data.date)];

  const horizon = data.horizonDays ?? ETL_CONSTANTS.ODDS_PREMATCH_HORIZON_DAYS;
  const days = Math.max(1, horizon);
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i + 1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  });
}

// Extracts Over/Under 2.5 and BTTS odds from the same bookmaker used for 1X2.
// Returns null for each market when the bookmaker doesn't provide it.
export function extractAdditionalMarketOdds(
  bookmakers: OddsBookmaker[],
  selectedBookmakerName: string,
): AdditionalMarketOdds {
  const bk = bookmakers.find((b) => b.name === selectedBookmakerName);
  if (!bk) {
    return {
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
      doubleChanceOdds: null,
      correctScoreOdds: {},
      drawNoBetOdds: null,
      teamTotalHomeOdds: {},
      teamTotalAwayOdds: {},
      cleanSheetHomeOdds: null,
      cleanSheetAwayOdds: null,
      winToNilHomeOdds: null,
      winToNilAwayOdds: null,
      winEitherHalfOdds: null,
    };
  }

  const ouBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.OVER_UNDER_25,
  );
  const bttsBet = bk.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.BTTS);
  const ouHtBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.OVER_UNDER_FIRST_HALF,
  );
  const fhwBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.FIRST_HALF_WINNER,
  );
  const dcBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.DOUBLE_CHANCE,
  );
  const dnbBet = bk.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.DRAW_NO_BET);
  const ttHomeBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.TEAM_TOTAL_HOME,
  );
  const ttAwayBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.TEAM_TOTAL_AWAY,
  );
  const csHomeBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.CLEAN_SHEET_HOME,
  );
  const csAwayBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.CLEAN_SHEET_AWAY,
  );
  const wtnHomeBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.WIN_TO_NIL_HOME,
  );
  const wtnAwayBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.WIN_TO_NIL_AWAY,
  );
  const twhBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.TO_WIN_EITHER_HALF,
  );

  const overUnderOdds = extractOverUnderOdds(ouBet);
  const bttsYesOdds =
    bttsBet?.values.find((v) => v.value === 'Yes')?.odd ?? null;
  const bttsNoOdds = bttsBet?.values.find((v) => v.value === 'No')?.odd ?? null;
  const htftOdds = extractHalfTimeFullTimeOdds(bk);
  const ouHtOdds = extractOverUnderHtOdds(ouHtBet);
  const firstHalfWinnerOdds = extractFirstHalfWinnerOdds(fhwBet);
  const doubleChanceOdds = extractDoubleChanceOdds(dcBet);
  const csBet = bk.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.EXACT_SCORE);
  const correctScoreOdds = extractCorrectScoreOdds(csBet);
  const drawNoBetOdds = extractHomeAwayOdds(dnbBet);
  const teamTotalHomeOdds = extractTeamTotalOdds(ttHomeBet);
  const teamTotalAwayOdds = extractTeamTotalOdds(ttAwayBet);
  const cleanSheetHomeOdds = extractYesNoOdds(csHomeBet);
  const cleanSheetAwayOdds = extractYesNoOdds(csAwayBet);
  const winToNilHomeOdds = extractYesNoOdds(wtnHomeBet);
  const winToNilAwayOdds = extractYesNoOdds(wtnAwayBet);
  const winEitherHalfOdds = extractHomeAwayOdds(twhBet);

  return {
    overUnderOdds,
    bttsYesOdds,
    bttsNoOdds,
    htftOdds,
    ouHtOdds,
    firstHalfWinnerOdds,
    doubleChanceOdds,
    correctScoreOdds,
    drawNoBetOdds,
    teamTotalHomeOdds,
    teamTotalAwayOdds,
    cleanSheetHomeOdds,
    cleanSheetAwayOdds,
    winToNilHomeOdds,
    winToNilAwayOdds,
    winEitherHalfOdds,
  };
}

// Two-way markets whose bet.values are literally 'Home'/'Away' — Draw No Bet
// (id 2) and To Win Either Half (id 39) share this exact shape.
function extractHomeAwayOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): { home: number; away: number } | null {
  if (!bet) return null;
  const home = bet.values.find((v) => v.value === 'Home')?.odd;
  const away = bet.values.find((v) => v.value === 'Away')?.odd;
  if (home === undefined || away === undefined) return null;
  return { home, away };
}

// Clean Sheet / Win to Nil: values are literally 'Yes'/'No', same shape as BTTS.
function extractYesNoOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): YesNoOdds {
  if (!bet) return null;
  const yes = bet.values.find((v) => v.value === 'Yes')?.odd;
  const no = bet.values.find((v) => v.value === 'No')?.odd;
  if (yes === undefined || no === undefined) return null;
  return { yes, no };
}

// Team Total: values like "Over 2.5"/"Under 2.5", sparse up to ~6.5. Parsed
// generically (unlike the goals OVER_UNDER extractor) since the line range
// is wider and no line has a reserved bare OVER/UNDER key here.
function extractTeamTotalOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): TeamTotalOdds {
  if (!bet) return {};
  const odds: TeamTotalOdds = {};
  for (const value of bet.values) {
    const match = /^(Over|Under) (\d+)\.5$/.exec(value.value);
    if (!match) continue;
    const [, side, whole] = match;
    const key = `${side.toUpperCase()}_${whole}_5` as keyof TeamTotalOdds;
    odds[key] = value.odd;
  }
  return odds;
}

// Extracts full-time exact-score odds: each value is a scoreline "H:A" with its
// odd. Kept as a generic map (scoreline → odds) since books price a variable,
// sparse subset of scorelines. Observation-only market — no model consumption yet.
function extractCorrectScoreOdds(
  csBet: OddsBookmaker['bets'][number] | undefined,
): Record<string, number> {
  if (!csBet) return {};
  const odds: Record<string, number> = {};
  for (const value of csBet.values) {
    // Keep only well-formed "H:A" scorelines (skip "Other"/catch-all buckets).
    if (/^\d+:\d+$/.test(value.value)) odds[value.value] = value.odd;
  }
  return odds;
}

function extractOverUnderOdds(
  overUnderBet: OddsBookmaker['bets'][number] | undefined,
): AdditionalMarketOdds['overUnderOdds'] {
  if (!overUnderBet) return {};

  const odds: AdditionalMarketOdds['overUnderOdds'] = {};

  for (const value of overUnderBet.values) {
    if (value.value === 'Over 1.5') odds['OVER_1_5'] = value.odd;
    if (value.value === 'Under 1.5') odds['UNDER_1_5'] = value.odd;
    if (value.value === 'Over 2.5') odds['OVER'] = value.odd;
    if (value.value === 'Under 2.5') odds['UNDER'] = value.odd;
    if (value.value === 'Over 3.5') odds['OVER_3_5'] = value.odd;
    if (value.value === 'Under 3.5') odds['UNDER_3_5'] = value.odd;
    if (value.value === 'Over 4.5') odds['OVER_4_5'] = value.odd;
    if (value.value === 'Under 4.5') odds['UNDER_4_5'] = value.odd;
  }

  return odds;
}

function extractDoubleChanceOdds(
  dcBet: OddsBookmaker['bets'][number] | undefined,
): AdditionalMarketOdds['doubleChanceOdds'] {
  if (!dcBet) return null;

  // API-Football returns 'Home' (= 1X) and 'Away' (= X2).
  // '12' (no draw) is not provided — stored as null and skipped by the engine.
  const homeDrawOdd =
    dcBet.values.find((v) => v.value === 'Home' || v.value === 'Home/Draw')
      ?.odd ?? undefined;
  const drawAwayOdd =
    dcBet.values.find((v) => v.value === 'Away' || v.value === 'Draw/Away')
      ?.odd ?? undefined;

  if (homeDrawOdd === undefined || drawAwayOdd === undefined) return null;

  const homeAwayOdd =
    dcBet.values.find((v) => v.value === 'Home/Away')?.odd ?? null;

  return { '1X': homeDrawOdd, X2: drawAwayOdd, '12': homeAwayOdd };
}

// Extracts Match Winner odds from every priority bookmaker, in priority
// order: Pinnacle → Bet365 → Unibet → Marathonbet → Bwin. The first entry is
// the primary book (drives the full snapshot incl. secondary markets); the
// rest feed the multi-book median used by the coherence gate.
export function extractAllOneXTwoOdds(
  bookmakers: OddsBookmaker[],
): OneXTwoOdds[] {
  const PRIORITY_IDS = [
    API_FOOTBALL_BOOKMAKERS.PINNACLE,
    API_FOOTBALL_BOOKMAKERS.BET365,
    API_FOOTBALL_BOOKMAKERS.UNIBET,
    API_FOOTBALL_BOOKMAKERS.MARATHONBET,
    API_FOOTBALL_BOOKMAKERS.BWIN,
  ] as const;

  const result: OneXTwoOdds[] = [];
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

    result.push({
      bookmaker: bk.name,
      homeOdds: home.odd,
      drawOdds: draw.odd,
      awayOdds: away.odd,
    });
  }

  return result;
}

// Backward-compatible single-book variant (primary priority book only).
export function extractOneXTwoOdds(
  bookmakers: OddsBookmaker[],
): OneXTwoOdds | null {
  return extractAllOneXTwoOdds(bookmakers)[0] ?? null;
}

function extractOverUnderHtOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): Partial<
  Record<'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5', number>
> {
  if (!bet) return {};
  const odds: Partial<
    Record<'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5', number>
  > = {};
  for (const value of bet.values) {
    if (value.value === 'Over 0.5') odds['OVER_0_5'] = value.odd;
    if (value.value === 'Under 0.5') odds['UNDER_0_5'] = value.odd;
    if (value.value === 'Over 1.5') odds['OVER_1_5'] = value.odd;
    if (value.value === 'Under 1.5') odds['UNDER_1_5'] = value.odd;
  }
  return odds;
}

function extractFirstHalfWinnerOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): { home: number; draw: number; away: number } | null {
  if (!bet) return null;
  const home = bet.values.find((v) => v.value === 'Home')?.odd;
  const draw = bet.values.find((v) => v.value === 'Draw')?.odd;
  const away = bet.values.find((v) => v.value === 'Away')?.odd;
  if (home === undefined || draw === undefined || away === undefined)
    return null;
  return { home, draw, away };
}

function extractHalfTimeFullTimeOdds(
  bookmaker: OddsBookmaker,
): Record<string, number> {
  const htftBet = bookmaker.bets.find(
    (bet) =>
      bet.id === API_FOOTBALL_BET_IDS.HALF_TIME_FULL_TIME ||
      normalizeLabel(bet.name) === 'HT/FTDOUBLE',
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
