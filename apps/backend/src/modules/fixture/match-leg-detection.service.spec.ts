import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchLegDetectionService } from './match-leg-detection.service';
import type { FixtureRepository } from './fixture.repository';

const SEASON_ID = 'season-ucl-2025';

type FixtureOverrides = Partial<{
  homeScore: number | null;
  awayScore: number | null;
  leg: number | null;
}>;

type MakeFixtureInput = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  overrides?: FixtureOverrides;
};

function makeFixture({
  id,
  homeTeamId,
  awayTeamId,
  scheduledAt,
  overrides = {},
}: MakeFixtureInput) {
  return {
    id,
    homeTeamId,
    awayTeamId,
    scheduledAt,
    homeScore: overrides.homeScore ?? null,
    awayScore: overrides.awayScore ?? null,
    leg: overrides.leg ?? null,
  };
}

describe('MatchLegDetectionService', () => {
  const repo = {
    findKnockoutRoundsBySeasonId: vi.fn(),
    findKnockoutFixturesBySeasonAndRound: vi.fn(),
    setFixtureLeg: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureRepository>;

  const service = new MatchLegDetectionService(
    repo as unknown as FixtureRepository,
  );

  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no knockout rounds exist', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([]);

    const result = await service.detectLegsForSeason(SEASON_ID);

    expect(result).toBe(0);
    expect(repo.setFixtureLeg).not.toHaveBeenCalled();
  });

  it('assigns leg 1 and leg 2 to a matched pair', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([
      { round: 'Quarter-finals' },
    ]);
    repo.findKnockoutFixturesBySeasonAndRound.mockResolvedValue([
      makeFixture({
        id: 'f1',
        homeTeamId: 'arsenal',
        awayTeamId: 'sporting',
        scheduledAt: new Date('2026-04-07'),
      }),
      makeFixture({
        id: 'f2',
        homeTeamId: 'sporting',
        awayTeamId: 'arsenal',
        scheduledAt: new Date('2026-04-15'),
      }),
    ]);

    const result = await service.detectLegsForSeason(SEASON_ID);

    expect(result).toBe(2);
    expect(repo.setFixtureLeg).toHaveBeenCalledWith('f1', 1, null);
    expect(repo.setFixtureLeg).toHaveBeenCalledWith('f2', 2, {
      homeGoals: null, // f1.awayScore (sporting scored null in leg 1)
      awayGoals: null, // f1.homeScore (arsenal scored null in leg 1)
    });
  });

  it('sets aggregate goals from leg 1 score on leg 2', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([
      { round: 'Round of 16' },
    ]);
    repo.findKnockoutFixturesBySeasonAndRound.mockResolvedValue([
      makeFixture({
        id: 'f1',
        homeTeamId: 'teamA',
        awayTeamId: 'teamB',
        scheduledAt: new Date('2026-03-11'),
        overrides: { homeScore: 1, awayScore: 1 },
      }),
      makeFixture({
        id: 'f2',
        homeTeamId: 'teamB',
        awayTeamId: 'teamA',
        scheduledAt: new Date('2026-03-17'),
      }),
    ]);

    await service.detectLegsForSeason(SEASON_ID);

    // leg 2: teamB is home (was away in leg1 → scored 1), teamA is away (was home in leg1 → scored 1)
    expect(repo.setFixtureLeg).toHaveBeenCalledWith('f2', 2, {
      homeGoals: 1,
      awayGoals: 1,
    });
  });

  it('skips pairs where both legs are already assigned', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([
      { round: 'Quarter-finals' },
    ]);
    repo.findKnockoutFixturesBySeasonAndRound.mockResolvedValue([
      makeFixture({
        id: 'f1',
        homeTeamId: 'arsenal',
        awayTeamId: 'sporting',
        scheduledAt: new Date('2026-04-07'),
        overrides: { leg: 1 },
      }),
      makeFixture({
        id: 'f2',
        homeTeamId: 'sporting',
        awayTeamId: 'arsenal',
        scheduledAt: new Date('2026-04-15'),
        overrides: { leg: 2 },
      }),
    ]);

    const result = await service.detectLegsForSeason(SEASON_ID);

    expect(result).toBe(0);
    expect(repo.setFixtureLeg).not.toHaveBeenCalled();
  });

  it('handles multiple rounds in a single season', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([
      { round: 'Quarter-finals' },
      { round: 'Semi-finals' },
    ]);
    repo.findKnockoutFixturesBySeasonAndRound
      .mockResolvedValueOnce([
        makeFixture({
          id: 'qf1',
          homeTeamId: 'a',
          awayTeamId: 'b',
          scheduledAt: new Date('2026-04-07'),
        }),
        makeFixture({
          id: 'qf2',
          homeTeamId: 'b',
          awayTeamId: 'a',
          scheduledAt: new Date('2026-04-15'),
        }),
      ])
      .mockResolvedValueOnce([
        makeFixture({
          id: 'sf1',
          homeTeamId: 'c',
          awayTeamId: 'd',
          scheduledAt: new Date('2026-04-28'),
        }),
        makeFixture({
          id: 'sf2',
          homeTeamId: 'd',
          awayTeamId: 'c',
          scheduledAt: new Date('2026-05-05'),
        }),
      ]);

    const result = await service.detectLegsForSeason(SEASON_ID);

    expect(result).toBe(4);
  });

  it('ignores unpaired fixtures (no matching reverse fixture)', async () => {
    repo.findKnockoutRoundsBySeasonId.mockResolvedValue([
      { round: 'Quarter-finals' },
    ]);
    repo.findKnockoutFixturesBySeasonAndRound.mockResolvedValue([
      makeFixture({
        id: 'f1',
        homeTeamId: 'arsenal',
        awayTeamId: 'sporting',
        scheduledAt: new Date('2026-04-07'),
      }),
      // no reverse fixture
    ]);

    const result = await service.detectLegsForSeason(SEASON_ID);

    expect(result).toBe(0);
    expect(repo.setFixtureLeg).not.toHaveBeenCalled();
  });
});
