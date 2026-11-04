import Decimal from 'decimal.js';
import {
  OPERATOR_BOOKMAKERS,
  playerIdOfPick,
  resolveStatMarketBetStatus,
  shinProbabilities,
  type MatchFacts,
} from '@evcore/analysis-core';
import {
  SHEET_NEW_MARKETS,
  SHEET_OTHER_BOOKMAKERS,
  SHEET_PRICES_LOOKBACK_DAYS,
  SHEET_PLAYER_SHOTS_SHOWN,
  SHEET_QUOTE_MAX_GAP_MINUTES,
  SHEET_SCORERS_SHOWN,
} from '@config/screens.constants';
import type { MarketPriceRow } from '@modules/betting-engine/pricing/playable-odds.repository';
import { DAY_MS } from '@utils/date.utils';
import type { SheetPick } from './match-sheet.types';
import { groupBy, resultOf as settledResultOf } from './matches-reading';

// « Autres paris », the markets ingested since 03/11 (decided 2026-11-04):
// a few readable lines per market, chosen on the prices of one book. The
// line nearest an even chance for the over/under markets, the three
// outcomes of corners 1X2 and of one minute's 1X2, the players the market
// makes most likely for scorers and shots. Odds and chance always come
// from the same book and the same reading (review-expectations § 6).

export type SheetNewMarket = (typeof SHEET_NEW_MARKETS)[number];

const RESULT_PICKS = ['HOME', 'DRAW', 'AWAY'] as const;

const HALF = new Decimal(0.5);

/** 1xBet first, then SHEET_OTHER_BOOKMAKERS, then any other book by name. */
const BOOK_ORDER: readonly string[] = [
  ...OPERATOR_BOOKMAKERS,
  ...SHEET_OTHER_BOOKMAKERS,
];

function bookFirst(books: Iterable<string>): string | undefined {
  const rank = (book: string) => {
    const index = BOOK_ORDER.indexOf(book);
    return index === -1 ? BOOK_ORDER.length : index;
  };
  return [...new Set(books)].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  )[0];
}

/**
 * The prices a match's new markets are read on: before its kick-off, over
 * the SHEET_PRICES_LOOKBACK_DAYS before it (the sheet and « Mon ticket »).
 */
export function sheetPriceWindow(
  fixtureId: string,
  kickoff: Date,
): { fixtureId: string; kickoff: Date; since: Date } {
  return {
    fixtureId,
    kickoff,
    since: new Date(kickoff.getTime() - SHEET_PRICES_LOOKBACK_DAYS * DAY_MS),
  };
}

/** The player ids the scorer and shots picks of these rows name. */
export function pricedPlayerIds(rows: readonly MarketPriceRow[]): number[] {
  return [
    ...new Set(
      rows.flatMap((row) => {
        const id = playerIdOfPick(row.pick);
        return id === null ? [] : [id];
      }),
    ),
  ];
}

type Settle = { finished: boolean; facts: MatchFacts | null };

/**
 * The picks of the new markets, in SHEET_NEW_MARKETS order. A player the
 * names do not give is left out (his bet could not be read); a market no
 * book prices gives nothing.
 */
export function newMarketPicksOf(input: {
  rows: readonly MarketPriceRow[];
  playerNames: ReadonlyMap<number, string>;
  settle: Settle;
}): SheetPick[] {
  const picks: SheetPick[] = [];
  const byMarket = groupBy(input.rows, (row) => row.market);
  for (const market of SHEET_NEW_MARKETS) {
    const rows = byMarket.get(market);
    if (!rows) continue;
    const chosen = READINGS[market].choose(rows, input.playerNames);
    for (const { row, chance } of chosen) {
      const playerId = playerIdOfPick(row.pick);
      picks.push({
        market,
        pick: row.pick,
        line: row.line,
        player:
          playerId === null ? null : (input.playerNames.get(playerId) ?? null),
        odds: row.odds,
        chance,
        result: resultOf({ market, row, settle: input.settle }),
      });
    }
  }
  return picks;
}

type Chosen = { row: MarketPriceRow; chance: number | null };

type Chooser = (
  rows: readonly MarketPriceRow[],
  names: ReadonlyMap<number, string>,
) => Chosen[];

const at = (row: MarketPriceRow) => new Date(row.snapshotAt).getTime();

/** Shin's frequencies of one book's group, read as one quote (its prices
 * within SHEET_QUOTE_MAX_GAP_MINUTES of each other); else null. */
function fairOf(group: readonly MarketPriceRow[]): Map<string, Decimal> | null {
  if (group.length === 0) return null;
  const times = group.map(at);
  if (
    Math.max(...times) - Math.min(...times) >
    SHEET_QUOTE_MAX_GAP_MINUTES * 60_000
  ) {
    return null;
  }
  return shinProbabilities(
    group.map((row) => ({ pick: row.pick, odds: new Decimal(row.odds) })),
  );
}

const chanceOf = (fair: Map<string, Decimal> | null, pick: string) =>
  fair?.get(pick)?.toDecimalPlaces(4).toNumber() ?? null;

type Pair = { over: MarketPriceRow; under: MarketPriceRow };

/** The over and the under of one book's group on one line, both or none. */
function overUnderPair(group: readonly MarketPriceRow[]): Pair | null {
  const over = group.find((row) => row.pick === 'OVER');
  const under = group.find((row) => row.pick === 'UNDER');
  return over && under ? { over, under } : null;
}

/**
 * Over and under of one line: at the first book pricing both sides of a
 * line at one instant, the line whose over is nearest an even chance (Shin
 * on the pair); the lower line on a tie.
 */
function overUnderLine(rows: readonly MarketPriceRow[]): Chosen[] {
  const pairs = new Map<string, Pair[]>();
  const byBookLine = groupBy(
    rows.filter((row) => row.line !== null),
    (row) => `${row.bookmaker}|${row.line}`,
  );
  for (const group of byBookLine.values()) {
    const pair = overUnderPair(group);
    if (!pair) continue;
    pairs.set(pair.over.bookmaker, [
      ...(pairs.get(pair.over.bookmaker) ?? []),
      pair,
    ]);
  }
  const book = bookFirst(pairs.keys());
  if (book === undefined) return [];
  let best: { pair: Pair; fair: Map<string, Decimal>; gap: Decimal } | null =
    null;
  for (const pair of pairs.get(book) ?? []) {
    const fair = fairOf([pair.over, pair.under]);
    const over = fair?.get('OVER');
    if (!fair || !over) continue;
    const gap = over.minus(HALF).abs();
    if (
      best === null ||
      gap.lt(best.gap) ||
      (gap.eq(best.gap) && (pair.over.line ?? 0) < (best.pair.over.line ?? 0))
    ) {
      best = { pair, fair, gap };
    }
  }
  if (best === null) return [];
  return [best.pair.over, best.pair.under].map((row) => ({
    row,
    chance: chanceOf(best.fair, row.pick),
  }));
}

/** The rows of the three outcomes of a 1X2. */
function outcomesOf(rows: readonly MarketPriceRow[]): MarketPriceRow[] {
  return rows.filter((row) =>
    (RESULT_PICKS as readonly string[]).includes(row.pick),
  );
}

/** One book's rows price all three outcomes. */
function isComplete(group: readonly MarketPriceRow[]): boolean {
  const picks = new Set(group.map((row) => row.pick));
  return RESULT_PICKS.every((pick) => picks.has(pick));
}

/** Corners 1X2 and a minute's 1X2: the first book pricing all three outcomes. */
function completeResult(rows: readonly MarketPriceRow[]): Chosen[] {
  const outcomes = outcomesOf(rows);
  const complete = [
    ...groupBy(outcomes, (row) => row.bookmaker).entries(),
  ].filter(([, group]) => isComplete(group));
  const book = bookFirst(complete.map(([name]) => name));
  const group = complete.find(([name]) => name === book)?.[1] ?? [];
  const fair = fairOf(group);
  return RESULT_PICKS.flatMap((pick) => {
    const row = group.find((r) => r.pick === pick);
    return row ? [{ row, chance: chanceOf(fair, pick) }] : [];
  });
}

/**
 * 1X2 at a minute: the minute the most books price whole (the earlier on a
 * tie), its three outcomes at one book.
 */
function minuteGroup(rows: readonly MarketPriceRow[]): Chosen[] {
  let best: { minute: number; books: number; rows: MarketPriceRow[] } | null =
    null;
  const byMinute = groupBy(
    rows.filter((row) => row.line !== null),
    (row) => String(row.line),
  );
  for (const [key, ofMinute] of byMinute) {
    const minute = Number(key);
    const books = [
      ...groupBy(ofMinute, (row) => row.bookmaker).values(),
    ].filter(isComplete).length;
    if (
      books > 0 &&
      (best === null ||
        books > best.books ||
        (books === best.books && minute < best.minute))
    ) {
      best = { minute, books, rows: ofMinute };
    }
  }
  return best === null ? [] : completeResult(best.rows);
}

/**
 * Scorers: at the first book pricing a player we can name, the
 * SHEET_SCORERS_SHOWN players at the lowest prices (the market's most
 * likely). No chance: the list is not a complete group.
 */
function scorers(
  rows: readonly MarketPriceRow[],
  names: ReadonlyMap<number, string>,
): Chosen[] {
  const named = rows.filter((row) => {
    const id = playerIdOfPick(row.pick);
    return id !== null && names.has(id);
  });
  const book = bookFirst(named.map((row) => row.bookmaker));
  return named
    .filter((row) => row.bookmaker === book)
    .sort((a, b) => a.odds - b.odds || a.pick.localeCompare(b.pick))
    .slice(0, SHEET_SCORERS_SHOWN)
    .map((row) => ({ row, chance: null }));
}

/**
 * Player shots: at the first book pricing a player we can name, each
 * player's line nearest an even chance (by its implied probability: the
 * market has no « under » to remove the margin with), then the
 * SHEET_PLAYER_SHOTS_SHOWN players nearest it. No chance shown.
 */
function shotLines(
  rows: readonly MarketPriceRow[],
  names: ReadonlyMap<number, string>,
): Chosen[] {
  const named = rows.filter((row) => {
    const id = playerIdOfPick(row.pick);
    return id !== null && names.has(id) && row.line !== null;
  });
  const book = bookFirst(named.map((row) => row.bookmaker));
  const gap = (row: MarketPriceRow) =>
    new Decimal(1).dividedBy(row.odds).minus(HALF).abs();
  const nearer = (a: MarketPriceRow, b: MarketPriceRow) =>
    gap(a).comparedTo(gap(b)) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    a.pick.localeCompare(b.pick);
  const perPlayer = new Map<string, MarketPriceRow>();
  for (const row of named.filter((r) => r.bookmaker === book)) {
    const kept = perPlayer.get(row.pick);
    if (!kept || nearer(row, kept) < 0) perPlayer.set(row.pick, row);
  }
  return [...perPlayer.values()]
    .sort(nearer)
    .slice(0, SHEET_PLAYER_SHOTS_SHOWN)
    .map((row) => ({ row, chance: null }));
}

/**
 * The frequencies of one book's group on one line, as the sheet reads
 * them: the over/under pair, the three outcomes of a 1X2; null for a group
 * incomplete.
 */
type GroupFair = (
  group: readonly MarketPriceRow[],
) => Map<string, Decimal> | null;

const pairFair: GroupFair = (group) => {
  const pair = overUnderPair(group);
  return pair ? fairOf([pair.over, pair.under]) : null;
};

const resultFair: GroupFair = (group) => {
  const outcomes = outcomesOf(group);
  return isComplete(outcomes) ? fairOf(outcomes) : null;
};

/** Scorers and shots: no complete group, no frequency. */
const noFair: GroupFair = () => null;

/**
 * How each market of SHEET_NEW_MARKETS is read: how it chooses its lines
 * (one market's rows, every book) and the frequencies of one book's group.
 */
const READINGS: Record<SheetNewMarket, { choose: Chooser; fair: GroupFair }> = {
  CORNERS: { choose: overUnderLine, fair: pairFair },
  CORNERS_HOME: { choose: overUnderLine, fair: pairFair },
  CORNERS_AWAY: { choose: overUnderLine, fair: pairFair },
  CARDS: { choose: overUnderLine, fair: pairFair },
  CORNERS_1X2: { choose: completeResult, fair: resultFair },
  MINUTE_1X2: { choose: minuteGroup, fair: resultFair },
  GOAL_SCORER_ANYTIME: { choose: scorers, fair: noFair },
  GOAL_SCORER_FIRST: { choose: scorers, fair: noFair },
  PLAYER_SHOTS: { choose: shotLines, fair: noFair },
  PLAYER_SHOTS_ON_TARGET: { choose: shotLines, fair: noFair },
};

/**
 * A bet of the new markets priced again (« Mon ticket »), from the same
 * prices and by the same rules as the sheet: at the first book (1xBet,
 * then SHEET_OTHER_BOOKMAKERS) that prices this pick on this line with
 * its whole group, else at the first that prices the pick alone. Odds and
 * chance from the same book and the same quote (review-expectations § 6);
 * null when no book prices it.
 */
export function quoteNewMarketPick(input: {
  market: SheetNewMarket;
  pick: string;
  line: number | null;
  rows: readonly MarketPriceRow[];
}): { odds: number; chance: number | null } | null {
  const { market, pick, line } = input;
  const onLine = input.rows.filter(
    (row) =>
      row.market === market &&
      (row.line === null || line === null
        ? row.line === line
        : Number(row.line) === Number(line)),
  );
  const priced = onLine.filter((row) => row.pick === pick);
  const chances = new Map(
    priced.map((row) => [
      row.bookmaker,
      chanceOf(
        READINGS[market].fair(
          onLine.filter((other) => other.bookmaker === row.bookmaker),
        ),
        pick,
      ),
    ]),
  );
  const whole = [...chances].filter(([, chance]) => chance !== null);
  const book = bookFirst(
    (whole.length > 0 ? whole : [...chances]).map(([name]) => name),
  );
  const row = priced.find((r) => r.bookmaker === book);
  return row
    ? { odds: row.odds, chance: chances.get(row.bookmaker) ?? null }
    : null;
}

/** A market of SHEET_NEW_MARKETS. */
export function isSheetNewMarket(market: string): market is SheetNewMarket {
  return (SHEET_NEW_MARKETS as readonly string[]).includes(market);
}

/**
 * Once the match is over, by the resolvers that settle the coupons' legs.
 * Unknown is not lost: facts not in yet, or cards whose two counts of a
 * red disagree, stay unsettled.
 */
export function resultOf(input: {
  market: SheetNewMarket;
  row: Pick<MarketPriceRow, 'pick' | 'line'>;
  settle: Settle;
}): SheetPick['result'] {
  const { market, row, settle } = input;
  if (!settle.finished || settle.facts === null) return null;
  return settledResultOf(
    resolveStatMarketBetStatus({
      market,
      pick: row.pick,
      line: row.line,
      facts: settle.facts,
    }),
  );
}
