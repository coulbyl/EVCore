import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { StatsBackfillService } from '../stats-backfill.service';
import type { LeagueSyncJobData } from './league-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { StatsBackfillCandidateRow } from '../../fixture/fixture.repository';
import type { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import type { NotificationService } from '../../notification/notification.service';
import type { ApiFootballClient } from '../api-football.client';
import {
  StatsBackfillWorker,
  type StatsBackfillJobData,
} from './stats-backfill.worker';
import type {
  StatsSyncBatchResult,
  StatsSyncWorker,
} from './stats-sync.worker';

const JOB = {} as Job<StatsBackfillJobData>;

function candidate(
  overrides: Partial<StatsBackfillCandidateRow>,
): StatsBackfillCandidateRow {
  return {
    seasonId: 'pl-2025',
    seasonName: '2025-26',
    competitionCode: 'PL',
    startDate: new Date('2025-08-15T00:00:00Z'),
    endDate: new Date('2026-05-24T00:00:00Z'),
    synced: 100,
    unavailable: 0,
    pending: 280,
    ...overrides,
  };
}

function pendingFixtures(count: number, firstId = 1) {
  return Array.from({ length: count }, (_, i) => ({
    externalId: firstId + i,
    homeTeam: { externalId: 33 },
    awayTeam: { externalId: 40 },
  }));
}

function batch(overrides: Partial<StatsSyncBatchResult>): StatsSyncBatchResult {
  return {
    updated: 0,
    skipped: 0,
    statisticRows: 0,
    statisticsUnavailable: 0,
    xgUnavailableIds: [],
    failedExternalIds: [],
    abortReason: null,
    ...overrides,
  };
}

describe('StatsBackfillWorker', () => {
  const config = { get: vi.fn().mockReturnValue(undefined) };
  const apiFootball = { getQuotaUsage: vi.fn() };
  const fixtureService = {
    findStatsBackfillCandidates: vi.fn(),
    findFinishedWithoutStatistics: vi.fn(),
  };
  const statsSync = { syncFixtures: vi.fn() };
  const rollingStats = { backfillSeason: vi.fn().mockResolvedValue({}) };
  const notification = { sendEtlFailureAlert: vi.fn() };

  const leagueSyncQueue = { getJobs: vi.fn() };

  const makeWorker = () =>
    new StatsBackfillWorker(
      new StatsBackfillService(
        {} as Queue<StatsBackfillJobData>,
        leagueSyncQueue as unknown as Queue<LeagueSyncJobData>,
        config as unknown as ConfigService,
        fixtureService as unknown as FixtureService,
        apiFootball as unknown as ApiFootballClient,
      ),
      fixtureService as unknown as FixtureService,
      statsSync as unknown as StatsSyncWorker,
      rollingStats as unknown as RollingStatsService,
      notification as unknown as NotificationService,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(undefined);
    leagueSyncQueue.getJobs.mockResolvedValue([]);
    apiFootball.getQuotaUsage.mockResolvedValue({
      current: 1_000,
      limitDay: 7_500,
    });
  });

  it('yields to a routine stats sync due before a lot could finish', async () => {
    leagueSyncQueue.getJobs.mockImplementation((states: string[]) =>
      Promise.resolve(
        states.includes('delayed')
          ? [
              {
                data: { syncType: 'stats' },
                timestamp: Date.now(),
                delay: 3 * 60_000,
              },
            ]
          : [],
      ),
    );

    await expect(makeWorker().process(JOB)).resolves.toEqual({
      status: 'routine-stats-sync',
    });
    expect(apiFootball.getQuotaUsage).not.toHaveBeenCalled();
  });

  it('ignores routine stats jobs due later and other sync types', async () => {
    leagueSyncQueue.getJobs.mockImplementation((states: string[]) =>
      Promise.resolve(
        states.includes('delayed')
          ? [
              {
                data: { syncType: 'stats' },
                timestamp: Date.now(),
                delay: 60 * 60_000,
              },
            ]
          : [{ data: { syncType: 'fixtures' }, timestamp: 0, delay: 0 }],
      ),
    );
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);

    await expect(makeWorker().process(JOB)).resolves.toEqual({
      status: 'nothing-left',
    });
  });

  it('does not spend anything when the quota is unreadable', async () => {
    apiFootball.getQuotaUsage.mockResolvedValue(null);

    await expect(makeWorker().process(JOB)).resolves.toEqual({
      status: 'quota-unknown',
    });
    expect(statsSync.syncFixtures).not.toHaveBeenCalled();
  });

  it('stops at the 2 500-call production reserve', async () => {
    apiFootball.getQuotaUsage.mockResolvedValue({
      current: 5_000,
      limitDay: 7_500,
    });

    await expect(makeWorker().process(JOB)).resolves.toEqual({
      status: 'budget-exhausted',
    });
    expect(fixtureService.findStatsBackfillCandidates).not.toHaveBeenCalled();
  });

  it('runs one lot on the highest-priority season, capped by the budget', async () => {
    apiFootball.getQuotaUsage.mockResolvedValue({
      current: 4_960,
      limitDay: 7_500,
    });
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([
      candidate({ seasonId: 'ch-2026', competitionCode: 'CH' }),
      candidate({}),
    ]);
    fixtureService.findFinishedWithoutStatistics
      .mockResolvedValueOnce(pendingFixtures(280))
      .mockResolvedValueOnce(pendingFixtures(240, 41));
    statsSync.syncFixtures.mockResolvedValue(batch({ updated: 40 }));

    const result = await makeWorker().process(JOB);

    expect(fixtureService.findFinishedWithoutStatistics).toHaveBeenCalledWith(
      'pl-2025',
    );
    expect(statsSync.syncFixtures.mock.calls[0]?.[0]).toHaveLength(40);
    expect(result).toMatchObject({
      status: 'lot-done',
      competitionCode: 'PL',
      updated: 40,
      remainingAfterJob: 240,
    });
    // Finished season not drained yet: rolling stats wait for the last lot.
    expect(rollingStats.backfillSeason).not.toHaveBeenCalled();
  });

  it('recomputes rolling stats once a finished season is drained', async () => {
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([
      candidate({ pending: 30 }),
    ]);
    fixtureService.findFinishedWithoutStatistics
      .mockResolvedValueOnce(pendingFixtures(30))
      .mockResolvedValueOnce([]);
    statsSync.syncFixtures.mockResolvedValue(batch({ updated: 30 }));

    await makeWorker().process(JOB);

    expect(rollingStats.backfillSeason).toHaveBeenCalledWith('pl-2025');
  });

  it('recomputes rolling stats after every lot of an in-progress season', async () => {
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([
      candidate({
        seasonId: 'pl-2026',
        startDate: new Date('2026-08-14T00:00:00Z'),
        endDate: new Date('2027-05-23T00:00:00Z'),
      }),
    ]);
    fixtureService.findFinishedWithoutStatistics
      .mockResolvedValueOnce(pendingFixtures(280))
      .mockResolvedValueOnce(pendingFixtures(180));
    statsSync.syncFixtures.mockResolvedValue(batch({ updated: 100 }));

    await makeWorker().process(JOB);

    expect(rollingStats.backfillSeason).toHaveBeenCalledWith('pl-2026');
  });

  it('skips parked seasons and fixtures that keep failing', async () => {
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([
      candidate({ seasonId: 'parked', synced: 1, unavailable: 40 }),
      candidate({ seasonId: 'pl-2025', pending: 1 }),
    ]);
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue(
      pendingFixtures(1, 777),
    );
    statsSync.syncFixtures.mockResolvedValue(
      batch({ skipped: 1, failedExternalIds: [777] }),
    );
    const worker = makeWorker();

    for (let tick = 0; tick < 3; tick++) await worker.process(JOB);
    const fourth = await worker.process(JOB);

    expect(
      fixtureService.findFinishedWithoutStatistics,
    ).not.toHaveBeenCalledWith('parked');
    expect(statsSync.syncFixtures).toHaveBeenCalledTimes(3);
    expect(fourth).toEqual({ status: 'nothing-left' });
  });

  it('alerts once when a lot reveals a season without coverage', async () => {
    fixtureService.findStatsBackfillCandidates.mockResolvedValue([
      candidate({ synced: 0, unavailable: 0, pending: 300 }),
    ]);
    fixtureService.findFinishedWithoutStatistics
      .mockResolvedValueOnce(pendingFixtures(300))
      .mockResolvedValueOnce(pendingFixtures(280));
    statsSync.syncFixtures.mockResolvedValue(
      batch({ skipped: 20, statisticsUnavailable: 20 }),
    );

    await makeWorker().process(JOB);

    // Untried season: probed with a 20-fixture lot, not a full 100.
    expect(statsSync.syncFixtures.mock.calls[0]?.[0]).toHaveLength(20);
    expect(notification.sendEtlFailureAlert).toHaveBeenCalledOnce();
  });
});
