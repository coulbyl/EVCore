import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { FixtureStatus } from '@evcore/db';
import {
  ApiFootballFixturesResponseSchema,
  type ApiFootballFixture,
  type ApiFootballStatus,
} from '../schemas/fixture.schema';
import {
  FixtureService,
  type FixtureInput,
} from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
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
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<FixturesSyncJobData>): Promise<void> {
    const { season } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const leagueId =
      this.config.get<string>('API_FOOTBALL_LEAGUE_ID') ??
      String(ETL_CONSTANTS.EPL_LEAGUE_ID);
    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?league=${leagueId}&season=${season}`;

    logger.info({ season }, 'Starting fixtures sync');

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

    const { data } = parsed;

    const competition = await this.fixtureService.upsertCompetition({
      name: ETL_CONSTANTS.EPL_COMPETITION_NAME,
      code: ETL_CONSTANTS.EPL_COMPETITION_CODE,
      country: ETL_CONSTANTS.EPL_COMPETITION_COUNTRY,
    });

    // API-FOOTBALL does not return season dates on the fixtures endpoint — use fallback
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonNameFromYear(season),
      startDate: eplSeasonFallbackStartDate(season),
      endDate: eplSeasonFallbackEndDate(season),
    });

    logger.info(
      { season, fixtureCount: data.response.length },
      'Upserting fixtures',
    );

    for (const item of data.response) {
      const fixture = mapApiFootballFixture(item);
      await this.fixtureService.upsertFixtureChain({
        competitionId: competition.id,
        seasonId: seasonRecord.id,
        fixture,
      });
    }

    logger.info(
      { season, fixtureCount: data.response.length },
      'Fixtures sync complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<FixturesSyncJobData> | undefined, error: Error): void {
    const isFinalAttempt =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      logger.error(
        { jobName: job.name, attempts: job.attemptsMade },
        'Job permanently failed — sending alert',
      );
      void this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.FIXTURES_SYNC,
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

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapApiFootballFixture(item: ApiFootballFixture): FixtureInput {
  return {
    externalId: item.fixture.id,
    homeTeam: {
      externalId: item.teams.home.id,
      name: item.teams.home.name,
      shortName: item.teams.home.name, // API-FOOTBALL has no shortName; name is used as fallback
    },
    awayTeam: {
      externalId: item.teams.away.id,
      name: item.teams.away.name,
      shortName: item.teams.away.name,
    },
    matchday: parseMatchday(item.league.round),
    scheduledAt: parseIsoDate(item.fixture.date),
    status: mapStatus(item.fixture.status.short),
    homeScore: item.goals.home,
    awayScore: item.goals.away,
  };
}

function parseMatchday(round: string): number {
  const match = /Regular Season - (\d+)/i.exec(round);
  if (!match?.[1]) {
    // Non-standard rounds (e.g. play-offs) default to 0 — filtered out by model
    return 0;
  }
  return parseInt(match[1], 10);
}

function mapStatus(status: ApiFootballStatus): FixtureStatus {
  switch (status) {
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
      return 'FINISHED';
    case 'PST':
      return 'POSTPONED';
    case 'CANC':
    case 'ABD':
      return 'CANCELLED';
    default:
      // NS, TBD, 1H, HT, 2H, ET, BT, P, INT, SUSP → SCHEDULED
      return 'SCHEDULED';
  }
}
