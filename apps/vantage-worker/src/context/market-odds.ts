import { prisma } from "@evcore/db";
import { Market } from "@evcore/analysis-core";
import type { MarketOddsSnapshot } from "./types";

// "What the market prices" for markets no channel selected on this fixture —
// never framed as edge/EV (CLAUDE.md: claimed edge is anti-predictive,
// MAX_LEG_EDGE is a ceiling never a selection floor — applies to VANTAGE's
// own reasoning exactly as much as to any channel's). Scoped to ONE_X_TWO
// only for now: it's the one market with a single clean home/draw/away
// price per snapshot row (`odds_snapshot.homeOdds/drawOdds/awayOdds`) —
// BTTS/OVER_UNDER instead spread across several `pick`-keyed rows and would
// need an aggregation step this first cut doesn't build. DOMINANT (14.2% of
// matches) and DRAW (33.6%) both target ONE_X_TWO but neither selects most
// of the time, so it's frequently uncovered and worth the raw look even
// alone. See docs/context-expansion-proposal.md ("A" — market context).
const SUPPORTED_MARKETS: readonly Market[] = [Market.ONE_X_TWO];

export async function loadUncoveredMarketOdds(
  fixtureId: string,
  coveredMarkets: ReadonlySet<Market>,
): Promise<MarketOddsSnapshot[]> {
  const toFetch = SUPPORTED_MARKETS.filter((m) => !coveredMarkets.has(m));
  if (toFetch.length === 0) return [];

  const results: MarketOddsSnapshot[] = [];
  for (const market of toFetch) {
    const row = await prisma.oddsSnapshot.findFirst({
      where: { fixtureId, market },
      orderBy: { snapshotAt: "desc" },
    });
    if (!row) continue;
    const homeOdds = row.homeOdds?.toNumber() ?? null;
    const drawOdds = row.drawOdds?.toNumber() ?? null;
    const awayOdds = row.awayOdds?.toNumber() ?? null;
    // A degenerate/partial snapshot row (all three prices null) is possible
    // — e.g. a suspended-market write that still got persisted (found in
    // code review 2026-08-30). Skip it rather than handing the prompt an
    // empty "1X2 — ." line.
    if (homeOdds === null && drawOdds === null && awayOdds === null) continue;
    results.push({ market, homeOdds, drawOdds, awayOdds });
  }
  return results;
}
