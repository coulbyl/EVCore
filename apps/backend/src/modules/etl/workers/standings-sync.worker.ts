import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  seasonFallbackEndDate,
  seasonFallbackStartDate,
} from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import { FixtureService } from '../../fixture/fixture.service';
import { StandingRepository } from '../../fixture/standing.repository';
import { ApiFootballStandingsResponseSchema } from '../schemas/standings.schema';
import {
  loadActiveCompetition,
  toUpsertCompetitionInput,
} from './etl-worker.utils';
import { Inject } from '@nestjs/common';

export type StandingsSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
};

const logger = createLogger('standings-sync-worker');

@Processor(BULLMQ_QUEUES.STANDINGS_SYNC)
export class StandingsSyncWorker extends WorkerHost {
  @Inject(ConfigService)
  private config!: ConfigService;

  constructor(
    private readonly fixtureService: FixtureService,
    private readonly standingRepository: StandingRepository,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<StandingsSyncJobData>): Promise<void> {
    const { season, competitionCode, leagueId } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info({ competitionCode, season }, 'Starting standings sync');

    const competitionMeta = await loadActiveCompetition(
      this.prisma,
      competitionCode,
      { allowInactive: true },
    );
    if (!competitionMeta) {
      logger.warn(
        { competitionCode },
        'Competition not found — skipping standings sync',
      );
      return;
    }

    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/standings?league=${leagueId}&season=${season}`;
    const res = await fetch(url, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (!res.ok) {
      throw new Error(
        `API Football standings error ${res.status} for ${competitionCode} ${season}`,
      );
    }

    const raw: unknown = await res.json();
    const parsed = ApiFootballStandingsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      logger.error(
        { competitionCode, season, issues: parsed.error.issues },
        'Standings Zod validation failed — skipping',
      );
      return;
    }

    if (parsed.data.results === 0 || parsed.data.response.length === 0) {
      logger.info(
        { competitionCode, season },
        'No standings data returned — skipping',
      );
      return;
    }

    const competition = await this.fixtureService.upsertCompetition(
      toUpsertCompetitionInput(competitionMeta),
    );
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competition.id,
      name: seasonNameFromYear(season),
      startDate: seasonFallbackStartDate(season),
      endDate: seasonFallbackEndDate(season),
    });

    const allGroups = parsed.data.response[0].league.standings;

    // Filter out the virtual "Ranking of third-placed teams" group
    const realGroups = allGroups.filter(
      (group) => group[0]?.group !== 'Ranking of third-placed teams',
    );

    const entries = realGroups.flat().map((entry) => ({
      competitionId: competition.id,
      seasonId: seasonRecord.id,
      teamApiId: entry.team.id,
      teamName: entry.team.name,
      teamLogo: entry.team.logo,
      group: entry.group,
      rank: entry.rank,
      points: entry.points,
      played: entry.all.played,
      win: entry.all.win,
      draw: entry.all.draw,
      lose: entry.all.lose,
      goalsFor: entry.all.goals.for ?? 0,
      goalsAgainst: entry.all.goals.against ?? 0,
      goalsDiff: entry.goalsDiff,
      form: entry.form,
      description: entry.description,
    }));

    await this.standingRepository.upsertMany(entries);

    logger.info(
      { competitionCode, season, count: entries.length },
      'Standings sync complete',
    );
  }
}
