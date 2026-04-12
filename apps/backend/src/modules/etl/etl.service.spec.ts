import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { EtlService } from './etl.service';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
  DEFAULT_SEASON_START_MONTH,
  getCurrentCsvSeasonCode,
} from '../../config/etl.constants';
import { currentSeason } from '@utils/date.utils';
import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '@/prisma.service';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { EloSyncJobData } from './workers/elo-sync.worker';
import type { StaleScheduledSyncJobData } from './workers/stale-scheduled-sync.worker';
import type { OddsPrematchSyncJobData } from './workers/odds-prematch-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';
import type { OddsHistoricalImportJobData } from './workers/odds-historical-import.worker';
import type { LeagueSyncJobData } from './workers/league-sync.worker';
import type { PendingBetsSettlementJobData } from './workers/pending-bets-settlement.worker';
import type { BettingEngineAnalysisJobData } from './workers/betting-engine-analysis.worker';
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
  apiSeasonOverride: number | null;
};

const TEST_COMPETITIONS: CompetitionRow[] = [
  {
    leagueId: 39,
    code: 'PL',
    name: 'Premier League',
    country: 'England',
    csvDivisionCode: 'E0',
    seasonStartMonth: null,
    apiSeasonOverride: null,
  },
  {
    leagueId: 135,
    code: 'SA',
    name: 'Serie A',
    country: 'Italy',
    csvDivisionCode: 'I1',
    seasonStartMonth: null,
    apiSeasonOverride: null,
  },
];

const CURRENT_SEASON = currentSeason(DEFAULT_SEASON_START_MONTH);
const totalStatsJobs = TEST_COMPETITIONS.length;

describe('EtlService', () => {
  const leagueSyncQueue = makeQueue<LeagueSyncJobData>();
  const pendingBetsSettlementQueue = makeQueue<PendingBetsSettlementJobData>();
  const staleScheduledSyncQueue = makeQueue<StaleScheduledSyncJobData>();
  const oddsCsvQueue = makeQueue<OddsCsvImportJobData>();
  const eloSyncQueue = makeQueue<EloSyncJobData>();
  const oddsPrematchQueue = makeQueue<OddsPrematchSyncJobData>();
  const bettingEngineQueue = makeQueue<BettingEngineAnalysisJobData>();
  const oddsSnapshotRetentionQueue = makeQueue<OddsSnapshotRetentionJobData>();
  const oddsHistoricalImportQueue = makeQueue<OddsHistoricalImportJobData>();
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
      totalBets: 0,
      averageBrierScore: new Decimal(0),
      averageCalibrationError: new Decimal(0),
      aggregateRoi: new Decimal(0),
      aggregateProfit: new Decimal(0),
      averageEvSimulated: new Decimal(0),
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
      totalBets: 0,
      aggregateProfit: new Decimal(0),
      averageEvSimulated: new Decimal(0),
      overallVerdict: 'INSUFFICIENT_DATA',
      byMarket: [],
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
    staleScheduledSyncQueue as Queue<StaleScheduledSyncJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    eloSyncQueue as Queue<EloSyncJobData>,
    oddsPrematchQueue as Queue<OddsPrematchSyncJobData>,
    bettingEngineQueue as Queue<BettingEngineAnalysisJobData>,
    oddsSnapshotRetentionQueue as Queue<OddsSnapshotRetentionJobData>,
    oddsHistoricalImportQueue as Queue<OddsHistoricalImportJobData>,
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

  it('dispatches one stale scheduled sync job', async () => {
    await service.triggerStaleScheduledSync();

    expect(staleScheduledSyncQueue.add).toHaveBeenCalledWith(
      'stale-scheduled-sync',
      {},
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  });

  it('dispatches stats jobs only for the current season', async () => {
    await service.triggerStatsSync();

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(totalStatsJobs);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `stats-sync-${competition.code}-${CURRENT_SEASON}`,
        {
          syncType: 'stats' as const,
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

  it('dispatches the Elo sync job', async () => {
    await service.triggerEloSync();

    expect(eloSyncQueue.add).toHaveBeenCalledWith(
      'elo-sync',
      {},
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
  });

  it('dispatches the betting engine analysis job', async () => {
    await service.triggerBettingEngineAnalysis('2026-04-13');

    expect(bettingEngineQueue.add).toHaveBeenCalledWith(
      'betting-engine-analysis',
      { date: '2026-04-13' },
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
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

  it('dispatches odds CSV import jobs only for the current season', async () => {
    await service.triggerOddsCsvImport();

    const seasonCode = getCurrentCsvSeasonCode();
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);

    TEST_COMPETITIONS.forEach((competition, index) => {
      expect(oddsCsvQueue.add).toHaveBeenNthCalledWith(
        index + 1,
        `odds-csv-import-${competition.code}-${seasonCode}`,
        {
          competitionCode: competition.code,
          seasonCode,
          divisionCode: competition.csvDivisionCode,
        },
        BULLMQ_DEFAULT_JOB_OPTIONS,
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

  it('dispatches one stats job for current season on manual per-league sync', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue({
      leagueId: 140,
      code: 'LL',
      name: 'La Liga',
      country: 'Spain',
      csvDivisionCode: 'SP1',
      seasonStartMonth: null,
      apiSeasonOverride: null,
    });

    await service.triggerStatsSyncForLeague('LL');

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(1);
    expect(leagueSyncQueue.add).toHaveBeenCalledWith(
      `stats-sync-LL-${CURRENT_SEASON}`,
      {
        syncType: 'stats',
        season: CURRENT_SEASON,
        competitionCode: 'LL',
        leagueId: 140,
      },
      { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: 0 },
    );
  });

  it('dispatches explicit historical stats backfill jobs for requested seasons', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue({
      leagueId: 98,
      code: 'J1',
      name: 'J1 League',
      country: 'Japan',
      csvDivisionCode: 'JPN',
      seasonStartMonth: 1,
      apiSeasonOverride: null,
    });

    await service.triggerStatsSyncForSeasons('J1', [2023, 2024, 2025]);

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(3);
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      1,
      'stats-sync-J1-2023',
      {
        syncType: 'stats',
        season: 2023,
        competitionCode: 'J1',
        leagueId: 98,
      },
      { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: 0 },
    );
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      2,
      'stats-sync-J1-2024',
      {
        syncType: 'stats',
        season: 2024,
        competitionCode: 'J1',
        leagueId: 98,
      },
      {
        ...BULLMQ_DEFAULT_JOB_OPTIONS,
        delay: ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
      },
    );
    expect(leagueSyncQueue.add).toHaveBeenNthCalledWith(
      3,
      'stats-sync-J1-2025',
      {
        syncType: 'stats',
        season: 2025,
        competitionCode: 'J1',
        leagueId: 98,
      },
      {
        ...BULLMQ_DEFAULT_JOB_OPTIONS,
        delay: ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS * 2,
      },
    );
  });

  it('dispatches one fixtures backfill job for current season on manual per-league sync', async () => {
    prismaMockRaw.client.competition.findFirst.mockResolvedValue({
      leagueId: 140,
      code: 'LL',
      name: 'La Liga',
      country: 'Spain',
      csvDivisionCode: 'SP1',
      seasonStartMonth: null,
      apiSeasonOverride: null,
    });

    await service.triggerFixturesSyncForLeague('LL');

    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(1);
    expect(leagueSyncQueue.add).toHaveBeenCalledWith(
      `fixtures-sync-LL-${CURRENT_SEASON}`,
      {
        syncType: 'fixtures',
        season: CURRENT_SEASON,
        competitionCode: 'LL',
        leagueId: 140,
        syncScope: 'backfill',
      },
      { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: 0 },
    );
  });

  it('triggerFullSync enqueues the fused league jobs, current CSV import, prematch odds sync, and analysis', async () => {
    await service.triggerFullSync();

    // fixtures (current) + stats (current) + injuries (current) = 3 jobs per competition
    expect(leagueSyncQueue.add).toHaveBeenCalledTimes(
      TEST_COMPETITIONS.length * 3,
    );
    expect(pendingBetsSettlementQueue.add).toHaveBeenCalledOnce();
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(TEST_COMPETITIONS.length);
    expect(oddsPrematchQueue.add).toHaveBeenCalledOnce();
    expect(bettingEngineQueue.add).toHaveBeenCalledOnce();
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
