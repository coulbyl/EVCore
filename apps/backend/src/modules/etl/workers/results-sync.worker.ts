import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { FootballDataResponseSchema } from '../schemas/fixture.schema';
import { ResultSchema } from '../schemas/result.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '../../../config/etl.constants';

export type ResultsSyncJobData = { season: number };

const logger = pino({ name: 'results-sync-worker' });

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
    const apiKey = this.config.getOrThrow<string>('FOOTBALL_DATA_API_KEY');
    const url = `${ETL_CONSTANTS.FOOTBALL_DATA_API_BASE}/competitions/${ETL_CONSTANTS.EPL_COMPETITION_CODE}/matches?season=${season}&status=FINISHED`;

    logger.info({ season }, 'Starting results sync');

    const res = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });

    if (!res.ok) {
      throw new Error(
        `football-data.org responded ${res.status} for season ${season}`,
      );
    }

    const parsed = FootballDataResponseSchema.safeParse(await res.json());

    if (!parsed.success) {
      logger.error(
        { season, issues: parsed.error.issues },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(`Zod validation failed for season ${season}`);
    }

    const finished = parsed.data.matches.filter((m) => m.status === 'FINISHED');
    logger.info(
      { season, count: finished.length },
      'Processing finished matches',
    );

    let updated = 0;
    let skipped = 0;

    for (const match of finished) {
      const result = ResultSchema.safeParse({
        externalId: match.id,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
        status: 'FINISHED',
      });

      if (!result.success) {
        logger.warn(
          { externalId: match.id, issues: result.error.issues },
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
