import {
  matchPlayerName,
  NO_GOALSCORER_PICK,
  playerPick,
  type SquadCandidate,
} from '@evcore/analysis-core';
import {
  API_FOOTBALL_BET_IDS,
  MARKET_BOOKMAKERS,
  PLAYER_SHOTS_MAX_LINE,
  type BookScopedMarket,
} from '@config/etl.constants';
import type { OddsBookmaker } from '../schemas/odds.schema';

// The markets of phase 3 of the strategies plan (03/11): team corners,
// corners 1X2, scorers, player shots, 1X2 at a given minute. Pure parsers
// over one bookmaker's bets; the worker decides where they are kept
// (MARKET_BOOKMAKERS).

type Bet = OddsBookmaker['bets'][number];

export type NewLineMarket =
  | 'CORNERS_HOME'
  | 'CORNERS_AWAY'
  | 'PLAYER_SHOTS'
  | 'PLAYER_SHOTS_ON_TARGET'
  | 'MINUTE_1X2';

export type NewFixedMarket =
  | 'CORNERS_1X2'
  | 'GOAL_SCORER_ANYTIME'
  | 'GOAL_SCORER_FIRST';

export type NewLineLeg = { pick: string; line: number; odds: number };
export type NewFixedLeg = { pick: string; odds: number };

/** The two squads of a fixture, for the player markets. */
export type FixtureSquads = {
  home: readonly SquadCandidate[];
  away: readonly SquadCandidate[];
};

/** Priced players of one book and one fixture, and what became of them. */
export type PlayerMatchTally = {
  priced: number;
  matched: number;
  ambiguous: number;
  unmatched: string[];
};

const RESULT_PICKS: Readonly<Record<string, string>> = {
  home: 'HOME',
  draw: 'DRAW',
  away: 'AWAY',
};

/** Bet id → minute of the 1X2 it prices. */
export const MINUTE_1X2_BETS: ReadonlyArray<readonly [number, number]> = [
  [API_FOOTBALL_BET_IDS.MINUTE_1X2_10, 10],
  [API_FOOTBALL_BET_IDS.MINUTE_1X2_15, 15],
  [API_FOOTBALL_BET_IDS.MINUTE_1X2_30, 30],
  [API_FOOTBALL_BET_IDS.MINUTE_1X2_60, 60],
  [API_FOOTBALL_BET_IDS.MINUTE_1X2_75, 75],
];

const playable = (odd: number): boolean => Number.isFinite(odd) && odd > 1;

/** « Over 4.5 » / « Under 4.5 »: the .5 lines only (an integer line refunds). */
export function parseCornersTeam(bet: Bet | undefined): NewLineLeg[] {
  if (!bet) return [];
  const legs: NewLineLeg[] = [];
  for (const value of bet.values) {
    const matched = /^(Over|Under)\s*(\d+(?:\.\d+)?)$/i.exec(
      String(value.value).trim(),
    );
    if (!matched?.[1] || matched[2] === undefined) continue;
    const line = Number(matched[2]);
    if (!Number.isFinite(line) || line % 1 !== 0.5) continue;
    if (!playable(value.odd)) continue;
    legs.push({ pick: matched[1].toUpperCase(), line, odds: value.odd });
  }
  return legs;
}

/** « Home » / « Draw » / « Away ». */
export function parseCorners1x2(bet: Bet | undefined): NewFixedLeg[] {
  return parseResult(bet);
}

/** « Home » / « Draw » / « Away » of a minute bet, the minute as `line`. */
export function parseMinute1x2(
  bet: Bet | undefined,
  minute: number,
): NewLineLeg[] {
  return parseResult(bet).map((leg) => ({ ...leg, line: minute }));
}

function parseResult(bet: Bet | undefined): NewFixedLeg[] {
  if (!bet) return [];
  const legs: NewFixedLeg[] = [];
  for (const value of bet.values) {
    const pick = RESULT_PICKS[String(value.value).trim().toLowerCase()];
    if (!pick || !playable(value.odd)) continue;
    legs.push({ pick, odds: value.odd });
  }
  return legs;
}

/** « Matheus Cunha - 2 » → name and minimum count; anything else, null. */
export function splitPlayerLine(
  label: string,
): { name: string; line: number } | null {
  const matched = /^(.*\S)\s+-\s+(\d+)$/.exec(label.trim());
  if (!matched?.[1] || matched[2] === undefined) return null;
  const line = Number(matched[2]);
  return line >= 1 ? { name: matched[1], line } : null;
}

/**
 * A player market: each name matched against the squad, the pick the
 * player's `P<externalId>`. An unmatched or ambiguous name is not stored (a
 * wrong id would settle another player's bet), nor are two names that land
 * on the same player and line. `withLine`: « Name - N » (shots); without,
 * a name alone (scorers), « No Goalscorer » → NONE when `noScorer`.
 */
export function parsePlayerMarket(input: {
  bet: Bet | undefined;
  squad: readonly SquadCandidate[];
  withLine: boolean;
  noScorer?: boolean;
}): { legs: NewLineLeg[]; tally: PlayerMatchTally } {
  const tally: PlayerMatchTally = {
    priced: 0,
    matched: 0,
    ambiguous: 0,
    unmatched: [],
  };
  if (!input.bet) return { legs: [], tally };

  const byKey = new Map<string, NewLineLeg[]>();
  const names = new Map<string, 'matched' | 'ambiguous' | 'unmatched'>();
  for (const value of input.bet.values) {
    if (!playable(value.odd)) continue;
    const label = String(value.value).trim();
    if (input.noScorer && label.toLowerCase() === 'no goalscorer') {
      push(byKey, { pick: NO_GOALSCORER_PICK, line: 0, odds: value.odd });
      continue;
    }
    const parsed = input.withLine
      ? splitPlayerLine(label)
      : { name: label, line: 0 };
    if (parsed === null) continue;
    const match = matchPlayerName(parsed.name, input.squad);
    names.set(parsed.name, match.status);
    if (match.status !== 'matched') continue;
    push(byKey, {
      pick: playerPick(match.playerExternalId),
      line: parsed.line,
      odds: value.odd,
    });
  }

  for (const status of names.values()) {
    tally.priced++;
    if (status === 'matched') tally.matched++;
    if (status === 'ambiguous') tally.ambiguous++;
  }
  tally.unmatched = [...names.entries()]
    .filter(([, status]) => status === 'unmatched')
    .map(([name]) => name);

  const legs = [...byKey.values()].filter((group) => group.length === 1).flat();
  return { legs, tally };
}

function push(byKey: Map<string, NewLineLeg[]>, leg: NewLineLeg): void {
  const key = `${leg.pick}|${leg.line}`;
  byKey.set(key, [...(byKey.get(key) ?? []), leg]);
}

const keptAt = (market: BookScopedMarket, bookmaker: string): boolean =>
  (MARKET_BOOKMAKERS[market] as readonly string[]).includes(bookmaker);

/**
 * The new markets of one book, restricted to the markets MARKET_BOOKMAKERS
 * keeps there. Without squads, the player markets give nothing (their
 * players could not be identified).
 */
export function extractNewMarketOdds(input: {
  bookmakers: OddsBookmaker[];
  bookmakerName: string;
  squads: FixtureSquads | null;
}): {
  lineMarkets: Array<{ market: NewLineMarket; legs: NewLineLeg[] }>;
  fixedMarkets: Array<{ market: NewFixedMarket; legs: NewFixedLeg[] }>;
  players: PlayerMatchTally;
} {
  const players: PlayerMatchTally = {
    priced: 0,
    matched: 0,
    ambiguous: 0,
    unmatched: [],
  };
  const book = input.bookmakers.find((b) => b.name === input.bookmakerName);
  if (!book) return { lineMarkets: [], fixedMarkets: [], players };
  const betById = (id: number) => book.bets.find((b) => b.id === id);
  const kept = (market: BookScopedMarket) => keptAt(market, book.name);

  const lineMarkets: Array<{ market: NewLineMarket; legs: NewLineLeg[] }> = [];
  const fixedMarkets: Array<{ market: NewFixedMarket; legs: NewFixedLeg[] }> =
    [];
  const addLine = (market: NewLineMarket, legs: NewLineLeg[]) => {
    if (legs.length > 0) lineMarkets.push({ market, legs });
  };
  const addFixed = (market: NewFixedMarket, legs: NewFixedLeg[]) => {
    if (legs.length > 0) fixedMarkets.push({ market, legs });
  };
  const count = (tally: PlayerMatchTally) => {
    players.priced += tally.priced;
    players.matched += tally.matched;
    players.ambiguous += tally.ambiguous;
    players.unmatched.push(...tally.unmatched);
  };

  if (kept('CORNERS_HOME')) {
    addLine(
      'CORNERS_HOME',
      parseCornersTeam(betById(API_FOOTBALL_BET_IDS.CORNERS_HOME)),
    );
  }
  if (kept('CORNERS_AWAY')) {
    addLine(
      'CORNERS_AWAY',
      parseCornersTeam(betById(API_FOOTBALL_BET_IDS.CORNERS_AWAY)),
    );
  }
  if (kept('CORNERS_1X2')) {
    addFixed(
      'CORNERS_1X2',
      parseCorners1x2(betById(API_FOOTBALL_BET_IDS.CORNERS_1X2)),
    );
  }
  if (kept('MINUTE_1X2')) {
    addLine(
      'MINUTE_1X2',
      MINUTE_1X2_BETS.flatMap(([id, minute]) =>
        parseMinute1x2(betById(id), minute),
      ),
    );
  }

  const squads = input.squads;
  if (squads !== null) {
    const both = [...squads.home, ...squads.away];
    const scorers = (
      market: 'GOAL_SCORER_ANYTIME' | 'GOAL_SCORER_FIRST',
      id: number,
    ) => {
      if (!kept(market)) return;
      const parsed = parsePlayerMarket({
        bet: betById(id),
        squad: both,
        withLine: false,
        noScorer: market === 'GOAL_SCORER_FIRST',
      });
      count(parsed.tally);
      addFixed(
        market,
        parsed.legs.map(({ pick, odds }) => ({ pick, odds })),
      );
    };
    scorers('GOAL_SCORER_ANYTIME', API_FOOTBALL_BET_IDS.GOAL_SCORER_ANYTIME);
    scorers('GOAL_SCORER_FIRST', API_FOOTBALL_BET_IDS.GOAL_SCORER_FIRST);

    const shots = (
      market: 'PLAYER_SHOTS' | 'PLAYER_SHOTS_ON_TARGET',
      ids: { home: number; away: number },
    ) => {
      if (!kept(market)) return;
      const legs = (['home', 'away'] as const).flatMap((side) => {
        const parsed = parsePlayerMarket({
          bet: betById(ids[side]),
          squad: squads[side],
          withLine: true,
        });
        count(parsed.tally);
        return parsed.legs.filter((leg) => leg.line <= PLAYER_SHOTS_MAX_LINE);
      });
      addLine(market, legs);
    };
    shots('PLAYER_SHOTS', {
      home: API_FOOTBALL_BET_IDS.PLAYER_SHOTS_HOME,
      away: API_FOOTBALL_BET_IDS.PLAYER_SHOTS_AWAY,
    });
    shots('PLAYER_SHOTS_ON_TARGET', {
      home: API_FOOTBALL_BET_IDS.PLAYER_SHOTS_ON_TARGET_HOME,
      away: API_FOOTBALL_BET_IDS.PLAYER_SHOTS_ON_TARGET_AWAY,
    });
  }

  return { lineMarkets, fixedMarkets, players };
}

/** A new market at one book it is kept at: what came, what was understood. */
export type NewMarketDiagnostic = {
  market: BookScopedMarket;
  bookmaker: string;
  rawValues: number;
  parsedValues: number;
  rejectedLabels: string[];
};

const NEW_MARKET_BETS: Readonly<Record<BookScopedMarket, readonly number[]>> = {
  CORNERS_HOME: [API_FOOTBALL_BET_IDS.CORNERS_HOME],
  CORNERS_AWAY: [API_FOOTBALL_BET_IDS.CORNERS_AWAY],
  CORNERS_1X2: [API_FOOTBALL_BET_IDS.CORNERS_1X2],
  GOAL_SCORER_ANYTIME: [API_FOOTBALL_BET_IDS.GOAL_SCORER_ANYTIME],
  GOAL_SCORER_FIRST: [API_FOOTBALL_BET_IDS.GOAL_SCORER_FIRST],
  PLAYER_SHOTS: [
    API_FOOTBALL_BET_IDS.PLAYER_SHOTS_HOME,
    API_FOOTBALL_BET_IDS.PLAYER_SHOTS_AWAY,
  ],
  PLAYER_SHOTS_ON_TARGET: [
    API_FOOTBALL_BET_IDS.PLAYER_SHOTS_ON_TARGET_HOME,
    API_FOOTBALL_BET_IDS.PLAYER_SHOTS_ON_TARGET_AWAY,
  ],
  MINUTE_1X2: MINUTE_1X2_BETS.map(([id]) => id),
};

/**
 * The label is understood (independently of the squads: a name the squads
 * miss is counted by the player tally, not here).
 */
function readsAs(market: BookScopedMarket, value: Bet['values'][number]) {
  const bet: Bet = { id: 0, name: market, values: [value] };
  switch (market) {
    case 'CORNERS_HOME':
    case 'CORNERS_AWAY':
      return /^(Over|Under)\s*\d+(?:\.\d+)?$/i.test(String(value.value).trim());
    case 'CORNERS_1X2':
    case 'MINUTE_1X2':
      return parseResult(bet).length === 1;
    case 'PLAYER_SHOTS':
    case 'PLAYER_SHOTS_ON_TARGET':
      return splitPlayerLine(String(value.value)) !== null;
    case 'GOAL_SCORER_ANYTIME':
    case 'GOAL_SCORER_FIRST':
      return String(value.value).trim().length > 0;
  }
}

/**
 * For each new market at each book that keeps it: absent at the book
 * (rawValues 0) or labels the parser rejected — the silent failures the
 * extended markets' coverage exists for.
 */
export function inspectNewMarkets(
  bookmakers: OddsBookmaker[],
): NewMarketDiagnostic[] {
  const diagnostics: NewMarketDiagnostic[] = [];
  for (const market of Object.keys(MARKET_BOOKMAKERS) as BookScopedMarket[]) {
    for (const bookmaker of MARKET_BOOKMAKERS[market]) {
      const book = bookmakers.find((b) => b.name === bookmaker);
      const values = NEW_MARKET_BETS[market].flatMap(
        (id) => book?.bets.find((bet) => bet.id === id)?.values ?? [],
      );
      const rejected = values.filter((value) => !readsAs(market, value));
      diagnostics.push({
        market,
        bookmaker,
        rawValues: values.length,
        parsedValues: values.length - rejected.length,
        rejectedLabels: rejected.map((value) => String(value.value)),
      });
    }
  }
  return diagnostics;
}
