import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { OddsSnapshotSource } from '@evcore/db';
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

// Pinnacle bookmaker key on The Odds API
const PINNACLE_KEY = 'pinnacle';

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
    let imported = 0;
    let skipped = 0;

    for (const [dateStr, dateFixtures] of byDate) {
      // Fetch odds snapshot from just before kick-off (T-1 hour)
      const snapshotDate = buildSnapshotTimestamp(dateFixtures[0].scheduledAt);

      const events = await this.fetchHistoricalOdds(
        apiKey,
        sportKey,
        snapshotDate,
      );

      if (events === null) {
        logger.warn({ dateStr }, 'Failed to fetch odds for date — skipping');
        skipped += dateFixtures.length;
        continue;
      }

      for (const fixture of dateFixtures) {
        const event = matchEvent(events, fixture);

        if (!event) {
          logger.debug(
            { fixtureId: fixture.id, dateStr },
            'No matching event found in The Odds API response',
          );
          skipped++;
          continue;
        }

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
          snapshotAt: new Date(event.bookmakers[0].last_update),
          homeOdds: pinnacleOdds.home,
          drawOdds: pinnacleOdds.draw,
          awayOdds: pinnacleOdds.away,
          source: OddsSnapshotSource.HISTORICAL,
        });

        imported++;
      }

      await sleep(ETL_CONSTANTS.THE_ODDS_API_RATE_LIMIT_MS);
    }

    logger.info(
      { competitionCode, seasonYear, imported, skipped },
      'Historical odds import complete',
    );
  }

  private async fetchHistoricalOdds(
    apiKey: string,
    sportKey: string,
    date: string,
  ): Promise<TheOddsApiEvent[] | null> {
    const url =
      `${ETL_CONSTANTS.THE_ODDS_API_BASE}/historical/sports/${sportKey}/odds` +
      `?apiKey=${apiKey}&date=${date}&regions=eu&markets=h2h&bookmakers=${PINNACLE_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn({ status: res.status, date }, 'The Odds API error');
        return null;
      }
      const json: unknown = await res.json();
      const parsed = TheOddsApiHistoricalResponseSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn(
          { date, issues: parsed.error.issues },
          'The Odds API response failed Zod validation',
        );
        return null;
      }
      return parsed.data.data;
    } catch (err) {
      logger.warn({ date, err }, 'The Odds API fetch threw');
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
  return t.toISOString();
}

/**
 * Normalize a team name for fuzzy matching: strip accents, lowercase,
 * remove common suffixes (FC, CF, SC, etc.).
 */
function normalizeTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|afc|cf|sc|ac|ss|as)\b/g, '')
    .replace(/[.\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamMatches(
  team: { name: string; shortName: string },
  eventName: string,
): boolean {
  const norm = normalizeTeam(eventName);
  const n = normalizeTeam(team.name);
  const s = normalizeTeam(team.shortName);
  return (
    n === norm ||
    s === norm ||
    n.endsWith(` ${norm}`) ||
    norm.endsWith(` ${n}`) ||
    s.endsWith(` ${norm}`) ||
    norm.endsWith(` ${s}`)
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
