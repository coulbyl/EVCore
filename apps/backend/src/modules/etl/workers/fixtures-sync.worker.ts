import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
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
import {
  ETL_CONSTANTS,
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
} from '@config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  endOfUtcDay,
  formatDateUtc,
  seasonFallbackEndDate,
  seasonFallbackStartDate,
  startOfUtcDay,
  parseIsoDate,
} from '@utils/date.utils';
import {
  fetchOrSkip,
  loadActiveCompetition,
  toUpsertCompetitionInput,
} from './etl-worker.utils';
import type { LeagueSyncJobData } from './league-sync.worker';
import { RollingStatsService } from '../../rolling-stats/rolling-stats.service';

export type FixturesSyncJobData = {
  season: number;
  competitionCode: string;
  leagueId: number;
  syncScope?: 'routine' | 'backfill';
};

const logger = createLogger('fixtures-sync-worker');

@Injectable()
export class FixturesSyncWorker {
  // eslint-disable-next-line max-params -- Queue injection is explicit for ETL chaining clarity.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rollingStatsService: RollingStatsService,
    @InjectQueue(BULLMQ_QUEUES.LEAGUE_SYNC)
    private readonly leagueSyncQueue: Queue<LeagueSyncJobData>,
  ) {}

  async process(job: Job<FixturesSyncJobData>): Promise<void> {
    const {
      season,
      competitionCode,
      leagueId: leagueIdNum,
      syncScope = 'routine',
    } = job.data;
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    const leagueId = String(leagueIdNum);

    logger.info({ competitionCode, season }, 'Starting fixtures sync');

    const competitionMeta = await loadActiveCompetition(
      this.prisma,
      competitionCode,
    );
    if (!competitionMeta) {
      logger.info(
        { competitionCode, season },
        'Competition inactive — skipping fixtures sync job',
      );
      return;
    }

    const url = buildFixturesUrl({
      leagueId,
      season,
      syncScope,
    });

    logger.info(
      { competitionCode, season, syncScope, url },
      'Fetching fixtures from API-FOOTBALL',
    );

    const res = await fetchOrSkip(url, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (res === null) {
      throw new Error(
        `Transient network error while fetching fixtures for ${competitionCode} season ${season}`,
      );
    }

    if (!res.ok) {
      logger.error(
        { competitionCode, season, syncScope, url, status: res.status },
        'API-FOOTBALL returned non-ok response during fixtures sync',
      );
      throw new Error(
        `API-FOOTBALL responded ${res.status} for ${competitionCode} season ${season}`,
      );
    }

    const parsed = ApiFootballFixturesResponseSchema.safeParse(
      await res.json(),
    );

    if (!parsed.success) {
      logger.error(
        {
          competitionCode,
          season,
          syncScope,
          url,
          issues: parsed.error.issues,
        },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(
        `Zod validation failed for ${competitionCode} season ${season}`,
      );
    }

    const { data } = parsed;
    const competitionRecord = await this.fixtureService.upsertCompetition(
      toUpsertCompetitionInput(competitionMeta),
    );

    // API-FOOTBALL does not return season dates on the fixtures endpoint — use fallback
    const seasonRecord = await this.fixtureService.upsertSeason({
      competitionId: competitionRecord.id,
      name: seasonNameFromYear(season),
      startDate: seasonFallbackStartDate(season),
      endDate: seasonFallbackEndDate(season),
    });

    logger.info(
      { season, fixtureCount: data.response.length },
      'Upserting fixtures',
    );

    let rollingStatsRefreshNeeded = false;

    for (const item of data.response) {
      const fixture = mapApiFootballFixture(item);
      const result = await this.fixtureService.upsertFixtureChain({
        competitionId: competitionRecord.id,
        seasonId: seasonRecord.id,
        fixture,
      });

      if (result.affectsRollingStats) {
        rollingStatsRefreshNeeded = true;
      }
    }

    logger.info(
      { season, fixtureCount: data.response.length },
      'Fixtures sync complete',
    );

    if (rollingStatsRefreshNeeded) {
      await this.rollingStatsService.refreshSeason(seasonRecord.id);
    }

    await this.leagueSyncQueue.add(
      `injuries-sync-${competitionCode}-${season}`,
      {
        syncType: 'injuries',
        competitionCode,
        season,
        leagueId: leagueIdNum,
        syncScope,
      } satisfies LeagueSyncJobData,
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
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
      logoUrl: item.teams.home.logo,
    },
    awayTeam: {
      externalId: item.teams.away.id,
      name: item.teams.away.name,
      shortName: item.teams.away.name,
      logoUrl: item.teams.away.logo,
    },
    matchday: parseMatchday(item.league.round),
    scheduledAt: parseIsoDate(item.fixture.date),
    status: mapStatus(item.fixture.status.short),
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    homeHtScore: item.score.halftime.home,
    awayHtScore: item.score.halftime.away,
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
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'INT':
      return 'IN_PROGRESS';
    default:
      // NS, TBD, SUSP → SCHEDULED
      return 'SCHEDULED';
  }
}

function buildFixturesUrl(input: {
  leagueId: string;
  season: number;
  syncScope: 'routine' | 'backfill';
}): string {
  const base = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?league=${input.leagueId}&season=${input.season}`;

  if (input.syncScope === 'backfill') {
    return base;
  }

  const from = startOfUtcDay(new Date());
  const to = endOfUtcDay(new Date(from.getTime() + 24 * 60 * 60 * 1000));

  return `${base}&from=${formatDateUtc(from)}&to=${formatDateUtc(to)}`;
}
