import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { LeagueSyncWorker, type LeagueSyncJobData } from './league-sync.worker';
import type { FixturesSyncWorker } from './fixtures-sync.worker';
import type { StatsSyncWorker } from './stats-sync.worker';
import type { InjuriesSyncWorker } from './injuries-sync.worker';

describe('LeagueSyncWorker', () => {
  const fixturesSyncWorker = {
    process: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixturesSyncWorker>;
  const statsSyncWorker = {
    process: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<StatsSyncWorker>;
  const injuriesSyncWorker = {
    process: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<InjuriesSyncWorker>;

  const worker = new LeagueSyncWorker();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(worker, {
      fixturesSyncWorker,
      statsSyncWorker,
      injuriesSyncWorker,
    });
  });

  it('dispatches fixtures jobs to FixturesSyncWorker', async () => {
    const job = {
      data: {
        syncType: 'fixtures',
        competitionCode: 'PL',
        season: 2025,
        leagueId: 39,
      },
    } as Job<LeagueSyncJobData>;

    await worker.process(job);

    expect(fixturesSyncWorker.process).toHaveBeenCalledWith(job);
    expect(statsSyncWorker.process).not.toHaveBeenCalled();
    expect(injuriesSyncWorker.process).not.toHaveBeenCalled();
  });

  it('dispatches stats jobs to StatsSyncWorker', async () => {
    const job = {
      data: {
        syncType: 'stats',
        competitionCode: 'PL',
        season: 2025,
        leagueId: 39,
      },
    } as Job<LeagueSyncJobData>;

    await worker.process(job);

    expect(statsSyncWorker.process).toHaveBeenCalledWith(job);
  });

  it('dispatches injuries jobs to InjuriesSyncWorker', async () => {
    const job = {
      data: {
        syncType: 'injuries',
        competitionCode: 'PL',
        season: 2025,
        leagueId: 39,
      },
    } as Job<LeagueSyncJobData>;

    await worker.process(job);

    expect(injuriesSyncWorker.process).toHaveBeenCalledWith(job);
  });

  it('throws on unsupported sync types', async () => {
    await expect(
      worker.process({
        data: {
          syncType: 'unknown' as never,
          competitionCode: 'PL',
          season: 2025,
          leagueId: 39,
        },
      } as unknown as Job<LeagueSyncJobData>),
    ).rejects.toThrow('Unsupported league sync type');
  });
});
