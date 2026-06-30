import { BetStatus, Market } from '@evcore/db';
import {
  resolveComboPickBetStatus,
  resolveEarlyBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  type ComboPick,
} from './betting-engine.utils';

export type SettleableSelection = {
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
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
  if (selection.comboMarket !== null && selection.comboPick !== null) {
    const combo: ComboPick = {
      market1: selection.market,
      pick1: selection.pick,
      market2: selection.comboMarket,
      pick2: selection.comboPick,
    };
    return resolveComboPickBetStatus(combo, scores.homeScore, scores.awayScore);
  }

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
 * in-progress score (e.g. BTTS confirmed, UNDER exceeded). Returns null to defer
 * to final settlement. Mirrors `settleEarlyBets`: a combo can only early-LOSE.
 */
export function resolveSelectionEarlyResult(
  selection: SettleableSelection,
  scores: FixtureScores,
): BetStatus | null {
  if (selection.comboMarket !== null && selection.comboPick !== null) {
    const s1 = resolveEarlyBetStatus({
      market: selection.market,
      pick: selection.pick,
      ...scores,
    });
    const s2 = resolveEarlyBetStatus({
      market: selection.comboMarket,
      pick: selection.comboPick,
      ...scores,
    });
    return s1 === BetStatus.LOST || s2 === BetStatus.LOST
      ? BetStatus.LOST
      : null;
  }

  return resolveEarlyBetStatus({
    market: selection.market,
    pick: selection.pick,
    ...scores,
  });
}
