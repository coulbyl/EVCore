import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import pino from 'pino';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { FixtureService } from '@modules/fixture/fixture.service';
import { parseIsoDate } from '@utils/date.utils';
import { OddsApiResponseSchema } from '../schemas/odds.schema';

export type OddsHistoricalSyncJobData = { season: number };

const logger = pino({ name: 'odds-historical-sync-worker' });

@Processor(BULLMQ_QUEUES.ODDS_HISTORICAL_SYNC)
export class OddsHistoricalSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<OddsHistoricalSyncJobData>): Promise<void> {
    const { season } = job.data;
    const apiKey = this.config.getOrThrow<string>('ODDS_API_KEY');
    const leagueId = this.config.get<string>('ODDS_API_LEAGUE_ID') ?? '39'; // EPL

    const url = `${ETL_CONSTANTS.ODDS_API_BASE}/odds?league=${leagueId}&season=${season}`;

    logger.info({ season, url }, 'Starting odds historical sync');

    const res = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(
        `API-Sports responded ${res.status} for season ${season}`,
      );
    }

    const parsed = OddsApiResponseSchema.safeParse(await res.json());

    if (!parsed.success) {
      logger.error(
        { season, issues: parsed.error.issues },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(`Zod validation failed for odds season ${season}`);
    }

    let fetched = 0;
    let inserted = 0;
    let skipped = 0;

    for (const match of parsed.data.response) {
      fetched++;

      const fixture = await this.fixtureService.findByExternalId(
        match.fixture.id,
      );
      if (!fixture) {
        skipped++;
        continue;
      }

      const snapshotAt = deriveSnapshotAt(
        match.update,
        match.fixture.timestamp,
        match.fixture.date,
      );

      for (const bookmaker of match.bookmakers) {
        const market = bookmaker.bets.find((b) => b.name === 'Match Winner');
        if (!market) {
          skipped++;
          continue;
        }

        const home = market.values.find((v) => v.value === 'Home')?.odd;
        const draw = market.values.find((v) => v.value === 'Draw')?.odd;
        const away = market.values.find((v) => v.value === 'Away')?.odd;

        if (home === undefined || draw === undefined || away === undefined) {
          skipped++;
          continue;
        }

        await this.fixtureService.upsertOneXTwoOddsSnapshot({
          fixtureId: fixture.id,
          bookmaker: bookmaker.name,
          snapshotAt,
          homeOdds: home,
          drawOdds: draw,
          awayOdds: away,
        });
        inserted++;
      }
    }

    logger.info(
      { season, fetched, inserted, skipped },
      'Odds historical sync complete',
    );
  }
}

function deriveSnapshotAt(
  update?: number,
  fixtureTimestamp?: number,
  fixtureDate?: string,
): Date {
  if (update) {
    return new Date(update * 1000);
  }
  if (fixtureTimestamp) {
    return new Date(fixtureTimestamp * 1000);
  }
  if (fixtureDate) {
    return parseIsoDate(fixtureDate);
  }
  return new Date();
}
