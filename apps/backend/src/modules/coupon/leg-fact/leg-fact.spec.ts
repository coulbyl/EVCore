import { describe, expect, it } from 'vitest';
import { legFact, type FactTeam, type PastMatch } from './leg-fact';

/** A match at the venue, `goalsFor`-`goalsAgainst`, most recent first. */
function m(
  score: string,
  extra: Partial<PastMatch> & { away?: boolean } = {},
): PastMatch {
  const [goalsFor, goalsAgainst] = score.split('-').map(Number);
  return {
    atHome: !extra.away,
    goalsFor: goalsFor ?? 0,
    goalsAgainst: goalsAgainst ?? 0,
    halfTimeFor: extra.halfTimeFor ?? null,
    halfTimeAgainst: extra.halfTimeAgainst ?? null,
    corners: extra.corners ?? null,
  };
}

const repeat = <T>(count: number, value: T): T[] =>
  Array.from({ length: count }, () => value);

function team(
  name: string,
  history: PastMatch[],
  shortName = name.slice(0, 3).toUpperCase(),
): FactTeam {
  return { name, shortName, history };
}

const PSG = (history: PastMatch[]) => team('PSG', history);
const LENS = (history: PastMatch[]) => team('Lens', history);

describe('legFact', () => {
  it('a home win speaks of the home side at home: a run first', () => {
    const fact = legFact({
      market: 'ONE_X_TWO',
      pick: 'HOME',
      line: null,
      // Away matches do not count for a home fact.
      home: PSG([...repeat(9, m('2-0')), m('0-0'), m('0-3', { away: true })]),
      away: LENS([]),
    });
    expect(fact).toBe('PSG a gagné ses 9 derniers matchs à domicile');
  });

  it('a share when there is no run of five', () => {
    const fact = legFact({
      market: 'DRAW_NO_BET',
      pick: 'AWAY',
      line: null,
      home: PSG([]),
      away: LENS([
        m('1-0', { away: true }),
        m('0-1', { away: true }),
        ...repeat(7, m('2-1', { away: true })),
        m('1-1', { away: true }),
      ]),
    });
    expect(fact).toBe("Lens a gagné 8 de ses 10 derniers matchs à l'extérieur");
  });

  it('nothing solid, nothing written', () => {
    const coinFlip = [
      m('1-0'),
      m('0-1'),
      m('1-0'),
      m('0-1'),
      m('1-0'),
      m('0-1'),
    ];
    expect(
      legFact({
        market: 'ONE_X_TWO',
        pick: 'HOME',
        line: null,
        home: PSG(coinFlip),
        away: LENS([]),
      }),
    ).toBe('');
    // Five wins in five, but a share needs six matches and a run five:
    // four is neither.
    expect(
      legFact({
        market: 'ONE_X_TWO',
        pick: 'HOME',
        line: null,
        home: PSG(repeat(4, m('1-0'))),
        away: LENS([]),
      }),
    ).toBe('');
  });

  it('a draw has a lower floor, and the stronger side is quoted', () => {
    const fact = legFact({
      market: 'ONE_X_TWO',
      pick: 'DRAW',
      line: null,
      home: team('Lazio', [
        m('1-1'),
        m('0-0'),
        m('2-2'),
        m('1-0'),
        m('0-2'),
        m('3-1'),
        m('1-0'),
        m('2-0'),
      ]),
      away: team('Torino', [
        m('1-1', { away: true }),
        m('0-0', { away: true }),
        m('2-2', { away: true }),
        m('1-1', { away: true }),
        m('0-1', { away: true }),
        m('2-1', { away: true }),
      ]),
    });
    expect(fact).toBe(
      "Torino : 4 nuls sur ses 6 derniers matchs à l'extérieur",
    );
  });

  it('double chance 1X is unbeaten, 12 is no draw', () => {
    const unbeaten = repeat(6, m('1-1'));
    expect(
      legFact({
        market: 'DOUBLE_CHANCE',
        pick: '1X',
        line: null,
        home: PSG(unbeaten),
        away: LENS([]),
      }),
    ).toBe('PSG est invaincu sur ses 6 derniers matchs à domicile');
    expect(
      legFact({
        market: 'DOUBLE_CHANCE',
        pick: '12',
        line: null,
        home: PSG(repeat(7, m('2-1'))),
        away: LENS([]),
      }),
    ).toBe('Aucun nul dans les 7 derniers matchs de PSG à domicile');
  });

  it('totals are said in whole goals, the line read from the pick', () => {
    const fact = legFact({
      market: 'OVER_UNDER',
      pick: 'OVER_2_5',
      line: null,
      home: PSG([
        m('3-1'),
        m('2-0'),
        m('4-1'),
        m('2-2'),
        m('1-0'),
        m('3-0'),
        m('2-1'),
        m('3-3'),
      ]),
      away: LENS([]),
    });
    expect(fact).toBe(
      'Au moins 3 buts dans 6 des 8 derniers de PSG à domicile',
    );
    expect(
      legFact({
        market: 'OVER_UNDER',
        pick: 'UNDER_3_5',
        line: null,
        home: PSG(repeat(6, m('1-1'))),
        away: LENS([]),
      }),
    ).toBe('Au plus 3 buts lors des 6 derniers matchs de PSG à domicile');
  });

  it('the line column wins when the market carries it', () => {
    const fact = legFact({
      market: 'OVER_UNDER',
      pick: 'OVER',
      line: 1.5,
      home: PSG(repeat(6, m('1-1'))),
      away: LENS([]),
    });
    expect(fact).toBe(
      'Au moins 2 buts lors des 6 derniers matchs de PSG à domicile',
    );
  });

  it("a team total speaks of that team's goals at its venue", () => {
    expect(
      legFact({
        market: 'TEAM_TOTAL_HOME',
        pick: 'OVER_0_5',
        line: null,
        home: PSG(repeat(12, m('1-1'))),
        away: LENS([]),
      }),
    ).toBe('PSG a marqué lors de ses 10 derniers matchs à domicile');
    expect(
      legFact({
        market: 'TEAM_TOTAL_AWAY',
        pick: 'UNDER_1_5',
        line: null,
        home: PSG([]),
        away: LENS(repeat(6, m('1-2', { away: true }))),
      }),
    ).toBe("Lens : au plus 1 but sur ses 6 derniers à l'extérieur");
    expect(
      legFact({
        market: 'TEAM_TOTAL_AWAY',
        pick: 'UNDER_0_5',
        line: null,
        home: PSG([]),
        away: LENS(repeat(6, m('0-2', { away: true }))),
      }),
    ).toBe("Lens n'a pas marqué lors de ses 6 derniers à l'extérieur");
  });

  it('half time: a draw at the break, or a lead', () => {
    const level = repeat(5, m('1-1', { halfTimeFor: 0, halfTimeAgainst: 0 }));
    expect(
      legFact({
        market: 'FIRST_HALF_WINNER',
        pick: 'DRAW',
        line: null,
        home: PSG(level),
        away: LENS([]),
      }),
    ).toBe('Nul à la pause dans les 5 derniers matchs de PSG à domicile');
    // Matches without a half-time score are skipped, not counted as misses.
    const lead = [
      ...repeat(5, m('2-0', { halfTimeFor: 1, halfTimeAgainst: 0 })),
      m('1-0'),
    ];
    expect(
      legFact({
        market: 'FIRST_HALF_WINNER',
        pick: 'HOME',
        line: null,
        home: PSG(lead),
        away: LENS([]),
      }),
    ).toBe('PSG menait à la pause lors de ses 5 derniers à domicile');
  });

  it('both teams to score, and its opposite', () => {
    expect(
      legFact({
        market: 'BTTS',
        pick: 'YES',
        line: null,
        home: PSG(repeat(6, m('2-1'))),
        away: LENS([]),
      }),
    ).toBe('Les deux ont marqué lors des 6 derniers de PSG à domicile');
    expect(
      legFact({
        market: 'BTTS',
        pick: 'NO',
        line: null,
        home: PSG(repeat(6, m('2-0'))),
        away: LENS([]),
      }),
    ).toBe('Un camp muet lors des 6 derniers matchs de PSG à domicile');
  });

  it('corners need the statistic; a match without it is skipped', () => {
    const history = [
      ...repeat(5, m('1-0', { corners: 11 })),
      m('1-0'),
      m('1-0', { corners: 6 }),
    ];
    expect(
      legFact({
        market: 'CORNERS',
        pick: 'OVER',
        line: 9.5,
        home: PSG(history),
        away: LENS([]),
      }),
    ).toBe('Au moins 10 corners lors des 5 derniers de PSG à domicile');
  });

  it('falls back to the short name, then to nothing, past 60 characters', () => {
    const long = 'Brighton and Hove Albion Football Club';
    expect(
      legFact({
        market: 'ONE_X_TWO',
        pick: 'HOME',
        line: null,
        home: team(long, repeat(6, m('1-0')), 'Brighton'),
        away: LENS([]),
      }),
    ).toBe('Brighton a gagné ses 6 derniers matchs à domicile');
    expect(
      legFact({
        market: 'ONE_X_TWO',
        pick: 'HOME',
        line: null,
        home: team(long, repeat(6, m('1-0')), long),
        away: LENS([]),
      }),
    ).toBe('');
  });

  it('every sentence fits the screen line', () => {
    const name = 'Borussia Mönchengladbach';
    const history = repeat(
      10,
      m('3-1', { halfTimeFor: 1, halfTimeAgainst: 0, corners: 12 }),
    );
    // [market, pick, line, a sentence fits even with this name]
    const cases: [string, string, number | null, boolean][] = [
      ['ONE_X_TWO', 'HOME', null, true],
      ['DOUBLE_CHANCE', '1X', null, true],
      ['DOUBLE_CHANCE', '12', null, true],
      ['OVER_UNDER', 'OVER_2_5', null, true],
      ['TEAM_TOTAL_HOME', 'OVER_1_5', null, true],
      // « Les deux ont marqué… » runs past 60 with a ten-letter short
      // name: nothing rather than a cut sentence.
      ['BTTS', 'YES', null, false],
      ['FIRST_HALF_WINNER', 'HOME', null, true],
      // Same for « au moins 10 corners » over ten matches.
      ['CORNERS', 'OVER', 9.5, false],
    ];
    for (const [market, pick, line, fits] of cases) {
      const fact = legFact({
        market,
        pick,
        line,
        home: team(name, history, "M'gladbach"),
        away: LENS([]),
      });
      expect(fact.length, `${market} ${pick}: ${fact}`).toBeLessThanOrEqual(60);
      expect(fact !== '', `${market} ${pick}: ${fact}`).toBe(fits);
    }
  });

  it("elides « de » before a vowel: « d'Austin »", () => {
    expect(
      legFact({
        market: 'BTTS',
        pick: 'YES',
        line: null,
        home: team('Austin', repeat(6, m('2-1'))),
        away: LENS([]),
      }),
    ).toBe("Les deux ont marqué lors des 6 derniers d'Austin à domicile");
  });

  it('a market without a rule writes nothing', () => {
    expect(
      legFact({
        market: 'CORRECT_SCORE',
        pick: '1:1',
        line: null,
        home: PSG(repeat(10, m('1-1'))),
        away: LENS([]),
      }),
    ).toBe('');
  });
});
