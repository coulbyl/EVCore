import { describe, expect, it } from 'vitest';
import { ApiFootballOddsResponseSchema } from '../schemas/odds.schema';
import {
  extractNewMarketOdds,
  inspectNewMarkets,
  parseCornersTeam,
  parsePlayerMarket,
  splitPlayerLine,
  type FixtureSquads,
} from './odds-new-markets';

// Labels and prices of the real answer of 03/11 (/odds?fixture=1635695,
// Manchester United – Roma), trimmed to a few values per bet.
const bet = (id: number, values: Array<[string, string]>) => ({
  id,
  name: `bet ${id}`,
  values: values.map(([value, odd]) => ({ value, odd })),
});
// A bet as the schema hands it over (odds as numbers).
const parsedBet = (id: number, values: Array<[string, string]>) => ({
  id,
  name: `bet ${id}`,
  values: values.map(([value, odd]) => ({ value, odd: Number(odd) })),
});
const ANSWER = {
  response: [
    {
      fixture: { id: 1635695 },
      update: '2026-11-03T12:16:17+00:00',
      bookmakers: [
        {
          id: 11,
          name: '1xBet',
          bets: [
            bet(55, [
              ['Home', '1.80'],
              ['Draw', '9.40'],
              ['Away', '2.36'],
            ]),
            bet(57, [
              ['Over 4.5', '1.75'],
              ['Under 4.5', '2.05'],
              ['Over 4.0', '1.45'],
              ['Under 4.0', '2.75'],
            ]),
            bet(58, [
              ['Over 3.5', '1.52'],
              ['Under 3.5', '2.50'],
            ]),
          ],
        },
        {
          id: 4,
          name: 'Pinnacle',
          bets: [
            bet(57, [
              ['Over 4.5', '1.83'],
              ['Under 4.5', '1.98'],
            ]),
          ],
        },
        {
          id: 3,
          name: 'Betfair',
          bets: [bet(55, [['Home', '1.83']])],
        },
        {
          id: 8,
          name: 'Bet365',
          bets: [
            bet(54, [
              ['Home', '6.50'],
              ['Draw', '1.20'],
              ['Away', '8.00'],
            ]),
            bet(57, [['Over 4.5', '1.83']]),
            bet(92, [
              ['Jaydan Kamason', '9.50'],
              ["Evan N'Dicka", '8.00'],
              ['Lorenzo Paratici', '11.00'],
            ]),
            bet(93, [
              ['Jaydan Kamason', '29.00'],
              ['No Goalscorer', '13.00'],
            ]),
            bet(240, [
              ['Matheus Cunha - 1', '1.22'],
              ['Matheus Cunha - 2', '2.10'],
              ['Matheus Cunha - 4', '9.00'],
            ]),
            bet(241, [['Leonardo Balerdi - 1', '1.73']]),
            bet(269, [['Matheus Cunha - 1', '3.25']]),
            // Names alone under the away shots on target id: rejected.
            bet(275, [['Jaydan Kamason', '41.00']]),
          ],
        },
        {
          id: 2,
          name: 'Marathonbet',
          bets: [
            bet(136, [
              ['Home', '4.65'],
              ['Draw', '1.33'],
              ['Away', '6.10'],
            ]),
            bet(138, [['Draw', '2.23']]),
          ],
        },
      ],
    },
  ],
};

const SQUADS: FixtureSquads = {
  home: [
    { playerExternalId: 1, names: ['Matheus Cunha'] },
    { playerExternalId: 2, names: ['J. Kamason'] },
  ],
  away: [
    { playerExternalId: 3, names: ['E. Ndicka'] },
    { playerExternalId: 4, names: ['L. Balerdi'] },
  ],
};

const books =
  ApiFootballOddsResponseSchema.parse(ANSWER).response[0].bookmakers;
const extract = (
  bookmakerName: string,
  squads: FixtureSquads | null = SQUADS,
) => extractNewMarketOdds({ bookmakers: books, bookmakerName, squads });
const marketOf = (
  result: ReturnType<typeof extract>,
  market: string,
): unknown[] =>
  [...result.lineMarkets, ...result.fixedMarkets].find(
    (entry) => entry.market === market,
  )?.legs ?? [];

describe('new markets — corners', () => {
  it('keeps the .5 team lines and the corners 1X2 at 1xBet', () => {
    const result = extract('1xBet');
    expect(marketOf(result, 'CORNERS_HOME')).toEqual([
      { pick: 'OVER', line: 4.5, odds: 1.75 },
      { pick: 'UNDER', line: 4.5, odds: 2.05 },
    ]);
    expect(marketOf(result, 'CORNERS_AWAY')).toHaveLength(2);
    expect(marketOf(result, 'CORNERS_1X2')).toEqual([
      { pick: 'HOME', odds: 1.8 },
      { pick: 'DRAW', odds: 9.4 },
      { pick: 'AWAY', odds: 2.36 },
    ]);
  });

  it('keeps Pinnacle, and nothing at a book outside the list', () => {
    expect(marketOf(extract('Pinnacle'), 'CORNERS_HOME')).toHaveLength(2);
    expect(marketOf(extract('Bet365'), 'CORNERS_HOME')).toEqual([]);
    const betfair = extract('Betfair');
    expect([...betfair.lineMarkets, ...betfair.fixedMarkets]).toEqual([]);
  });

  it('never keeps an integer line, which refunds on a tie', () => {
    expect(
      parseCornersTeam(
        parsedBet(57, [
          ['Over 4.0', '1.45'],
          ['Over 4.5', '1.75'],
        ]),
      ),
    ).toEqual([{ pick: 'OVER', line: 4.5, odds: 1.75 }]);
  });
});

describe('new markets — minute 1X2', () => {
  it('carries the minute as the line, from the bet id', () => {
    expect(marketOf(extract('Marathonbet'), 'MINUTE_1X2')).toEqual([
      { pick: 'HOME', line: 15, odds: 4.65 },
      { pick: 'DRAW', line: 15, odds: 1.33 },
      { pick: 'AWAY', line: 15, odds: 6.1 },
      { pick: 'DRAW', line: 75, odds: 2.23 },
    ]);
    expect(marketOf(extract('Bet365'), 'MINUTE_1X2')).toEqual([
      { pick: 'HOME', line: 10, odds: 6.5 },
      { pick: 'DRAW', line: 10, odds: 1.2 },
      { pick: 'AWAY', line: 10, odds: 8 },
    ]);
  });
});

describe('new markets — players at Bet365', () => {
  it('stores matched scorers as P<id>, No Goalscorer as NONE, never an unmatched name', () => {
    const result = extract('Bet365');
    expect(marketOf(result, 'GOAL_SCORER_ANYTIME')).toEqual([
      { pick: 'P2', odds: 9.5 },
      { pick: 'P3', odds: 8 },
    ]);
    expect(marketOf(result, 'GOAL_SCORER_FIRST')).toEqual([
      { pick: 'P2', odds: 29 },
      { pick: 'NONE', odds: 13 },
    ]);
    expect(result.players.unmatched).toEqual(['Lorenzo Paratici']);
  });

  it('player shots: line = minimum count, up to 3, each side against its squad', () => {
    const result = extract('Bet365');
    expect(marketOf(result, 'PLAYER_SHOTS')).toEqual([
      { pick: 'P1', line: 1, odds: 1.22 },
      { pick: 'P1', line: 2, odds: 2.1 },
      { pick: 'P4', line: 1, odds: 1.73 },
    ]);
    // 275 carried names alone: nothing stored.
    expect(marketOf(result, 'PLAYER_SHOTS_ON_TARGET')).toEqual([
      { pick: 'P1', line: 1, odds: 3.25 },
    ]);
  });

  it('counts priced, matched and unmatched names per market', () => {
    expect(extract('Bet365').players).toEqual({
      priced: 7,
      matched: 6,
      ambiguous: 0,
      unmatched: ['Lorenzo Paratici'],
    });
  });

  it('without squads, no player market is stored', () => {
    const result = extract('Bet365', null);
    expect(marketOf(result, 'GOAL_SCORER_ANYTIME')).toEqual([]);
    expect(marketOf(result, 'PLAYER_SHOTS')).toEqual([]);
    expect(marketOf(result, 'MINUTE_1X2')).toHaveLength(3);
  });

  it('two names on the same player and line are both dropped', () => {
    const parsed = parsePlayerMarket({
      bet: parsedBet(92, [
        ['Jaydan Kamason', '9.50'],
        ['J. Kamason', '9.00'],
      ]),
      squad: SQUADS.home,
      withLine: false,
    });
    expect(parsed.legs).toEqual([]);
  });

  it('an ambiguous name is counted and not stored', () => {
    const parsed = parsePlayerMarket({
      bet: parsedBet(92, [['Tyler Fletcher', '9.50']]),
      squad: [
        { playerExternalId: 10, names: ['T. Fletcher'] },
        { playerExternalId: 11, names: ['T. Fletcher'] },
      ],
      withLine: false,
    });
    expect(parsed.legs).toEqual([]);
    expect(parsed.tally).toMatchObject({ priced: 1, ambiguous: 1 });
  });

  it('splits « Name - N », hyphenated names included', () => {
    expect(splitPlayerLine('Brandon Thomas-Asante - 2')).toEqual({
      name: 'Brandon Thomas-Asante',
      line: 2,
    });
    expect(splitPlayerLine('Caleb Yirenkyi')).toBeNull();
    expect(splitPlayerLine('X - 0')).toBeNull();
  });
});

describe('inspectNewMarkets', () => {
  it('tells an absent market from a rejected label', () => {
    const diagnostics = inspectNewMarkets(books);
    const at = (market: string, bookmaker: string) =>
      diagnostics.find((d) => d.market === market && d.bookmaker === bookmaker);
    expect(at('CORNERS_1X2', 'Pinnacle')).toMatchObject({ rawValues: 0 });
    expect(at('PLAYER_SHOTS_ON_TARGET', 'Bet365')).toEqual({
      market: 'PLAYER_SHOTS_ON_TARGET',
      bookmaker: 'Bet365',
      rawValues: 2,
      parsedValues: 1,
      rejectedLabels: ['Jaydan Kamason'],
    });
    expect(at('CORNERS_HOME', '1xBet')).toMatchObject({
      rawValues: 4,
      parsedValues: 4,
    });
  });
});
