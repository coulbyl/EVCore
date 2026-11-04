import { describe, expect, it } from 'vitest';
import type { MatchFacts } from '@evcore/analysis-core';
import type { MarketPriceRow } from '@modules/betting-engine/pricing/playable-odds.repository';
import {
  newMarketPicksOf,
  pricedPlayerIds,
  resultOf,
} from './match-sheet-markets';

const AT = new Date('2026-11-04T17:00:00.000Z');

const row = (
  market: string,
  pick: string,
  price: { odds: number; line?: number | null; book?: string; at?: Date },
): MarketPriceRow => ({
  market,
  pick,
  line: price.line ?? null,
  bookmaker: price.book ?? '1xBet',
  odds: price.odds,
  snapshotAt: price.at ?? AT,
});

const BEFORE = { finished: false, facts: null };

function facts(overrides: Partial<MatchFacts> = {}): MatchFacts {
  return {
    score: { home: 1, away: 0 },
    teams: {
      home: {
        corners: 6,
        shotsTotal: 12,
        shotsOn: 5,
        yellowCards: null,
        redCards: null,
      },
      away: {
        corners: 4,
        shotsTotal: 8,
        shotsOn: 2,
        yellowCards: null,
        redCards: null,
      },
    },
    events: [
      {
        side: 'home',
        ordinal: 0,
        minute: 20,
        extraMinute: null,
        type: 'GOAL',
        detail: 'Normal Goal',
        comments: null,
        playerExternalId: 9,
        playerName: 'Saka',
        assistExternalId: null,
      },
    ],
    lineups: [
      { side: 'home', playerExternalId: 9, starter: true },
      { side: 'away', playerExternalId: 20, starter: true },
    ],
    playerStats: null,
    ...overrides,
  };
}

const keys = (picks: { market: string; pick: string; line: number | null }[]) =>
  picks.map((p) => `${p.market}/${p.pick}/${p.line}`);

describe('newMarketPicksOf', () => {
  it('total corners: 1xBet, the line nearest an even chance, over and under', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('CORNERS', 'OVER', { line: 8.5, odds: 1.5 }),
        row('CORNERS', 'UNDER', { line: 8.5, odds: 2.5 }),
        row('CORNERS', 'OVER', { line: 9.5, odds: 1.9 }),
        row('CORNERS', 'UNDER', { line: 9.5, odds: 1.85 }),
        row('CORNERS', 'OVER', { line: 10.5, odds: 2.4 }),
        row('CORNERS', 'UNDER', { line: 10.5, odds: 1.52 }),
        // Pinnacle's is nearer still, but 1xBet prices the market.
        row('CORNERS', 'OVER', { line: 9, odds: 1.95, book: 'Pinnacle' }),
        row('CORNERS', 'UNDER', { line: 9, odds: 1.95, book: 'Pinnacle' }),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(keys(picks)).toEqual(['CORNERS/OVER/9.5', 'CORNERS/UNDER/9.5']);
    expect(picks[0]).toMatchObject({ odds: 1.9, player: null, addable: false });
    const [over, under] = picks;
    expect((over?.chance ?? 0) + (under?.chance ?? 0)).toBeCloseTo(1, 3);
    expect(picks.every((p) => p.result === null)).toBe(true);
  });

  it('a market 1xBet does not price shows another book’s price', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('CORNERS_HOME', 'OVER', { line: 4.5, odds: 1.8, book: 'Pinnacle' }),
        row('CORNERS_HOME', 'UNDER', {
          line: 4.5,
          odds: 2.0,
          book: 'Pinnacle',
        }),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(keys(picks)).toEqual([
      'CORNERS_HOME/OVER/4.5',
      'CORNERS_HOME/UNDER/4.5',
    ]);
    expect(picks[0]?.odds).toBe(1.8);
    // The book is never part of what the sheet sends.
    expect(picks[0]).not.toHaveProperty('bookmaker');
  });

  it('a line priced on one side only, or on two readings, is not judged', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('CARDS', 'OVER', { line: 4.5, odds: 1.9 }),
        row('CARDS', 'OVER', { line: 3.5, odds: 1.5 }),
        row('CARDS', 'UNDER', {
          line: 3.5,
          odds: 2.5,
          at: new Date('2026-11-04T12:00:00.000Z'),
        }),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(picks).toEqual([]);
  });

  it('over and under updated minutes apart still read as one quote', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('CARDS', 'OVER', { line: 3.5, odds: 1.9 }),
        row('CARDS', 'UNDER', {
          line: 3.5,
          odds: 1.9,
          at: new Date('2026-11-04T17:03:00.000Z'),
        }),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(keys(picks)).toEqual(['CARDS/OVER/3.5', 'CARDS/UNDER/3.5']);
  });

  it('corners 1X2: the three outcomes, their chances summing to one', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('CORNERS_1X2', 'HOME', { odds: 1.6 }),
        row('CORNERS_1X2', 'DRAW', { odds: 8 }),
        row('CORNERS_1X2', 'AWAY', { odds: 2.6 }),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(keys(picks)).toEqual([
      'CORNERS_1X2/HOME/null',
      'CORNERS_1X2/DRAW/null',
      'CORNERS_1X2/AWAY/null',
    ]);
    const sum = picks.reduce((total, p) => total + (p.chance ?? 0), 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it('minute 1X2: the minute the most books price, at the first of them', () => {
    const triplet = (minute: number, book: string) => [
      row('MINUTE_1X2', 'HOME', { line: minute, odds: 4, book }),
      row('MINUTE_1X2', 'DRAW', { line: minute, odds: 1.4, book }),
      row('MINUTE_1X2', 'AWAY', { line: minute, odds: 6, book }),
    ];
    const picks = newMarketPicksOf({
      rows: [
        ...triplet(10, 'Bet365'),
        ...triplet(30, 'Marathonbet'),
        ...triplet(30, 'Betano'),
        ...triplet(30, 'Bet365'),
        ...triplet(60, 'Betano'),
        ...triplet(60, 'Marathonbet'),
      ],
      playerNames: new Map(),
      settle: BEFORE,
    });
    expect(keys(picks)).toEqual([
      'MINUTE_1X2/HOME/30',
      'MINUTE_1X2/DRAW/30',
      'MINUTE_1X2/AWAY/30',
    ]);
  });

  it('scorers: the most likely players at Bet365, a player we cannot name left out', () => {
    const rows = [
      row('GOAL_SCORER_ANYTIME', 'P1', { odds: 2.1, book: 'Bet365' }),
      row('GOAL_SCORER_ANYTIME', 'P2', { odds: 3.5, book: 'Bet365' }),
      row('GOAL_SCORER_ANYTIME', 'P3', { odds: 1.9, book: 'Bet365' }),
      row('GOAL_SCORER_ANYTIME', 'P4', { odds: 2.8, book: 'Bet365' }),
      row('GOAL_SCORER_ANYTIME', 'P5', { odds: 1.5, book: 'Bet365' }),
      row('GOAL_SCORER_FIRST', 'NONE', { odds: 9, book: 'Bet365' }),
      row('GOAL_SCORER_FIRST', 'P1', { odds: 5, book: 'Bet365' }),
    ];
    expect(pricedPlayerIds(rows)).toEqual([1, 2, 3, 4, 5]);
    const picks = newMarketPicksOf({
      rows,
      playerNames: new Map([
        [1, 'Bukayo Saka'],
        [2, 'Kai Havertz'],
        [3, 'Viktor Gyökeres'],
        [4, 'Martin Ødegaard'],
      ]),
      settle: BEFORE,
    });
    expect(picks.map((p) => `${p.market}/${p.player}/${p.odds}`)).toEqual([
      'GOAL_SCORER_ANYTIME/Viktor Gyökeres/1.9',
      'GOAL_SCORER_ANYTIME/Bukayo Saka/2.1',
      'GOAL_SCORER_ANYTIME/Martin Ødegaard/2.8',
      'GOAL_SCORER_FIRST/Bukayo Saka/5',
    ]);
    expect(picks.every((p) => p.chance === null)).toBe(true);
  });

  it('player shots: each player’s line nearest an even chance, the nearest two', () => {
    const picks = newMarketPicksOf({
      rows: [
        row('PLAYER_SHOTS', 'P1', { line: 1, odds: 1.2, book: 'Bet365' }),
        row('PLAYER_SHOTS', 'P1', { line: 2, odds: 2.0, book: 'Bet365' }),
        row('PLAYER_SHOTS', 'P1', { line: 3, odds: 3.6, book: 'Bet365' }),
        row('PLAYER_SHOTS', 'P2', { line: 1, odds: 1.7, book: 'Bet365' }),
        row('PLAYER_SHOTS', 'P3', { line: 1, odds: 3.0, book: 'Bet365' }),
      ],
      playerNames: new Map([
        [1, 'Saka'],
        [2, 'Rice'],
        [3, 'Saliba'],
      ]),
      settle: BEFORE,
    });
    expect(picks.map((p) => `${p.player}/${p.line}`)).toEqual([
      'Saka/2',
      'Rice/1',
    ]);
  });
});

describe('resultOf (after the match)', () => {
  const finished = (f: MatchFacts | null) => ({ finished: true, facts: f });

  it('total corners on both teams’ counts, never rounded', () => {
    expect(
      resultOf({
        market: 'CORNERS',
        row: { pick: 'OVER', line: 9.5 },
        settle: finished(facts()),
      }),
    ).toBe('won');
    expect(
      resultOf({
        market: 'CORNERS',
        row: { pick: 'UNDER', line: 9.5 },
        settle: finished(facts()),
      }),
    ).toBe('lost');
    // A met integer line is refunded.
    expect(
      resultOf({
        market: 'CORNERS',
        row: { pick: 'OVER', line: 10 },
        settle: finished(facts()),
      }),
    ).toBe('void');
  });

  it('unknown is not lost: corners not reported, no facts, cards', () => {
    const noCorners = facts({
      teams: {
        home: {
          corners: null,
          shotsTotal: null,
          shotsOn: null,
          yellowCards: null,
          redCards: null,
        },
        away: {
          corners: 4,
          shotsTotal: null,
          shotsOn: null,
          yellowCards: null,
          redCards: null,
        },
      },
    });
    expect(
      resultOf({
        market: 'CORNERS',
        row: { pick: 'OVER', line: 9.5 },
        settle: finished(noCorners),
      }),
    ).toBeNull();
    expect(
      resultOf({
        market: 'CORNERS_1X2',
        row: { pick: 'HOME', line: null },
        settle: finished(null),
      }),
    ).toBeNull();
    // Cards not reported: unsettled, never ✗.
    expect(
      resultOf({
        market: 'CARDS',
        row: { pick: 'UNDER', line: 4.5 },
        settle: finished(facts()),
      }),
    ).toBeNull();
  });

  it('cards on the statistics, unknown when the two counts of a red disagree', () => {
    // Chelsea – Manchester United, 31/10: 1 + 4 yellows, one red: 6 or 7.
    const carded = finished(
      facts({
        teams: {
          home: {
            corners: 6,
            shotsTotal: 12,
            shotsOn: 5,
            yellowCards: 1,
            redCards: 0,
          },
          away: {
            corners: 4,
            shotsTotal: 8,
            shotsOn: 2,
            yellowCards: 4,
            redCards: 1,
          },
        },
      }),
    );
    const cards = (pick: string, line: number) =>
      resultOf({ market: 'CARDS', row: { pick, line }, settle: carded });
    expect(cards('OVER', 4.5)).toBe('won');
    expect(cards('UNDER', 5.5)).toBe('lost');
    expect(cards('OVER', 6.5)).toBeNull();
  });

  it('the phase 3 resolvers settle corners 1X2, scorers and the minute', () => {
    const settle = finished(facts());
    expect(
      resultOf({
        market: 'CORNERS_1X2',
        row: { pick: 'HOME', line: null },
        settle,
      }),
    ).toBe('won');
    expect(
      resultOf({
        market: 'GOAL_SCORER_ANYTIME',
        row: { pick: 'P9', line: null },
        settle,
      }),
    ).toBe('won');
    expect(
      resultOf({
        market: 'GOAL_SCORER_ANYTIME',
        row: { pick: 'P20', line: null },
        settle,
      }),
    ).toBe('lost');
    // Not in either lineup: did not play, refunded.
    expect(
      resultOf({
        market: 'GOAL_SCORER_FIRST',
        row: { pick: 'P77', line: null },
        settle,
      }),
    ).toBe('void');
    expect(
      resultOf({
        market: 'MINUTE_1X2',
        row: { pick: 'DRAW', line: 15 },
        settle,
      }),
    ).toBe('won');
    // Player statistics not reported: unknown.
    expect(
      resultOf({
        market: 'PLAYER_SHOTS',
        row: { pick: 'P9', line: 1 },
        settle,
      }),
    ).toBeNull();
  });

  it('before the end, nothing', () => {
    expect(
      resultOf({
        market: 'CORNERS_1X2',
        row: { pick: 'HOME', line: null },
        settle: { finished: false, facts: facts() },
      }),
    ).toBeNull();
  });
});
