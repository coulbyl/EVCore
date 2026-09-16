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
  CLOSING_MISS_ALERT_RATIO,
  ODDS_CLOSING_RATE_LIMIT_MS,
  ODDS_CLOSING_WINDOWS,
  ODDS_INGESTION_BOOKMAKER_IDS,
  REFERENCE_ONLY_MARKETS,
  REFERENCE_BOOKMAKER,
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
export type OddsPrematchSyncJobData = {
  date?: string;
  horizonDays?: number;
  /**
   * `horizon` (défaut) ratisse les journées J+1..J+horizon ; `closing` ne
   * prend que les rencontres sur le point de commencer, pour capturer un prix
   * juste avant le coup d'envoi. Voir ODDS_CLOSING_WINDOWS.
   */
  mode?: 'horizon' | 'closing';
};

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
    const closing = job.data.mode === 'closing';
    const targetDates = closing ? [] : resolveTargetDates(job.data);
    const dateLabel = closing
      ? ODDS_CLOSING_WINDOWS.map((window) => window.name).join(',')
      : targetDates.map(formatDateUtc).join(',');

    logger.info(
      { dates: dateLabel, mode: closing ? 'closing' : 'horizon' },
      'Starting odds prematch sync',
    );

    const fixtures = closing
      ? await this.findClosingFixtures()
      : (
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
    // Rencontres atteintes après leur coup d'envoi : l'indicateur direct que
    // le balayage ne tient pas sa fenêtre (voir CLOSING_MISS_ALERT_RATIO).
    let missedKickoff = 0;
    // En mode clôture, l'espacement doit rester sous la durée de la fenêtre :
    // voir ODDS_CLOSING_RATE_LIMIT_MS.
    const rateLimitMs = closing
      ? ODDS_CLOSING_RATE_LIMIT_MS
      : ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS;

    for (const { id: fixtureId, externalId, scheduledAt } of fixtures) {
      // Filet de sécurité : si le lot a pris du retard, une rencontre déjà
      // commencée n'a plus de cote d'avant match à offrir. La stocker
      // polluerait la ligne de clôture avec un prix post-coup d'envoi.
      if (closing && scheduledAt.getTime() <= Date.now()) {
        skipped++;
        missedKickoff++;
        continue;
      }
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
        await sleep(rateLimitMs);
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        logger.warn(
          { externalId, status: res.status, durationMs, url },
          'API-FOOTBALL error — skipping fixture',
        );
        skipped++;
        await sleep(rateLimitMs);
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
        await sleep(rateLimitMs);
        continue;
      }

      const match = parsed.data.response[0];

      if (!match) {
        logger.warn({ externalId }, 'No odds data returned — skipping fixture');
        skipped++;
        await sleep(rateLimitMs);
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
        await sleep(rateLimitMs);
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
          resultTotalGoalsOdds: additionalOdds.resultTotalGoalsOdds,
          resultBttsOdds: additionalOdds.resultBttsOdds,
        });

        await this.persistExtendedMarkets({
          fixtureId,
          bookmaker: odds.bookmaker,
          snapshotAt,
          bookmakers: match.bookmakers,
        });

        // Store secondary market odds from every other ingested bookmaker.
        // Each bookmaker's OVER_UNDER/BTTS/HTFT/OU_HT/FHW data is stored
        // independently so the engine can pick the best available per market.
        for (const id of ODDS_INGESTION_BOOKMAKER_IDS) {
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
            secondary.winEitherHalfOdds !== null ||
            Object.keys(secondary.resultTotalGoalsOdds).length > 0 ||
            Object.keys(secondary.resultBttsOdds).length > 0;
          if (!hasData) continue;
          await this.persistExtendedMarkets({
            fixtureId,
            bookmaker: bk.name,
            snapshotAt,
            bookmakers: match.bookmakers,
          });
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
            resultTotalGoalsOdds: secondary.resultTotalGoalsOdds,
            resultBttsOdds: secondary.resultBttsOdds,
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
        await sleep(rateLimitMs);
        continue;
      }

      synced++;
      await sleep(rateLimitMs);
    }

    logger.info(
      { synced, skipped, missedKickoff, dates: dateLabel },
      'Odds prematch sync complete',
    );

    if (closing) this.reportClosingCoverage(synced, missedKickoff);

    await this.checkQuotaUsage();
  }

  /**
   * Alerte quand le balayage de clôture rate trop de coups d'envoi
   * (chantier B, tâche B-7).
   *
   * Une rencontre atteinte après son coup d'envoi n'a pas de ligne de
   * clôture, donc pas de CLV. Au-delà du seuil, c'est que le lot ne tient plus
   * dans sa fenêtre : trop de rencontres simultanées, file en retard ou
   * cadence d'appel trop lente. Le signal doit remonter tout de suite, parce
   * que l'absence de clôture ne se voit pas dans les données — elle se
   * confond avec un relevé simplement plus ancien.
   */
  private reportClosingCoverage(synced: number, missedKickoff: number): void {
    const attempted = synced + missedKickoff;
    if (attempted === 0) return;
    const missRatio = missedKickoff / attempted;
    if (missRatio < CLOSING_MISS_ALERT_RATIO) return;
    logger.warn(
      {
        synced,
        missedKickoff,
        missRatio: Number(missRatio.toFixed(3)),
        threshold: CLOSING_MISS_ALERT_RATIO,
      },
      'Closing sweep missed too many kickoffs — closing lines are incomplete',
    );
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

  /**
   * Rencontres des fenêtres de clôture, dédoublonnées.
   *
   * Une même rencontre peut tomber dans deux fenêtres si le cron a pris du
   * retard ; on ne la traite alors qu'une fois, la seconde capture n'apportant
   * rien de plus que la première.
   */
  private async findClosingFixtures(): Promise<
    { id: string; externalId: number; scheduledAt: Date }[]
  > {
    const batches = await Promise.all(
      ODDS_CLOSING_WINDOWS.map((window) =>
        this.fixtureService.findScheduledWithinMinutes(
          window.fromMinutes,
          window.toMinutes,
        ),
      ),
    );
    const seen = new Set<string>();
    return batches.flat().filter((fixture) => {
      if (seen.has(fixture.id)) return false;
      seen.add(fixture.id);
      return true;
    });
  }

  /**
   * Persiste les marchés ajoutés le 2026-09-15 pour un book : handicap
   * asiatique (plein match et mi-temps), second-half over/under, corners,
   * cartons, pair/impair, mi-temps la plus prolifique, première équipe à
   * marquer.
   *
   * Un book qui n'en price aucun produit simplement zéro jambe : ces marchés
   * sont absents chez beaucoup de books secondaires, ce n'est pas une
   * anomalie et cela ne doit rien journaliser.
   */
  private async persistExtendedMarkets(input: {
    fixtureId: string;
    bookmaker: string;
    snapshotAt: Date;
    bookmakers: OddsBookmaker[];
  }): Promise<void> {
    const { fullTime, firstHalf } = extractAsianHandicapOdds(
      input.bookmakers,
      input.bookmaker,
    );
    const context = {
      fixtureId: input.fixtureId,
      bookmaker: input.bookmaker,
      snapshotAt: input.snapshotAt,
    };
    if (fullTime.length > 0) {
      await this.fixtureService.upsertLineMarketOdds(
        context,
        'ASIAN_HANDICAP',
        fullTime,
      );
    }
    if (firstHalf.length > 0) {
      await this.fixtureService.upsertLineMarketOdds(
        context,
        'ASIAN_HANDICAP_HT',
        firstHalf,
      );
    }

    const extended = extractExtendedMarketOdds(
      input.bookmakers,
      input.bookmaker,
    );
    // Les marchés de REFERENCE_ONLY_MARKETS ne sont conservés que chez le
    // book de référence : leur marge les exclut du pari, et les stocker chez
    // onze books multiplierait le volume sans rien apporter.
    const keep = (market: string): boolean =>
      input.bookmaker === REFERENCE_BOOKMAKER ||
      !(REFERENCE_ONLY_MARKETS as readonly string[]).includes(market);
    for (const entry of extended.lineMarkets.filter((row) =>
      keep(row.market),
    )) {
      await this.fixtureService.upsertLineMarketOdds(
        context,
        entry.market,
        entry.legs,
      );
    }
    for (const entry of extended.fixedMarkets.filter((row) =>
      keep(row.market),
    )) {
      await this.fixtureService.upsertFixedOutcomeOdds(
        context,
        entry.market,
        entry.legs,
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
  // Pre-combined bookmaker markets (result × goals line / result × BTTS) —
  // a genuine joint price, not a synthetic combo. Sparse: bookmakers don't
  // price every (side, line) cell.
  resultTotalGoalsOdds: ResultTotalGoalsOdds;
  resultBttsOdds: ResultBttsOdds;
};

type YesNoOdds = { yes: number; no: number } | null;

type ResultTotalGoalsOdds = Partial<
  Record<
    `${'HOME' | 'DRAW' | 'AWAY'}_${'OVER' | 'UNDER'}_${'1_5' | '2_5' | '3_5' | '4_5'}`,
    number
  >
>;

type ResultBttsOdds = Partial<
  Record<`${'HOME' | 'DRAW' | 'AWAY'}_${'YES' | 'NO'}`, number>
>;

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
      resultTotalGoalsOdds: {},
      resultBttsOdds: {},
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
  const resultTotalGoalsBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.RESULT_TOTAL_GOALS,
  );
  const resultBttsBet = bk.bets.find(
    (b) => b.id === API_FOOTBALL_BET_IDS.RESULT_BTTS,
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
  const resultTotalGoalsOdds = extractResultTotalGoalsOdds(resultTotalGoalsBet);
  const resultBttsOdds = extractResultBttsOdds(resultBttsBet);

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
    resultTotalGoalsOdds,
    resultBttsOdds,
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

const RESULT_SIDE_TO_PICK = {
  Home: 'HOME',
  Draw: 'DRAW',
  Away: 'AWAY',
} as const;

// Result/Total Goals (id 25): a genuine bookmaker joint price ("Home/Over
// 2.5"), not a synthetic combo — sparse, books don't price every
// (side, line) cell.
function extractResultTotalGoalsOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): ResultTotalGoalsOdds {
  if (!bet) return {};
  const odds: ResultTotalGoalsOdds = {};
  for (const value of bet.values) {
    const match = /^(Home|Draw|Away)\/(Over|Under) (\d+)\.5$/.exec(value.value);
    if (!match) continue;
    const [, side, direction, whole] = match;
    const key =
      `${RESULT_SIDE_TO_PICK[side as keyof typeof RESULT_SIDE_TO_PICK]}_${direction.toUpperCase()}_${whole}_5` as keyof ResultTotalGoalsOdds;
    odds[key] = value.odd;
  }
  return odds;
}

// Results/Both Teams Score (id 24): fixed 6-cell grid, "Home/Yes" etc.
function extractResultBttsOdds(
  bet: OddsBookmaker['bets'][number] | undefined,
): ResultBttsOdds {
  if (!bet) return {};
  const odds: ResultBttsOdds = {};
  for (const value of bet.values) {
    const match = /^(Home|Draw|Away)\/(Yes|No)$/.exec(value.value);
    if (!match) continue;
    const [, side, yesNo] = match;
    const key =
      `${RESULT_SIDE_TO_PICK[side as keyof typeof RESULT_SIDE_TO_PICK]}_${yesNo.toUpperCase()}` as keyof ResultBttsOdds;
    odds[key] = value.odd;
  }
  return odds;
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

/** Marchés à ligne collectés depuis le 2026-09-15. */
export type LineMarket =
  | 'ASIAN_HANDICAP'
  | 'ASIAN_HANDICAP_HT'
  | 'OVER_UNDER_2H'
  | 'CORNERS'
  | 'CORNERS_HT'
  | 'CARDS';

/** Marchés à issues fixes collectés depuis le 2026-09-15. */
export type FixedOutcomeMarket =
  | 'ODD_EVEN'
  | 'ODD_EVEN_HT'
  | 'HIGHEST_SCORING_HALF'
  | 'TEAM_TO_SCORE_FIRST';

/** Une jambe de marché à ligne : un côté, une ligne, une cote. */
export type LineMarketLeg = {
  pick: string;
  line: number;
  odds: number;
};

/**
 * Parse un marché « Over X / Under X » : second-half, corners, cartons.
 *
 * La ligne peut être entière (« Over 9 » sur les corners) autant que
 * décimale (« Over 8.5 ») — c'est ce que l'encodage historique dans `pick`
 * ne savait pas représenter, et la raison d'être de la colonne `line`.
 */
export function parseOverUnderValues(
  bet: OddsBookmaker['bets'][number] | undefined,
): LineMarketLeg[] {
  if (!bet) return [];
  const legs: LineMarketLeg[] = [];
  for (const value of bet.values) {
    const matched = /^(Over|Under)\s*([+-]?\d+(?:\.\d+)?)$/i.exec(
      String(value.value).trim(),
    );
    if (!matched) continue;
    const [, side, rawLine] = matched;
    if (!side || rawLine === undefined) continue;
    const line = Number(rawLine);
    if (!Number.isFinite(line) || !Number.isFinite(value.odd)) continue;
    if (value.odd <= 1) continue;
    legs.push({ pick: side.toUpperCase(), line, odds: value.odd });
  }
  return legs;
}

/**
 * Parse un marché à issues fixes, en traduisant les libellés de l'API vers
 * le vocabulaire interne. Une issue non reconnue est ignorée plutôt que
 * stockée telle quelle : un `pick` inconnu polluerait durablement la base.
 */
export function parseFixedOutcomeValues(
  bet: OddsBookmaker['bets'][number] | undefined,
  mapping: Readonly<Record<string, string>>,
): Array<{ pick: string; odds: number }> {
  if (!bet) return [];
  const legs: Array<{ pick: string; odds: number }> = [];
  for (const value of bet.values) {
    const pick = mapping[String(value.value).trim().toLowerCase()];
    if (!pick) continue;
    if (!Number.isFinite(value.odd) || value.odd <= 1) continue;
    legs.push({ pick, odds: value.odd });
  }
  return legs;
}

/** Libellés de l'API relevés le 2026-09-15, par marché à issues fixes. */
export const FIXED_OUTCOME_MAPPINGS = {
  ODD_EVEN: { odd: 'ODD', even: 'EVEN' },
  HIGHEST_SCORING_HALF: {
    '1st half': 'FIRST_HALF',
    '2nd half': 'SECOND_HALF',
    draw: 'DRAW',
  },
  TEAM_TO_SCORE_FIRST: {
    home: 'HOME',
    away: 'AWAY',
    'no goal': 'NO_GOAL',
  },
} as const;

/** Une jambe de handicap asiatique : un côté, une ligne, une cote. */
export type AsianHandicapLeg = {
  pick: 'HOME' | 'AWAY';
  line: number;
  odds: number;
};

/**
 * Parse les valeurs d'un marché de handicap asiatique.
 *
 * L'API les libelle « Home -0.5 » / « Away -0.5 » : les deux côtés d'un même
 * handicap portent le MÊME signe, la ligne étant exprimée du point de vue du
 * domicile. Vérifié sur données réelles — apparier « Home -0.5 » avec
 * « Away +0.5 » donne des marges négatives, donc impossibles.
 *
 * Les lignes en quart de but (-0.25, +0.75) sont conservées telles quelles :
 * ce sont des marchés à part entière, pas des arrondis.
 */
export function parseAsianHandicapValues(
  bet: OddsBookmaker['bets'][number] | undefined,
): AsianHandicapLeg[] {
  if (!bet) return [];
  const legs: AsianHandicapLeg[] = [];
  for (const value of bet.values) {
    const matched = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/i.exec(
      String(value.value).trim(),
    );
    if (!matched) continue;
    const [, side, rawLine] = matched;
    if (!side || rawLine === undefined) continue;
    const line = Number(rawLine);
    if (!Number.isFinite(line) || !Number.isFinite(value.odd)) continue;
    if (value.odd <= 1) continue;
    legs.push({
      pick: side.toUpperCase() === 'HOME' ? 'HOME' : 'AWAY',
      line,
      odds: value.odd,
    });
  }
  return legs;
}

/**
 * Les huit marchés ajoutés le 2026-09-15 pour un book donné : quatre à ligne,
 * quatre à issues fixes. Un book qui n'en price aucun renvoie des listes
 * vides — c'est le cas courant hors des grands books, pas une anomalie.
 */
export function extractExtendedMarketOdds(
  bookmakers: OddsBookmaker[],
  bookmakerName: string,
): {
  lineMarkets: Array<{ market: LineMarket; legs: LineMarketLeg[] }>;
  fixedMarkets: Array<{
    market: FixedOutcomeMarket;
    legs: Array<{ pick: string; odds: number }>;
  }>;
} {
  const book = bookmakers.find((b) => b.name === bookmakerName);
  if (!book) return { lineMarkets: [], fixedMarkets: [] };
  const betById = (id: number) => book.bets.find((b) => b.id === id);

  const lineSpecs: ReadonlyArray<[LineMarket, number]> = [
    ['OVER_UNDER_2H', API_FOOTBALL_BET_IDS.OVER_UNDER_2H],
    ['CORNERS', API_FOOTBALL_BET_IDS.CORNERS],
    ['CORNERS_HT', API_FOOTBALL_BET_IDS.CORNERS_HT],
    ['CARDS', API_FOOTBALL_BET_IDS.CARDS],
  ];
  const fixedSpecs: ReadonlyArray<
    [FixedOutcomeMarket, number, Readonly<Record<string, string>>]
  > = [
    [
      'ODD_EVEN',
      API_FOOTBALL_BET_IDS.ODD_EVEN,
      FIXED_OUTCOME_MAPPINGS.ODD_EVEN,
    ],
    [
      'ODD_EVEN_HT',
      API_FOOTBALL_BET_IDS.ODD_EVEN_HT,
      FIXED_OUTCOME_MAPPINGS.ODD_EVEN,
    ],
    [
      'HIGHEST_SCORING_HALF',
      API_FOOTBALL_BET_IDS.HIGHEST_SCORING_HALF,
      FIXED_OUTCOME_MAPPINGS.HIGHEST_SCORING_HALF,
    ],
    [
      'TEAM_TO_SCORE_FIRST',
      API_FOOTBALL_BET_IDS.TEAM_TO_SCORE_FIRST,
      FIXED_OUTCOME_MAPPINGS.TEAM_TO_SCORE_FIRST,
    ],
  ];

  return {
    lineMarkets: lineSpecs
      .map(([market, id]) => ({
        market,
        legs: parseOverUnderValues(betById(id)),
      }))
      .filter((entry) => entry.legs.length > 0),
    fixedMarkets: fixedSpecs
      .map(([market, id, mapping]) => ({
        market,
        legs: parseFixedOutcomeValues(betById(id), mapping),
      }))
      .filter((entry) => entry.legs.length > 0),
  };
}

/** Handicap asiatique plein match et mi-temps pour un book donné. */
export function extractAsianHandicapOdds(
  bookmakers: OddsBookmaker[],
  bookmakerName: string,
): { fullTime: AsianHandicapLeg[]; firstHalf: AsianHandicapLeg[] } {
  const book = bookmakers.find((b) => b.name === bookmakerName);
  if (!book) return { fullTime: [], firstHalf: [] };
  return {
    fullTime: parseAsianHandicapValues(
      book.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.ASIAN_HANDICAP),
    ),
    firstHalf: parseAsianHandicapValues(
      book.bets.find((b) => b.id === API_FOOTBALL_BET_IDS.ASIAN_HANDICAP_HT),
    ),
  };
}

// Extracts Match Winner odds from every ingested bookmaker, in the order of
// ODDS_INGESTION_BOOKMAKER_IDS (Pinnacle first). The first entry is the
// primary book — it drives the full snapshot, secondary markets included.
//
// Les books ajoutés le 2026-09-15 élargissent ce qui est STOCKÉ. Le garde-fou
// de cohérence, lui, reste calculé sur COHERENCE_BOOKMAKERS : sans ce
// cloisonnement, collecter un book de plus déplacerait une médiane qui pilote
// des décisions en production.
export function extractAllOneXTwoOdds(
  bookmakers: OddsBookmaker[],
): OneXTwoOdds[] {
  const result: OneXTwoOdds[] = [];
  for (const bookmakerId of ODDS_INGESTION_BOOKMAKER_IDS) {
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
