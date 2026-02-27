import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtlService } from './etl.service';
import { BULLMQ_DEFAULT_JOB_OPTIONS, ETL_CONSTANTS } from '../../config/etl.constants';
import type { Queue } from 'bullmq';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { XgSyncJobData } from './workers/xg-sync.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';

type MockQueue<T> = Pick<Queue<T>, 'add'>;

function makeQueue<T>(): MockQueue<T> {
  return {
    add: vi.fn().mockResolvedValue({}),
  };
}

describe('EtlService', () => {
  const fixturesQueue = makeQueue<FixturesSyncJobData>();
  const resultsQueue = makeQueue<ResultsSyncJobData>();
  const xgQueue = makeQueue<XgSyncJobData>();
  const statsQueue = makeQueue<StatsSyncJobData>();

  const service = new EtlService(
    fixturesQueue as Queue<FixturesSyncJobData>,
    resultsQueue as Queue<ResultsSyncJobData>,
    xgQueue as Queue<XgSyncJobData>,
    statsQueue as Queue<StatsSyncJobData>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches fixtures jobs for each season with football-data staggered delays', async () => {
    await service.triggerFixturesSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(fixturesQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `fixtures-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.FOOTBALL_DATA_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches results jobs for each season with football-data staggered delays', async () => {
    await service.triggerResultsSync();

    expect(resultsQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(resultsQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `results-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.FOOTBALL_DATA_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches xg jobs for each season with understat staggered delays', async () => {
    await service.triggerXgSync();

    expect(xgQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(xgQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `xg-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.UNDERSTAT_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches stats jobs for each season with fbref staggered delays', async () => {
    await service.triggerStatsSync();

    expect(statsQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `stats-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.FBREF_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('triggerFullSync enqueues fixtures, results, xg and stats jobs', async () => {
    await service.triggerFullSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);
    expect(resultsQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);
    expect(xgQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);
    expect(statsQueue.add).toHaveBeenCalledTimes(ETL_CONSTANTS.EPL_SEASONS.length);
  });
});
