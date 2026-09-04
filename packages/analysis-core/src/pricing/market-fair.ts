import Decimal from "decimal.js";
import { Market } from "../types";
import { bookmakerMargin, removeOverround } from "../ev/ev-math";
import { getPickOddsFromSnapshot } from "../selection/combo-pricing";
import type { FullOddsSnapshot } from "../selection/types";

// Opposite pick of an OVER_UNDER(_HT) line — pairs OVER_x with UNDER_x to
// recover the two mutually-exclusive outcomes needed to remove the
// overround. The 2.5 line uses the bare 'OVER' / 'UNDER' keys (cf.
// FullOddsSnapshot.overUnderOdds).
export function overUnderOpposite(pick: string): string | null {
  if (pick === "OVER") return "UNDER";
  if (pick === "UNDER") return "OVER";
  if (pick.startsWith("OVER_")) return `UNDER_${pick.slice("OVER_".length)}`;
  if (pick.startsWith("UNDER_")) return `OVER_${pick.slice("UNDER_".length)}`;
  return null;
}

// Two-outcome opposite of a pick, for markets where "fade the model" means
// literally staking the other side — a strict superset of overUnderOpposite
// (also covers OVER_UNDER_HT/TEAM_TOTAL_HOME/TEAM_TOTAL_AWAY, which share the
// same OVER_x/UNDER_x pick naming) plus the YES/NO markets. `null` for
// three-way or non-exhaustive markets (ONE_X_TWO, DOUBLE_CHANCE, ...) — no
// clean fade exists there, per the plan's scope.
export function oppositePick(pick: string): string | null {
  if (pick === "YES") return "NO";
  if (pick === "NO") return "YES";
  return overUnderOpposite(pick);
}

// Sibling outcome odds for a market+pick — the OTHER mutually-exclusive
// outcomes, needed alongside the selected odds to remove the bookmaker
// margin. Returns `null` (skip fair-prob) when the market has no clean
// exhaustive partition here (DOUBLE_CHANCE overlaps; HALF_TIME_FULL_TIME
// coverage is too partial).
export function siblingOutcomeOdds(
  market: Market,
  pick: string,
  snapshot: FullOddsSnapshot,
): Decimal[] | null {
  const pickOdds = (p: string): Decimal | null =>
    getPickOddsFromSnapshot(market, p, snapshot);

  if (market === Market.ONE_X_TWO || market === Market.FIRST_HALF_WINNER) {
    const others = ["HOME", "DRAW", "AWAY"].filter((p) => p !== pick);
    if (others.length !== 2) return null;
    const odds = others.map(pickOdds);
    return odds.every((o): o is Decimal => o !== null) ? odds : null;
  }
  if (market === Market.BTTS) {
    const other = pick === "YES" ? "NO" : pick === "NO" ? "YES" : null;
    const o = other ? pickOdds(other) : null;
    return o ? [o] : null;
  }
  if (market === Market.OVER_UNDER || market === Market.OVER_UNDER_HT) {
    const opposite = overUnderOpposite(pick);
    const o = opposite ? pickOdds(opposite) : null;
    return o ? [o] : null;
  }
  return null;
}

// Fair (overround-removed) probability of the selected outcome + the
// market's bookmaker margin. Depends on odds only — computed at pool-build
// time. Returns `null` when the full outcome set is unavailable or the odds
// are invalid.
export function computeMarketFair(
  market: Market,
  pick: string,
  snapshot: FullOddsSnapshot,
): { pMarketFair: number; bookmakerMargin: number } | null {
  const selected = getPickOddsFromSnapshot(market, pick, snapshot);
  if (selected === null) return null;
  const siblings = siblingOutcomeOdds(market, pick, snapshot);
  if (siblings === null || siblings.length === 0) return null;

  const outcomeOdds = [selected, ...siblings];
  try {
    const fair = removeOverround(outcomeOdds);
    const selectedFair = fair[0];
    if (selectedFair === undefined) return null;
    return {
      pMarketFair: selectedFair.toNumber(),
      bookmakerMargin: bookmakerMargin(outcomeOdds).toNumber(),
    };
  } catch {
    // Invalid decimal odds (≤ 1) — skip fair-prob rather than fail the pool.
    return null;
  }
}
