import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@evcore/db';
import { RollingStatsService } from './rolling-stats.service';

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function makeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fixture-1',
    seasonId: 'season-1',
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    scheduledAt: new Date('2024-08-01T12:00:00.000Z'),
    homeScore: 1,
    awayScore: 0,
    homeXg: decimal(1.2),
    awayXg: decimal(0.8),
    ...overrides,
  };
}

describe('RollingStatsService', () => {
  const fixtureFindMany = vi.fn();
  const fixtureFindUnique = vi.fn();
  const teamStatsFindMany = vi.fn();
  const teamStatsCreateMany = vi.fn();
  const teamStatsUpdate = vi.fn();
  const transaction = vi.fn();
  const coachTenureFindMany = vi.fn();

  const prismaService = {
    client: {
      fixture: {
        findMany: fixtureFindMany,
        findUnique: fixtureFindUnique,
      },
      teamStats: {
        findMany: teamStatsFindMany,
        createMany: teamStatsCreateMany,
        update: teamStatsUpdate,
      },
      coachTenure: {
        findMany: coachTenureFindMany,
      },
      $transaction: transaction,
    },
  };

  beforeEach(() => {
    fixtureFindMany.mockReset();
    fixtureFindUnique.mockReset();
    teamStatsFindMany.mockReset();
    teamStatsCreateMany.mockReset();
    teamStatsUpdate.mockReset();
    transaction.mockReset();
    coachTenureFindMany.mockReset();
    teamStatsCreateMany.mockResolvedValue({ count: 0 });
    transaction.mockResolvedValue([]);
    // Most tests don't care about coach data — empty by default keeps
    // recentForm's reset-on-coach-change behaviour a no-op for them.
    coachTenureFindMany.mockResolvedValue([]);
  });

  it('builds season stats from one fixture scan and writes only missing rows', async () => {
    fixtureFindMany.mockResolvedValue([
      makeFixture({
        id: 'fixture-b',
        scheduledAt: new Date('2024-08-01T15:00:00.000Z'),
      }),
      makeFixture({
        id: 'fixture-a',
        scheduledAt: new Date('2024-08-01T15:00:00.000Z'),
      }),
    ]);
    teamStatsFindMany.mockResolvedValue([]);

    const service = new RollingStatsService(prismaService as never);
    const result = await service.backfillSeason('season-1');

    expect(fixtureFindMany).toHaveBeenCalledTimes(1);
    expect(fixtureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId: 'season-1', status: 'FINISHED' },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(teamStatsFindMany).toHaveBeenCalledTimes(1);
    expect(teamStatsCreateMany).toHaveBeenCalledTimes(1);
    expect(teamStatsCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            teamId: 'team-a',
            afterFixtureId: 'fixture-b',
          }),
          expect.objectContaining({
            teamId: 'team-b',
            afterFixtureId: 'fixture-b',
          }),
        ]),
      }),
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(result.fixtureCount).toBe(2);
    expect(result.teamStatsWritten).toBe(4);
    expect(result.createdCount).toBe(4);
    expect(result.updatedCount).toBe(0);
  });

  it('skips unchanged rows and updates changed ones', async () => {
    fixtureFindMany.mockResolvedValue([
      makeFixture({
        id: 'fixture-1',
        homeScore: 1,
        awayScore: 0,
        homeXg: decimal(1.5),
        awayXg: decimal(0.5),
      }),
    ]);
    teamStatsFindMany.mockResolvedValue([
      {
        teamId: 'team-a',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(1),
        xgFor: decimal(1.5),
        xgAgainst: decimal(0.5),
        homeWinRate: decimal(1),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-b',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(0),
        xgFor: decimal(0.4),
        xgAgainst: decimal(1.5),
        homeWinRate: decimal(0),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
    ]);

    const service = new RollingStatsService(prismaService as never);
    const result = await service.backfillSeason('season-1');

    expect(teamStatsCreateMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(teamStatsUpdate).toHaveBeenCalledTimes(1);
    expect(teamStatsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId_afterFixtureId: {
            teamId: 'team-b',
            afterFixtureId: 'fixture-1',
          },
        },
      }),
    );
    expect(result.teamStatsWritten).toBe(1);
    expect(result.createdCount).toBe(0);
    expect(result.updatedCount).toBe(1);
  });

  it("re-centers recentForm on a coach change instead of blending in the previous coach's results", async () => {
    fixtureFindUnique.mockResolvedValue({
      id: 'fixture-3',
      seasonId: 'season-1',
      scheduledAt: new Date('2024-08-10T12:00:00.000Z'),
    });
    fixtureFindMany.mockResolvedValue([
      // Two losses under the old coach.
      makeFixture({
        id: 'fixture-1',
        scheduledAt: new Date('2024-08-01T12:00:00.000Z'),
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeScore: 0,
        awayScore: 1,
      }),
      makeFixture({
        id: 'fixture-2',
        scheduledAt: new Date('2024-08-05T12:00:00.000Z'),
        homeTeamId: 'team-c',
        awayTeamId: 'team-a',
        homeScore: 1,
        awayScore: 0,
      }),
      // A win, but only after a coach change on 2024-08-08 — should be
      // scored on its own, not blended with the two losses above.
      makeFixture({
        id: 'fixture-3',
        scheduledAt: new Date('2024-08-10T12:00:00.000Z'),
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeScore: 2,
        awayScore: 0,
      }),
    ]);
    coachTenureFindMany.mockResolvedValue([
      { teamId: 'team-a', startDate: new Date('2024-01-01T00:00:00.000Z') },
      { teamId: 'team-a', startDate: new Date('2024-08-08T00:00:00.000Z') },
    ]);

    const service = new RollingStatsService(prismaService as never);
    const stats = await service.computeStats('team-a', 'fixture-3');

    // A lone win scores recentForm = 1 exactly (calculateRecentForm).
    // Blended with the two prior losses it would come out to ~0.41 instead.
    expect(stats.recentForm.toNumber()).toBeCloseTo(1, 6);
  });

  it('computes stats for one team without refetching fixtures per team/fixture pair', async () => {
    fixtureFindUnique.mockResolvedValue({
      id: 'fixture-2',
      seasonId: 'season-1',
      scheduledAt: new Date('2024-08-08T12:00:00.000Z'),
    });
    fixtureFindMany.mockResolvedValue([
      makeFixture({
        id: 'fixture-1',
        scheduledAt: new Date('2024-08-01T12:00:00.000Z'),
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeScore: 1,
        awayScore: 0,
        homeXg: decimal(1.1),
        awayXg: decimal(0.6),
      }),
      makeFixture({
        id: 'fixture-2',
        scheduledAt: new Date('2024-08-08T12:00:00.000Z'),
        homeTeamId: 'team-c',
        awayTeamId: 'team-a',
        homeScore: 0,
        awayScore: 2,
        homeXg: decimal(0.7),
        awayXg: decimal(1.8),
      }),
    ]);

    const service = new RollingStatsService(prismaService as never);
    const stats = await service.computeStats('team-a', 'fixture-2');

    expect(fixtureFindUnique).toHaveBeenCalledTimes(1);
    expect(fixtureFindMany).toHaveBeenCalledTimes(1);
    expect(stats.recentForm.toNumber()).toBeGreaterThan(0);
    expect(stats.xgFor.toNumber()).toBeCloseTo(1.45, 6);
    expect(stats.xgAgainst.toNumber()).toBeCloseTo(0.65, 6);
  });

  it('refreshSeason does nothing when every finished fixture already has both rows', async () => {
    fixtureFindMany.mockResolvedValue([
      makeFixture({ id: 'fixture-1' }),
      makeFixture({
        id: 'fixture-2',
        scheduledAt: new Date('2024-08-08T12:00:00.000Z'),
        homeTeamId: 'team-c',
        awayTeamId: 'team-d',
      }),
    ]);
    teamStatsFindMany.mockResolvedValue([
      {
        teamId: 'team-a',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(1),
        xgFor: decimal(1.2),
        xgAgainst: decimal(0.8),
        homeWinRate: decimal(1),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-b',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(0),
        xgFor: decimal(0.8),
        xgAgainst: decimal(1.2),
        homeWinRate: decimal(0),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-c',
        afterFixtureId: 'fixture-2',
        recentForm: decimal(0),
        xgFor: decimal(1.2),
        xgAgainst: decimal(0.8),
        homeWinRate: decimal(1),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-d',
        afterFixtureId: 'fixture-2',
        recentForm: decimal(0),
        xgFor: decimal(0.8),
        xgAgainst: decimal(1.2),
        homeWinRate: decimal(0),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
    ]);

    const service = new RollingStatsService(prismaService as never);
    const result = await service.refreshSeason('season-1');

    expect(teamStatsCreateMany).not.toHaveBeenCalled();
    expect(teamStatsUpdate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(result.teamStatsWritten).toBe(0);
  });

  it('refreshSeason recalculates only from the first incomplete fixture onward', async () => {
    fixtureFindMany.mockResolvedValue([
      makeFixture({
        id: 'fixture-1',
        scheduledAt: new Date('2024-08-01T12:00:00.000Z'),
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
      }),
      makeFixture({
        id: 'fixture-2',
        scheduledAt: new Date('2024-08-08T12:00:00.000Z'),
        homeTeamId: 'team-a',
        awayTeamId: 'team-c',
        homeScore: 2,
        awayScore: 1,
      }),
      makeFixture({
        id: 'fixture-3',
        scheduledAt: new Date('2024-08-15T12:00:00.000Z'),
        homeTeamId: 'team-d',
        awayTeamId: 'team-a',
        homeScore: 0,
        awayScore: 0,
      }),
    ]);
    teamStatsFindMany.mockResolvedValue([
      {
        teamId: 'team-a',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(1),
        xgFor: decimal(1.2),
        xgAgainst: decimal(0.8),
        homeWinRate: decimal(1),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-b',
        afterFixtureId: 'fixture-1',
        recentForm: decimal(0),
        xgFor: decimal(0.8),
        xgAgainst: decimal(1.2),
        homeWinRate: decimal(0),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
      {
        teamId: 'team-a',
        afterFixtureId: 'fixture-2',
        recentForm: decimal(1),
        xgFor: decimal(1.2),
        xgAgainst: decimal(0.8),
        homeWinRate: decimal(1),
        awayWinRate: decimal(0),
        drawRate: decimal(0),
        leagueVolatility: decimal(0),
      },
    ]);

    const service = new RollingStatsService(prismaService as never);
    const result = await service.refreshSeason('season-1');

    expect(teamStatsCreateMany).toHaveBeenCalledTimes(1);
    expect(teamStatsCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            teamId: 'team-c',
            afterFixtureId: 'fixture-2',
          }),
          expect.objectContaining({
            teamId: 'team-d',
            afterFixtureId: 'fixture-3',
          }),
          expect.objectContaining({
            teamId: 'team-a',
            afterFixtureId: 'fixture-3',
          }),
        ]),
      }),
    );
    expect(result.createdCount).toBe(3);
    expect(result.updatedCount).toBe(1);
    expect(result.teamStatsWritten).toBe(4);
  });
});
