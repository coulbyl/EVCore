import { describe, expect, it } from 'vitest';
import { FixtureEventType } from '@evcore/db';
import { FixtureByIdDetailsSchema } from '../etl/schemas/fixture-full.schema';
import { fixturesByIdsSample } from '../etl/schemas/fixture-full.sample';
import { toFixtureDetailRows, UnknownTeamError } from './fixture-events.mapper';

// 1557450: Chelsea (49) – Manchester United (33).
const TEAMS = new Map([
  [49, 'chelsea-id'],
  [33, 'united-id'],
]);

function details(mutate?: (entry: Record<string, unknown>) => void) {
  const entry = fixturesByIdsSample().response[0] as Record<string, unknown>;
  mutate?.(entry);
  return FixtureByIdDetailsSchema.parse(entry);
}

describe('toFixtureDetailRows', () => {
  it('stores an event the API sent without a detail as an empty text', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const events = entry.events as Array<Record<string, unknown>>;
        Object.assign(events[0] ?? {}, { detail: null });
      }),
      teams: TEAMS,
    });
    expect(rows.events[0]?.detail).toBe('');
  });

  it('maps a real match: events in response order, our team ids', () => {
    const rows = toFixtureDetailRows({ details: details(), teams: TEAMS });

    expect(rows.complete).toBe(true);
    expect(rows.events.map((e) => e.ordinal)).toEqual(
      rows.events.map((_, index) => index),
    );
    expect(rows.events[0]).toEqual({
      teamId: 'united-id',
      ordinal: 0,
      minute: 34,
      extraMinute: null,
      type: FixtureEventType.VAR,
      detail: 'Goal cancelled',
      comments: null,
      playerExternalId: 1165,
      playerName: 'Matheus Cunha',
      assistExternalId: null,
      assistName: null,
    });
    const penalty = rows.events.find((e) => e.detail === 'Penalty');
    expect(penalty).toMatchObject({
      teamId: 'chelsea-id',
      type: FixtureEventType.GOAL,
      minute: 64,
      playerName: 'Cole Palmer',
    });
    expect(rows.events.find((e) => e.detail === 'Red Card')?.type).toBe(
      FixtureEventType.CARD,
    );
    expect(
      rows.events.filter((e) => e.type === FixtureEventType.SUBSTITUTION),
    ).toHaveLength(2);
    const stoppage = rows.events.find((e) => e.extraMinute !== null);
    expect(stoppage).toMatchObject({ minute: 90, extraMinute: 3 });
  });

  it('keeps starters and substitutes with their formation', () => {
    const rows = toFixtureDetailRows({ details: details(), teams: TEAMS });
    expect(rows.lineups).toHaveLength(6);
    expect(rows.lineups.filter((l) => l.starter)).toHaveLength(4);
    expect(rows.lineups[0]).toMatchObject({
      teamId: 'chelsea-id',
      starter: true,
    });
    expect(rows.lineups[0]?.formation).toEqual(expect.any(String));
  });

  it('keeps a null count null, never zero, and the whole block as raw', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const team = (
          entry.players as {
            players: { statistics: { shots: object; games: object }[] }[];
          }[]
        )[0];
        const block = team?.players[0]?.statistics[0];
        if (!block) throw new Error('sample block missing');
        Object.assign(block.shots, { total: null, on: null });
        Object.assign(block.games, { rating: null });
      }),
      teams: TEAMS,
    });
    const first = rows.playerStatistics[0];
    expect(first).toMatchObject({
      shotsTotal: null,
      shotsOn: null,
      rating: null,
    });
    expect(first?.raw).toHaveProperty('duels');
    expect(rows.playerStatistics.some((p) => p.rating !== null)).toBe(true);
  });

  it('leaves out a player without statistics, keeps him as a player', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const team = (entry.players as { players: unknown[] }[])[0];
        team?.players.push({
          player: { id: 999001, name: 'No Stats', photo: null },
          statistics: [],
        });
      }),
      teams: TEAMS,
    });
    expect(
      rows.playerStatistics.some((p) => p.playerExternalId === 999001),
    ).toBe(false);
    expect(rows.players.some((p) => p.externalId === 999001)).toBe(true);
  });

  it('skips a lineup player without an id and an event of an unknown type', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const lineup = (
          entry.lineups as { startXI: { player: { id: number | null } }[] }[]
        )[0];
        const starter = lineup?.startXI[0];
        if (!starter) throw new Error('sample starter missing');
        starter.player.id = null;
        const events = entry.events as { type: string }[];
        if (events[1]) events[1].type = 'Corner';
      }),
      teams: TEAMS,
    });
    expect(rows.lineups).toHaveLength(5);
    expect(rows.events.map((e) => e.ordinal)).not.toContain(1);
    expect(rows.events.map((e) => e.ordinal)).toContain(2);
  });

  it("treats id 0, the API's unknown person, as no identity", () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const team = (
          entry.players as { players: { player: { id: number } }[] }[]
        )[0];
        const first = team?.players[0];
        if (!first) throw new Error('sample player missing');
        first.player.id = 0;
        const lineup = (entry.lineups as { coach: { id: number } }[])[0];
        if (lineup) lineup.coach.id = 0;
        const event = (entry.events as { player: { id: number } }[])[0];
        if (event) event.player.id = 0;
      }),
      teams: TEAMS,
    });
    expect(rows.players.some((p) => p.externalId === 0)).toBe(false);
    expect(rows.playerStatistics.some((p) => p.playerExternalId === 0)).toBe(
      false,
    );
    expect(rows.lineups[0]?.coachExternalId).toBeNull();
    expect(rows.events[0]?.playerExternalId).toBeNull();
  });

  it('names a player from the statistics block over the lineup', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const lineup = (
          entry.lineups as {
            startXI: { player: { id: number; name: string } }[];
          }[]
        )[0];
        const team = (
          entry.players as { players: { player: { id: number } }[] }[]
        )[0];
        const starter = lineup?.startXI[0];
        const id = team?.players[0]?.player.id;
        if (!starter || id === undefined) throw new Error('sample missing');
        starter.player.id = id;
        starter.player.name = 'R. Abbreviated';
      }),
      teams: TEAMS,
    });
    const id = rows.playerStatistics[0]?.playerExternalId;
    expect(rows.players.find((p) => p.externalId === id)?.name).not.toBe(
      'R. Abbreviated',
    );
    expect(new Set(rows.players.map((p) => p.externalId)).size).toBe(
      rows.players.length,
    );
  });

  it('keeps the statistics of a player without a name or games block', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        const team = (
          entry.players as {
            players: {
              player: { id: number; name: string | null };
              statistics: { games: unknown }[];
            }[];
          }[]
        )[0];
        const first = team?.players[0];
        const block = first?.statistics[0];
        if (!first || !block) throw new Error('sample player missing');
        first.player.name = null;
        block.games = null;
      }),
      teams: TEAMS,
    });
    const first = rows.playerStatistics[0];
    expect(first).toMatchObject({
      minutes: null,
      rating: null,
      substitute: null,
    });
    expect(first?.shotsTotal).not.toBeUndefined();
  });

  it('is incomplete when one of the three blocks is empty', () => {
    const rows = toFixtureDetailRows({
      details: details((entry) => {
        entry.players = [];
      }),
      teams: TEAMS,
    });
    expect(rows.complete).toBe(false);
  });

  it('rejects the match when a team is neither side', () => {
    expect(() =>
      toFixtureDetailRows({
        details: details(),
        teams: new Map([[49, 'chelsea-id']]),
      }),
    ).toThrow(UnknownTeamError);
  });
});
