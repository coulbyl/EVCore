import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixtureService, type FixtureInput } from './fixture.service';
import type { FixtureRepository } from './fixture.repository';

function buildFixture(overrides: Partial<FixtureInput> = {}): FixtureInput {
  return {
    externalId: 867946,
    homeTeam: {
      externalId: 52,
      name: 'Crystal Palace',
      shortName: 'Crystal Palace',
      logoUrl: 'https://media.api-sports.io/football/teams/52.png',
    },
    awayTeam: {
      externalId: 42,
      name: 'Arsenal',
      shortName: 'Arsenal',
      logoUrl: 'https://media.api-sports.io/football/teams/42.png',
    },
    matchday: 1,
    scheduledAt: new Date('2022-08-05T19:00:00Z'),
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    ...overrides,
  };
}

describe('FixtureService.upsertFixtureChain', () => {
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
    fixtureRepository.upsertFixture.mockResolvedValue({
      id: 'fixture-id',
      changed: true,
      affectsRollingStats: false,
    });
  });

  it.each(['SCHEDULED', 'FINISHED', 'POSTPONED', 'CANCELLED'] as const)(
    'passes status %s through to the repository unchanged',
    async (status) => {
      const fixture = buildFixture({ status });

      await service.upsertFixtureChain({
        competitionId: 'competition-id',
        seasonId: 'season-id',
        fixture,
      });

      expect(fixtureRepository.upsertFixture).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
    },
  );

  it('upserts both home and away teams with correct externalIds', async () => {
    const fixture = buildFixture();

    await service.upsertFixtureChain({
      competitionId: 'competition-id',
      seasonId: 'season-id',
      fixture,
    });

    expect(fixtureRepository.upsertTeam).toHaveBeenCalledTimes(2);
    expect(fixtureRepository.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: fixture.homeTeam.externalId }),
    );
    expect(fixtureRepository.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: fixture.awayTeam.externalId }),
    );
  });

  it('passes team logos to the repository', async () => {
    const fixture = buildFixture();

    await service.upsertFixtureChain({
      competitionId: 'competition-id',
      seasonId: 'season-id',
      fixture,
    });

    expect(fixtureRepository.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: fixture.homeTeam.logoUrl }),
    );
    expect(fixtureRepository.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: fixture.awayTeam.logoUrl }),
    );
  });

  it('passes scores and matchday to the repository', async () => {
    const fixture = buildFixture({
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
      matchday: 5,
    });

    await service.upsertFixtureChain({
      competitionId: 'competition-id',
      seasonId: 'season-id',
      fixture,
    });

    expect(fixtureRepository.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: fixture.externalId,
        matchday: 5,
        homeScore: 2,
        awayScore: 1,
        homeHtScore: 1,
        awayHtScore: 0,
        status: 'FINISHED',
      }),
    );
  });

  it('passes null scores for unplayed fixtures', async () => {
    const fixture = buildFixture({
      homeScore: null,
      awayScore: null,
      homeHtScore: null,
      awayHtScore: null,
    });

    await service.upsertFixtureChain({
      competitionId: 'competition-id',
      seasonId: 'season-id',
      fixture,
    });

    expect(fixtureRepository.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({
        homeScore: null,
        awayScore: null,
        homeHtScore: null,
        awayHtScore: null,
      }),
    );
  });

  it('returns repository change metadata to the caller', async () => {
    const fixture = buildFixture({
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
    });
    fixtureRepository.upsertFixture.mockResolvedValueOnce({
      id: 'fixture-id',
      changed: true,
      affectsRollingStats: true,
    });

    const result = await service.upsertFixtureChain({
      competitionId: 'competition-id',
      seasonId: 'season-id',
      fixture,
    });

    expect(result).toEqual({
      id: 'fixture-id',
      changed: true,
      affectsRollingStats: true,
    });
  });
});
