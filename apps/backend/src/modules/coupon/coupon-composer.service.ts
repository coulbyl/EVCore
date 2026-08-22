import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { VALUE_MIN_EDGE } from '@evcore/analysis-core';
import { productDecimal } from '@utils/decimal.utils';
import { calculateEV } from '@modules/betting-engine/betting-engine.utils';
import {
  EV_MAX_SOFT_ALERT,
  getValueMinEdge,
} from '@modules/betting-engine/ev.constants';
import {
  COUPON_PARAMS,
  CANAL_BASE_WEIGHT,
  DEFAULT_CANAL_BASE_WEIGHT,
  DEFAULT_COUPON_PROFILE,
  EXHAUSTIVE_LEG_THRESHOLD,
  GREEDY_START_VARIANTS,
  JOINT_PROBABILITY_CORRELATION_FACTOR,
  COUPON_EV_DEFLATION,
  ANCHOR_MIN_PROBABILITY,
  MAX_POOL_PER_COMPETITION,
  type CouponProfileBounds,
} from './coupon.constants';
import {
  applyReliability,
  type ChannelReliability,
  type ChannelReliabilityMap,
} from '@modules/adjustment/channel-reliability';
import type { ScoredPick, SignalWindow } from './signal-window.service';

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const MIN_DISTINCT_FIXTURES = 2;
const MAX_POOL_SIZE = 25;

export type ComposedCoupon = {
  rank: number;
  legs: ScoredPick[];
  combinedOdds: number;
  /** Produit brut des probas par jambe, avant shrinkage (voir `jointProbability`). */
  rawJointProbability: number;
  jointProbability: number;
  /** EV du coupon : `P_coupon × Odd_coupon − 1` (cf. DESIGN.md Étape 1). */
  couponEV: number;
  /**
   * `couponEV` moins la pénalité de biais de sélection (COUPON_EV_DEFLATION).
   * Filtre de viabilité et classement s'appliquent à CETTE valeur ; `couponEV`
   * reste la valeur brute, recalculable à la main depuis les jambes stockées.
   * `undefined` hors de `compose()`.
   */
  deflatedCouponEV?: number;
  signalScore: number;
  reasoning: Record<string, unknown>;
};

// jointProbability was previously the product of canal-level calibrated hit
// rates only — every coupon with the same canal mix stored the identical value
// (audit 2026-06-11: six pending coupons all at 0.4743 = SAFE rate × BTTS rate),
// making the viability filter and the jointProbability sort degenerate among
// same-canal combos. Blending each pick's model probability with its canal
// calibrated rate keeps the calibration tempering (raw model probabilities are
// over-confident) while restoring pick-specific joint probabilities.
export const LEG_PROBABILITY_MODEL_WEIGHT = 0.5;

export function calibratedLegProbability(leg: {
  probability: number;
  calibratedHitRate: number;
}): number {
  return (
    leg.probability * LEG_PROBABILITY_MODEL_WEIGHT +
    leg.calibratedHitRate * (1 - LEG_PROBABILITY_MODEL_WEIGHT)
  );
}

// Per-leg probability calibration — applies the leg's OWN channel reliability
// curve (Platt on the logit scale, see channel-reliability.ts).
//
// Replaces a per-market mean-error shift (`marketCalibration[market].meanError`,
// subtracted from the raw probability) that was wrong in two ways, both
// measured 2026-08-22:
//
//   1. Wrong SHAPE. The reliability curve is flatter than the diagonal, not
//      offset from it: announced 0.46 -> 0.81 while realised moves only
//      0.46 -> 0.59. A constant shift under-corrects the top of the range and
//      over-corrects the bottom, whatever value it takes.
//   2. Wrong GROUPING. The bias is channel-specific (realised/announced from
//      1.016 for DRAW to 0.623 for RESULT_BTTS), and a market-pooled figure
//      averages channels that need opposite corrections. Grouping by channel
//      also subsumes the market grouping in practice, since a channel owns one
//      or two markets.
//
// A channel with little settled history is shrunk toward the pooled curve in
// proportion to its sample size rather than dropped to a fallback, so there is
// no cliff and no "uncalibrated" branch left (see shrinkTowardPooled).
export function calibrateLegProbability(
  leg: { probability: number; canal: string },
  window: {
    channelReliability: ChannelReliabilityMap;
    pooledReliability: ChannelReliability;
  },
): number {
  const reliability =
    window.channelReliability[leg.canal] ?? window.pooledReliability;
  const calibrated = applyReliability(leg.probability, reliability);
  return Math.min(
    COUPON_PARAMS.capMax,
    Math.max(COUPON_PARAMS.capMin, calibrated),
  );
}

// Single source of truth for a leg's probability inside a coupon: the calibrated
// value when scoring has run, otherwise the legacy blend (keeps `compose()`
// correct even when called without a prior `scorePicks`, e.g. in unit tests).
export function legProbability(leg: {
  calibratedProbability?: number | null;
  probability: number;
  calibratedHitRate: number;
}): number {
  return leg.calibratedProbability ?? calibratedLegProbability(leg);
}

// Corrects the raw product-of-legs jointProbability for the coupon-level
// overconfidence found in the 2026-08-12 audit — a flat multiplicative factor
// (not a Bayesian shrink-to-prior) so pick-specific differentiation between
// coupons is preserved (see JOINT_PROBABILITY_CORRELATION_FACTOR doc for why).
export function calibrateJointProbability(rawJointProbability: number): number {
  const { factor, capMin, capMax } = JOINT_PROBABILITY_CORRELATION_FACTOR;
  return Math.min(capMax, Math.max(capMin, rawJointProbability * factor));
}

/**
 * Standard error of a coupon's EV estimate, propagated from the estimation
 * error of each leg's calibrated probability.
 *
 * `couponEV + 1 = (prod p_i) * (prod odds_i)`. The odds are observed, not
 * estimated, so all the uncertainty sits in the product of probabilities, and
 * relative errors add in quadrature:
 *
 *     se(couponEV) = (1 + couponEV) * sqrt( sum_i (se(p_i) / p_i)^2 )
 *     se(p_i) = sqrt( p_i * (1 - p_i) / n_i )
 *
 * `n_i` is the settled sample the leg's channel reliability curve was fitted
 * on. A leg from a thin channel therefore widens the interval — and gets
 * penalised harder by the deflation below — which is the behaviour we want:
 * uncertainty about a channel is a reason to trust its EV less.
 */
export function couponEVStandardError(
  legs: ScoredPick[],
  couponEV: number,
): number {
  let relativeVariance = 0;
  for (const leg of legs) {
    const p = legProbability(leg);
    const n = leg.calibrationSampleSize ?? 0;
    if (n <= 0 || p <= 0 || p >= 1) continue;
    const se = Math.sqrt((p * (1 - p)) / n);
    relativeVariance += (se / p) ** 2;
  }
  return Math.abs(1 + couponEV) * Math.sqrt(relativeVariance);
}

/**
 * Selection-bias deflation of a candidate's EV — see COUPON_EV_DEFLATION.
 *
 * `compose()` keeps the best candidate by EV, and the maximum of N noisy
 * estimates sits about `sqrt(2 ln N)` standard errors above the truth even
 * when no candidate has any real edge. Subtracting that much brings the
 * winner's EV back to what it is worth in expectation.
 *
 * `trials` is the POOL SIZE, not the number of candidate combinations. The
 * combinations are not independent draws — they are built from the same legs
 * and overlap heavily, so `C(pool, legs)` would wildly overstate how many
 * genuinely distinct chances the search had. The number of distinct legs is
 * the honest bound on the search's freedom.
 *
 * A first version used the dispersion of candidate EVs as the standard error
 * and the raw candidate count as `trials` (2026-08-22). Both were wrong: the
 * candidate spread is driven by genuine odds differences rather than by
 * estimation noise, and with sigma ~0.33 over ~136 candidates it deflated
 * every coupon by ~1.0 EV point against a 0.15 threshold. That did not filter
 * out lucky maxima, it filtered out everything EXCEPT the most extreme
 * long-odds outliers — the opposite of the intent. Measured: 141 settled
 * coupons over the same range before, 23 after, and those 23 the highest-EV.
 */
export function deflateCouponEV(
  couponEV: number,
  search: { trials: number; standardError: number },
): number {
  if (!COUPON_EV_DEFLATION.enabled) return couponEV;
  const trials = Math.min(
    Math.max(search.trials, Math.E),
    COUPON_EV_DEFLATION.trialsCap,
  );
  return couponEV - search.standardError * Math.sqrt(2 * Math.log(trials));
}

// signalScore is a (canal, dow, league) environment rate — within one canal on
// one day it is constant across picks, so a sort on signalScore alone leaves
// same-canal picks in arbitrary (insertion) order. Tie-break on the blended
// pick probability so pool cuts and per-canal selections are deterministic and
// favour the stronger pick.
export function comparePicksBySignalThenProbability(
  a: {
    signalScore: number;
    probability: number;
    calibratedHitRate: number;
    calibratedProbability?: number | null;
  },
  b: {
    signalScore: number;
    probability: number;
    calibratedHitRate: number;
    calibratedProbability?: number | null;
  },
): number {
  if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore;
  return legProbability(b) - legProbability(a);
}

// Depth tie-break — NOT a probability/EV weight (db:backtest:coupon-quality-
// signals still shows train n=0 on these three signals as of 2026-08-15, so
// they can't be calibrated into signalScore yet). Used only to order
// otherwise-similar picks — same "pure ordering policy, no backtest needed"
// category as comparePicksBySignalThenProbability itself. Higher is better:
// offensiveBalance BALANCED > unknown (null) > ASYMMETRIC > STRONGLY_ASYMMETRIC;
// shadowConflict false (no conflict) > unknown (null) > true; more prior
// analyses of this exact (market, pick) preferred, capped so it can't dominate
// the other two components.
export function depthRank(pick: {
  offensiveBalance: 'BALANCED' | 'ASYMMETRIC' | 'STRONGLY_ASYMMETRIC' | null;
  shadowConflict: boolean | null;
  priorAnalysisCount: number;
}): number {
  const offensiveBalanceRank =
    pick.offensiveBalance === 'BALANCED'
      ? 2
      : pick.offensiveBalance === null
        ? 1
        : pick.offensiveBalance === 'ASYMMETRIC'
          ? 0
          : -1; // STRONGLY_ASYMMETRIC
  const shadowConflictRank =
    pick.shadowConflict === false ? 1 : pick.shadowConflict === null ? 0 : -1;
  return (
    offensiveBalanceRank * 4 +
    shadowConflictRank * 2 +
    Math.min(pick.priorAnalysisCount, 5) * 0.1
  );
}

// Anchor+value mix, diversified by competition per mode — replaces the old
// flat "sort everything by signalScore, slice to MAX_POOL_SIZE" pool cut.
// That flat sort let a single dominant canal (high CANAL_BASE_WEIGHT, e.g.
// SAFE) crowd out every other canal before the combinatorial search even
// starts, and never distinguished a genuinely reliable pick from a merely
// high-EV one — exactly the gap COUPON_ANALYSIS_TEMPLATE.md (Étape 0)
// documents from real manual-analysis incidents: the method that works
// deliberately blends a few high-probability ANCHOR legs (70-90%+, carry the
// joint probability) with a few moderate-probability VALUE legs (better
// odds, carry the combined odds) — never a single EV-only ranking. This is a
// pool-construction policy (like sharesAnyLeg's zero-tolerance rule below),
// not a viability threshold — no backtest gate needed, unlike EV/odds/
// probability bounds.
function buildCandidatePool(
  pricedPicks: ScoredPick[],
  poolSize: number,
): ScoredPick[] {
  const isAnchor = (p: ScoredPick) =>
    legProbability(p) >= ANCHOR_MIN_PROBABILITY;
  const anchors = pricedPicks.filter(isAnchor);
  const value = pricedPicks.filter((p) => !isAnchor(p));

  // Within the value bucket only, cap the EV used for ranking at the same
  // threshold the betting engine already uses to flag "may indicate
  // calibration anomaly" (EV_MAX_SOFT_ALERT) — a leg isn't rejected for
  // having a huge EV, it just can't use that EV to jump the value queue.
  const evMaxSoftAlert = EV_MAX_SOFT_ALERT.toNumber();
  const rankedValueEV = (p: ScoredPick) =>
    Math.min(p.legEV ?? 0, evMaxSoftAlert);

  const byDepthThenSignal = (a: ScoredPick, b: ScoredPick): number => {
    if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore;
    const depthDiff = depthRank(b) - depthRank(a);
    if (depthDiff !== 0) return depthDiff;
    return legProbability(b) - legProbability(a);
  };

  // Shared across anchor selection, value selection, AND the backfill pass
  // below — a per-competition cap that resets between phases isn't a cap at
  // all (the backfill would just readmit whatever the diversify step
  // rejected).
  const perCompetition = new Map<string, number>();
  const diversifyByCompetition = (
    picks: ScoredPick[],
    limit: number,
  ): ScoredPick[] => {
    const kept: ScoredPick[] = [];
    for (const pick of picks) {
      if (kept.length >= limit) break;
      const count = perCompetition.get(pick.competition) ?? 0;
      if (count >= MAX_POOL_PER_COMPETITION) continue;
      perCompetition.set(pick.competition, count + 1);
      kept.push(pick);
    }
    return kept;
  };

  const anchorShare = Math.ceil(poolSize / 2);
  const valueShare = poolSize - anchorShare;

  const sortedAnchors = [...anchors].sort(byDepthThenSignal);
  const sortedValue = [...value].sort(
    (a, b) => byDepthThenSignal(a, b) || rankedValueEV(b) - rankedValueEV(a),
  );

  const keptAnchors = diversifyByCompetition(sortedAnchors, anchorShare);
  const keptValue = diversifyByCompetition(sortedValue, valueShare);

  // Never waste real pool capacity: if one mode came up short (not enough
  // anchors, or not enough value legs, after the per-competition cap),
  // backfill from the other mode's remaining candidates rather than
  // shrinking the pool — same no-forcing spirit as selectDiverseCoupons,
  // applied to filling capacity rather than to diversity. Still respects
  // the shared per-competition cap (see above) — this only recovers pool
  // slots left empty by an under-supplied mode, it doesn't reopen a
  // competition that already hit its cap.
  const usedKeys = new Set(
    [...keptAnchors, ...keptValue].map((p) => legKey(p)),
  );
  const remaining = [...sortedAnchors, ...sortedValue]
    .filter((p) => !usedKeys.has(legKey(p)))
    .sort(byDepthThenSignal);
  const merged = [...keptAnchors, ...keptValue];
  for (const pick of remaining) {
    if (merged.length >= poolSize) break;
    const count = perCompetition.get(pick.competition) ?? 0;
    if (count >= MAX_POOL_PER_COMPETITION) continue;
    perCompetition.set(pick.competition, count + 1);
    merged.push(pick);
  }

  return merged;
}

// VALUE-only edge floor, mirroring the standalone VALUE channel's own gate
// (`selectBestViablePick` in analysis-core: probability − 1/odds ≥
// getValueMinEdge(league) ?? VALUE_MIN_EDGE=0.10). Before this, a VALUE leg
// that would be REJECTED as a standalone VALUE pick could still ride into a
// coupon whenever a partner leg's EV compensated for it at the combined-coupon
// level — audit 2026-08-01 found COUPON_ALL subscriptions at 0/19 settled
// wins. SAFE/BTTS/... legs are unaffected: VALUE_MIN_EDGE is deliberately
// VALUE-only, same as in the channel strategy.
export function clearsValueEdgeFloor(
  leg: {
    canal: string;
    calibratedProbability: number | null;
    oddsSnapshot: number | null;
    featureSnapshot: Record<string, unknown>;
  },
  getMinEdge: (
    competitionCode: string | null,
  ) => Decimal | undefined = getValueMinEdge,
): boolean {
  if (leg.canal !== 'VALUE') return true;
  if (leg.calibratedProbability === null || leg.oddsSnapshot === null) {
    return false;
  }
  const competitionCode =
    (leg.featureSnapshot['competitionCode'] as string | undefined) ?? null;
  const minEdge = getMinEdge(competitionCode) ?? VALUE_MIN_EDGE;
  const edge = new Decimal(leg.calibratedProbability).minus(
    new Decimal(1).div(leg.oddsSnapshot),
  );
  return edge.greaterThanOrEqualTo(minEdge);
}

// All-canal probability floor — a high-EV leg is not automatically a safe
// coupon leg: it can still be more likely to lose than win. Distinct from
// clearsValueEdgeFloor (VALUE-only, edge-based) — this checks the leg's own
// calibrated probability, whatever canal it came from. The floor is a PROFILE
// bound now, not a global constant — see LEGACY_MIN_LEG_PROBABILITY
// (coupon.constants.ts) for the incident that motivated it and why a single
// global value made the best-calibrated channels unusable. A profile with no
// `minLegProbability` imposes no per-leg floor and relies on
// `minJointProbability` instead.
export function clearsMinLegProbability(
  leg: {
    calibratedProbability: number | null;
    probability: number;
    calibratedHitRate: number;
  },
  minLegProbability: number | undefined,
): boolean {
  if (minLegProbability === undefined) return true;
  return legProbability(leg) >= minLegProbability;
}

// Shared anti-correlation bookkeeping — used identically by composeExhaustive
// (DFS) and composeGreedy (longshot) so the two strategies can never drift
// apart on what counts as "too correlated" (1/fixture, 1/canal+market,
// 2/competition, and an optional per-day cap for multi-day pools).
type AntiCorrelationState = {
  canalMarketCounts: Map<string, number>;
  compCounts: Map<string, number>;
  dayCounts: Map<string, number>;
};

function createAntiCorrelationState(legs: ScoredPick[]): AntiCorrelationState {
  const state: AntiCorrelationState = {
    canalMarketCounts: new Map(),
    compCounts: new Map(),
    dayCounts: new Map(),
  };
  for (const leg of legs) recordAntiCorrelation(state, leg);
  return state;
}

function recordAntiCorrelation(
  state: AntiCorrelationState,
  leg: ScoredPick,
): void {
  const cmKey = `${leg.canal}:${leg.market}`;
  state.canalMarketCounts.set(
    cmKey,
    (state.canalMarketCounts.get(cmKey) ?? 0) + 1,
  );
  state.compCounts.set(
    leg.competition,
    (state.compCounts.get(leg.competition) ?? 0) + 1,
  );
  state.dayCounts.set(
    leg.dayBucket,
    (state.dayCounts.get(leg.dayBucket) ?? 0) + 1,
  );
}

function violatesAntiCorrelation(
  current: ScoredPick[],
  next: ScoredPick,
  ctx: { state: AntiCorrelationState; profile: CouponProfileBounds },
): boolean {
  const { state, profile } = ctx;
  if (current.some((p) => p.fixtureId === next.fixtureId)) return true;

  const cmKey = `${next.canal}:${next.market}`;
  if ((state.canalMarketCounts.get(cmKey) ?? 0) >= 1) return true;

  if ((state.compCounts.get(next.competition) ?? 0) >= 2) return true;

  if (
    profile.maxLegsPerDay !== undefined &&
    (state.dayCounts.get(next.dayBucket) ?? 0) >= profile.maxLegsPerDay
  ) {
    return true;
  }

  return false;
}

function legKey(leg: ScoredPick): string {
  return `${leg.fixtureId}:${leg.canal}:${leg.market}:${leg.pick}`;
}

// Canal-agnostic variant of legKey, used ONLY by sharesAnyLeg below. Two
// different channels landing the identical (fixture, market, pick) — e.g.
// VALUE picks ONE_X_TWO/HOME and DOMINANT also picks ONE_X_TWO/HOME on the
// same fixture — are the same underlying bet: if that result goes the wrong
// way, both legs lose together regardless of which channel originally
// proposed the pick. legKey's canal component is deliberately kept for
// every OTHER caller (pool dedup, coupon dedup) — there, two picks from
// different canals on the same market genuinely are distinct candidates
// (different odds/probability/EV) worth keeping separate in the pool.
function sharedBetKey(leg: ScoredPick): string {
  return `${leg.fixtureId}:${leg.market}:${leg.pick}`;
}

// Any leg shared between two published coupons means a single result can
// make both lose together — exactly what happened 2026-08-15 (a POL2
// TEAM_TOTAL_HOME leg present in both rank 1 and rank 2, both LOST; rank 3,
// without it, WON). The previous rule tolerated up to 50% leg overlap, which
// let a single shared leg through on any coupon with ≥3 legs (1/3 ≈ 0.33 <
// 0.5) — not a fluke, the ratio math always allows exactly one shared leg
// once a coupon has 3+ legs. Zero tolerance now: a candidate is rejected the
// moment it shares even one leg with an already-selected coupon. This is a
// presentation/diversity policy, not a probability threshold — no backtest
// gate needed, unlike EV/odds/probability bounds.
//
// Compares on sharedBetKey (fixture+market+pick), not the canal-inclusive
// legKey (found 2026-08-16): otherwise VALUE and DOMINANT both landing
// ONE_X_TWO/HOME on the same fixture would register as "different" legs and
// two coupons could both publish riding the identical underlying bet — the
// exact correlation this rule exists to close, just entered from the
// cross-canal side instead of the same-canal side the 08-15 incident came from.
function sharesAnyLeg(
  candidate: ComposedCoupon,
  against: ComposedCoupon,
): boolean {
  const againstKeys = new Set(against.legs.map(sharedBetKey));
  return candidate.legs.some((l) => againstKeys.has(sharedBetKey(l)));
}

// Greedy selection from the EV-sorted viable list: take the best coupon,
// then keep taking the next-best one that shares no leg at all with what's
// already picked. No backfill — unlike the previous ratio-based version,
// this never reintroduces a shared leg just to hit `maxCoupons`: the number
// of coupons actually published depends on how many leg-disjoint
// combinations the pool supports, up to `maxCoupons` as an upper bound only.
function selectDiverseCoupons(
  viableSortedByEV: ComposedCoupon[],
  maxCoupons: number,
): ComposedCoupon[] {
  const selected: ComposedCoupon[] = [];
  for (const candidate of viableSortedByEV) {
    if (selected.length >= maxCoupons) break;
    const overlaps = selected.some((s) => sharesAnyLeg(candidate, s));
    if (!overlaps) selected.push(candidate);
  }
  return selected;
}

@Injectable()
export class CouponComposerService {
  // Day-of-week factor is read per-pick from its OWN `dayBucket` — a
  // multi-day pool (weekend/midweek window, cf. SignalWindowService
  // .getPoolForRange) mixes fixtures from different days, so a single `date`
  // parameter applied to every pick would misattribute Saturday/Sunday legs
  // to Friday's dow factor.
  scorePicks(picks: ScoredPick[], window: SignalWindow): ScoredPick[] {
    return picks.map((pick) => {
      const d = new Date(`${pick.dayBucket}T12:00:00.000Z`);
      const dow = DOW_LABELS[(d.getUTCDay() + 6) % 7];
      const canalBase =
        CANAL_BASE_WEIGHT[pick.canal] ?? DEFAULT_CANAL_BASE_WEIGHT;
      const windowRate =
        window.calibratedCanalHitRates[pick.canal] ?? canalBase;
      const dowRate = window.canalDowFactors[pick.canal]?.[dow] ?? windowRate;
      const leagueRate =
        window.calibratedCanalLeagueHitRates[pick.canal]?.[pick.competition] ??
        windowRate;

      // 50% canal calibrated rate, 30% dow factor, 20% league calibrated rate
      const signalScore = windowRate * 0.5 + dowRate * 0.3 + leagueRate * 0.2;

      const calibratedProbability = calibrateLegProbability(
        { probability: pick.probability, canal: pick.canal },
        window,
      );
      const reliability =
        window.channelReliability[pick.canal] ?? window.pooledReliability;

      // EV de jambe sur la cote RÉELLE uniquement (jamais de cote inventée) —
      // une jambe sans cote ne porte pas d'EV et sera exclue des coupons.
      const legEV =
        pick.oddsSnapshot !== null
          ? calculateEV(calibratedProbability, pick.oddsSnapshot).toNumber()
          : null;

      // Edge marché = proba calibrée − proba « fair » (overround retiré).
      // Mesure la value vs le marché (pas « car sûr »). `null` si pas de fair.
      const edge =
        pick.pMarketFair !== null
          ? calibratedProbability - pick.pMarketFair
          : null;

      const featureSnapshot = {
        ...pick.featureSnapshot,
        canal: pick.canal,
        league: pick.competition,
        dow,
        calibratedCanalHitRate: windowRate,
        dowHitRate: dowRate,
        calibratedLeagueHitRate: leagueRate,
        signalScore,
        calibratedProbability,
        channelReliabilityA: reliability.a,
        channelReliabilityB: reliability.b,
        channelReliabilityN: reliability.n,
        legEV,
        pMarketFair: pick.pMarketFair,
        bookmakerMargin: pick.bookmakerMargin,
        edge,
      };

      return {
        ...pick,
        calibratedHitRate: windowRate,
        calibratedProbability,
        calibrationSampleSize: reliability.n,
        legEV,
        edge,
        signalScore,
        featureSnapshot,
      };
    });
  }

  compose(
    scoredPicks: ScoredPick[],
    profile: CouponProfileBounds = DEFAULT_COUPON_PROFILE,
  ): ComposedCoupon[] {
    // EVCore est value-driven : un coupon ne se construit que sur des jambes à
    // cote RÉELLE (B2 — plus de FALLBACK_ODDS). Une jambe sans cote n'a pas d'EV.
    const pricedPicks = scoredPicks
      .filter((p) => p.oddsSnapshot !== null)
      .filter((p) => clearsValueEdgeFloor(p))
      .filter((p) => clearsMinLegProbability(p, profile.minLegProbability));

    const distinctFixtures = new Set(pricedPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    const pool = buildCandidatePool(
      pricedPicks,
      profile.maxPoolSize ?? MAX_POOL_SIZE,
    );

    // Exhaustive DFS stays exact and cheap up to EXHAUSTIVE_LEG_THRESHOLD legs
    // (C(25,5)≈2300 combinations); beyond that (longshot profiles, 8-12 legs)
    // it explodes (C(25,10)≈3.3M) — composeGreedy trades exactness for a
    // handful of good-enough candidates. Both share buildCoupon and the
    // anti-correlation rules above, so neither can silently diverge from the
    // other on what makes two legs "too correlated".
    const candidates: ComposedCoupon[] =
      profile.maxLegs <= EXHAUSTIVE_LEG_THRESHOLD
        ? this.composeExhaustive(pool, profile)
        : this.composeGreedy(pool, profile);

    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const key = c.legs
        .map((l) => legKey(l))
        .sort()
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filtre value (bornes du profil) : nombre de jambes, cote combinée, proba
    // jointe ET EV de coupon — ce dernier DÉFLATÉ par la largeur réelle de la
    // recherche menée ce jour-là (cf. COUPON_EV_DEFLATION). Sans déflation, le
    // filtre et le tri s'appliquent au maximum d'un échantillon, donc à une
    // valeur gonflée par le nombre d'essais et non par un edge réel.
    const deflated = unique.map((c) => {
      const standardError = couponEVStandardError(c.legs, c.couponEV);
      const deflatedCouponEV = deflateCouponEV(c.couponEV, {
        trials: pool.length,
        standardError,
      });
      return {
        ...c,
        deflatedCouponEV,
        // Traced so a published coupon can be audited: how wide was the search
        // it won, and how much EV did winning it cost in deflation.
        reasoning: {
          ...c.reasoning,
          deflatedCouponEV,
          searchTrials: pool.length,
          couponEVStandardError: standardError,
        },
      };
    });

    const viable = deflated
      .filter(
        (c) =>
          c.legs.length >= profile.minLegs &&
          c.combinedOdds >= profile.minCombinedOdds &&
          c.jointProbability >= profile.minJointProbability &&
          c.deflatedCouponEV >= profile.minCouponEV,
      )
      .sort(compareCouponsByEV);

    return selectDiverseCoupons(viable, COUPON_PARAMS.maxCoupons).map(
      (c, i) => ({ ...c, rank: i + 1 }),
    );
  }

  private composeExhaustive(
    pool: ScoredPick[],
    profile: CouponProfileBounds,
  ): ComposedCoupon[] {
    const candidates: ComposedCoupon[] = [];
    this.buildCombinations(pool, [], { out: candidates, profile });
    return candidates;
  }

  private buildCombinations(
    remaining: ScoredPick[],
    current: ScoredPick[],
    ctx: { out: ComposedCoupon[]; profile: CouponProfileBounds },
  ): void {
    const { out, profile } = ctx;
    if (current.length > profile.maxLegs) return;

    const combinedOdds = this.computeCombinedOdds(current);
    if (combinedOdds > profile.maxCombinedOdds) return;

    if (current.length >= 2) {
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (distinctFixtures.size >= MIN_DISTINCT_FIXTURES) {
        out.push(this.buildCoupon(current, combinedOdds));
      }
    }

    if (current.length === profile.maxLegs) return;

    const state = createAntiCorrelationState(current);

    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      if (violatesAntiCorrelation(current, next, { state, profile })) continue;
      this.buildCombinations(remaining.slice(i + 1), [...current, next], ctx);
    }
  }

  // Longshot composition (8-12+ legs, cote cible 50-70) — a bounded greedy
  // walk instead of the exhaustive DFS above, which is intractable at this
  // leg count (cf. EXHAUSTIVE_LEG_THRESHOLD). Tries GREEDY_START_VARIANTS
  // distinct starting legs (the pool is already sorted by signal strength),
  // each time greedily accepting the next-best remaining leg that doesn't
  // violate anti-correlation or push combinedOdds past the profile ceiling —
  // skipping (not stopping on) a leg that would breach the ceiling, so a
  // single strong-odds candidate doesn't prematurely end the walk.
  private composeGreedy(
    pool: ScoredPick[],
    profile: CouponProfileBounds,
  ): ComposedCoupon[] {
    const candidates: ComposedCoupon[] = [];
    const variantCount = Math.min(pool.length, GREEDY_START_VARIANTS);

    for (let start = 0; start < variantCount; start++) {
      const current: ScoredPick[] = [pool[start]];
      const state = createAntiCorrelationState(current);

      for (let i = 0; i < pool.length; i++) {
        if (i === start) continue;
        if (current.length >= profile.maxLegs) break;

        const next = pool[i];
        if (violatesAntiCorrelation(current, next, { state, profile }))
          continue;

        const combinedOdds = this.computeCombinedOdds([...current, next]);
        if (combinedOdds > profile.maxCombinedOdds) continue;

        current.push(next);
        recordAntiCorrelation(state, next);
      }

      if (current.length < 2) continue;
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) continue;

      candidates.push(
        this.buildCoupon(current, this.computeCombinedOdds(current)),
      );
    }

    return candidates;
  }

  private computeCombinedOdds(legs: ScoredPick[]): number {
    // Invariant compose() : seules des jambes à cote réelle arrivent ici.
    for (const leg of legs) {
      if (leg.oddsSnapshot === null) {
        throw new Error('compose: leg without real odds reached combinedOdds');
      }
    }
    return productDecimal(
      legs.map((leg) => leg.oddsSnapshot as number),
    ).toNumber();
  }

  private buildCoupon(
    legs: ScoredPick[],
    combinedOdds: number,
  ): ComposedCoupon {
    const rawJointProbability = legs.reduce(
      (acc, leg) => acc * legProbability(leg),
      1,
    );
    // Correction de surconfiance (cf. JOINT_PROBABILITY_CORRELATION_FACTOR) —
    // appliquée avant toute consommation (EV, filtre de viabilité, Kelly) pour
    // qu'il n'existe qu'une seule valeur "officielle" persistée.
    const jointProbability = calibrateJointProbability(rawJointProbability);
    // couponEV = P_coupon × Odd_coupon − 1 (source unique calculateEV).
    const couponEV = calculateEV(jointProbability, combinedOdds).toNumber();
    const signalScore =
      legs.reduce((acc, leg) => acc + leg.signalScore, 0) / legs.length;

    const reasoning: Record<string, unknown> = {
      legs: legs.map((l) => ({
        fixture: `${l.homeTeam} vs ${l.awayTeam}`,
        canal: l.canal,
        pick: `${l.market}/${l.pick}`,
        signalScore: l.signalScore,
        legEV: l.legEV,
        edge: l.edge,
        pMarketFair: l.pMarketFair,
        calibratedCanalHitRate:
          (l.featureSnapshot['calibratedCanalHitRate'] as number | undefined) ??
          null,
      })),
      combinedOdds,
      rawJointProbability,
      jointProbability,
      couponEV,
      signalScore,
    };

    return {
      rank: 0,
      legs,
      combinedOdds,
      rawJointProbability,
      jointProbability,
      couponEV,
      signalScore,
      reasoning,
    };
  }
}

// Classement value-driven (DESIGN.md §5) : EV de coupon d'abord, proba jointe
// en tie-break, puis le coupon le plus court à EV égale.
//
// Un tri signal-first (compareCouponsBySignalThenEV, canal×jour×ligue avant
// couponEV) a été essayé le 2026-08-20 : signalScore est bien plus prédictif
// que couponEV/jointProbability sur toute sa plage, mais reclasser sur ce
// critère n'a PAS amélioré le ROI mesuré une fois réellement backtesté (après
// correction d'un bug de non-régénération, voir deleteExpiredInRange,
// coupon.repository.ts) — combiné aux autres changements du jour, le ROI est
// tombé à -13.49% (n=106) contre +4.77% (n=478) sans lui. Revenu à l'EV-first
// historique en attendant une piste qui améliore vraiment le ROI mesuré, pas
// seulement la calibration d'un signal pris isolément.
export function compareCouponsByEV(
  a: ComposedCoupon,
  b: ComposedCoupon,
): number {
  // Ranks on the deflated EV when present (compose() sets it on every
  // candidate); falls back to the raw EV for callers that build a
  // ComposedCoupon directly, e.g. unit tests.
  const aEV = a.deflatedCouponEV ?? a.couponEV;
  const bEV = b.deflatedCouponEV ?? b.couponEV;
  if (bEV !== aEV) return bEV - aEV;
  if (b.jointProbability !== a.jointProbability) {
    return b.jointProbability - a.jointProbability;
  }
  return a.legs.length - b.legs.length;
}
