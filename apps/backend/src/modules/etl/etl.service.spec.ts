import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtlService } from './etl.service';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
  DEFAULT_ACTIVE_SEASONS_COUNT,
  DEFAULT_SEASON_START_MONTH,
  getActiveCsvSeasonCodes,
} from '../../config/etl.constants';
import { activeSeasons } from '@utils/date.utils';
import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '@/prisma.service';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { OddsLiveSyncJobData } from './workers/odds-live-sync.worker';
import type { InjuriesSyncJobData } from './workers/injuries-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';

type MockQueue<T> = Pick<
  Queue<T>,
  'add' | 'upsertJobScheduler' | 'removeJobScheduler'
>;

function makeQueue<T>(): MockQueue<T> {
  return {
    add: vi.fn().mockResolvedValue({}),
    upsertJobScheduler: vi.fn().mockResolvedValue({}),
    removeJobScheduler: vi.fn().mockResolvedValue(undefined),
  };
}

// Scheduling disabled in tests — avoids real upsertJobScheduler calls
const configMock = {
  get: vi.fn().mockImplementation((key: string, defaultValue?: string) => {
    if (key === 'ETL_SCHEDULING_ENABLED') return 'false';
    return defaultValue;
  }),
} as unknown as ConfigService;

// Test competition plans — used instead of DB at test time
type CompetitionRow = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  csvDivisionCode: string | null;
  seasonStartMonth: number | null;
  activeSeasonsCount: number | null;
};

const TEST_COMPETITIONS: CompetitionRow[] = [
  {
    leagueId: 39,
    code: 'PL',
    name: 'Premier League',
    country: 'England',
    csvDivisionCode: 'E0',
    seasonStartMonth: null,
    activeSeasonsCount: null,
  },
  {
    leagueId: 135,
    code: 'SA',
    name: 'Serie A',
    country: 'Italy',
    csvDivisionCode: 'I1',
    seasonStartMonth: null,
    activeSeasonsCount: null,
  },
];
const TEST_SEASONS = activeSeasons(
  DEFAULT_SEASON_START_MONTH,
  DEFAULT_ACTIVE_SEASONS_COUNT,
);
const TEST_PLANS = TEST_COMPETITIONS.map((c) => ({
  competition: c,
  seasons: TEST_SEASONS,
}));

const totalSeasonJobs = TEST_PLANS.reduce(
  (sum, plan) => sum + plan.seasons.length,
  0,
);
const csvCompetitions = TEST_PLANS.filter(
  (p) => p.competition.csvDivisionCode != null,
).map((p) => p.competition as CompetitionRow & { csvDivisionCode: string });
const csvSeasonCodes = getActiveCsvSeasonCodes();
const totalCsvJobs = csvCompetitions.length * csvSeasonCodes.length;

describe('EtlService', () => {
  const fixturesQueue = makeQueue<FixturesSyncJobData>();
  const resultsQueue = makeQueue<ResultsSyncJobData>();
  const statsQueue = makeQueue<StatsSyncJobData>();
  const injuriesQueue = makeQueue<InjuriesSyncJobData>();
  const oddsCsvQueue = makeQueue<OddsCsvImportJobData>();
  const oddsLiveQueue = makeQueue<OddsLiveSyncJobData>();
  const oddsSnapshotRetentionQueue = makeQueue<OddsSnapshotRetentionJobData>();
  const prismaMockRaw = {
    client: {
      competition: {
        findMany: vi.fn().mockResolvedValue(TEST_COMPETITIONS),
        findFirst: vi.fn(),
      },
    },
  };
  const prismaMock = prismaMockRaw as unknown as PrismaService;

  const service = new EtlService(
    fixturesQueue as Queue<FixturesSyncJobData>,
    resultsQueue as Queue<ResultsSyncJobData>,
    statsQueue as Queue<StatsSyncJobData>,
    injuriesQueue as Queue<InjuriesSyncJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    oddsLiveQueue as Queue<OddsLiveSyncJobData>,
    oddsSnapshotRetentionQueue as Queue<OddsSnapshotRetentionJobData>,
    configMock,
    prismaMock,
  );

  // Inject test plans directly — scheduling is disabled so onApplicationBootstrap
  // returns early without populating competitionPlans from DB.
  service['competitionPlans'] = TEST_PLANS;

  beforeEach(() => {
    vi.clearAllMocks();
    service['competitionPlans'] = TEST_PLANS;
    prismaMockRaw.client.competition.findMany.mockResolvedValue(
      TEST_COMPETITIONS,
    );
  });

  it('dispatches fixtures jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerFixturesSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(prismaMockRaw.client.competition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });

    const expectedJobs = TEST_PLANS.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        leagueId: plan.competition.leagueId,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(fixturesQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `fixtures-sync-${job.competitionCode}-${job.season}`,
        {
          season: job.season,
          competitionCode: job.competitionCode,
          leagueId: job.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: (callIndex - 1) * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches results jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerResultsSync();

    expect(resultsQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(prismaMockRaw.client.competition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });

    const expectedJobs = TEST_PLANS.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        leagueId: plan.competition.leagueId,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(resultsQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `results-sync-${job.competitionCode}-${job.season}`,
        {
          season: job.season,
          competitionCode: job.competitionCode,
          leagueId: job.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: (callIndex - 1) * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches stats jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerStatsSync();

    expect(statsQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);

    const expectedJobs = TEST_COMPETITIONS.flatMap((competition) =>
      activeSeasons(
        competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
        competition.activeSeasonsCount ?? DEFAULT_ACTIVE_SEASONS_COUNT,
      ).map((season) => ({
        competitionCode: competition.code,
        leagueId: competition.leagueId,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `stats-sync-${job.competitionCode}-${job.season}`,
        {
          season: job.season,
          competitionCode: job.competitionCode,
          leagueId: job.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: (callIndex - 1) * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('reloads active competitions from DB before dispatching stats jobs', async () => {
    const refreshedCompetition = {
      leagueId: 140,
      code: 'LL',
      name: 'La Liga',
      country: 'Spain',
      csvDivisionCode: 'SP1',
      seasonStartMonth: null,
      activeSeasonsCount: 1,
    };
    prismaMockRaw.client.competition.findMany.mockResolvedValue([
      refreshedCompetition,
    ]);

    await service.triggerStatsSync();

    expect(prismaMockRaw.client.competition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });
    expect(statsQueue.add).toHaveBeenCalledOnce();
    expect(statsQueue.add).toHaveBeenCalledWith(
      'stats-sync-LL-2025',
      {
        season: 2025,
        competitionCode: 'LL',
        leagueId: 140,
      },
      {
        ...BULLMQ_DEFAULT_JOB_OPTIONS,
        delay: 0,
      },
    );
  });

  it('rejects stats sync for one inactive league', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue(null);

    await expect(service.triggerStatsSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );

    expect(statsQueue.add).not.toHaveBeenCalled();
    expect(prismaMockRaw.client.competition.findFirst).toHaveBeenCalledWith({
      where: { code: 'LL', isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });
  });

  it('rejects fixtures sync for one inactive league', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue(null);

    await expect(service.triggerFixturesSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );

    expect(fixturesQueue.add).not.toHaveBeenCalled();
    expect(prismaMockRaw.client.competition.findFirst).toHaveBeenCalledWith({
      where: { code: 'LL', isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });
  });

  it('rejects results sync for one inactive league', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue(null);

    await expect(service.triggerResultsSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );

    expect(resultsQueue.add).not.toHaveBeenCalled();
    expect(prismaMockRaw.client.competition.findFirst).toHaveBeenCalledWith({
      where: { code: 'LL', isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });
  });

  it('rejects injuries sync for one inactive league', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue(null);

    await expect(service.triggerInjuriesSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );

    expect(injuriesQueue.add).not.toHaveBeenCalled();
    expect(prismaMockRaw.client.competition.findFirst).toHaveBeenCalledWith({
      where: { code: 'LL', isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });
  });

  it('dispatches injuries jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerInjuriesSync();

    expect(injuriesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(prismaMockRaw.client.competition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });

    const expectedJobs = TEST_PLANS.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        leagueId: plan.competition.leagueId,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(injuriesQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `injuries-sync-${job.competitionCode}-${job.season}`,
        {
          season: job.season,
          competitionCode: job.competitionCode,
          leagueId: job.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: (callIndex - 1) * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches odds CSV import jobs for each season code with 2s staggered delays', async () => {
    await service.triggerOddsCsvImport();

    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(totalCsvJobs);
    expect(prismaMockRaw.client.competition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        leagueId: true,
        code: true,
        name: true,
        country: true,
        csvDivisionCode: true,
        seasonStartMonth: true,
        activeSeasonsCount: true,
      },
    });

    let callIndex = 0;
    for (const competition of csvCompetitions) {
      for (let i = 0; i < csvSeasonCodes.length; i++) {
        callIndex++;
        const seasonCode = csvSeasonCodes[i];
        expect(oddsCsvQueue.add).toHaveBeenNthCalledWith(
          callIndex,
          `odds-csv-import-${competition.code}-${seasonCode}`,
          {
            competitionCode: competition.code,
            seasonCode,
            divisionCode: competition.csvDivisionCode,
          },
          {
            ...BULLMQ_DEFAULT_JOB_OPTIONS,
            delay: i * 2_000,
          },
        );
      }
    }
  });

  it('triggerFullSync enqueues fixtures, results, stats, injuries, odds CSV, and odds live jobs', async () => {
    await service.triggerFullSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(resultsQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(statsQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(injuriesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(totalCsvJobs);
    expect(oddsLiveQueue.add).toHaveBeenCalledOnce();
  });

  it('dispatches odds snapshot retention cleanup job', async () => {
    await service.triggerOddsSnapshotRetention(30);

    expect(oddsSnapshotRetentionQueue.add).toHaveBeenCalledWith(
      'odds-snapshot-retention',
      { retentionDays: 30 },
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  });
});
