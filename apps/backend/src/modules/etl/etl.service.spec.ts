import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtlService } from './etl.service';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ETL_CONSTANTS,
  getActiveCompetitionPlans,
  getActiveCsvCompetitions,
  getActiveCsvSeasonCodes,
} from '../../config/etl.constants';
import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixturesSyncJobData } from './workers/fixtures-sync.worker';
import type { ResultsSyncJobData } from './workers/results-sync.worker';
import type { StatsSyncJobData } from './workers/stats-sync.worker';
import type { OddsCsvImportJobData } from './workers/odds-csv-import.worker';
import type { OddsLiveSyncJobData } from './workers/odds-live-sync.worker';
import type { InjuriesSyncJobData } from './workers/injuries-sync.worker';
import type { OddsSnapshotRetentionJobData } from './workers/odds-snapshot-retention.worker';

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
  const activePlans = getActiveCompetitionPlans();
  const totalSeasonJobs = activePlans.reduce(
    (sum, plan) => sum + plan.seasons.length,
    0,
  );
  const csvCompetitions = getActiveCsvCompetitions();
  const csvSeasonCodes = getActiveCsvSeasonCodes();
  const totalCsvJobs = csvCompetitions.length * csvSeasonCodes.length;

  const fixturesQueue = makeQueue<FixturesSyncJobData>();
  const resultsQueue = makeQueue<ResultsSyncJobData>();
  const statsQueue = makeQueue<StatsSyncJobData>();
  const injuriesQueue = makeQueue<InjuriesSyncJobData>();
  const oddsCsvQueue = makeQueue<OddsCsvImportJobData>();
  const oddsLiveQueue = makeQueue<OddsLiveSyncJobData>();
  const oddsSnapshotRetentionQueue = makeQueue<OddsSnapshotRetentionJobData>();

  const service = new EtlService(
    fixturesQueue as Queue<FixturesSyncJobData>,
    resultsQueue as Queue<ResultsSyncJobData>,
    statsQueue as Queue<StatsSyncJobData>,
    injuriesQueue as Queue<InjuriesSyncJobData>,
    oddsCsvQueue as Queue<OddsCsvImportJobData>,
    oddsLiveQueue as Queue<OddsLiveSyncJobData>,
    oddsSnapshotRetentionQueue as Queue<OddsSnapshotRetentionJobData>,
    configMock,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches fixtures jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerFixturesSync();

    expect(fixturesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);

    const expectedJobs = activePlans.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(fixturesQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `fixtures-sync-${job.competitionCode}-${job.season}`,
        { season: job.season, competitionCode: job.competitionCode },
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

    const expectedJobs = activePlans.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(resultsQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `results-sync-${job.competitionCode}-${job.season}`,
        { season: job.season, competitionCode: job.competitionCode },
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

    const expectedJobs = activePlans.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(statsQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `stats-sync-${job.competitionCode}-${job.season}`,
        { season: job.season, competitionCode: job.competitionCode },
        {
          ...BULLMQ_DEFAULT_JOB_OPTIONS,
          delay: (callIndex - 1) * ETL_CONSTANTS.API_FOOTBALL_RATE_LIMIT_MS,
        },
      );
    }
  });

  it('dispatches injuries jobs for each season with API-FOOTBALL staggered delays', async () => {
    await service.triggerInjuriesSync();

    expect(injuriesQueue.add).toHaveBeenCalledTimes(totalSeasonJobs);

    const expectedJobs = activePlans.flatMap((plan) =>
      plan.seasons.map((season) => ({
        competitionCode: plan.competition.code,
        season,
      })),
    );

    let callIndex = 0;
    for (const job of expectedJobs) {
      callIndex++;
      expect(injuriesQueue.add).toHaveBeenNthCalledWith(
        callIndex,
        `injuries-sync-${job.competitionCode}-${job.season}`,
        { season: job.season, competitionCode: job.competitionCode },
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
