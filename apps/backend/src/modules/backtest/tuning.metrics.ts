// Pure threshold-sweep helpers for the offline channel tuning brick. No I/O,
// no Prisma — every channel's selection is reconstructed from the stored
// signals + odds at each candidate threshold, then scored flat-stake.

import { DOMINANT_MIN_MARGIN } from '@modules/betting-engine/strategies/channel-strategy.config';
import type { ChannelStrategyConfigChannel } from '@modules/betting-engine/strategies/channel-strategy.config';
import { getOneXTwoOutcome } from './backtest.report';
import { flatRoi } from './backtest.metrics';
import type { ChannelTuningRow } from './backtest.repository';
import {
  CHANNEL_PROMOTION_RULE,
  TUNING_THRESHOLD_GRID,
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

function sweep(
  channel: ChannelStrategyConfigChannel,
  selectables: Selectable[],
): ThresholdPoint[] {
  const denom = selectables.length;
  return (TUNING_THRESHOLD_GRID[channel] ?? []).map((threshold) => {
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

function recommend(
  channel: ChannelStrategyConfigChannel,
  points: ThresholdPoint[],
): ThresholdRecommendation | null {
  const rule = CHANNEL_PROMOTION_RULE[channel];
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
