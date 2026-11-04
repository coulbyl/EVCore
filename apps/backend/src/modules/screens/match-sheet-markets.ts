import Decimal from 'decimal.js';
import {
  BetStatus,
  OPERATOR_BOOKMAKERS,
  playerIdOfPick,
  resolveCornersBetStatus,
  resolveStatMarketBetStatus,
  shinProbabilities,
  type MatchFacts,
} from '@evcore/analysis-core';
import {
  SHEET_NEW_MARKETS,
  SHEET_OTHER_BOOKMAKERS,
  SHEET_PLAYER_SHOTS_SHOWN,
  SHEET_SCORERS_SHOWN,
} from '@config/screens.constants';
import type { MarketPriceRow } from '@modules/betting-engine/pricing/playable-odds.repository';
import type { SheetPick } from './match-sheet.types';

// « Autres paris », the markets ingested since 03/11 (decided 2026-11-04):
// a few readable lines per market, chosen on the prices of one book. The
// line nearest an even chance for the over/under markets, the three
// outcomes of corners 1X2 and of one minute's 1X2, the players the market
// makes most likely for scorers and shots. Odds and chance always come
// from the same book and the same reading (review-expectations § 6).

export type SheetNewMarket = (typeof SHEET_NEW_MARKETS)[number];

const OVER_UNDER_MARKETS: readonly SheetNewMarket[] = [
  'CORNERS',
  'CORNERS_HOME',
  'CORNERS_AWAY',
  'CARDS',
];

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
  for (const market of SHEET_NEW_MARKETS) {
    const rows = input.rows.filter((row) => row.market === market);
    if (rows.length === 0) continue;
    const chosen = OVER_UNDER_MARKETS.includes(market)
      ? overUnderLine(rows)
      : market === 'CORNERS_1X2'
        ? completeResult(rows)
        : market === 'MINUTE_1X2'
          ? minuteGroup(rows)
          : market === 'PLAYER_SHOTS' || market === 'PLAYER_SHOTS_ON_TARGET'
            ? shotLines(rows, input.playerNames)
            : scorers(rows, input.playerNames);
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
        addable: false,
      });
    }
  }
  return picks;
}

type Chosen = { row: MarketPriceRow; chance: number | null };

const at = (row: MarketPriceRow) => new Date(row.snapshotAt).getTime();

/** Shin's frequencies of one book's group, read at one instant; else null. */
function fairOf(group: readonly MarketPriceRow[]): Map<string, Decimal> | null {
  const first = group[0];
  if (!first || group.some((row) => at(row) !== at(first))) return null;
  return shinProbabilities(
    group.map((row) => ({ pick: row.pick, odds: new Decimal(row.odds) })),
  );
}

const chanceOf = (fair: Map<string, Decimal> | null, pick: string) =>
  fair?.get(pick)?.toDecimalPlaces(4).toNumber() ?? null;

/**
 * Over and under of one line: at the first book pricing both sides of a
 * line at one instant, the line whose over is nearest an even chance (Shin
 * on the pair); the lower line on a tie.
 */
function overUnderLine(rows: readonly MarketPriceRow[]): Chosen[] {
  type Pair = { over: MarketPriceRow; under: MarketPriceRow };
  const pairs = new Map<string, Pair[]>();
  for (const over of rows.filter((row) => row.pick === 'OVER')) {
    const under = rows.find(
      (row) =>
        row.pick === 'UNDER' &&
        row.bookmaker === over.bookmaker &&
        row.line === over.line,
    );
    if (!under || over.line === null) continue;
    pairs.set(over.bookmaker, [
      ...(pairs.get(over.bookmaker) ?? []),
      { over, under },
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

/** Corners 1X2 and a minute's 1X2: the first book pricing all three outcomes. */
function completeResult(rows: readonly MarketPriceRow[]): Chosen[] {
  const byBook = new Map<string, MarketPriceRow[]>();
  for (const row of rows) {
    if (!(RESULT_PICKS as readonly string[]).includes(row.pick)) continue;
    byBook.set(row.bookmaker, [...(byBook.get(row.bookmaker) ?? []), row]);
  }
  const complete = [...byBook].filter(
    ([, group]) => new Set(group.map((row) => row.pick)).size === 3,
  );
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
  const minutes = [
    ...new Set(rows.flatMap((row) => (row.line === null ? [] : [row.line]))),
  ];
  let best: { minute: number; books: number } | null = null;
  for (const minute of minutes.sort((a, b) => a - b)) {
    const ofMinute = rows.filter((row) => row.line === minute);
    const books = [...new Set(ofMinute.map((row) => row.bookmaker))].filter(
      (book) =>
        new Set(
          ofMinute.filter((row) => row.bookmaker === book).map((r) => r.pick),
        ).size === RESULT_PICKS.length,
    ).length;
    if (books > 0 && (best === null || books > best.books)) {
      best = { minute, books };
    }
  }
  if (best === null) return [];
  const minute = best.minute;
  return completeResult(rows.filter((row) => row.line === minute));
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
 * Once the match is over, by the resolvers that settle the coupons' legs.
 * Unknown is not lost: facts not in yet, or a market without a resolver
 * (cards), stay unsettled.
 */
export function resultOf(input: {
  market: SheetNewMarket;
  row: Pick<MarketPriceRow, 'pick' | 'line'>;
  settle: Settle;
}): SheetPick['result'] {
  const { market, row, settle } = input;
  if (!settle.finished || settle.facts === null) return null;
  const facts = settle.facts;
  let status: BetStatus | null;
  if (market === 'CARDS') {
    status = null;
  } else if (market === 'CORNERS') {
    const { home, away } = facts.teams;
    status =
      row.line === null || home.corners === null || away.corners === null
        ? null
        : resolveCornersBetStatus(
            row.pick,
            row.line,
            home.corners + away.corners,
          );
  } else {
    status = resolveStatMarketBetStatus({
      market,
      pick: row.pick,
      line: row.line,
      facts,
    });
  }
  return status === BetStatus.WON
    ? 'won'
    : status === BetStatus.LOST
      ? 'lost'
      : status === BetStatus.VOID
        ? 'void'
        : null;
}
