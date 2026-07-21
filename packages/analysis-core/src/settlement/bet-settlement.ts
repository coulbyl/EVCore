import { BetStatus, Market } from "../types";
import { outcomeFromScores } from "../probability/markets";
import { PICK_CONDITIONS } from "../probability/combo";

type ResolveHalfTimeFullTimeInput = {
  pick: string;
  homeHtScore: number | null;
  awayHtScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type EarlyBetStatusInput = {
  market: Market;
  pick: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

// Resolve the outcome of a HALF_TIME_FULL_TIME bet against half-time and full-time scores.
export function resolveHalfTimeFullTimeBetStatus(
  input: ResolveHalfTimeFullTimeInput,
): BetStatus {
  if (
    input.homeHtScore === null ||
    input.awayHtScore === null ||
    input.homeScore === null ||
    input.awayScore === null
  ) {
    return BetStatus.VOID;
  }

  const [expectedHalf, expectedFull] = input.pick.split("_");
  if (!expectedHalf || !expectedFull) return BetStatus.VOID;

  const halfOutcome = outcomeFromScores(input.homeHtScore, input.awayHtScore);
  const fullOutcome = outcomeFromScores(input.homeScore, input.awayScore);
  if (!halfOutcome || !fullOutcome) return BetStatus.VOID;

  return expectedHalf === halfOutcome && expectedFull === fullOutcome
    ? BetStatus.WON
    : BetStatus.LOST;
}

// Resolve OVER_UNDER_HT and FIRST_HALF_WINNER bets against half-time scores.
export function resolveFirstHalfBetStatus(
  pick: string,
  homeHtScore: number | null,
  awayHtScore: number | null,
): BetStatus {
  if (homeHtScore === null || awayHtScore === null) return BetStatus.VOID;
  const condition = PICK_CONDITIONS[pick];
  if (!condition) return BetStatus.VOID;
  return condition(homeHtScore, awayHtScore) ? BetStatus.WON : BetStatus.LOST;
}

// Resolve TO_WIN_EITHER_HALF: a team wins the pick's outcome if it wins the
// first half OR the (derived) second half. Mirrors the winEitherHalfHome/Away
// probability definition in poisson.ts (inclusion of either half, not a
// derivative of the full-time result).
export function resolveWinEitherHalfBetStatus(
  pick: string,
  homeHtScore: number | null,
  awayHtScore: number | null,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (
    homeHtScore === null ||
    awayHtScore === null ||
    homeScore === null ||
    awayScore === null
  ) {
    return BetStatus.VOID;
  }
  if (pick !== "HOME" && pick !== "AWAY") return BetStatus.VOID;

  const homeSecondHalf = homeScore - homeHtScore;
  const awaySecondHalf = awayScore - awayHtScore;
  const wonFirstHalf =
    pick === "HOME" ? homeHtScore > awayHtScore : awayHtScore > homeHtScore;
  const wonSecondHalf =
    pick === "HOME"
      ? homeSecondHalf > awaySecondHalf
      : awaySecondHalf > homeSecondHalf;

  return wonFirstHalf || wonSecondHalf ? BetStatus.WON : BetStatus.LOST;
}

// A "YES"/"NO" pick resolved from a single boolean condition (e.g. clean
// sheet, win to nil). Unknown pick values VOID rather than silently settling.
function resolveYesNoPick(pick: string, conditionTrue: boolean): BetStatus {
  if (pick === "YES") return conditionTrue ? BetStatus.WON : BetStatus.LOST;
  if (pick === "NO") return conditionTrue ? BetStatus.LOST : BetStatus.WON;
  return BetStatus.VOID;
}

// TEAM_TOTAL_HOME/AWAY picks are OVER_x_5 / UNDER_x_5 against a single team's
// goals — not PICK_CONDITIONS' OVER/UNDER (which sum both teams).
function resolveTeamTotalPick(pick: string, teamScore: number): BetStatus {
  const match = /^(OVER|UNDER)_(\d)_5$/.exec(pick);
  if (!match || !match[1] || !match[2]) return BetStatus.VOID;
  const threshold = Number(match[2]) + 0.5;
  const over = teamScore > threshold;
  return (match[1] === "OVER") === over ? BetStatus.WON : BetStatus.LOST;
}

// RESULT_TOTAL_GOALS picks combine the match result with a total-goals line,
// e.g. "HOME_OVER_1_5": won iff the result matches AND the total-goals side
// of the pick matches.
function resolveResultTotalGoalsPick(
  pick: string,
  homeScore: number,
  awayScore: number,
): BetStatus {
  const match = /^(HOME|DRAW|AWAY)_(OVER|UNDER)_(\d)_5$/.exec(pick);
  if (!match || !match[1] || !match[2] || !match[3]) return BetStatus.VOID;
  const [, side, direction, digits] = match;
  if (outcomeFromScores(homeScore, awayScore) !== side) return BetStatus.LOST;
  const threshold = Number(digits) + 0.5;
  const over = homeScore + awayScore > threshold;
  return (direction === "OVER") === over ? BetStatus.WON : BetStatus.LOST;
}

// RESULT_BTTS picks combine the match result with BTTS, e.g. "HOME_YES".
function resolveResultBttsPick(
  pick: string,
  homeScore: number,
  awayScore: number,
): BetStatus {
  const match = /^(HOME|DRAW|AWAY)_(YES|NO)$/.exec(pick);
  if (!match || !match[1] || !match[2]) return BetStatus.VOID;
  const [, side, yesNo] = match;
  if (outcomeFromScores(homeScore, awayScore) !== side) return BetStatus.LOST;
  const bothScored = homeScore >= 1 && awayScore >= 1;
  return (yesNo === "YES") === bothScored ? BetStatus.WON : BetStatus.LOST;
}

// Resolve a bet from in-progress scores when the outcome is already irrevocable.
// Returns null if the outcome cannot yet be determined (wait for FINISHED).
// Never re-settles combos here — callers handle those separately.
export function resolveEarlyBetStatus({
  market,
  pick,
  homeScore,
  awayScore,
  homeHtScore,
  awayHtScore,
}: EarlyBetStatusInput): BetStatus | null {
  // HT markets — settle as soon as HT scores are available
  if (market === Market.OVER_UNDER_HT || market === Market.FIRST_HALF_WINNER) {
    if (homeHtScore === null || awayHtScore === null) return null;
    return resolveFirstHalfBetStatus(pick, homeHtScore, awayHtScore);
  }

  // HTFT needs both HT and FT — only settle at FINISHED
  if (market === Market.HALF_TIME_FULL_TIME) return null;

  // 1X2 and DC — in-progress score doesn't confirm final result
  if (market === Market.ONE_X_TWO || market === Market.DOUBLE_CHANCE)
    return null;

  const totalGoals = homeScore + awayScore;

  if (market === Market.BTTS) {
    const bothScored = homeScore >= 1 && awayScore >= 1;
    if (pick === "YES") return bothScored ? BetStatus.WON : null;
    if (pick === "NO") return bothScored ? BetStatus.LOST : null;
    return null;
  }

  // OVER picks: irrevocably WON once goal threshold is crossed
  const OVER_WON_THRESHOLD: Record<string, number> = {
    OVER_0_5: 1,
    OVER_1_5: 2,
    OVER: 3,
    OVER_3_5: 4,
    OVER_4_5: 5,
  };
  // UNDER picks: irrevocably LOST once goal threshold is crossed
  const UNDER_LOST_THRESHOLD: Record<string, number> = {
    UNDER_0_5: 1,
    UNDER_1_5: 2,
    UNDER: 3,
    UNDER_3_5: 4,
    UNDER_4_5: 5,
  };

  const overThreshold = OVER_WON_THRESHOLD[pick];
  if (overThreshold !== undefined) {
    return totalGoals >= overThreshold ? BetStatus.WON : null;
  }

  const underThreshold = UNDER_LOST_THRESHOLD[pick];
  if (underThreshold !== undefined) {
    return totalGoals >= underThreshold ? BetStatus.LOST : null;
  }

  return null;
}

// Resolve the outcome of a single-market bet from the final score. `market`
// disambiguates pick strings that collide across markets (e.g. "YES" means
// "both teams scored" for BTTS but "conceded nothing" for CLEAN_SHEET_HOME) —
// never fall back to the generic PICK_CONDITIONS lookup for those markets.
export function resolvePickBetStatus(
  market: Market,
  pick: string,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (homeScore === null || awayScore === null) return BetStatus.VOID;

  // CORRECT_SCORE picks are dynamic scorelines "H:A": won iff the final score
  // matches exactly.
  if (market === Market.CORRECT_SCORE) {
    return pick === `${homeScore}:${awayScore}`
      ? BetStatus.WON
      : BetStatus.LOST;
  }

  if (market === Market.DRAW_NO_BET) {
    if (homeScore === awayScore) return BetStatus.VOID; // stake refunded
    if (pick === "HOME") {
      return homeScore > awayScore ? BetStatus.WON : BetStatus.LOST;
    }
    if (pick === "AWAY") {
      return awayScore > homeScore ? BetStatus.WON : BetStatus.LOST;
    }
    return BetStatus.VOID;
  }

  if (market === Market.TEAM_TOTAL_HOME) {
    return resolveTeamTotalPick(pick, homeScore);
  }
  if (market === Market.TEAM_TOTAL_AWAY) {
    return resolveTeamTotalPick(pick, awayScore);
  }

  if (market === Market.CLEAN_SHEET_HOME) {
    return resolveYesNoPick(pick, awayScore === 0);
  }
  if (market === Market.CLEAN_SHEET_AWAY) {
    return resolveYesNoPick(pick, homeScore === 0);
  }
  if (market === Market.WIN_TO_NIL_HOME) {
    return resolveYesNoPick(pick, homeScore > awayScore && awayScore === 0);
  }
  if (market === Market.WIN_TO_NIL_AWAY) {
    return resolveYesNoPick(pick, awayScore > homeScore && homeScore === 0);
  }

  if (market === Market.RESULT_TOTAL_GOALS) {
    return resolveResultTotalGoalsPick(pick, homeScore, awayScore);
  }
  if (market === Market.RESULT_BTTS) {
    return resolveResultBttsPick(pick, homeScore, awayScore);
  }

  // ONE_X_TWO, OVER_UNDER, BTTS, DOUBLE_CHANCE
  const condition = PICK_CONDITIONS[pick];
  if (!condition) return BetStatus.VOID;
  return condition(homeScore, awayScore) ? BetStatus.WON : BetStatus.LOST;
}
