import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Market, OddsSnapshotSource } from '@evcore/db';
import { createLogger } from '@utils/logger';
import {
  ETL_CONSTANTS,
  BULLMQ_QUEUES,
  THE_ODDS_API_SPORT_KEYS,
} from '@config/etl.constants';
import { BACKTEST_CONSTANTS } from '@modules/backtest/backtest.constants';
import { FixtureService } from '@modules/fixture/fixture.service';
import { NotificationService } from '@modules/notification/notification.service';
import {
  TheOddsApiHistoricalResponseSchema,
  TheOddsApiEventOddsResponseSchema,
  TheOddsApiErrorResponseSchema,
  type TheOddsApiEvent,
} from '../schemas/the-odds-api.schema';
import { sleep } from '@utils/async.utils';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type OddsHistoricalImportJobData = {
  // Competition code matching the DB seed: 'UCL' | 'UEL' | 'UECL'
  competitionCode: keyof typeof THE_ODDS_API_SPORT_KEYS;
  // Start year of the season (e.g. 2022 for 2022/23)
  seasonYear: number;
};

const logger = createLogger('odds-historical-import-worker');

const PINNACLE_KEY = 'pinnacle';
// Fallback bookmaker for totals when Pinnacle uses a non-2.5 Asian line.
// Unibet EU consistently offers standard 2.5 over/under lines.
const TOTALS_FALLBACK_KEY = 'unibet_eu';

// lockDuration: 20 min — one season import fetches many pages with rate limiting
@Processor(BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT, { lockDuration: 1_200_000 })
export class OddsHistoricalImportWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsHistoricalImportJobData>): Promise<void> {
    const { competitionCode, seasonYear } = job.data;

    if (seasonYear < BACKTEST_CONSTANTS.EUROPEAN_BACKTEST_SEASON_FROM) {
      throw new Error(
        `seasonYear ${seasonYear} is below EUROPEAN_BACKTEST_SEASON_FROM (${BACKTEST_CONSTANTS.EUROPEAN_BACKTEST_SEASON_FROM})`,
      );
    }

    const apiKey = this.config.getOrThrow<string>('THE_ODDS_API_KEY');
    const sportKey = THE_ODDS_API_SPORT_KEYS[competitionCode];

    logger.info(
      { competitionCode, seasonYear, sportKey },
      'Starting historical odds import',
    );

    // Find all finished fixtures for this competition + season
    const season = await this.fixtureService.findSeasonByCompetitionAndYear(
      competitionCode,
      seasonYear,
    );

    if (!season) {
      logger.warn(
        { competitionCode, seasonYear },
        'Season not found in DB — run fixtures-sync first',
      );
      return;
    }

    const fixtures = await this.fixtureService.findFinishedBySeasonWithTeams(
      season.id,
    );

    if (fixtures.length === 0) {
      logger.info(
        { competitionCode, seasonYear },
        'No finished fixtures found — nothing to import',
      );
      return;
    }

    logger.info(
      { count: fixtures.length },
      'Fixtures found — fetching historical odds per match date',
    );

    // Group fixtures by date (YYYY-MM-DD) to batch API calls
    const byDate = groupByDate(fixtures);
    const totalDates = byDate.size;
    let dateIndex = 0;
    let imported = 0;
    let skipped = 0;

    for (const [dateStr, dateFixtures] of byDate) {
      dateIndex++;
      const fixtureIds = dateFixtures.map((f) => f.id);
      const TRACKED_MARKETS = [
        Market.ONE_X_TWO,
        Market.OVER_UNDER,
        Market.BTTS,
        Market.FIRST_HALF_WINNER,
        Market.OVER_UNDER_HT,
      ] as const;

      // Single query: returns a map of fixtureId → set of already-imported markets.
      const existing = await this.fixtureService.findExistingMarketsForFixtures(
        fixtureIds,
        [...TRACKED_MARKETS],
      );

      const has = (fixtureId: string, market: Market): boolean =>
        existing.get(fixtureId)?.has(market) ?? false;

      // Skip fixtures where every tracked market is already present.
      const needFetch = dateFixtures.filter((f) =>
        TRACKED_MARKETS.some((m) => !has(f.id, m)),
      );

      if (needFetch.length === 0) {
        logger.debug(
          { dateStr },
          'All markets already present — skipping date',
        );
        skipped += dateFixtures.length;
        continue;
      }

      // Always fetch h2h from batch to get event IDs (needed for per-event secondary calls).
      // btts, h2h_h1, totals_h1 are fetched per-event via a dedicated endpoint.
      const needOu = needFetch.some((f) => !has(f.id, Market.OVER_UNDER));
      const batchMarkets = ['h2h', needOu && 'totals']
        .filter(Boolean)
        .join(',');

      const snapshotDate = buildSnapshotTimestamp(dateFixtures[0].scheduledAt);
      const events = await this.fetchBatchOdds(
        apiKey,
        sportKey,
        snapshotDate,
        batchMarkets,
      );

      if (events === null) {
        logger.warn({ dateStr }, 'Failed to fetch odds for date — skipping');
        skipped += needFetch.length;
        continue;
      }

      if (events.length === 0) {
        logger.info(
          { dateStr, fixturesNeedFetch: needFetch.length },
          'API returned empty events array — likely outside retention window',
        );
        skipped += needFetch.length;
        continue;
      }

      logger.debug(
        {
          dateStr,
          eventsReturned: events.length,
          fixturesNeedFetch: needFetch.length,
        },
        'API response received',
      );

      const apiTeamNames = events.map(
        (e: TheOddsApiEvent) => `${e.home_team} vs ${e.away_team}`,
      );

      for (const fixture of needFetch) {
        const event = matchEvent(events, fixture);

        if (!event) {
          const mismatch = {
            fixtureId: fixture.id,
            dateStr,
            dbHome: fixture.homeTeam.name,
            dbAway: fixture.awayTeam.name,
            apiEvents: apiTeamNames,
          };
          logger.info(mismatch, 'No matching event — team name mismatch');
          await appendFile(
            join(process.cwd(), 'logs', 'team-name-mismatches.ndjson'),
            JSON.stringify(mismatch) + '\n',
          ).catch(() => undefined);
          skipped++;
          continue;
        }

        const snapshotBookmaker =
          event.bookmakers.find((b) => b.key === PINNACLE_KEY) ??
          event.bookmakers[0];
        const snapshotAt = new Date(
          snapshotBookmaker?.last_update ?? event.commence_time,
        );

        if (!has(fixture.id, Market.ONE_X_TWO)) {
          const pinnacleOdds = extractPinnacleH2H(event);
          if (!pinnacleOdds) {
            logger.debug(
              { fixtureId: fixture.id, externalEventId: event.id },
              'Pinnacle h2h odds not available for this event',
            );
            skipped++;
            continue;
          }
          await this.fixtureService.upsertOneXTwoOddsSnapshot({
            fixtureId: fixture.id,
            bookmaker: 'Pinnacle',
            snapshotAt,
            homeOdds: pinnacleOdds.home,
            drawOdds: pinnacleOdds.draw,
            awayOdds: pinnacleOdds.away,
            source: OddsSnapshotSource.HISTORICAL,
          });
        }

        const totals = !has(fixture.id, Market.OVER_UNDER)
          ? extractTotals25(event)
          : null;

        // Secondary markets (btts, h2h_h1, totals_h1) require the per-event endpoint.
        let btts: BttsOdds | null = null;
        let fhw: FirstHalfWinnerOdds | null = null;
        let ouHt: OuHtOdds = {};

        const secondaryMarketParts = [
          !has(fixture.id, Market.BTTS) && 'btts',
          !has(fixture.id, Market.FIRST_HALF_WINNER) && 'h2h_h1',
          !has(fixture.id, Market.OVER_UNDER_HT) && 'totals_h1',
        ]
          .filter(Boolean)
          .join(',');

        if (secondaryMarketParts) {
          const secondaryEvent = await this.fetchEventOdds(
            apiKey,
            sportKey,
            event.id,
            snapshotDate,
            secondaryMarketParts,
          );
          if (secondaryEvent) {
            btts = !has(fixture.id, Market.BTTS)
              ? extractBtts(secondaryEvent)
              : null;
            fhw = !has(fixture.id, Market.FIRST_HALF_WINNER)
              ? extractFirstHalfWinner(secondaryEvent)
              : null;
            ouHt = !has(fixture.id, Market.OVER_UNDER_HT)
              ? extractTotalsHT(secondaryEvent)
              : {};
          }
          await sleep(ETL_CONSTANTS.THE_ODDS_API_RATE_LIMIT_MS);
        }

        const hasSecondary =
          totals !== null ||
          btts !== null ||
          fhw !== null ||
          Object.keys(ouHt).length > 0;

        if (hasSecondary) {
          await this.fixtureService.upsertSecondaryMarketOdds({
            fixtureId: fixture.id,
            bookmaker: totals?.bookmaker ?? 'Pinnacle',
            snapshotAt,
            overUnderOdds: totals
              ? { OVER: totals.over, UNDER: totals.under }
              : {},
            bttsYesOdds: btts?.yes ?? null,
            bttsNoOdds: btts?.no ?? null,
            htftOdds: {},
            ouHtOdds: ouHt,
            firstHalfWinnerOdds: fhw,
            source: OddsSnapshotSource.HISTORICAL,
          });
        }

        imported++;
      }

      logger.info(
        { dateStr, dateIndex, totalDates, imported, skipped },
        'Date batch complete',
      );

      await sleep(ETL_CONSTANTS.THE_ODDS_API_RATE_LIMIT_MS);
    }

    logger.info(
      { competitionCode, seasonYear, imported, skipped },
      'Historical odds import complete',
    );
  }

  // eslint-disable-next-line max-params
  private async fetchBatchOdds(
    apiKey: string,
    sportKey: string,
    date: string,
    markets: string,
  ): Promise<TheOddsApiEvent[] | null> {
    const url =
      `${ETL_CONSTANTS.THE_ODDS_API_BASE}/historical/sports/${sportKey}/odds` +
      `?apiKey=${apiKey}&date=${date}&regions=eu` +
      `&markets=${markets}` +
      `&bookmakers=${PINNACLE_KEY},${TOTALS_FALLBACK_KEY}`;

    try {
      const stdout = await runCurlGet(url);
      const json: unknown = JSON.parse(stdout);

      const errorParsed = TheOddsApiErrorResponseSchema.safeParse(json);
      if (errorParsed.success) {
        logger.warn(
          {
            date,
            markets,
            errorCode: errorParsed.data.error_code,
            message: errorParsed.data.message,
          },
          'The Odds API batch returned an error response',
        );
        return null;
      }

      const parsed = TheOddsApiHistoricalResponseSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn(
          { date, issues: parsed.error.issues },
          'The Odds API batch response failed Zod validation',
        );
        return null;
      }
      return parsed.data.data;
    } catch (err) {
      logger.warn({ date, err }, 'The Odds API fetch threw');
      return null;
    }
  }

  // eslint-disable-next-line max-params
  private async fetchEventOdds(
    apiKey: string,
    sportKey: string,
    eventId: string,
    date: string,
    markets: string,
  ): Promise<TheOddsApiEvent | null> {
    const url =
      `${ETL_CONSTANTS.THE_ODDS_API_BASE}/historical/sports/${sportKey}/events/${eventId}/odds` +
      `?apiKey=${apiKey}&date=${date}&regions=eu` +
      `&markets=${markets}` +
      `&bookmakers=${PINNACLE_KEY}`;

    try {
      const stdout = await runCurlGet(url);
      const json: unknown = JSON.parse(stdout);

      const errorParsed = TheOddsApiErrorResponseSchema.safeParse(json);
      if (errorParsed.success) {
        logger.warn(
          {
            eventId,
            markets,
            errorCode: errorParsed.data.error_code,
            message: errorParsed.data.message,
          },
          'The Odds API event endpoint returned an error response',
        );
        return null;
      }

      const parsed = TheOddsApiEventOddsResponseSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn(
          { eventId, issues: parsed.error.issues },
          'The Odds API event response failed Zod validation',
        );
        return null;
      }
      return parsed.data.data;
    } catch (err) {
      logger.warn({ eventId, err }, 'The Odds API event fetch threw');
      return null;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<OddsHistoricalImportJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT,
      job,
      error,
      logger,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FixtureMinimal = {
  id: string;
  scheduledAt: Date;
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
};

function groupByDate(
  fixtures: FixtureMinimal[],
): Map<string, FixtureMinimal[]> {
  const map = new Map<string, FixtureMinimal[]>();
  for (const f of fixtures) {
    const key = f.scheduledAt.toISOString().slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return map;
}

/**
 * Returns an ISO 8601 timestamp 1 hour before the first fixture of a day.
 * The Odds API historical endpoint returns the odds snapshot at that point in time.
 */
function buildSnapshotTimestamp(scheduledAt: Date): string {
  const t = new Date(scheduledAt);
  t.setUTCHours(t.getUTCHours() - 1);
  return t.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Normalize a team name for fuzzy matching: strip accents, lowercase,
 * remove common suffixes (FC, CF, SC, etc.), and normalize separators.
 */
export function normalizeTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/([A-Za-z])\./g, '$1')
    .toLowerCase()
    .replace(/\butd\b/g, 'united')
    .replace(/\b(fc|afc|cf|sc|ac|ss|as|ff|if|bk|aif|bois|ik)\b/g, '')
    .replace(/[.\-'/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Maps normalized DB names to additional normalized forms used by The Odds API.
// Needed when the API name shares no prefix/suffix with the DB name.
const TEAM_ALIASES: Record<string, string[]> = {
  // PL
  wolves: ['wolverhampton wanderers', 'wolverhampton'],
  // BL1 / D2
  'bayern munchen': ['bayern munich'],
  '1899 hoffenheim': ['tsg hoffenheim', 'hoffenheim'],
  '1 heidenheim': ['heidenheim'],
  'hertha bsc': ['hertha berlin'],
  // D2
  'sv wehen': ['wehen wiesbaden'],
  // SP2
  'racing ferrol': ['racing de ferrol'],
  'racing santander': ['real racing club de santander', 'real racing club'],
  'real sociedad ii': ['real sociedad b'],
  // L1 / F2
  'stade brestois 29': ['brest'],
  laval: ['stade lavallois'],
  quevilly: ['us quevilly rouen'],
  // I2
  catanzaro: ['us catanzaro 1929'],
  lecco: ['lecce'],
  // CH
  'west brom': ['west bromwich albion', 'west bromwich'],
  qpr: ['queens park rangers'],
  // EL1 / EL2
  'accrington st': ['accrington stanley'],
  // POR
  'sporting cp': ['sporting lisbon', 'sporting'],
  guimaraes: ['vitoria sc', 'vitoria'],
  // LL — DB stores "Athletic Club", API uses "Athletic Bilbao"
  'athletic club': ['athletic bilbao', 'athletic'],
  // J1
  'sanfrecce hiroshima': ['hiroshima sanfrecce'],
  'kyoto sanga': ['kyoto purple sanga'],
};

export function teamMatches(
  team: { name: string; shortName: string },
  eventName: string,
): boolean {
  const norm = normalizeTeam(eventName);
  const n = normalizeTeam(team.name);
  const candidates = [
    n,
    normalizeTeam(team.shortName),
    ...(TEAM_ALIASES[n] ?? []),
  ];

  return candidates.some((c) => namesEquivalent(c, norm));
}

function namesEquivalent(left: string, right: string): boolean {
  if (
    left === right ||
    left.startsWith(`${right} `) ||
    right.startsWith(`${left} `) ||
    left.endsWith(` ${right}`) ||
    right.endsWith(` ${left}`)
  ) {
    return true;
  }

  const stripTrailingS = (value: string): string =>
    value.endsWith('s') ? value.slice(0, -1) : value;

  return (
    stripTrailingS(left) === right ||
    stripTrailingS(right) === left ||
    stripTrailingS(left) === stripTrailingS(right)
  );
}

function matchEvent(
  events: TheOddsApiEvent[],
  fixture: FixtureMinimal,
): TheOddsApiEvent | undefined {
  return events.find(
    (e) =>
      teamMatches(fixture.homeTeam, e.home_team) &&
      teamMatches(fixture.awayTeam, e.away_team),
  );
}

type H2HOdds = { home: number; draw: number; away: number };

type TotalsOdds = { over: number; under: number; bookmaker: string };

// Extracts over/under 2.5 odds: Pinnacle preferred, falls back to Unibet EU.
// Pinnacle uses Asian handicap lines (2.75, 3.0) for high-scoring leagues —
// in that case Unibet EU provides the standard 2.5 line.
function extractTotals25(event: TheOddsApiEvent): TotalsOdds | null {
  for (const bmKey of [PINNACLE_KEY, TOTALS_FALLBACK_KEY]) {
    const bm = event.bookmakers.find((b) => b.key === bmKey);
    if (!bm) continue;

    const totals = bm.markets.find((m) => m.key === 'totals');
    if (!totals) continue;

    const over = totals.outcomes.find(
      (o) => o.name === 'Over' && o.point === 2.5,
    )?.price;
    const under = totals.outcomes.find(
      (o) => o.name === 'Under' && o.point === 2.5,
    )?.price;

    if (over !== undefined && under !== undefined) {
      return {
        over,
        under,
        bookmaker: bmKey === PINNACLE_KEY ? 'Pinnacle' : 'Unibet',
      };
    }
  }
  return null;
}

type BttsOdds = { yes: number; no: number };

type OuHtOdds = Partial<
  Record<'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5', number>
>;

type FirstHalfWinnerOdds = { home: number; draw: number; away: number };

function extractBtts(event: TheOddsApiEvent): BttsOdds | null {
  const bm = event.bookmakers.find((b) => b.key === PINNACLE_KEY);
  if (!bm) return null;
  const market = bm.markets.find((m) => m.key === 'btts');
  if (!market) return null;
  const yes = market.outcomes.find((o) => o.name === 'Yes')?.price;
  const no = market.outcomes.find((o) => o.name === 'No')?.price;
  if (yes === undefined || no === undefined) return null;
  return { yes, no };
}

function extractFirstHalfWinner(
  event: TheOddsApiEvent,
): FirstHalfWinnerOdds | null {
  const bm = event.bookmakers.find((b) => b.key === PINNACLE_KEY);
  if (!bm) return null;
  const market = bm.markets.find((m) => m.key === 'h2h_h1');
  if (!market) return null;
  const home = market.outcomes.find((o) => o.name === event.home_team)?.price;
  const away = market.outcomes.find((o) => o.name === event.away_team)?.price;
  const draw = market.outcomes.find((o) => o.name === 'Draw')?.price;
  if (home === undefined || away === undefined || draw === undefined)
    return null;
  return { home, draw, away };
}

function extractTotalsHT(event: TheOddsApiEvent): OuHtOdds {
  const bm = event.bookmakers.find((b) => b.key === PINNACLE_KEY);
  if (!bm) return {};
  const market = bm.markets.find((m) => m.key === 'totals_h1');
  if (!market) return {};

  const result: OuHtOdds = {};
  for (const outcome of market.outcomes) {
    const point = outcome.point;
    if (point === 0.5) {
      if (outcome.name === 'Over') result['OVER_0_5'] = outcome.price;
      else if (outcome.name === 'Under') result['UNDER_0_5'] = outcome.price;
    } else if (point === 1.5) {
      if (outcome.name === 'Over') result['OVER_1_5'] = outcome.price;
      else if (outcome.name === 'Under') result['UNDER_1_5'] = outcome.price;
    }
  }
  return result;
}

function extractPinnacleH2H(event: TheOddsApiEvent): H2HOdds | null {
  const bm = event.bookmakers.find((b) => b.key === PINNACLE_KEY);
  if (!bm) return null;

  const h2h = bm.markets.find((m) => m.key === 'h2h');
  if (!h2h) return null;

  const home = h2h.outcomes.find((o) => o.name === event.home_team)?.price;
  const away = h2h.outcomes.find((o) => o.name === event.away_team)?.price;
  const draw = h2h.outcomes.find((o) => o.name === 'Draw')?.price;

  if (home === undefined || away === undefined || draw === undefined)
    return null;

  return { home, draw, away };
}

// Uses system curl instead of Node fetch to avoid WSL2 ETIMEDOUT issues.
// The API key is embedded in the URL query string — no auth header needed.
function runCurlGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['--silent', '--show-error', '--location', url],
      (error, stdout) => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}
