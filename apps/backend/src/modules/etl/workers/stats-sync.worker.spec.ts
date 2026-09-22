import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractXg, StatsSyncWorker } from './stats-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import { ApiFootballClient } from '../api-football.client';
import type { NotificationService } from '../../notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { Job } from 'bullmq';
import type { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import type { FixtureStatisticsService } from '../../fixture-statistics/fixture-statistics.service';
import { XgSource } from '@evcore/db';
import { execFile } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Minimal valid statistics response for two teams
function buildStatisticsResponse(homeXg: string | null, awayXg: string | null) {
  return {
    get: 'fixtures/statistics',
    parameters: { fixture: '12345' },
    results: 2,
    response: [
      {
        team: { id: 33, name: 'Manchester United' },
        statistics: [
          { type: 'Shots on Goal', value: 5 },
          { type: 'expected_goals', value: homeXg },
        ],
      },
      {
        team: { id: 40, name: 'Liverpool' },
        statistics: [
          { type: 'Shots on Goal', value: 3 },
          { type: 'expected_goals', value: awayXg },
        ],
      },
    ],
  };
}

const PL_COMPETITION_ROW = {
  id: 'comp-pl',
  leagueId: 39,
  code: 'PL',
  name: 'Premier League',
  country: 'England',
  isActive: true,
  csvDivisionCode: 'E0',
  seasonStartMonth: null,
  includeInBacktest: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fixtureWithoutStatistics(
  externalId: number,
  homeExternalId = 33,
  awayExternalId = 40,
) {
  return {
    externalId,
    homeTeam: { externalId: homeExternalId },
    awayTeam: { externalId: awayExternalId },
  };
}

describe('StatsSyncWorker', () => {
  const execFileMock = vi.mocked(execFile);
  const fixtureService = {
    upsertCompetition: vi.fn().mockResolvedValue({ id: 'competition-id' }),
    upsertSeason: vi.fn().mockResolvedValue({ id: 'season-id' }),
    findFinishedWithoutStatistics: vi.fn(),
    updateXg: vi.fn().mockResolvedValue(undefined),
    markXgUnavailable: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    get: vi.fn().mockReturnValue(undefined),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
    sendXgUnavailableReport: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const rollingStatsService = {
    backfillSeason: vi.fn().mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 1,
      upsertCount: 2,
      teamStatsWritten: 2,
      createdCount: 2,
      updatedCount: 0,
      durationMs: 1,
    }),
  } satisfies Partial<RollingStatsService>;

  const fixtureStatistics = {
    persistFinalStatistics: vi.fn().mockResolvedValue(4),
    markUnavailable: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureStatisticsService>;

  const prisma = {
    client: {
      competition: {
        findFirst: vi.fn().mockResolvedValue(PL_COMPETITION_ROW),
      },
    },
  };

  const apiFootball = new ApiFootballClient(config as unknown as ConfigService);

  const worker = new StatsSyncWorker(
    fixtureService as unknown as FixtureService,
    apiFootball,
    notification as unknown as NotificationService,
    prisma as unknown as PrismaService,
    rollingStatsService as unknown as RollingStatsService,
    fixtureStatistics as unknown as FixtureStatisticsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    fixtureService.updateXg.mockResolvedValue(undefined);
    fixtureService.markXgUnavailable.mockResolvedValue(undefined);
    fixtureStatistics.persistFinalStatistics.mockResolvedValue(4);
    fixtureStatistics.markUnavailable.mockResolvedValue(undefined);
    rollingStatsService.backfillSeason.mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 1,
      upsertCount: 2,
      teamStatsWritten: 2,
      createdCount: 2,
      updatedCount: 0,
      durationMs: 1,
    });
    config.getOrThrow.mockReturnValue('test-api-key');
    config.get.mockReturnValue(undefined);
    prisma.client.competition.findFirst.mockResolvedValue(PL_COMPETITION_ROW);
    execFileMock.mockReset();
  });

  it('skips fixtures when API returns non-ok status', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(12345),
    ]);

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(null, '{"errors":{"rate":"limited"}}\n__EVCORE_HTTP_CODE__:429');
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  }, 15_000);

  it('extracts expected_goals from API response and calls updateXg', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(99999),
    ]);

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify(buildStatisticsResponse('0.76', '1.23'))}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).toHaveBeenCalledOnce();
    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 99999,
      homeXg: 0.76,
      awayXg: 1.23,
      homeXgSource: XgSource.API_FOOTBALL,
      awayXgSource: XgSource.API_FOOTBALL,
    });
    expect(fixtureStatistics.persistFinalStatistics).toHaveBeenCalledOnce();
    expect(rollingStatsService.backfillSeason).toHaveBeenCalledWith(
      'season-id',
    );
  });

  it('matches home and away xG by provider team id, not response order', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(99998),
    ]);
    const response = buildStatisticsResponse('0.76', '1.23');
    response.response.reverse();

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(null, `${JSON.stringify(response)}\n__EVCORE_HTTP_CODE__:200`);
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).toHaveBeenCalledWith(
      expect.objectContaining({ homeXg: 0.76, awayXg: 1.23 }),
    );
  });

  it('falls back to shots proxy when expected_goals field is present but null', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(11111),
    ]);

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify(buildStatisticsResponse(null, null))}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    // Proxy: shots_on_goal × 0.40 — home: 5×0.40=2.00, away: 3×0.40=1.20
    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 11111,
      homeXg: expect.closeTo(2.0),
      awayXg: expect.closeTo(1.2),
      homeXgSource: XgSource.SHOTS_PROXY,
      awayXgSource: XgSource.SHOTS_PROXY,
    });
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).toHaveBeenCalledWith(
      'season-id',
    );
  });

  it('falls back to shots proxy when expected_goals field is absent', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(44444, 52, 42),
    ]);

    // Response without expected_goals field (2022-23 first half pattern)
    const responseWithoutXg = {
      get: 'fixtures/statistics',
      parameters: { fixture: '44444' },
      results: 2,
      response: [
        {
          team: { id: 52, name: 'Crystal Palace' },
          statistics: [{ type: 'Shots on Goal', value: 2 }],
        },
        {
          team: { id: 42, name: 'Arsenal' },
          statistics: [{ type: 'Shots on Goal', value: 5 }],
        },
      ],
    };

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify(responseWithoutXg)}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    // Proxy: shots_on_goal × 0.40 — home: 2×0.40=0.80, away: 5×0.40=2.00
    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 44444,
      homeXg: 0.8,
      awayXg: 2.0,
      homeXgSource: XgSource.SHOTS_PROXY,
      awayXgSource: XgSource.SHOTS_PROXY,
    });
    expect(rollingStatsService.backfillSeason).toHaveBeenCalledWith(
      'season-id',
    );
  });

  it('skips all fixtures when findFinishedWithoutXg returns empty list', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([]);
    // The worker still calls /leagues once to resolve the Season's date
    // range (fetchLeagueSeasonDates) before checking for xg-missing
    // fixtures — answer it with a harmless empty leagues response.
    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify({ get: 'leagues', parameters: {}, errors: [], results: 0, response: [] })}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findFirst.mockResolvedValue({
      ...PL_COMPETITION_ROW,
      isActive: false,
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(fixtureService.findFinishedWithoutStatistics).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('marks xgUnavailable when statistics response has < 2 teams', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(33333),
    ]);

    const singleTeamResponse = {
      get: 'fixtures/statistics',
      parameters: { fixture: '33333' },
      results: 1,
      response: [
        {
          team: { id: 33, name: 'Manchester United' },
          statistics: [{ type: 'Shots on Goal', value: 5 }],
        },
      ],
    };

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify(singleTeamResponse)}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.markXgUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureStatistics.markUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('skips fixture when statistics response has < 2 teams', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(22222),
    ]);

    const singleTeamResponse = {
      get: 'fixtures/statistics',
      parameters: { fixture: '22222' },
      results: 1,
      response: [
        {
          team: { id: 33, name: 'Manchester United' },
          statistics: [{ type: 'Shots on Goal', value: 5 }],
        },
      ],
    };

    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      callback(
        null,
        `${JSON.stringify(singleTeamResponse)}\n__EVCORE_HTTP_CODE__:200`,
      );
      return {} as never;
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });
});

describe('extractXg', () => {
  it('ne transforme pas une absence de xG et de tirs cadrés en faux xG nul', () => {
    expect(extractXg([{ type: 'Corner Kicks', value: 4 }])).toBeNull();
  });

  it('trace explicitement la provenance du proxy tirs cadrés', () => {
    expect(extractXg([{ type: 'Shots on Goal', value: 5 }])).toEqual({
      value: 2,
      source: XgSource.SHOTS_PROXY,
    });
  });
});
