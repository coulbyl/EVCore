import { describe, expect, it } from 'vitest';
import type { SheetEventRow } from '@modules/fixture-events/fixture-event.repository';
import { sheetEventsOf } from './match-sheet-events';

const event = (overrides: Partial<SheetEventRow>): SheetEventRow => ({
  ordinal: 0,
  teamId: 'home-id',
  minute: 10,
  extraMinute: null,
  type: 'GOAL',
  detail: 'Normal Goal',
  comments: null,
  playerName: 'Scorer',
  ...overrides,
});

const of = (
  events: SheetEventRow[],
  score: { home: number; away: number } | null,
) =>
  sheetEventsOf({
    events,
    homeTeamId: 'home-id',
    awayTeamId: 'away-id',
    score,
  });

describe('sheetEventsOf', () => {
  it('orders by minute then stoppage time, whatever the response order', () => {
    const result = of(
      [
        event({ ordinal: 0, minute: 45, extraMinute: 2, playerName: 'C' }),
        event({ ordinal: 1, minute: 45, extraMinute: null, playerName: 'B' }),
        event({ ordinal: 2, minute: 3, teamId: 'away-id', playerName: 'A' }),
      ],
      { home: 2, away: 1 },
    );
    expect(result?.scorers.map((s) => s.player)).toEqual(['A', 'B', 'C']);
  });

  it('labels an own goal and counts it for the team its event names', () => {
    // API-Football: an own goal's team is the side it counts for (45/45 of
    // the 03/11 sample), its player from the other side.
    const result = of(
      [
        event({
          teamId: 'away-id',
          detail: 'Own Goal',
          playerName: 'Defender',
        }),
      ],
      { home: 0, away: 1 },
    );
    expect(result?.scorers).toEqual([
      {
        minute: 10,
        extraMinute: null,
        player: 'Defender',
        team: 'away',
        kind: 'own',
      },
    ]);
  });

  it('leaves out a missed penalty and a goal the VAR cancelled (no scorer)', () => {
    const result = of(
      [
        event({ ordinal: 0, detail: 'Missed Penalty', playerName: 'Petkov' }),
        event({
          ordinal: 1,
          type: 'VAR',
          detail: 'Goal cancelled',
          minute: 41,
        }),
        event({ ordinal: 2, minute: 41, playerName: null }),
        event({ ordinal: 3, minute: 60, playerName: 'Rohr' }),
      ],
      { home: 1, away: 0 },
    );
    expect(result?.scorers.map((s) => s.player)).toEqual(['Rohr']);
  });

  it('keeps stoppage time, leaves out extra time (not in the full-time score)', () => {
    const result = of(
      [
        event({ ordinal: 0, minute: 90, extraMinute: 4, playerName: 'Late' }),
        event({ ordinal: 1, minute: 105, extraMinute: 1, playerName: 'Extra' }),
        event({ ordinal: 2, minute: 118, playerName: 'Extra 2' }),
      ],
      { home: 1, away: 0 },
    );
    expect(result?.scorers.map((s) => s.player)).toEqual(['Late']);
  });

  it('leaves out the kicks of a penalty shoot-out', () => {
    const result = of(
      [
        event({ ordinal: 0, minute: 30 }),
        event({ ordinal: 1, minute: 70, teamId: 'away-id' }),
        event({
          ordinal: 2,
          minute: 120,
          detail: 'Penalty',
          comments: 'Penalty Shootout',
        }),
        event({
          ordinal: 3,
          minute: 120,
          teamId: 'away-id',
          detail: 'Penalty',
          comments: 'Penalty Shootout',
        }),
      ],
      { home: 1, away: 1 },
    );
    expect(result?.scorers).toHaveLength(2);
  });

  it('shows nothing rather than a list that does not make the score', () => {
    expect(of([event({})], { home: 2, away: 0 })).toBeNull();
    expect(of([], { home: 0, away: 0 })).toBeNull();
    expect(of([event({})], null)).toBeNull();
  });

  it('a goalless match with its events: no scorer, nothing hidden', () => {
    const result = of([event({ type: 'CARD', detail: 'Yellow Card' })], {
      home: 0,
      away: 0,
    });
    expect(result).toEqual({ scorers: [], redCards: [] });
  });

  it('keeps red cards and second yellows, not one the VAR took back', () => {
    const result = of(
      [
        event({
          ordinal: 0,
          type: 'CARD',
          detail: 'Red Card',
          playerName: 'A',
          minute: 20,
        }),
        event({
          ordinal: 1,
          type: 'CARD',
          detail: 'Second Yellow card',
          playerName: 'B',
          minute: 70,
          teamId: 'away-id',
        }),
        event({
          ordinal: 2,
          type: 'CARD',
          detail: 'Red Card',
          playerName: 'C',
          minute: 51,
        }),
        event({
          ordinal: 3,
          type: 'VAR',
          detail: 'Red card cancelled',
          playerName: 'C',
          minute: 53,
        }),
        event({
          ordinal: 4,
          type: 'CARD',
          detail: 'Yellow Card',
          playerName: 'D',
        }),
      ],
      { home: 0, away: 0 },
    );
    expect(result?.redCards.map((r) => [r.player, r.team])).toEqual([
      ['A', 'home'],
      ['B', 'away'],
    ]);
  });
});
