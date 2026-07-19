import { BetStatus, Market } from '@evcore/db';
import {
  resolveEarlyBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
} from './betting-engine.utils';

export type SettleableSelection = {
  market: Market;
  pick: string;
};

export type FixtureScores = {
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

/**
 * Final analytical result of a ChannelSelection from the definitive score.
 * Mirrors the bet settlement in `settleOpenBets` exactly (same resolvers), so a
 * selection linked to a Bet resolves to the same status as that Bet — Bet.status
 * stays the financial authority, this is the analytical mirror (doc §5).
 */
export function resolveSelectionFinalResult(
  selection: SettleableSelection,
  scores: FixtureScores,
): BetStatus {
  if (selection.market === Market.HALF_TIME_FULL_TIME) {
    return resolveHalfTimeFullTimeBetStatus({
      pick: selection.pick,
      homeHtScore: scores.homeHtScore,
      awayHtScore: scores.awayHtScore,
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
    });
  }

  if (
    selection.market === Market.OVER_UNDER_HT ||
    selection.market === Market.FIRST_HALF_WINNER
  ) {
    return resolveFirstHalfBetStatus(
      selection.pick,
      scores.homeHtScore,
      scores.awayHtScore,
    );
  }

  return resolvePickBetStatus(
    selection.pick,
    scores.homeScore,
    scores.awayScore,
  );
}

/**
 * Early analytical result — only when the outcome is irrevocable from the
 * in-progress score (e.g. BTTS confirmed, UNDER exceeded). Returns null to
 * defer to final settlement.
 */
export function resolveSelectionEarlyResult(
  selection: SettleableSelection,
  scores: FixtureScores,
): BetStatus | null {
  return resolveEarlyBetStatus({
    market: selection.market,
    pick: selection.pick,
    ...scores,
  });
}
