// Pure threshold-sweep helpers for the offline channel tuning brick. No I/O,
// no Prisma — every channel's selection is reconstructed from the stored
// signals + odds at each candidate threshold, then scored flat-stake.

import { DOMINANT_MIN_MARGIN } from '@modules/betting-engine/strategies/channel-strategy.config';
import type { ChannelStrategyConfigChannel } from '@modules/betting-engine/strategies/channel-strategy.config';
import { getOneXTwoOutcome } from './backtest.report';
import { flatRoi } from './backtest.metrics';
import type { ChannelTuningRow } from './backtest.repository';
import {
  BTTS_NO_PROMOTION_RULE,
  BTTS_NO_TUNING_THRESHOLD_GRID,
  CHANNEL_PROMOTION_RULE,
  GOALS_PROMOTION_RULE,
  GOALS_TUNING_THRESHOLD_GRID,
  TUNING_THRESHOLD_GRID,
  type ChannelPromotionRule,
  type GoalsTuningSide,
} from './tuning.constants';

const DOMINANT_MARGIN = DOMINANT_MIN_MARGIN.toNumber();

/** A fixture that could be selected by a channel, with its signal + outcome. */
type Selectable = { signal: number; won: boolean; odds: number };

export type ThresholdPoint = {
  threshold: number;
  /** Selections admitted at this threshold (signal ≥ threshold, with odds). */
  total: number;
  won: number;
  hitRate: number;
  /** Share of eligible fixtures admitted at this threshold. */
  coverage: number;
  /** Flat-stake ROI over the admitted selections. */
  roi: number;
};

export type ThresholdRecommendation = ThresholdPoint & { verdict: 'PASS' };

export type ChannelThresholdSweep = {
  channel: ChannelStrategyConfigChannel;
  /** Eligible fixtures (signal computable + required odds present). */
  candidates: number;
  points: ThresholdPoint[];
  /** Best PASS threshold per the channel's promotion rule, or `null`. */
  recommended: ThresholdRecommendation | null;
};

/** Builds the channel's selectable fixtures from raw tuning rows. */
function buildSelectables(
  channel: ChannelStrategyConfigChannel,
  rows: ChannelTuningRow[],
): Selectable[] {
  if (channel === 'DRAW') return drawSelectables(rows);
  if (channel === 'BTTS') return bttsSelectables(rows);
  if (channel === 'CLEAN_SHEET') return cleanSheetSelectables(rows);
  if (channel === 'WIN_EITHER_HALF') return winEitherHalfSelectables(rows);
  return dominantSelectables(rows);
}

function dominantSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    const ranked = [
      { pick: 'HOME' as const, p: r.probHome, odds: r.oddsHome },
      { pick: 'DRAW' as const, p: r.probDraw, odds: r.oddsDraw },
      { pick: 'AWAY' as const, p: r.probAway, odds: r.oddsAway },
    ].sort((a, b) => b.p - a.p);
    const first = ranked[0];
    const second = ranked[1];
    if (!first || !second) continue;
    // Margin is a threshold-independent selection criterion — fixtures that
    // fail it would never be SELECTED at any threshold, so drop them upfront.
    if (first.p - second.p < DOMINANT_MARGIN) continue;
    if (first.odds === null) continue;
    const outcome = getOneXTwoOutcome(r.homeScore, r.awayScore);
    out.push({
      signal: first.p,
      won: outcome === first.pick,
      odds: first.odds,
    });
  }
  return out;
}

function drawSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    if (r.oddsDraw === null || r.oddsDraw <= 0) continue;
    // The DRAW signal is the bookmaker implied probability, not the model prob.
    out.push({
      signal: 1 / r.oddsDraw,
      won: getOneXTwoOutcome(r.homeScore, r.awayScore) === 'DRAW',
      odds: r.oddsDraw,
    });
  }
  return out;
}

function bttsSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    if (r.probBttsYes === null || r.oddsBttsYes === null) continue;
    out.push({
      signal: r.probBttsYes,
      won: r.homeScore > 0 && r.awayScore > 0,
      odds: r.oddsBttsYes,
    });
  }
  return out;
}

// CLEAN_SHEET — argmax(probCleanSheetHome, probCleanSheetAway), no margin gate
// (unlike DOMINANT's 3-way argmax, CleanSheetStrategy doesn't require one).
function cleanSheetSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    const candidates = [
      {
        side: 'HOME' as const,
        p: r.probCleanSheetHome,
        odds: r.oddsCleanSheetHome,
      },
      {
        side: 'AWAY' as const,
        p: r.probCleanSheetAway,
        odds: r.oddsCleanSheetAway,
      },
    ].filter(
      (c): c is { side: 'HOME' | 'AWAY'; p: number; odds: number } =>
        c.p !== null && c.odds !== null,
    );
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (b.p > a.p ? b : a));
    out.push({
      signal: best.p,
      won: best.side === 'HOME' ? r.awayScore === 0 : r.homeScore === 0,
      odds: best.odds,
    });
  }
  return out;
}

// WIN_EITHER_HALF — argmax(probWinEitherHalfHome, probWinEitherHalfAway).
// Requires HT scores to resolve the outcome (a team can win the match without
// winning either half outright — see win-either-half.strategy.ts).
function winEitherHalfSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    if (r.homeHtScore === null || r.awayHtScore === null) continue;
    const candidates = [
      {
        side: 'HOME' as const,
        p: r.probWinEitherHalfHome,
        odds: r.oddsWinEitherHalfHome,
      },
      {
        side: 'AWAY' as const,
        p: r.probWinEitherHalfAway,
        odds: r.oddsWinEitherHalfAway,
      },
    ].filter(
      (c): c is { side: 'HOME' | 'AWAY'; p: number; odds: number } =>
        c.p !== null && c.odds !== null,
    );
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (b.p > a.p ? b : a));
    const homeWonHalf =
      r.homeHtScore > r.awayHtScore ||
      r.homeScore - r.homeHtScore > r.awayScore - r.awayHtScore;
    const awayWonHalf =
      r.awayHtScore > r.homeHtScore ||
      r.awayScore - r.awayHtScore > r.homeScore - r.homeHtScore;
    out.push({
      signal: best.p,
      won: best.side === 'HOME' ? homeWonHalf : awayWonHalf,
      odds: best.odds,
    });
  }
  return out;
}

// Generic threshold sweep over an explicit grid — shared by the config-driven
// channels and the GOALS line sweep.
function sweepGrid(
  grid: readonly number[],
  selectables: Selectable[],
): ThresholdPoint[] {
  const denom = selectables.length;
  return grid.map((threshold) => {
    const sel = selectables.filter((s) => s.signal >= threshold);
    const won = sel.filter((s) => s.won).length;
    return {
      threshold,
      total: sel.length,
      won,
      hitRate: sel.length > 0 ? won / sel.length : 0,
      coverage: denom > 0 ? sel.length / denom : 0,
      roi: flatRoi(sel),
    };
  });
}

function sweep(
  channel: ChannelStrategyConfigChannel,
  selectables: Selectable[],
): ThresholdPoint[] {
  return sweepGrid(TUNING_THRESHOLD_GRID[channel] ?? [], selectables);
}

// Best PASS threshold per a promotion rule, or null. Shared selector.
function recommendFrom(
  rule: ChannelPromotionRule,
  points: ThresholdPoint[],
): ThresholdRecommendation | null {
  const passing = points.filter(
    (p) =>
      p.total >= rule.minSample &&
      p.roi >= rule.roiFloor &&
      (rule.hitRateFloor === null || p.hitRate >= rule.hitRateFloor),
  );
  if (passing.length === 0) return null;
  // Best ROI wins; ties break toward the lower threshold (more coverage).
  const best = passing.reduce((a, b) =>
    b.roi > a.roi || (b.roi === a.roi && b.threshold < a.threshold) ? b : a,
  );
  return { ...best, verdict: 'PASS' };
}

function recommend(
  channel: ChannelStrategyConfigChannel,
  points: ThresholdPoint[],
): ThresholdRecommendation | null {
  return recommendFrom(CHANNEL_PROMOTION_RULE[channel], points);
}

/** Full threshold sweep + recommendation for one channel over a fixture set. */
export function buildChannelThresholdSweep(
  channel: ChannelStrategyConfigChannel,
  rows: ChannelTuningRow[],
): ChannelThresholdSweep {
  const selectables = buildSelectables(channel, rows);
  const points = sweep(channel, selectables);
  return {
    channel,
    candidates: selectables.length,
    points,
    recommended: recommend(channel, points),
  };
}

// ─────────────────────────────────────────────
// GOALS (Over/Under 2.5) sweep — separate from the uniform channel brick: the
// signal is the model side probability, the outcome compares total goals to the
// line, and promotion is ROI-driven (GOALS_PROMOTION_RULE).
// ─────────────────────────────────────────────

export type GoalsLineSweep = {
  side: GoalsTuningSide;
  line: number;
  candidates: number;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

function goalsSelectables(
  rows: ChannelTuningRow[],
  side: GoalsTuningSide,
): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    const signal = side === 'OVER' ? r.probOver25 : r.probUnder25;
    const odds = side === 'OVER' ? r.oddsOver25 : r.oddsUnder25;
    if (signal === null || odds === null || odds <= 0) continue;
    const totalGoals = r.homeScore + r.awayScore;
    out.push({
      signal,
      won: side === 'OVER' ? totalGoals > 2 : totalGoals < 3,
      odds,
    });
  }
  return out;
}

// ─────────────────────────────────────────────
// BTTS NO sweep — calibrated separately from YES and per-league. Signal is the
// model P(NO BTTS); a selection wins when NOT both teams score. Promotion mirrors
// BTTS YES (hit rate + non-negative ROI). Produces a per-competition threshold
// recommendation so NO can be tuned championship by championship.
// ─────────────────────────────────────────────

export type BttsNoSweep = {
  candidates: number;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

function bttsNoSelectables(rows: ChannelTuningRow[]): Selectable[] {
  const out: Selectable[] = [];
  for (const r of rows) {
    if (r.probBttsNo === null || r.oddsBttsNo === null || r.oddsBttsNo <= 0) {
      continue;
    }
    out.push({
      signal: r.probBttsNo,
      won: !(r.homeScore > 0 && r.awayScore > 0),
      odds: r.oddsBttsNo,
    });
  }
  return out;
}

/** Threshold sweep + recommendation for the BTTS NO side over a fixture set. */
export function buildBttsNoSweep(rows: ChannelTuningRow[]): BttsNoSweep {
  const selectables = bttsNoSelectables(rows);
  const points = sweepGrid(BTTS_NO_TUNING_THRESHOLD_GRID, selectables);
  return {
    candidates: selectables.length,
    points,
    recommended: recommendFrom(BTTS_NO_PROMOTION_RULE, points),
  };
}

/** Threshold sweep + ROI-driven recommendation for one GOALS (line × side). */
export function buildGoalsLineSweep(
  side: GoalsTuningSide,
  rows: ChannelTuningRow[],
): GoalsLineSweep {
  const selectables = goalsSelectables(rows, side);
  const points = sweepGrid(GOALS_TUNING_THRESHOLD_GRID, selectables);
  return {
    side,
    line: 2.5,
    candidates: selectables.length,
    points,
    recommended: recommendFrom(GOALS_PROMOTION_RULE, points),
  };
}
