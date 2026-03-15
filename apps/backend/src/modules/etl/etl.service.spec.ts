import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
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
import type { PendingBetsSettlementJobData } from './workers/pending-bets-settlement.worker';
import type { BacktestService } from '../backtest/backtest.service';
import type { RollingStatsService } from '../rolling-stats/rolling-stats.service';

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
  const pendingBetsSettlementQueue = makeQueue<PendingBetsSettlementJobData>();
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
  const backtestServiceMock = {
    runAllSeasons: vi.fn().mockResolvedValue({
      seasons: [],
      totalFixtures: 0,
      totalAnalyzed: 0,
      averageBrierScore: new Decimal(0),
      averageCalibrationError: new Decimal(0),
      aggregateRoi: new Decimal(0),
      byCompetition: [],
      reportGeneratedAt: new Date(),
    }),
    getValidationReport: vi.fn().mockResolvedValue({
      brierScore: {
        value: new Decimal(0),
        threshold: new Decimal(0.65),
        verdict: 'INSUFFICIENT_DATA',
      },
      calibrationError: {
        value: new Decimal(0),
        threshold: new Decimal(0.05),
        verdict: 'INSUFFICIENT_DATA',
      },
      roi: {
        value: new Decimal(0),
        threshold: new Decimal(-0.05),
        verdict: 'INSUFFICIENT_DATA',
      },
      totalAnalyzed: 0,
      overallVerdict: 'INSUFFICIENT_DATA',
      byCompetition: [],
      reportGeneratedAt: new Date(),
    }),
    runBacktest: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      fixtureCount: 0,
      analyzedCount: 0,
      skippedCount: 0,
      brierScore: new Decimal(0),
      calibrationError: new Decimal(0),
      roiSimulated: new Decimal(0),
      maxDrawdownSimulated: new Decimal(0),
      averageEvSimulated: new Decimal(0),
      marketPerformance: [],
      reportGeneratedAt: new Date(),
    }),
  } as unknown as BacktestService;
  const rollingStatsServiceMock = {
    refreshSeasonYear: vi.fn().mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 10,
      upsertCount: 2,
      teamStatsWritten: 2,
      createdCount: 2,
      updatedCount: 0,
      durationMs: 1,
    }),
    backfillSeasonYear: vi.fn().mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 10,
      upsertCount: 20,
      teamStatsWritten: 20,
      createdCount: 20,
      updatedCount: 0,
      durationMs: 1,
    }),
  } as unknown as RollingStatsService;

  const service = new EtlService(
    leagueSyncQueue as Queue<LeagueSyncJobData>,
    pendingBetsSettlementQueue as Queue<PendingBetsSettlementJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    oddsLiveQueue as Queue<OddsLiveSyncJobData>,
    oddsSnapshotRetentionQueue as Queue<OddsSnapshotRetentionJobData>,
    configMock,
    prismaMock,
    backtestServiceMock,
    rollingStatsServiceMock,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMockRaw.client.competition.findMany.mockResolvedValue(
      TEST_COMPETITIONS,
    );
  });

  it('triggers rolling-stats refresh for one season', async () => {
    await service.triggerRollingStatsSeason('PL', 2024);

    expect(rollingStatsServiceMock.refreshSeasonYear).toHaveBeenCalledWith(
      2024,
      'PL',
    );
    expect(rollingStatsServiceMock.backfillSeasonYear).not.toHaveBeenCalled();
  });

  it('triggers rolling-stats rebuild for one season', async () => {
    await service.triggerRollingStatsSeason('PL', 2024, 'rebuild');

    expect(rollingStatsServiceMock.backfillSeasonYear).toHaveBeenCalledWith(
      2024,
      'PL',
    );
    expect(rollingStatsServiceMock.refreshSeasonYear).not.toHaveBeenCalled();
  });

  it('triggers the all-seasons backtest and refreshes validation cache', async () => {
    await service.triggerBacktestAllSeasons();

    expect(backtestServiceMock.runAllSeasons).toHaveBeenCalledTimes(1);
    expect(backtestServiceMock.getValidationReport).toHaveBeenCalledTimes(1);
  });

  it('triggers one-season backtest', async () => {
    await service.triggerBacktestSeason('season-1');

    expect(backtestServiceMock.runBacktest).toHaveBeenCalledWith('season-1');
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
          syncScope: 'routine',
        },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: index * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    });
  });

  it('dispatches one pending bets settlement job', async () => {
    await service.triggerPendingBetsSettlementSync();

    expect(pendingBetsSettlementQueue.add).toHaveBeenCalledWith(
      'pending-bets-settlement-sync',
      {},
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
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

  it('keeps manual league fixtures backfill across active seasons', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue({
      leagueId: 140,
      code: 'LL',
      name: 'La Liga',
      country: 'Spain',
      csvDivisionCode: 'SP1',
      seasonStartMonth: null,
      activeSeasonsCount: 2,
    });

    await service.triggerFixturesSyncForLeague('LL');

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(2);
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      1,
      'fixtures-sync-LL-2024',
      {
        syncType: 'fixtures',
        season: 2024,
        competitionCode: 'LL',
        leagueId: 140,
        syncScope: 'backfill',
      },
      { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: 0 },
    );
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      2,
      'fixtures-sync-LL-2025',
      {
        syncType: 'fixtures',
        season: 2025,
        competitionCode: 'LL',
        leagueId: 140,
        syncScope: 'backfill',
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
      TEST_COMPETITIONS.length * 2 + totalStatsJobs,
    );
    expect(pendingBetsSettlementQueue.add).toHaveBeenCalledOnce();
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
