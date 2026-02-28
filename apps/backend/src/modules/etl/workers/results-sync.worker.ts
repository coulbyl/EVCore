import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { ApiFootballFixturesResponseSchema } from '../schemas/fixture.schema';
import { ResultSchema } from '../schemas/result.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '../../../config/etl.constants';

export type ResultsSyncJobData = { season: number };

const logger = pino({ name: 'results-sync-worker' });

// API-FOOTBALL status codes that indicate a finished match
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD']);

@Processor(BULLMQ_QUEUES.RESULTS_SYNC)
export class ResultsSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ResultsSyncJobData>): Promise<void> {
    const { season } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const leagueId =
      this.config.get<string>('API_FOOTBALL_LEAGUE_ID') ??
      String(ETL_CONSTANTS.EPL_LEAGUE_ID);
    // Fetch only finished matches (FT + AET + PEN) in one request
    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?league=${leagueId}&season=${season}&status=FT-AET-PEN`;

    logger.info({ season }, 'Starting results sync');

    const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

    if (!res.ok) {
      throw new Error(
        `API-FOOTBALL responded ${res.status} for season ${season}`,
      );
    }

    const parsed = ApiFootballFixturesResponseSchema.safeParse(
      await res.json(),
    );

    if (!parsed.success) {
      logger.error(
        { season, issues: parsed.error.issues },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(`Zod validation failed for season ${season}`);
    }

    const finished = parsed.data.response.filter((item) =>
      FINISHED_STATUSES.has(item.fixture.status.short),
    );

    logger.info(
      { season, count: finished.length },
      'Processing finished matches',
    );

    let updated = 0;
    let skipped = 0;

    for (const item of finished) {
      const result = ResultSchema.safeParse({
        externalId: item.fixture.id,
        homeScore: item.goals.home,
        awayScore: item.goals.away,
        status: 'FINISHED',
      });

      if (!result.success) {
        logger.warn(
          { externalId: item.fixture.id, issues: result.error.issues },
          'Invalid result — skipping',
        );
        skipped++;
        continue;
      }

      await this.fixtureService.updateScores(
        result.data.externalId,
        result.data.homeScore,
        result.data.awayScore,
      );
      updated++;
    }

    logger.info({ season, updated, skipped }, 'Results sync complete');
  }
}
