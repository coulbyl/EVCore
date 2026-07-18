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

// Resolve the outcome of a single-market bet (1X2, OVER_UNDER, BTTS, DOUBLE_CHANCE).
export function resolvePickBetStatus(
  pick: string,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (homeScore === null || awayScore === null) return BetStatus.VOID;
  // CORRECT_SCORE picks are dynamic scorelines "H:A" (not in PICK_CONDITIONS):
  // won iff the final score matches exactly.
  if (/^\d+:\d+$/.test(pick)) {
    return pick === `${homeScore}:${awayScore}`
      ? BetStatus.WON
      : BetStatus.LOST;
  }
  const condition = PICK_CONDITIONS[pick];
  if (!condition) return BetStatus.VOID;
  return condition(homeScore, awayScore) ? BetStatus.WON : BetStatus.LOST;
}
