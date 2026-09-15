import { calculateEV } from "../ev";
import type { CouponBounds, CouponClass } from "./coupon-classes";
import {
  clearsMaxLegEdge,
  clearsMinLegOdds,
  clearsTeamTotalMaxOdds,
  clearsValueEdgeFloor,
  createAntiCorrelationState,
  depthRank,
  legProbability,
  violatesAntiCorrelation,
  type CouponLeg,
} from "./guardrails";

const DEFAULT_PROBABILITY_POOL_SIZE = 30;
const DEFAULT_VALUE_POOL_SIZE = 20;
const FLOAT_EPSILON = 1e-12;

export type DeterministicComposerOptions = {
  probabilityPoolSize?: number;
  valuePoolSize?: number;
  maxPositiveEdge?: number;
};

export type DeterministicCoupon<T extends CouponLeg> = {
  legs: readonly T[];
  combinedOdds: number;
  rawJointProbability: number;
  jointProbability: number;
  couponEV: number;
};

export type DeterministicCompositionResult<T extends CouponLeg> =
  | { outcome: "empty_pool" }
  | { outcome: "no_coupon"; reason: string }
  | { outcome: "composed"; coupon: DeterministicCoupon<T> };

function stableCandidateKey(candidate: CouponLeg): string {
  return [
    candidate.fixtureId,
    candidate.canal,
    candidate.market,
    candidate.pick,
  ].join(":");
}

function wagerKey(candidate: CouponLeg): string {
  return [candidate.fixtureId, candidate.market, candidate.pick].join(":");
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function candidateEV(candidate: CouponLeg): number {
  return candidate.oddsSnapshot === null
    ? Number.NEGATIVE_INFINITY
    : legProbability(candidate) * candidate.oddsSnapshot - 1;
}

function compareCandidatesByProbability(a: CouponLeg, b: CouponLeg): number {
  const probabilityDelta = legProbability(b) - legProbability(a);
  if (Math.abs(probabilityDelta) > FLOAT_EPSILON) return probabilityDelta;
  const evDelta = candidateEV(b) - candidateEV(a);
  if (Math.abs(evDelta) > FLOAT_EPSILON) return evDelta;
  const depthDelta = depthRank(b) - depthRank(a);
  if (Math.abs(depthDelta) > FLOAT_EPSILON) return depthDelta;
  return compareText(stableCandidateKey(a), stableCandidateKey(b));
}

function compareCandidatesByValue(a: CouponLeg, b: CouponLeg): number {
  const evDelta = candidateEV(b) - candidateEV(a);
  if (Math.abs(evDelta) > FLOAT_EPSILON) return evDelta;
  return compareCandidatesByProbability(a, b);
}

export function isAdmissibleCouponCandidate<T extends CouponLeg>(
  candidate: T,
  couponClass: CouponClass,
  options: Pick<DeterministicComposerOptions, "maxPositiveEdge"> = {},
): boolean {
  const probability = legProbability(candidate);
  const odds = candidate.oddsSnapshot;
  const referenceOdds = candidate.referenceOdds ?? odds;
  const positiveEdge =
    referenceOdds === null
      ? Number.POSITIVE_INFINITY
      : probability - 1 / referenceOdds;
  return (
    odds !== null &&
    Number.isFinite(odds) &&
    Number.isFinite(probability) &&
    probability > 0 &&
    probability < 1 &&
    probability * odds > 1 &&
    clearsValueEdgeFloor(candidate) &&
    clearsTeamTotalMaxOdds(candidate) &&
    clearsMaxLegEdge(candidate) &&
    positiveEdge <= (options.maxPositiveEdge ?? 0.1) &&
    clearsMinLegOdds(candidate, couponClass)
  );
}

/**
 * Stable, bounded candidate reduction used by both live generation and
 * historical replay. It keeps the strongest probability candidates and the
 * strongest per-leg EV candidates, then deduplicates by the actual wager.
 */
export function buildDeterministicCandidatePool<T extends CouponLeg>(
  candidates: readonly T[],
  couponClass: CouponClass,
  options: DeterministicComposerOptions = {},
): T[] {
  const admissible = candidates.filter((candidate) =>
    isAdmissibleCouponCandidate(candidate, couponClass, options),
  );
  const probabilityPoolSize =
    options.probabilityPoolSize ?? DEFAULT_PROBABILITY_POOL_SIZE;
  const valuePoolSize = options.valuePoolSize ?? DEFAULT_VALUE_POOL_SIZE;
  const byProbability = [...admissible].sort(compareCandidatesByProbability);
  const byValue = [...admissible].sort(compareCandidatesByValue);
  const seen = new Set<string>();
  const pool: T[] = [];

  for (const candidate of [
    ...byProbability.slice(0, probabilityPoolSize),
    ...byValue.slice(0, valuePoolSize),
  ]) {
    const key = wagerKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(candidate);
  }

  return pool.sort(compareCandidatesByProbability);
}

function couponSignature(coupon: DeterministicCoupon<CouponLeg>): string {
  return coupon.legs.map(stableCandidateKey).sort().join("|");
}

/** Highest joint hit probability first; EV and fewer legs break exact ties. */
export function compareDeterministicCoupons(
  a: DeterministicCoupon<CouponLeg>,
  b: DeterministicCoupon<CouponLeg>,
): number {
  const probabilityDelta = b.jointProbability - a.jointProbability;
  if (Math.abs(probabilityDelta) > FLOAT_EPSILON) return probabilityDelta;
  const evDelta = b.couponEV - a.couponEV;
  if (Math.abs(evDelta) > FLOAT_EPSILON) return evDelta;
  if (a.legs.length !== b.legs.length) return a.legs.length - b.legs.length;
  return compareText(couponSignature(a), couponSignature(b));
}

function buildCoupon<T extends CouponLeg>(
  legs: readonly T[],
): DeterministicCoupon<T> | null {
  const combinedOdds = legs.reduce(
    (product, leg) => product * (leg.oddsSnapshot as number),
    1,
  );
  const jointProbability = legs.reduce(
    (product, leg) => product * legProbability(leg),
    1,
  );
  const couponEV = calculateEV(jointProbability, combinedOdds).toNumber();
  if (!Number.isFinite(couponEV) || couponEV <= 0) return null;
  return {
    legs: [...legs],
    combinedOdds,
    rawJointProbability: jointProbability,
    jointProbability,
    couponEV,
  };
}

/**
 * Pure coupon composer: same input always yields the same output. It searches
 * the bounded candidate pool without randomness, network calls or clocks.
 * The objective is fixed before evaluation: maximise joint hit probability
 * inside the product bounds, then coupon EV, then prefer fewer legs.
 */
export function composeDeterministicCoupon<T extends CouponLeg>(
  candidates: readonly T[],
  couponClass: CouponClass,
  bounds: CouponBounds,
  options: DeterministicComposerOptions = {},
): DeterministicCompositionResult<T> {
  const pool = buildDeterministicCandidatePool(
    candidates,
    couponClass,
    options,
  );
  if (pool.length < bounds.minLegs) return { outcome: "empty_pool" };

  let best: DeterministicCoupon<T> | null = null;

  function visit(
    startIndex: number,
    selected: readonly T[],
    combinedOdds: number,
    jointProbability: number,
  ): void {
    if (
      best !== null &&
      selected.length > 0 &&
      jointProbability <= best.jointProbability + FLOAT_EPSILON
    ) {
      return;
    }
    if (selected.length >= Math.min(bounds.maxLegs, couponClass.maxLegs)) {
      return;
    }

    const state = createAntiCorrelationState(selected);
    for (let index = startIndex; index < pool.length; index += 1) {
      const candidate = pool[index];
      if (!candidate) continue;
      if (violatesAntiCorrelation(selected, candidate, { state })) continue;

      const nextOdds = combinedOdds * (candidate.oddsSnapshot as number);
      if (nextOdds > bounds.maxCombinedOdds + FLOAT_EPSILON) continue;
      const nextProbability = jointProbability * legProbability(candidate);
      const nextSelected = [...selected, candidate];

      if (
        nextSelected.length >= bounds.minLegs &&
        nextOdds >=
          Math.max(bounds.minCombinedOdds, couponClass.targetCombinedOdds)
      ) {
        const coupon = buildCoupon(nextSelected);
        if (
          coupon !== null &&
          (best === null || compareDeterministicCoupons(coupon, best) < 0)
        ) {
          best = coupon;
        }
        // Adding another leg can only lower joint hit probability.
        continue;
      }

      visit(index + 1, nextSelected, nextOdds, nextProbability);
    }
  }

  visit(0, [], 1, 1);
  return best === null
    ? { outcome: "no_coupon", reason: "no_admissible_combination" }
    : { outcome: "composed", coupon: best };
}
