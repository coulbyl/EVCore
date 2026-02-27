import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixtureService } from './fixture.service';
import type { FixtureRepository } from './fixture.repository';
import type { FootballDataFixture } from '../etl/schemas/fixture.schema';

function buildFixture(
  status: FootballDataFixture['status'],
): FootballDataFixture {
  return {
    id: 395086,
    utcDate: '2022-08-05T19:00:00+00:00',
    matchday: 1,
    status,
    homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal' },
    awayTeam: { id: 65, name: 'Manchester City FC', shortName: 'Man City' },
    score: { fullTime: { home: 0, away: 2 } },
  };
}

describe('FixtureService', () => {
  const fixtureRepository = {
    upsertTeam: vi.fn(),
    upsertFixture: vi.fn(),
    upsertCompetition: vi.fn(),
    upsertSeason: vi.fn(),
    findByDateAndTeams: vi.fn(),
    updateScores: vi.fn(),
    updateXg: vi.fn(),
    findByExternalId: vi.fn(),
    findFinishedBySeason: vi.fn(),
  } satisfies Partial<FixtureRepository>;

  const service = new FixtureService(fixtureRepository as never);

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureRepository.upsertTeam
      .mockResolvedValueOnce({ id: 'team-home-id' })
      .mockResolvedValueOnce({ id: 'team-away-id' });
    fixtureRepository.upsertFixture.mockResolvedValue({ id: 'fixture-id' });
  });

  it.each([
    ['SCHEDULED', 'SCHEDULED'],
    ['IN_PLAY', 'SCHEDULED'],
    ['PAUSED', 'SCHEDULED'],
    ['SUSPENDED', 'SCHEDULED'],
    ['FINISHED', 'FINISHED'],
    ['AWARDED', 'FINISHED'],
    ['POSTPONED', 'POSTPONED'],
    ['CANCELLED', 'CANCELLED'],
  ] as const)(
    'maps api status %s to db status %s via upsertFixtureChain',
    async (apiStatus, expectedDbStatus) => {
      const fixture = buildFixture(apiStatus);

      await service.upsertFixtureChain({
        competitionId: 'competition-id',
        seasonId: 'season-id',
        fixture,
      });

      expect(fixtureRepository.upsertTeam).toHaveBeenCalledTimes(2);
      expect(fixtureRepository.upsertFixture).toHaveBeenCalledTimes(1);
      expect(fixtureRepository.upsertFixture).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: fixture.id,
          seasonId: 'season-id',
          homeTeamId: 'team-home-id',
          awayTeamId: 'team-away-id',
          matchday: fixture.matchday,
          status: expectedDbStatus,
          homeScore: fixture.score.fullTime.home,
          awayScore: fixture.score.fullTime.away,
        }),
      );
    },
  );
});
