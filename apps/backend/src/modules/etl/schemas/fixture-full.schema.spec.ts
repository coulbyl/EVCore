import { describe, expect, it } from 'vitest';
import {
  ApiFootballFixturesByIdsResponseSchema,
  FixtureByIdDetailsSchema,
  FixtureByIdIdentitySchema,
  FixtureByIdStatisticsSchema,
} from './fixture-full.schema';
import { fixturesByIdsSample } from './fixture-full.sample';

function entry(index = 0) {
  const sample = fixturesByIdsSample();
  const found = sample.response[index];
  if (!found) throw new Error('sample entry missing');
  return found;
}

describe('ApiFootballFixturesByIdsResponseSchema', () => {
  it('accepts a real /fixtures?ids= answer', () => {
    const parsed = ApiFootballFixturesByIdsResponseSchema.safeParse(
      fixturesByIdsSample(),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data?.response).toHaveLength(3);
  });

  it('rejects another endpoint and a non-array response', () => {
    expect(
      ApiFootballFixturesByIdsResponseSchema.safeParse({
        ...fixturesByIdsSample(),
        get: 'fixtures/statistics',
      }).success,
    ).toBe(false);
    expect(
      ApiFootballFixturesByIdsResponseSchema.safeParse({
        get: 'fixtures',
        results: 0,
        response: {},
      }).success,
    ).toBe(false);
  });
});

describe('FixtureByIdIdentitySchema', () => {
  it('reads the fixture id and both team ids', () => {
    const parsed = FixtureByIdIdentitySchema.parse(entry());
    expect(parsed.fixture.id).toBe(1557450);
    expect(parsed.teams).toEqual({ home: { id: 49 }, away: { id: 33 } });
  });
});

describe('FixtureByIdStatisticsSchema', () => {
  it('accepts the two teams of a real entry', () => {
    expect(
      FixtureByIdStatisticsSchema.safeParse(entry().statistics).success,
    ).toBe(true);
  });

  it('rejects a match without team statistics, as /fixtures/statistics did', () => {
    expect(FixtureByIdStatisticsSchema.safeParse([]).success).toBe(false);
  });
});

describe('FixtureByIdDetailsSchema', () => {
  it('accepts real events, lineups and player statistics', () => {
    for (const index of [0, 1, 2]) {
      expect(FixtureByIdDetailsSchema.safeParse(entry(index)).success).toBe(
        true,
      );
    }
  });

  it('accepts a match without events', () => {
    const match = entry();
    match.events = [];
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('accepts a player without statistics and null counts', () => {
    const match = entry();
    const team = match.players[0];
    if (!team) throw new Error('sample team missing');
    (team.players as unknown[]).push({
      player: { id: 999001, name: 'No Stats', photo: null },
      statistics: [],
    });
    const block = team.players[0]?.statistics[0];
    if (!block) throw new Error('sample block missing');
    Object.assign(block.games, { rating: null, minutes: null });
    Object.assign(block.shots, { total: null, on: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('accepts a cancelled goal without a scorer and a lineup player without an id', () => {
    const match = entry(1);
    const lineup = match.lineups[0];
    if (!lineup) throw new Error('sample lineup missing');
    Object.assign(lineup.startXI[0]?.player ?? {}, { id: null, grid: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(true);
  });

  it('rejects an event without a minute', () => {
    const match = entry();
    Object.assign(match.events[0]?.time ?? {}, { elapsed: null });
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(false);
  });

  it('rejects a match whose players block is missing', () => {
    const match: Record<string, unknown> = entry();
    delete match.players;
    expect(FixtureByIdDetailsSchema.safeParse(match).success).toBe(false);
  });
});
