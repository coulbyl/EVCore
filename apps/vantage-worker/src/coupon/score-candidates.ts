import {
  calculateEV,
  calibrateLegProbability,
  clearsMaxLegEdge,
  clearsMinLegOdds,
  clearsTeamTotalMaxOdds,
  clearsValueEdgeFloor,
  depthRank,
  type ChannelReliability,
  type ChannelReliabilityMap,
} from "@evcore/analysis-core";
import type { PoolCandidate } from "./pool-query";

// Phase B step 1 (docs/vantage-centric-redesign-2026-09-01.md §9 point 1):
// calibrate + admit + reduce the raw pool (pool-query.ts) to the small,
// already-scored view the LLM actually sees. The LLM is never handed a raw
// probability/odds to recompute — every number it needs (calibrated
// probability, edge, EV) is computed here, deterministically, once.

export type ScoredCandidate = PoolCandidate & {
  calibratedProbability: number;
  /** Mirrors calibratedProbability — guardrails.ts's CouponLeg shape expects
   * both names (legacy blend fallback when calibration hasn't run; always
   * populated here). */
  calibratedHitRate: number;
  /** legEV recomputed on the CALIBRATED probability — supersedes
   * PoolCandidate.legEV, which is on the raw one. */
  legEV: number | null;
  /** calibratedProbability − pMarketFair (overround-removed market prob). */
  edge: number | null;
};

export function scoreCandidates(
  candidates: readonly PoolCandidate[],
  calibration: {
    channelReliability: ChannelReliabilityMap;
    pooledReliability: ChannelReliability;
  },
): ScoredCandidate[] {
  return candidates.map((candidate) => {
    const calibratedProbability = calibrateLegProbability(
      { probability: candidate.probability, canal: candidate.canal },
      calibration,
    );
    const legEV =
      candidate.oddsSnapshot !== null
        ? calculateEV(calibratedProbability, candidate.oddsSnapshot).toNumber()
        : null;
    const edge =
      candidate.pMarketFair !== null
        ? calibratedProbability - candidate.pMarketFair
        : null;

    return {
      ...candidate,
      calibratedProbability,
      calibratedHitRate: calibratedProbability,
      legEV,
      edge,
    };
  });
}

// The same admission gates CouponComposerService.compose() applied before
// building a coupon (clearsValueEdgeFloor/clearsTeamTotalMaxOdds/
// clearsMaxLegEdge/clearsMinLegOdds, @evcore/analysis-core/coupon/
// guardrails.ts) — applied here, once, before the LLM ever sees a
// candidate, rather than left for Phase C's post-generation check to catch.
// Phase C still re-runs them (never trust a single gate), but a candidate
// that can't survive them has no business being offered to the LLM in the
// first place.
export function admissibleCandidates(
  scored: readonly ScoredCandidate[],
): ScoredCandidate[] {
  return scored
    .filter((c) => c.oddsSnapshot !== null)
    .filter((c) => clearsValueEdgeFloor(c))
    .filter((c) => clearsTeamTotalMaxOdds(c))
    .filter((c) => clearsMaxLegEdge(c))
    .filter((c) => clearsMinLegOdds(c));
}

// Reduces the admissible candidates to the LLM-facing pool — the "Fiabilité"
// (anchors, ranked by calibrated probability) and "Valeur" (ranked by edge)
// modes from COUPON_ANALYSIS_TEMPLATE.md merged into one deduplicated list,
// depthRank as the tie-break within each mode. `reliabilityTopN`/
// `valueTopN` are a starting point matching the template's own qualitative
// description ("quelques jambes-ancres, quelques jambes-valeur"), NOT
// backtested for this automatic pipeline — same caveat
// ANCHOR_MIN_PROBABILITY carried in the retired composer.
export function reduceToLlmPool(
  admissible: readonly ScoredCandidate[],
  opts: { reliabilityTopN?: number; valueTopN?: number } = {},
): ScoredCandidate[] {
  const reliabilityTopN = opts.reliabilityTopN ?? 30;
  const valueTopN = opts.valueTopN ?? 20;

  const byReliability = [...admissible].sort(
    (a, b) =>
      b.calibratedProbability - a.calibratedProbability ||
      depthRank(b) - depthRank(a),
  );
  const byValue = [...admissible].sort(
    (a, b) => (b.edge ?? -Infinity) - (a.edge ?? -Infinity) || depthRank(b) - depthRank(a),
  );

  const key = (c: ScoredCandidate) => `${c.fixtureId}:${c.market}:${c.pick}`;
  const seen = new Set<string>();
  const pool: ScoredCandidate[] = [];
  for (const c of [
    ...byReliability.slice(0, reliabilityTopN),
    ...byValue.slice(0, valueTopN),
  ]) {
    const k = key(c);
    if (seen.has(k)) continue;
    seen.add(k);
    pool.push(c);
  }
  return pool;
}
