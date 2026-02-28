import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtlService } from './etl.service';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
} from '../../config/etl.constants';
import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';

type MockQueue<T> = Pick<Queue<T>, 'add' | 'upsertJobScheduler'>;

function makeQueue<T>(): MockQueue<T> {
  return {
    add: vi.fn().mockResolvedValue({}),
    upsertJobScheduler: vi.fn().mockResolvedValue({}),
  };
}

// Scheduling disabled in tests — avoids real upsertJobScheduler calls
const configMock = {
  get: vi.fn().mockImplementation((key: string, defaultValue?: string) => {
    if (key === 'ETL_SCHEDULING_ENABLED') return 'false';
    return defaultValue;
  }),
} as unknown as ConfigService;

describe('EtlService', () => {
  const fixturesQueue = makeQueue<FixturesSyncJobData>();
  const resultsQueue = makeQueue<ResultsSyncJobData>();
  const statsQueue = makeQueue<StatsSyncJobData>();
  const oddsCsvQueue = makeQueue<OddsCsvImportJobData>();

  const service = new EtlService(
    fixturesQueue as Queue<FixturesSyncJobData>,
    resultsQueue as Queue<ResultsSyncJobData>,
    statsQueue as Queue<StatsSyncJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    configMock,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches fixtures jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerFixturesSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(fixturesQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `fixtures-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches results jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerResultsSync();

    expect(resultsQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(resultsQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `results-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches stats jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerStatsSync();

    expect(statsQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );

    for (let i = 0; i < ETL_CONSTANTS.EPL_SEASONS.length; i++) {
      const season = ETL_CONSTANTS.EPL_SEASONS[i];
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `stats-sync-${season}`,
        { season },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches odds CSV import jobs for each season code with 2s staggered delays', async () => {
    await service.triggerOddsCsvImport();

    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.CSV_ODDS_SEASONS.length,
    );

    for (let i = 0; i < ETL_CONSTANTS.CSV_ODDS_SEASONS.length; i++) {
      const seasonCode = ETL_CONSTANTS.CSV_ODDS_SEASONS[i];
      expect(oddsCsvQueue.add).toHaveBeenNthCalledWith(
        i + 1,
        `odds-csv-import-${seasonCode}`,
        { seasonCode },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: i * 2_000,
        },
      );
    }
  });

  it('triggerFullSync enqueues fixtures, results, stats, and odds CSV jobs', async () => {
    await service.triggerFullSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );
    expect(resultsQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );
    expect(statsQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.EPL_SEASONS.length,
    );
    expect(oddsCsvQueue.add).toHaveBeenCalledTimes(
      ETL_CONSTANTS.CSV_ODDS_SEASONS.length,
    );
  });
});
