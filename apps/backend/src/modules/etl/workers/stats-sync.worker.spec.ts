import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsSyncWorker } from './stats-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { Job } from 'bullmq';
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

  const worker = new StatsSyncWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    notification as unknown as NotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    fixtureService.updateXg.mockResolvedValue(undefined);
    fixtureService.markXgUnavailable.mockResolvedValue(undefined);
    config.getOrThrow.mockReturnValue('test-api-key');
    config.get.mockReturnValue(undefined);
  });

  it('skips fixtures when API returns non-ok status', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 12345 },
    ]);

    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 429, json: vi.fn() });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
  });

  it('extracts expected_goals from API response and calls updateXg', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 99999 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse('0.76', '1.23')),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    expect(fixtureService.updateXg).toHaveBeenCalledOnce();
    expect(fixtureService.updateXg).toHaveBeenCalledWith(99999, 0.76, 1.23);
  });

  it('uses 0 xG when expected_goals field is present but null', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 11111 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse(null, null)),
    });

    await worker.process({
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    // Field present with null → 0, no proxy fallback
    expect(fixtureService.updateXg).toHaveBeenCalledWith(11111, 0, 0);
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
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    // Proxy: shots_on_goal × 0.35
    expect(fixtureService.updateXg).toHaveBeenCalledWith(44444, 0.7, 1.75);
  });

  it('skips all fixtures when findFinishedWithoutXg returns empty list', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([]);

    global.fetch = vi.fn();

    await worker.process({
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    expect(fetch).not.toHaveBeenCalled();
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
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
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    expect(fixtureService.markXgUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
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
      data: { season: 2022, competitionCode: 'PL' },
    } as Job<{ season: number; competitionCode: string }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
  });
});
