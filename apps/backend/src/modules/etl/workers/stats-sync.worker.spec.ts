import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsSyncWorker } from './stats-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { Job } from 'bullmq';
import { ETL_CONSTANTS } from '../../../config/etl.constants';

// Minimal valid statistics response for two teams
function buildStatisticsResponse(
  homeShotsOnGoal: number | null,
  awayShotsOnGoal: number | null,
) {
  return {
    get: 'fixtures/statistics',
    parameters: { fixture: '12345', league: '39', season: '2022' },
    results: 2,
    response: [
      {
        team: { id: 33, name: 'Manchester United' },
        statistics: [
          { type: 'Shots on Goal', value: homeShotsOnGoal },
          { type: 'Total Shots', value: 15 },
        ],
      },
      {
        team: { id: 40, name: 'Liverpool' },
        statistics: [
          { type: 'Shots on Goal', value: awayShotsOnGoal },
          { type: 'Total Shots', value: 10 },
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
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    get: vi.fn().mockReturnValue(undefined),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
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

    await worker.process({ data: { season: 2022 } } as Job<{ season: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
  });

  it('calculates xG proxy from shots on target and calls updateXg', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 99999 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse(5, 3)),
    });

    await worker.process({ data: { season: 2022 } } as Job<{ season: number }>);

    const expectedHomeXg = 5 * ETL_CONSTANTS.XG_SHOTS_CONVERSION_FACTOR;
    const expectedAwayXg = 3 * ETL_CONSTANTS.XG_SHOTS_CONVERSION_FACTOR;

    expect(fixtureService.updateXg).toHaveBeenCalledOnce();
    expect(fixtureService.updateXg).toHaveBeenCalledWith(
      99999,
      expectedHomeXg,
      expectedAwayXg,
    );
  });

  it('uses 0 xG when shots on goal is null', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([
      { externalId: 11111 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildStatisticsResponse(null, null)),
    });

    await worker.process({ data: { season: 2022 } } as Job<{ season: number }>);

    expect(fixtureService.updateXg).toHaveBeenCalledWith(11111, 0, 0);
  });

  it('skips all fixtures when findFinishedWithoutXg returns empty list', async () => {
    fixtureService.findFinishedWithoutXg.mockResolvedValue([]);

    global.fetch = vi.fn();

    await worker.process({ data: { season: 2022 } } as Job<{ season: number }>);

    expect(fetch).not.toHaveBeenCalled();
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

    await worker.process({ data: { season: 2022 } } as Job<{ season: number }>);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
  });
});
