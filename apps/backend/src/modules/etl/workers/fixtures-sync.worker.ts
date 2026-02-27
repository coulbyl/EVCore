import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { FootballDataResponseSchema } from '../schemas/fixture.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  eplSeasonFallbackEndDate,
  eplSeasonFallbackStartDate,
  parseIsoDate,
} from '@utils/date.utils';

export type FixturesSyncJobData = { season: number };

const logger = pino({ name: 'fixtures-sync-worker' });

@Processor(BULLMQ_QUEUES.FIXTURES_SYNC)
export class FixturesSyncWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<FixturesSyncJobData>): Promise<void> {
    const { season } = job.data;
    const apiKey = this.config.getOrThrow<string>('FOOTBALL_DATA_API_KEY');
    const url = `${ETL_CONSTANTS.FOOTBALL_DATA_API_BASE}/competitions/${ETL_CONSTANTS.EPL_COMPETITION_CODE}/matches?season=${season}`;

    logger.info({ season }, 'Starting fixtures sync');

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

    const { data } = parsed;

    const competition = await this.fixtureService.upsertCompetition({
      name: ETL_CONSTANTS.EPL_COMPETITION_NAME,
      code: ETL_CONSTANTS.EPL_COMPETITION_CODE,
      country: ETL_CONSTANTS.EPL_COMPETITION_COUNTRY,
    });

    // Derive season dates — API may return null on some seasons
    const startDate = data.season.startDate
      ? parseIsoDate(data.season.startDate)
      : eplSeasonFallbackStartDate(season);
    const endDate = data.season.endDate
      ? parseIsoDate(data.season.endDate)
      : eplSeasonFallbackEndDate(season);

    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonNameFromYear(season),
      startDate,
      endDate,
    });

    logger.info(
      { season, fixtureCount: data.matches.length },
      'Upserting fixtures',
    );

    for (const match of data.matches) {
      await this.fixtureService.upsertFixtureChain({
        competitionId: competition.id,
        seasonId: seasonRecord.id,
        fixture: match,
      });
      // No per-match rate limiting — all fixtures come in a single API call.
      // The between-season delay is handled by BullMQ job staggering in EtlService.
    }

    logger.info(
      { season, fixtureCount: data.matches.length },
      'Fixtures sync complete',
    );
  }
}
