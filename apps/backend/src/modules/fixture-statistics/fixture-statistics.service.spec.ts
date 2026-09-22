import { describe, expect, it, vi } from 'vitest';
import { FixtureStatisticsService } from './fixture-statistics.service';
import type { FixtureStatisticsRepository } from './fixture-statistics.repository';

describe('FixtureStatisticsService', () => {
  it('maps provider team ids to internal ids before atomic persistence', async () => {
    const repository = {
      findFixtureTeamIdentity: vi.fn().mockResolvedValue({
        fixtureId: 'fixture-1',
        teams: new Map([
          [10, 'home-id'],
          [20, 'away-id'],
        ]),
      }),
      replaceFixtureStatistics: vi.fn().mockResolvedValue(undefined),
      markUnavailable: vi.fn(),
    } satisfies Partial<FixtureStatisticsRepository>;
    const service = new FixtureStatisticsService(
      repository as unknown as FixtureStatisticsRepository,
    );
    const observedAt = new Date('2026-09-21T12:00:00.000Z');

    const count = await service.persistFinalStatistics({
      fixtureExternalId: 123,
      observedAt,
      teams: [
        {
          externalTeamId: 10,
          statistics: [{ type: 'Shots on Goal', value: 6 }],
        },
        {
          externalTeamId: 20,
          statistics: [{ type: 'Ball Possession', value: '43%' }],
        },
      ],
    });

    expect(count).toBe(2);
    expect(repository.replaceFixtureStatistics).toHaveBeenCalledWith({
      fixtureId: 'fixture-1',
      observedAt,
      statistics: [
        {
          teamId: 'home-id',
          type: 'shots_on_goal',
          value: 6,
          rawValue: '6',
        },
        {
          teamId: 'away-id',
          type: 'ball_possession',
          value: 43,
          rawValue: '43%',
        },
      ],
    });
  });

  it('refuses a provider team that does not belong to the fixture', async () => {
    const repository = {
      findFixtureTeamIdentity: vi.fn().mockResolvedValue({
        fixtureId: 'fixture-1',
        teams: new Map([[10, 'home-id']]),
      }),
      replaceFixtureStatistics: vi.fn(),
      markUnavailable: vi.fn(),
    } satisfies Partial<FixtureStatisticsRepository>;
    const service = new FixtureStatisticsService(
      repository as unknown as FixtureStatisticsRepository,
    );

    await expect(
      service.persistFinalStatistics({
        fixtureExternalId: 123,
        observedAt: new Date(),
        teams: [{ externalTeamId: 99, statistics: [] }],
      }),
    ).rejects.toThrow('Unexpected team 99 for fixture 123');
    expect(repository.replaceFixtureStatistics).not.toHaveBeenCalled();
  });
});
