import {
  Market,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
} from "@evcore/analysis-core";
import type { ReplayFixture } from "./point-in-time-loader";

/**
 * Settlement of one pick on a replayed fixture's score, with the production
 * resolvers: half-time markets read the half-time score, the rest the full
 * time score. SETTLEMENT TRUTH: read after the decision, never fed into it.
 */
export function settleReplayPick(
  fixture: Pick<
    ReplayFixture,
    "homeScore" | "awayScore" | "homeHtScore" | "awayHtScore"
  >,
  pick: { market: Market; pick: string },
): ReturnType<typeof resolvePickBetStatus> {
  const { homeScore, awayScore, homeHtScore, awayHtScore } = fixture;
  switch (pick.market) {
    case Market.OVER_UNDER_HT:
    case Market.FIRST_HALF_WINNER:
      return resolveFirstHalfBetStatus(pick.pick, homeHtScore, awayHtScore);
    case Market.HALF_TIME_FULL_TIME:
      return resolveHalfTimeFullTimeBetStatus({
        pick: pick.pick,
        homeHtScore,
        awayHtScore,
        homeScore,
        awayScore,
      });
    case Market.TO_WIN_EITHER_HALF:
      return resolveWinEitherHalfBetStatus(
        pick.pick,
        homeHtScore,
        awayHtScore,
        homeScore,
        awayScore,
      );
    default:
      return resolvePickBetStatus(pick.market, pick.pick, homeScore, awayScore);
  }
}
