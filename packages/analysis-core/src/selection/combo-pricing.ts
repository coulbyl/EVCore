import Decimal from "decimal.js";
import { Market } from "../types";
import type { ComboPick } from "../probability";
import { isHalfTimeFullTimePick } from "../probability";
import {
  COMBO_CORRELATION_ALPHA,
  COMBO_CORRELATION_MAX_FACTOR,
  COMBO_CORRELATION_MIN_FACTOR,
} from "./constants";
import type { FullOddsSnapshot, MatchProbabilities, ViablePick } from "./types";

// Validated combo pairs — only combinations that are logically consistent and
// have positive expected correlation. Impossible combos (HOME+DRAW, etc.) are absent.
export const COMBO_WHITELIST: readonly ComboPick[] = [
  {
    market1: Market.ONE_X_TWO,
    pick1: "HOME",
    market2: Market.BTTS,
    pick2: "YES",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "HOME",
    market2: Market.OVER_UNDER,
    pick2: "OVER",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "HOME",
    market2: Market.BTTS,
    pick2: "NO",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "AWAY",
    market2: Market.BTTS,
    pick2: "YES",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "AWAY",
    market2: Market.OVER_UNDER,
    pick2: "OVER",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "AWAY",
    market2: Market.BTTS,
    pick2: "NO",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "DRAW",
    market2: Market.OVER_UNDER,
    pick2: "UNDER",
  },
  {
    market1: Market.ONE_X_TWO,
    pick1: "DRAW",
    market2: Market.BTTS,
    pick2: "YES",
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: "1X",
    market2: Market.BTTS,
    pick2: "YES",
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: "X2",
    market2: Market.BTTS,
    pick2: "YES",
  },
  {
    market1: Market.DOUBLE_CHANCE,
    pick1: "12",
    market2: Market.BTTS,
    pick2: "YES",
  },
  // NOTE: {OVER_UNDER/OVER + BTTS/YES} is intentionally excluded.
  // Over 2.5 and BTTS Yes are near-tautological on the same match: virtually
  // every Over-2.5 game also satisfies BTTS Yes (except 0-3+ or 3-0+ scores).
  // The Poisson joint probability correctly captures this near-perfect correlation,
  // making the combo appear to have massive EV vs the bookmaker's naive product
  // odds — but the edge is an artifact of the independence assumption in the
  // bookmaker's pricing, not a genuine model signal.
] as const;

// Stable identity key for a (single or combo) pick. Used to dedupe / exclude
// picks across channels (e.g. SV must not re-select the EV pick).
export function buildBetPickKey(input: {
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
}): string {
  return [
    input.market,
    input.pick,
    input.comboMarket ?? "-",
    input.comboPick ?? "-",
  ].join("|");
}

// Returns odds for a pick within a FullOddsSnapshot (single-market, no combo).
export function getPickOddsFromSnapshot(
  market: Market,
  pick: string,
  odds: FullOddsSnapshot,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === "HOME") return odds.homeOdds;
    if (pick === "DRAW") return odds.drawOdds;
    if (pick === "AWAY") return odds.awayOdds;
  }
  if (market === Market.OVER_UNDER) {
    return odds.overUnderOdds[pick as keyof typeof odds.overUnderOdds] ?? null;
  }
  if (market === Market.BTTS) {
    if (pick === "YES") return odds.bttsYesOdds;
    if (pick === "NO") return odds.bttsNoOdds;
  }
  if (market === Market.HALF_TIME_FULL_TIME) {
    if (isHalfTimeFullTimePick(pick)) {
      return odds.htftOdds[pick] ?? null;
    }
  }
  if (market === Market.OVER_UNDER_HT) {
    return odds.ouHtOdds[pick as keyof typeof odds.ouHtOdds] ?? null;
  }
  if (
    market === Market.FIRST_HALF_WINNER &&
    odds.firstHalfWinnerOdds !== null
  ) {
    if (pick === "HOME") return odds.firstHalfWinnerOdds.home;
    if (pick === "DRAW") return odds.firstHalfWinnerOdds.draw;
    if (pick === "AWAY") return odds.firstHalfWinnerOdds.away;
  }
  if (market === Market.DOUBLE_CHANCE && odds.doubleChanceOdds !== null) {
    return odds.doubleChanceOdds[pick as "1X" | "X2" | "12"] ?? null;
  }
  if (market === Market.DRAW_NO_BET && odds.drawNoBetOdds !== null) {
    if (pick === "HOME") return odds.drawNoBetOdds.home;
    if (pick === "AWAY") return odds.drawNoBetOdds.away;
  }
  if (market === Market.TEAM_TOTAL_HOME) {
    return (
      odds.teamTotalHomeOdds[pick as keyof typeof odds.teamTotalHomeOdds] ??
      null
    );
  }
  if (market === Market.TEAM_TOTAL_AWAY) {
    return (
      odds.teamTotalAwayOdds[pick as keyof typeof odds.teamTotalAwayOdds] ??
      null
    );
  }
  if (market === Market.CLEAN_SHEET_HOME) {
    return getYesNoOdds(odds.cleanSheetHomeOdds, pick);
  }
  if (market === Market.CLEAN_SHEET_AWAY) {
    return getYesNoOdds(odds.cleanSheetAwayOdds, pick);
  }
  if (market === Market.WIN_TO_NIL_HOME) {
    return getYesNoOdds(odds.winToNilHomeOdds, pick);
  }
  if (market === Market.WIN_TO_NIL_AWAY) {
    return getYesNoOdds(odds.winToNilAwayOdds, pick);
  }
  if (market === Market.TO_WIN_EITHER_HALF && odds.winEitherHalfOdds !== null) {
    if (pick === "HOME") return odds.winEitherHalfOdds.home;
    if (pick === "AWAY") return odds.winEitherHalfOdds.away;
  }
  if (market === Market.RESULT_TOTAL_GOALS) {
    return (
      odds.resultTotalGoalsOdds[
        pick as keyof typeof odds.resultTotalGoalsOdds
      ] ?? null
    );
  }
  if (market === Market.RESULT_BTTS) {
    return (
      odds.resultBttsOdds[pick as keyof typeof odds.resultBttsOdds] ?? null
    );
  }
  return null;
}

function getYesNoOdds(
  yesNo: { yes: Decimal; no: Decimal } | null,
  pick: string,
): Decimal | null {
  if (yesNo === null) return null;
  if (pick === "YES") return yesNo.yes;
  if (pick === "NO") return yesNo.no;
  return null;
}

// Returns the odds of the primary market pick for a ViablePick.
// Used for line movement comparison.
export function getPickOdds(
  pick: ViablePick,
  odds: FullOddsSnapshot,
): Decimal | null {
  return getPickOddsFromSnapshot(pick.market, pick.pick, odds);
}

export function getModelProbabilityForPick(
  market: Market,
  pick: string,
  probabilities: MatchProbabilities,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === "HOME") return probabilities.home;
    if (pick === "DRAW") return probabilities.draw;
    if (pick === "AWAY") return probabilities.away;
  }
  if (market === Market.DOUBLE_CHANCE) {
    if (pick === "1X") return probabilities.dc1X;
    if (pick === "X2") return probabilities.dcX2;
    if (pick === "12") return probabilities.dc12;
  }
  if (market === Market.OVER_UNDER) {
    if (pick === "OVER_1_5") return probabilities.over15;
    if (pick === "UNDER_1_5") return probabilities.under15;
    if (pick === "OVER") return probabilities.over25;
    if (pick === "UNDER") return probabilities.under25;
    if (pick === "OVER_3_5") return probabilities.over35;
    if (pick === "UNDER_3_5") return probabilities.under35;
    if (pick === "OVER_4_5") return probabilities.over45;
    if (pick === "UNDER_4_5") return probabilities.under45;
  }
  if (market === Market.BTTS) {
    if (pick === "YES") return probabilities.bttsYes;
    if (pick === "NO") return probabilities.bttsNo;
  }
  if (market === Market.HALF_TIME_FULL_TIME && isHalfTimeFullTimePick(pick)) {
    return probabilities.htft[pick];
  }
  if (market === Market.OVER_UNDER_HT) {
    return probabilities.ouHT[pick as keyof typeof probabilities.ouHT] ?? null;
  }
  if (market === Market.FIRST_HALF_WINNER) {
    if (pick === "HOME") return probabilities.firstHalfWinner.home;
    if (pick === "DRAW") return probabilities.firstHalfWinner.draw;
    if (pick === "AWAY") return probabilities.firstHalfWinner.away;
  }
  if (market === Market.DRAW_NO_BET) {
    if (pick === "HOME") return probabilities.dnbHome;
    if (pick === "AWAY") return probabilities.dnbAway;
  }
  if (market === Market.TEAM_TOTAL_HOME) {
    return (
      probabilities.teamTotalHome[
        pick as keyof typeof probabilities.teamTotalHome
      ] ?? null
    );
  }
  if (market === Market.TEAM_TOTAL_AWAY) {
    return (
      probabilities.teamTotalAway[
        pick as keyof typeof probabilities.teamTotalAway
      ] ?? null
    );
  }
  if (market === Market.CLEAN_SHEET_HOME) {
    if (pick === "YES") return probabilities.cleanSheetHome;
    if (pick === "NO")
      return new Decimal(1).minus(probabilities.cleanSheetHome);
  }
  if (market === Market.CLEAN_SHEET_AWAY) {
    if (pick === "YES") return probabilities.cleanSheetAway;
    if (pick === "NO")
      return new Decimal(1).minus(probabilities.cleanSheetAway);
  }
  if (market === Market.WIN_TO_NIL_HOME) {
    if (pick === "YES") return probabilities.winToNilHome;
    if (pick === "NO") return new Decimal(1).minus(probabilities.winToNilHome);
  }
  if (market === Market.WIN_TO_NIL_AWAY) {
    if (pick === "YES") return probabilities.winToNilAway;
    if (pick === "NO") return new Decimal(1).minus(probabilities.winToNilAway);
  }
  if (market === Market.TO_WIN_EITHER_HALF) {
    if (pick === "HOME") return probabilities.winEitherHalfHome;
    if (pick === "AWAY") return probabilities.winEitherHalfAway;
  }
  if (market === Market.RESULT_TOTAL_GOALS) {
    return (
      probabilities.resultTotalGoals[
        pick as keyof typeof probabilities.resultTotalGoals
      ] ?? null
    );
  }
  if (market === Market.RESULT_BTTS) {
    return (
      probabilities.resultBtts[
        pick as keyof typeof probabilities.resultBtts
      ] ?? null
    );
  }
  return null;
}

export function estimateComboOdds(input: {
  combo: ComboPick;
  probabilities: MatchProbabilities;
  jointProbability: Decimal;
  odds1: Decimal;
  odds2: Decimal;
}): Decimal {
  const { combo, probabilities, jointProbability, odds1, odds2 } = input;
  const probability1 = getModelProbabilityForPick(
    combo.market1,
    combo.pick1,
    probabilities,
  );
  const probability2 = getModelProbabilityForPick(
    combo.market2,
    combo.pick2,
    probabilities,
  );

  const rawProduct = odds1.mul(odds2);
  if (
    probability1 === null ||
    probability2 === null ||
    jointProbability.lte(0) ||
    probability1.lte(0) ||
    probability2.lte(0)
  ) {
    return rawProduct;
  }

  const independentProbability = probability1.mul(probability2);
  if (independentProbability.lte(0)) {
    return rawProduct;
  }

  const correlationFactor = independentProbability
    .div(jointProbability)
    .pow(COMBO_CORRELATION_ALPHA);
  const clampedFactor = Decimal.min(
    COMBO_CORRELATION_MAX_FACTOR,
    Decimal.max(COMBO_CORRELATION_MIN_FACTOR, correlationFactor),
  );

  return rawProduct.mul(clampedFactor);
}
