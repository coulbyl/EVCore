import { describe, expect, it } from 'vitest';
import {
  buildStandingTable,
  standingFor,
  type StandingFixture,
} from './standing.builder';

function match(
  homeTeamId: string,
  awayTeamId: string,
  score: [number, number],
): StandingFixture {
  return {
    homeTeamId,
    awayTeamId,
    homeScore: score[0],
    awayScore: score[1],
  };
}

describe('buildStandingTable', () => {
  it('applique le barème 3/1/0 des deux côtés du match', () => {
    const table = buildStandingTable([match('a', 'b', [2, 0])]);

    expect(table.get('a')).toMatchObject({
      points: 3,
      played: 1,
      wins: 1,
      goalsFor: 2,
      goalsAgainst: 0,
      goalsDiff: 2,
    });
    expect(table.get('b')).toMatchObject({
      points: 0,
      played: 1,
      losses: 1,
      goalsFor: 0,
      goalsAgainst: 2,
      goalsDiff: -2,
    });
  });

  it('compte un point à chaque équipe sur un nul', () => {
    const table = buildStandingTable([match('a', 'b', [1, 1])]);

    expect(table.get('a')?.points).toBe(1);
    expect(table.get('b')?.points).toBe(1);
    expect(table.get('a')?.draws).toBe(1);
  });

  it('classe par points, puis différence de buts, puis buts marqués', () => {
    const table = buildStandingTable([
      // a : 3 pts, +3
      match('a', 'c', [3, 0]),
      // b : 3 pts, +1
      match('b', 'd', [1, 0]),
    ]);

    expect(table.get('a')?.rank).toBe(1);
    expect(table.get('b')?.rank).toBe(2);
    expect(table.get('a')?.teamCount).toBe(4);
  });

  it('départage deux équipes à égalité de points et de différence par les buts marqués', () => {
    const table = buildStandingTable([
      match('a', 'x', [3, 1]), // a : 3 pts, +2, 3 bm
      match('b', 'y', [2, 0]), // b : 3 pts, +2, 2 bm
    ]);

    expect(table.get('a')?.rank).toBe(1);
    expect(table.get('b')?.rank).toBe(2);
  });

  it('reste déterministe quand deux équipes sont strictement à égalité', () => {
    const fixtures = [match('zzz', 'x', [1, 0]), match('aaa', 'y', [1, 0])];

    const first = buildStandingTable(fixtures);
    const second = buildStandingTable([...fixtures].reverse());

    expect(first.get('aaa')?.rank).toBe(second.get('aaa')?.rank);
    expect(first.get('zzz')?.rank).toBe(second.get('zzz')?.rank);
  });

  it('cumule plusieurs journées', () => {
    const table = buildStandingTable([
      match('a', 'b', [1, 0]),
      match('b', 'a', [2, 2]),
      match('a', 'c', [0, 1]),
    ]);

    expect(table.get('a')).toMatchObject({
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      points: 4,
    });
  });

  it('annonce la provenance dérivée, jamais la table API', () => {
    const table = buildStandingTable([match('a', 'b', [1, 0])]);

    expect(table.get('a')?.source).toBe('derived_from_fixtures');
  });
});

describe('standingFor', () => {
  it('motive l’absence d’une équipe qui n’a encore joué aucun match', () => {
    const table = buildStandingTable([match('a', 'b', [1, 0])]);

    expect(standingFor(table, 'inconnue')).toEqual({
      value: null,
      reason: 'no_prior_fixtures',
    });
  });
});
