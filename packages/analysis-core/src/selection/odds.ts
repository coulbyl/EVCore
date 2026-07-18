import Decimal from "decimal.js";
import { Market } from "../types";
import { calculateEV } from "../ev";
import type { FullOddsSnapshot } from "./types";

/**
 * Shared pricing for channel selections.
 *
 * Principle (every channel strategy must follow it): a selection always carries
 * its market price when the book has one — `odds`, `impliedProbability` and `ev`
 * — so every channel is auditable on EV/ROI the same way, not just EV/SAFE.
 * Prediction channels still record a price-less selection (for analytical
 * settlement) when no odds exist.
 */

// Resolve the decimal odds for a (market, pick) from a full odds snapshot.
// Returns null when the book has no price for that exact selection.
export function resolveSelectionOdds(
  odds: FullOddsSnapshot | null,
  market: Market,
  pick: string,
): Decimal | null {
  if (odds === null) return null;
  switch (market) {
    case Market.ONE_X_TWO:
      if (pick === "HOME") return odds.homeOdds;
      if (pick === "DRAW") return odds.drawOdds;
      if (pick === "AWAY") return odds.awayOdds;
      return null;
    case Market.BTTS:
      if (pick === "YES") return odds.bttsYesOdds;
      if (pick === "NO") return odds.bttsNoOdds;
      return null;
    case Market.OVER_UNDER:
      return (
        odds.overUnderOdds[pick as keyof typeof odds.overUnderOdds] ?? null
      );
    case Market.OVER_UNDER_HT:
      return odds.ouHtOdds[pick as keyof typeof odds.ouHtOdds] ?? null;
    case Market.DOUBLE_CHANCE:
      return odds.doubleChanceOdds?.[pick as "1X" | "X2" | "12"] ?? null;
    case Market.FIRST_HALF_WINNER:
      if (odds.firstHalfWinnerOdds === null) return null;
      if (pick === "HOME") return odds.firstHalfWinnerOdds.home;
      if (pick === "DRAW") return odds.firstHalfWinnerOdds.draw;
      if (pick === "AWAY") return odds.firstHalfWinnerOdds.away;
      return null;
    case Market.HALF_TIME_FULL_TIME:
      return odds.htftOdds[pick as keyof typeof odds.htftOdds] ?? null;
    case Market.CORRECT_SCORE:
      return odds.correctScoreOdds?.[pick] ?? null;
    case Market.DRAW_NO_BET:
      if (odds.drawNoBetOdds === null) return null;
      if (pick === "HOME") return odds.drawNoBetOdds.home;
      if (pick === "AWAY") return odds.drawNoBetOdds.away;
      return null;
    case Market.TEAM_TOTAL_HOME:
      return (
        odds.teamTotalHomeOdds[pick as keyof typeof odds.teamTotalHomeOdds] ??
        null
      );
    case Market.TEAM_TOTAL_AWAY:
      return (
        odds.teamTotalAwayOdds[pick as keyof typeof odds.teamTotalAwayOdds] ??
        null
      );
    case Market.CLEAN_SHEET_HOME:
      return resolveYesNoOdds(odds.cleanSheetHomeOdds, pick);
    case Market.CLEAN_SHEET_AWAY:
      return resolveYesNoOdds(odds.cleanSheetAwayOdds, pick);
    case Market.WIN_TO_NIL_HOME:
      return resolveYesNoOdds(odds.winToNilHomeOdds, pick);
    case Market.WIN_TO_NIL_AWAY:
      return resolveYesNoOdds(odds.winToNilAwayOdds, pick);
    case Market.TO_WIN_EITHER_HALF:
      if (odds.winEitherHalfOdds === null) return null;
      if (pick === "HOME") return odds.winEitherHalfOdds.home;
      if (pick === "AWAY") return odds.winEitherHalfOdds.away;
      return null;
    default:
      return null;
  }
}

function resolveYesNoOdds(
  yesNo: { yes: Decimal; no: Decimal } | null,
  pick: string,
): Decimal | null {
  if (yesNo === null) return null;
  if (pick === "YES") return yesNo.yes;
  if (pick === "NO") return yesNo.no;
  return null;
}

// EV/impliedProbability/odds enrichment to spread into a StrategySelection.
// Returns an empty object (no fields) when the book has no usable price, so a
// price-less selection stays valid for analytical settlement.
export function priceSelection(input: {
  probability: Decimal;
  odds: Decimal | null;
}): { odds?: Decimal; impliedProbability?: Decimal; ev?: Decimal } {
  const { probability, odds } = input;
  if (odds === null || odds.lessThanOrEqualTo(1)) return {};
  return {
    odds,
    impliedProbability: new Decimal(1).div(odds),
    ev: calculateEV(probability, odds),
  };
}

// Convenience: resolve the price for a (market, pick) then enrich. One call per
// channel strategy keeps the pricing identical everywhere.
export function priceForSelection(input: {
  odds: FullOddsSnapshot | null;
  market: Market;
  pick: string;
  probability: Decimal;
}): { odds?: Decimal; impliedProbability?: Decimal; ev?: Decimal } {
  return priceSelection({
    probability: input.probability,
    odds: resolveSelectionOdds(input.odds, input.market, input.pick),
  });
}
