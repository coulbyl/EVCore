import { prisma } from "@evcore/db";
import {
  Market,
  assembleFullOddsSnapshot,
  resolveSelectionOdds,
  type FullOddsSnapshot,
  type RawOddsRow,
} from "@evcore/analysis-core";
import type { MarketOddsSnapshot } from "./types";

// "What the market prices" for markets no channel selected on this fixture —
// never framed as edge/EV (CLAUDE.md: claimed edge is anti-predictive,
// MAX_LEG_EDGE is a ceiling never a selection floor — applies to VANTAGE's
// own reasoning exactly as much as to any channel's).
//
// Was scoped to ONE_X_TWO only until 2026-09-04 (single home/draw/away price
// per snapshot row, easy to read directly off `odds_snapshot`) — BTTS/
// OVER_UNDER instead spread across several `pick`-keyed rows, which this
// file used to document as needing an aggregation step it didn't build.
// That aggregation already exists (`assembleFullOddsSnapshot` +
// `resolveSelectionOdds`, extracted 2026-09-03 for the coupon pool — see
// apps/vantage-worker/src/coupon/odds-batch.ts) — reused here instead of
// duplicated. Kept to a short list of markets for the CONTEXT block below
// (BTTS, and OVER_UNDER's main 2.5 line): every extra market/pick pair is
// more raw noise in a prompt already asking the model to weigh several
// context blocks, for a benefit that hasn't been measured yet. DOMINANT
// (14.2% of matches) and DRAW (33.6%) both target ONE_X_TWO but neither
// selects most of the time, so it's frequently uncovered and worth the raw
// look even alone. See docs/context-expansion-proposal.md ("A" — market
// context).
const CONTEXT_MARKET_PICKS: ReadonlyMap<Market, readonly string[]> = new Map([
  [Market.ONE_X_TWO, ["HOME", "DRAW", "AWAY"]],
  [Market.BTTS, ["YES", "NO"]],
  // Bare "OVER"/"UNDER" is the main 2.5-goals line (see FIXED_PICKS in
  // known-picks.ts) — the other lines (1.5/3.5/4.5) are left out of this
  // display-only block for the same noise reason as above; VANTAGE's own
  // pick (any line) still resolves correctly via findKnownOdds below,
  // which isn't limited to this list.
  [Market.OVER_UNDER, ["OVER", "UNDER"]],
]);

const EXTENDED_CONTEXT_MARKETS: readonly Market[] = [
  Market.ASIAN_HANDICAP,
  Market.ASIAN_HANDICAP_HT,
  Market.OVER_UNDER_2H,
  Market.CORNERS,
  Market.CORNERS_HT,
  Market.CARDS,
  Market.ODD_EVEN,
  Market.ODD_EVEN_HT,
  Market.HIGHEST_SCORING_HALF,
  Market.TEAM_TO_SCORE_FIRST,
];

const REFERENCE_BOOKMAKER = "Pinnacle";

type ExtendedOddsRow = {
  market: Market;
  pick: string | null;
  line: { toNumber(): number } | null;
  odds: { toNumber(): number } | null;
  snapshotAt: Date;
};

const RAW_ODDS_ROW_SELECT = {
  bookmaker: true,
  market: true,
  pick: true,
  odds: true,
  snapshotAt: true,
  homeOdds: true,
  drawOdds: true,
  awayOdds: true,
} as const;

/** One query for every market/bookmaker on this fixture, assembled into the
 * same generic per-pick snapshot every channel strategy and the coupon pool
 * already resolve odds from — `null` when the fixture has no ONE_X_TWO price
 * at all (assembleFullOddsSnapshot's anchor market), same "no odds" case the
 * old ONE_X_TWO-only query treated as "nothing to show". Cutoff is "now":
 * unlike the coupon pool's backtest-safe point-in-time reads, VANTAGE always
 * analyzes a fixture live, once, so the latest price is always the right
 * one. */
export async function loadFullOddsSnapshot(
  fixtureId: string,
): Promise<FullOddsSnapshot | null> {
  const rows: RawOddsRow[] = await prisma.oddsSnapshot.findMany({
    where: { fixtureId },
    select: RAW_ODDS_ROW_SELECT,
  });
  return assembleFullOddsSnapshot(rows, new Date());
}

/** Reads the latest reference-book snapshot for every newly collected market.
 * For line markets, only the most balanced two-sided line is retained: this
 * approximates the bookmaker's main line while keeping the prompt compact.
 * These prices are context-only; selection stays gated until the complete
 * line-aware decision/settlement path and calibration exist. */
export async function loadExtendedMarketOdds(
  fixtureId: string,
): Promise<MarketOddsSnapshot[]> {
  const rows = await prisma.oddsSnapshot.findMany({
    where: {
      fixtureId,
      bookmaker: REFERENCE_BOOKMAKER,
      market: { in: [...EXTENDED_CONTEXT_MARKETS] },
      odds: { not: null },
    },
    select: {
      market: true,
      pick: true,
      line: true,
      odds: true,
      snapshotAt: true,
    },
    orderBy: { snapshotAt: "desc" },
  });
  return buildExtendedMarketOdds(rows);
}

export function buildExtendedMarketOdds(
  rows: readonly ExtendedOddsRow[],
): MarketOddsSnapshot[] {
  const result: MarketOddsSnapshot[] = [];
  for (const market of EXTENDED_CONTEXT_MARKETS) {
    const marketRows = rows.filter((row) => row.market === market);
    const snapshotTimes = [
      ...new Set(marketRows.map((row) => row.snapshotAt.getTime())),
    ].sort((left, right) => right - left);

    for (const snapshotTime of snapshotTimes) {
      const snapshotRows = marketRows.filter(
        (row) => row.snapshotAt.getTime() === snapshotTime,
      );
      const prices = pricesForCompleteSnapshot(snapshotRows);
      if (prices.length < 2) continue;
      result.push({ market, prices });
      break;
    }
  }
  return result;
}

function pricesForCompleteSnapshot(
  rows: readonly ExtendedOddsRow[],
): Array<{ pick: string; odds: number; line?: number }> {
  const fixedPrices = toPrices(rows.filter((row) => row.line === null));
  if (fixedPrices.length >= 2) return fixedPrices;

  const byLine = new Map<number, ExtendedOddsRow[]>();
  for (const row of rows) {
    if (row.line === null) continue;
    const line = row.line.toNumber();
    byLine.set(line, [...(byLine.get(line) ?? []), row]);
  }
  return (
    [...byLine.entries()]
      .map(([line, lineRows]) => ({
        prices: toPrices(lineRows, line),
      }))
      .filter((candidate) => candidate.prices.length >= 2)
      .sort(
        (left, right) => balanceScore(left.prices) - balanceScore(right.prices),
      )[0]?.prices ?? []
  );
}

function toPrices(
  rows: readonly ExtendedOddsRow[],
  line?: number,
): Array<{ pick: string; odds: number; line?: number }> {
  const seen = new Set<string>();
  const prices: Array<{ pick: string; odds: number; line?: number }> = [];
  for (const row of rows) {
    if (row.pick === null || row.odds === null || seen.has(row.pick)) continue;
    seen.add(row.pick);
    prices.push({
      pick: row.pick,
      odds: row.odds.toNumber(),
      ...(line === undefined ? {} : { line }),
    });
  }
  return prices;
}

function balanceScore(prices: readonly { odds: number }[]): number {
  return prices.reduce(
    (score, price) => score + Math.abs(1 / price.odds - 0.5),
    0,
  );
}

/** The raw-price context block (CONTEXT_MARKET_PICKS only) for whichever of
 * those markets no channel selected on this fixture. */
export function buildUncoveredMarketOdds(
  odds: FullOddsSnapshot | null,
  coveredMarkets: ReadonlySet<Market>,
): MarketOddsSnapshot[] {
  if (odds === null) return [];

  const results: MarketOddsSnapshot[] = [];
  for (const [market, picks] of CONTEXT_MARKET_PICKS) {
    if (coveredMarkets.has(market)) continue;
    const prices = picks
      .map((pick) => {
        const value = resolveSelectionOdds(odds, market, pick);
        return value !== null ? { pick, odds: value.toNumber() } : null;
      })
      .filter((p): p is { pick: string; odds: number } => p !== null);
    if (prices.length > 0) results.push({ market, prices });
  }
  return results;
}
