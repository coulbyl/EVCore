import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import type { AppSettingService } from '@modules/app-setting/app-setting.service';
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
import type { SquadsSyncService } from '../squads-sync.service';
import type { PlayerSquadRepository } from '../../fixture-events/player-squad.repository';

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

function pendingFixtures(
  count: number,
  firstId = 1,
  scheduledAt = new Date(),
) {
  return Array.from({ length: count }, (_, i) => ({
    externalId: firstId + i,
    scheduledAt,
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
    details: {
      written: 0,
      synced: 0,
      rejected: 0,
      dropped: 0,
      failedExternalIds: [],
    },
    calls: 0,
    rejectedCalls: 0,
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
    findEventsBackfillPending: vi.fn(),
  };
  const statsSync = { syncFixtures: vi.fn() };
  const rollingStats = { backfillSeason: vi.fn().mockResolvedValue({}) };
  const notification = { sendEtlFailureAlert: vi.fn() };
  const squadsSync = { syncDue: vi.fn() };
  const NO_SQUAD_DUE = {
    status: 'nothing-left',
    teams: 0,
    written: 0,
    players: 0,
    calls: 0,
  } as const;

  const leagueSyncQueue = { getJobs: vi.fn() };

  const makeWorker = () =>
    new StatsBackfillWorker(
      new StatsBackfillService(
        {} as Queue<StatsBackfillJobData>,
        leagueSyncQueue as unknown as Queue<LeagueSyncJobData>,
        config as unknown as ConfigService,
        fixtureService as unknown as FixtureService,
        apiFootball as unknown as ApiFootballClient,
        {
          statsBackfillDailyReserve: vi.fn().mockResolvedValue(2_500),
        } as unknown as AppSettingService,
        {} as PlayerSquadRepository,
      ),
      fixtureService as unknown as FixtureService,
      statsSync as unknown as StatsSyncWorker,
      rollingStats as unknown as RollingStatsService,
      notification as unknown as NotificationService,
      squadsSync as unknown as SquadsSyncService,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(undefined);
    leagueSyncQueue.getJobs.mockResolvedValue([]);
    fixtureService.findEventsBackfillPending.mockResolvedValue([]);
    squadsSync.syncDue.mockResolvedValue(NO_SQUAD_DUE);
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
    // 2 calls left above the reserve: 40 fixtures at 20 per call.
    apiFootball.getQuotaUsage.mockResolvedValue({
      current: 4_998,
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

  describe('events backfill', () => {
    const details = (
      overrides: Partial<StatsSyncBatchResult['details']>,
    ): StatsSyncBatchResult['details'] => ({
      written: 0,
      synced: 0,
      rejected: 0,
      dropped: 0,
      failedExternalIds: [],
      ...overrides,
    });

    it('runs an events lot in what the stats lot left of the budget', async () => {
      // 10 calls above the reserve; the stats lot spends 2.
      apiFootball.getQuotaUsage.mockResolvedValue({
        current: 4_990,
        limitDay: 7_500,
      });
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([
        candidate({ pending: 40 }),
      ]);
      fixtureService.findFinishedWithoutStatistics
        .mockResolvedValueOnce(pendingFixtures(40))
        .mockResolvedValueOnce([]);
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(160, 5_000),
      );
      statsSync.syncFixtures
        .mockResolvedValueOnce(batch({ updated: 40, calls: 2 }))
        .mockResolvedValueOnce(
          batch({ calls: 8, details: details({ written: 160, synced: 150 }) }),
        );

      const result = await makeWorker().process(JOB);
      const after = Date.now();

      const query = fixtureService.findEventsBackfillPending.mock.calls[0]?.[0];
      expect(query?.limit).toBe(160);
      // Only fixtures past the three-day grace period.
      expect(query?.before.getTime()).toBeLessThanOrEqual(
        after - 3 * 24 * 60 * 60 * 1000,
      );
      expect(statsSync.syncFixtures.mock.calls[1]?.[1]).toBe('details-only');
      expect(result).toMatchObject({
        status: 'lot-done',
        events: {
          status: 'lot-done',
          count: 160,
          written: 160,
          synced: 150,
          calls: 8,
        },
      });
    });

    it('runs the events lot when no stats season is left', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(20),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, details: details({ written: 20, synced: 20 }) }),
      );

      const result = await makeWorker().process(JOB);

      expect(
        fixtureService.findEventsBackfillPending.mock.calls[0]?.[0],
      ).toMatchObject({ limit: 200 });
      expect(result).toMatchObject({
        status: 'nothing-left',
        events: { status: 'lot-done', written: 20 },
      });
    });

    it('spends nothing more after a quota stop in the stats lot', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([
        candidate({ pending: 40 }),
      ]);
      fixtureService.findFinishedWithoutStatistics.mockResolvedValue(
        pendingFixtures(40),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, abortReason: 'quota' }),
      );

      const result = await makeWorker().process(JOB);

      expect(result.status).toBe('lot-aborted');
      expect(fixtureService.findEventsBackfillPending).not.toHaveBeenCalled();
      expect(statsSync.syncFixtures).toHaveBeenCalledOnce();
    });

    it('reports a quota stop of the events lot', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(40),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, abortReason: 'quota' }),
      );

      await expect(makeWorker().process(JOB)).resolves.toMatchObject({
        events: { status: 'lot-aborted', written: 0 },
      });
    });

    it('asks recent matches with no event yet, at most every 30 minutes', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-11-03T22:10:00Z'));
        fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
        fixtureService.findEventsBackfillPending.mockResolvedValue(
          pendingFixtures(1, 1635695),
        );
        statsSync.syncFixtures.mockResolvedValue(
          batch({ calls: 1, details: details({ written: 1 }) }),
        );
        const worker = makeWorker();

        await worker.process(JOB);
        const first = fixtureService.findEventsBackfillPending.mock.calls[0];
        // Not yet reported: kicked off within the last 24 hours.
        expect(first?.[0].notReportedSince).toEqual(
          new Date('2026-11-02T22:10:00Z'),
        );
        expect(first?.[0].excludeExternalIds).toEqual([]);

        vi.setSystemTime(new Date('2026-11-03T22:15:00Z'));
        await worker.process(JOB);
        expect(
          fixtureService.findEventsBackfillPending.mock.calls[1]?.[0]
            .excludeExternalIds,
        ).toEqual([1635695]);

        // The mock answered it again at 22:15 (a query would not have).
        vi.setSystemTime(new Date('2026-11-03T22:46:00Z'));
        await worker.process(JOB);
        expect(
          fixtureService.findEventsBackfillPending.mock.calls[2]?.[0]
            .excludeExternalIds,
        ).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('holds back only the recent matches it asked', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-11-03T22:10:00Z'));
        fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
        fixtureService.findEventsBackfillPending.mockResolvedValue([
          ...pendingFixtures(1, 1, new Date('2026-11-03T19:00:00Z')),
          ...pendingFixtures(1, 2, new Date('2026-10-20T19:00:00Z')),
        ]);
        statsSync.syncFixtures.mockResolvedValue(
          batch({ calls: 1, details: details({ written: 2 }) }),
        );
        const worker = makeWorker();

        await worker.process(JOB);
        vi.setSystemTime(new Date('2026-11-03T22:15:00Z'));
        await worker.process(JOB);
        expect(
          fixtureService.findEventsBackfillPending.mock.calls[1]?.[0]
            .excludeExternalIds,
        ).toEqual([1]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not hold back the fixtures of an events lot stopped by the quota', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(1, 777),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, abortReason: 'quota' }),
      );
      const worker = makeWorker();

      await worker.process(JOB);
      await worker.process(JOB);

      expect(
        fixtureService.findEventsBackfillPending.mock.calls[1]?.[0]
          .excludeExternalIds,
      ).toEqual([]);
    });

    it('stops asking for a fixture that keeps failing', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(1, 888),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, details: details({ failedExternalIds: [888] }) }),
      );
      const worker = makeWorker();

      // A tick every 31 minutes: past the retry delay of a recent match.
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        for (let tick = 0; tick < 4; tick++) {
          vi.setSystemTime(Date.UTC(2026, 10, 3, 20) + tick * 31 * 60_000);
          await worker.process(JOB);
        }
      } finally {
        vi.useRealTimers();
      }

      const calls = fixtureService.findEventsBackfillPending.mock.calls;
      expect(calls[2]?.[0].excludeExternalIds).toEqual([]);
      expect(calls[3]?.[0].excludeExternalIds).toEqual([888]);
    });

    it('runs the squads lot before the events lot, in the same budget', async () => {
      // 10 calls above the reserve: 3 for squads, 7 left for events.
      apiFootball.getQuotaUsage.mockResolvedValue({
        current: 4_990,
        limitDay: 7_500,
      });
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      squadsSync.syncDue.mockResolvedValue({
        status: 'lot-done',
        teams: 3,
        written: 3,
        players: 90,
        calls: 3,
      });
      fixtureService.findEventsBackfillPending.mockResolvedValue(
        pendingFixtures(20),
      );
      statsSync.syncFixtures.mockResolvedValue(
        batch({ calls: 1, details: details({ written: 20, synced: 20 }) }),
      );

      const result = await makeWorker().process(JOB);

      expect(squadsSync.syncDue).toHaveBeenCalledWith(10);
      expect(
        fixtureService.findEventsBackfillPending.mock.calls[0]?.[0],
      ).toMatchObject({ limit: 140 });
      expect(result).toMatchObject({
        status: 'nothing-left',
        squads: { status: 'lot-done', written: 3 },
        events: { status: 'lot-done', written: 20 },
      });
    });

    it('spends nothing more after a quota stop in the squads lot', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);
      squadsSync.syncDue.mockResolvedValue({
        status: 'lot-aborted',
        teams: 5,
        written: 1,
        players: 30,
        calls: 2,
      });

      const result = await makeWorker().process(JOB);

      expect(result).toMatchObject({ squads: { status: 'lot-aborted' } });
      expect(fixtureService.findEventsBackfillPending).not.toHaveBeenCalled();
    });

    it('stays idle when nothing is missing', async () => {
      fixtureService.findStatsBackfillCandidates.mockResolvedValue([]);

      await expect(makeWorker().process(JOB)).resolves.toEqual({
        status: 'nothing-left',
      });
      expect(fixtureService.findEventsBackfillPending).toHaveBeenCalledOnce();
      expect(statsSync.syncFixtures).not.toHaveBeenCalled();
    });
  });
});
