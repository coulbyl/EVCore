import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsSyncWorker } from './stats-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { Job } from 'bullmq';
import type { RollingStatsService } from '../../rolling-stats/rolling-stats.service';

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

describe('StatsSyncWorker', () => {
  const fixtureService = {
    upsertCompetition: vi.fn().mockResolvedValue({ id: 'competition-id' }),
    upsertSeason: vi.fn().mockResolvedValue({ id: 'season-id' }),
    findFinishedWithoutXg: vi.fn(),
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
    refreshSeason: vi.fn().mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 1,
      upsertCount: 2,
      teamStatsWritten: 2,
      createdCount: 2,
      updatedCount: 0,
      durationMs: 1,
    }),
  } satisfies Partial<RollingStatsService>;

  const prisma = {
    client: {
      competition: {
        findFirst: vi.fn().mockResolvedValue(PL_COMPETITION_ROW),
      },
    },
  };

  const worker = new StatsSyncWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    notification as unknown as NotificationService,
    prisma as unknown as PrismaService,
    rollingStatsService as unknown as RollingStatsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    fixtureService.updateXg.mockResolvedValue(undefined);
    fixtureService.markXgUnavailable.mockResolvedValue(undefined);
    rollingStatsService.refreshSeason.mockResolvedValue({
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
  });

  it('skips fixtures when API returns non-ok status', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 12345 },
    ]);

    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 429, json: vi.fn() });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).not.toHaveBeenCalled();
  }, 15_000);

  it('extracts expected_goals from API response and calls updateXg', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 99999 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse('0.76', '1.23')),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).toHaveBeenCalledOnce();
    expect(fixtureService.updateXg).toHaveBeenCalledWith(99999, 0.76, 1.23);
    expect(rollingStatsService.refreshSeason).toHaveBeenCalledWith('season-id');
  });

  it('falls back to shots proxy when expected_goals field is present but null', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 11111 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse(null, null)),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    // Proxy: shots_on_goal × 0.40 — home: 5×0.40=2.00, away: 3×0.40=1.20
    expect(fixtureService.updateXg).toHaveBeenCalledWith(
      11111,
      expect.closeTo(2.0),
      expect.closeTo(1.2),
    );
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).toHaveBeenCalledWith('season-id');
  });

  it('falls back to shots proxy when expected_goals field is absent', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 44444 },
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(responseWithoutXg),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    // Proxy: shots_on_goal × 0.40 — home: 2×0.40=0.80, away: 5×0.40=2.00
    expect(fixtureService.updateXg).toHaveBeenCalledWith(44444, 0.8, 2.0);
    expect(rollingStatsService.refreshSeason).toHaveBeenCalledWith('season-id');
  });

  it('skips all fixtures when findFinishedWithoutXg returns empty list', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([]);

    global.fetch = vi.fn();

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fetch).not.toHaveBeenCalled();
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).not.toHaveBeenCalled();
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findFirst.mockResolvedValue({
      ...PL_COMPETITION_ROW,
      isActive: false,
    });

    global.fetch = vi.fn();

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(fixtureService.findFinishedWithoutXg).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).not.toHaveBeenCalled();
  });

  it('marks xgUnavailable when statistics response has < 2 teams', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 33333 },
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(singleTeamResponse),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.markXgUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).not.toHaveBeenCalled();
  });

  it('skips fixture when statistics response has < 2 teams', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 22222 },
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(singleTeamResponse),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(rollingStatsService.refreshSeason).not.toHaveBeenCalled();
  });
});
