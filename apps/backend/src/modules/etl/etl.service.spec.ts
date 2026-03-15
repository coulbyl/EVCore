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
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { OddsLiveSyncJobData } from './workers/odds-live-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';
import type { LeagueSyncJobData } from './workers/league-sync.worker';

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

const configMock = {
  get: vi.fn().mockImplementation((key: string, defaultValue?: string) => {
    if (key === 'ETL_SCHEDULING_ENABLED') return 'false';
    return defaultValue;
  }),
} as unknown as ConfigService;

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
const CURRENT_SEASON = TEST_SEASONS[TEST_SEASONS.length - 1];
const totalStatsJobs = TEST_COMPETITIONS.length * TEST_SEASONS.length;

describe('EtlService', () => {
  const leagueSyncQueue = makeQueue<LeagueSyncJobData>();
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
    leagueSyncQueue as Queue<LeagueSyncJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    oddsLiveQueue as Queue<OddsLiveSyncJobData>,
    oddsSnapshotRetentionQueue as Queue<OddsSnapshotRetentionJobData>,
    configMock,
    prismaMock,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMockRaw.client.competition.findMany.mockResolvedValue(
      TEST_COMPETITIONS,
    );
  });

  it('dispatches fixtures jobs only for the current season', async () => {
    await service.triggerFixturesSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `fixtures-sync-${competition.code}-${CURRENT_SEASON}`,
        {
          syncType: 'fixtures',
          season: CURRENT_SEASON,
          competitionCode: competition.code,
          leagueId: competition.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: index * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    });
  });

  it('dispatches results jobs only for the current season', async () => {
    await service.triggerResultsSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `results-sync-${competition.code}-${CURRENT_SEASON}`,
        {
          syncType: 'results',
          season: CURRENT_SEASON,
          competitionCode: competition.code,
          leagueId: competition.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: index * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    });
  });

  it('dispatches stats jobs for all active seasons', async () => {
    await service.triggerStatsSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(totalStatsJobs);

    const expectedJobs = TEST_COMPETITIONS.flatMap((competition) =>
      TEST_SEASONS.map((season) => ({
        syncType: 'stats' as const,
        season,
        competitionCode: competition.code,
        leagueId: competition.leagueId,
      })),
    );

    expectedJobs.forEach((job, index) => {
      expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `stats-sync-${job.competitionCode}-${job.season}`,
        job,
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: index * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    });
  });

  it('dispatches injuries jobs only for the current season', async () => {
    await service.triggerInjuriesSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `injuries-sync-${competition.code}-${CURRENT_SEASON}`,
        {
          syncType: 'injuries',
          season: CURRENT_SEASON,
          competitionCode: competition.code,
          leagueId: competition.leagueId,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: index * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    });
  });

  it('dispatches odds CSV import jobs only for the current CSV season', async () => {
    await service.triggerOddsCsvImport();

    const currentCsvSeasonCode = getActiveCsvSeasonCodes().at(-1);
    expect(currentCsvSeasonCode).toBeDefined();
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(oddsCsvQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `odds-csv-import-${competition.code}-${currentCsvSeasonCode}`,
        {
          competitionCode: competition.code,
          seasonCode: currentCsvSeasonCode,
          divisionCode: competition.csvDivisionCode,
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: 0,
        },
      );
    });
  });

  it('rejects one-league sync for inactive competitions', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue(null);

    await expect(service.triggerFixturesSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );
    await expect(service.triggerResultsSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );
    await expect(service.triggerStatsSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );
    await expect(service.triggerInjuriesSyncForLeague('LL')).rejects.toThrow(
      'Unknown or inactive competition: LL',
    );

    expect(leagueSyncQueue.add).not.toHaveBeenCalled();
  });

  it('keeps manual league stats backfill across active seasons', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue({
      leagueId: 140,
      code: 'LL',
      name: 'La Liga',
      country: 'Spain',
      csvDivisionCode: 'SP1',
      seasonStartMonth: null,
      activeSeasonsCount: 2,
    });

    await service.triggerStatsSyncForLeague('LL');

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(2);
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      1,
      'stats-sync-LL-2024',
      {
        syncType: 'stats',
        season: 2024,
        competitionCode: 'LL',
        leagueId: 140,
      },
      { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: 0 },
    );
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      2,
      'stats-sync-LL-2025',
      {
        syncType: 'stats',
        season: 2025,
        competitionCode: 'LL',
        leagueId: 140,
      },
      {
        ...BULLMQ_DEFAULT_JOB_OPTIONS,
        delay: ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
      },
    );
  });

  it('triggerFullSync enqueues the fused league jobs, current CSV import, and live odds sync', async () => {
    await service.triggerFullSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(
      TEST_COMPETITIONS.length * 3 + totalStatsJobs,
    );
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);
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
