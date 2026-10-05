import {
  DETERMINISTIC_COUPON_BOUNDS,
  DETERMINISTIC_COUPON_CLASS,
  DETERMINISTIC_COUPON_POLICY_VERSION,
  DETERMINISTIC_MAX_POSITIVE_EDGE,
  MAX_LEG_EDGE,
  PROBABILITY_SHADOW_POLICY_VERSION,
  STRATEGY_CHANNEL,
  UNIFIED_COUPON_BOUNDS,
  UNIFIED_COUPON_CLASS,
  composeDeterministicCoupon,
  type DeterministicComposerOptions,
  type DeterministicCompositionResult,
} from "@evcore/analysis-core";
import type { GenerationAttempt } from "./record-generation-attempt";
import type { ScoredCandidate } from "./score-candidates";

type ShadowAttemptInput = {
  scoredPool: readonly ScoredCandidate[];
  forDate: Date;
  pass: GenerationAttempt["pass"];
};

/**
 * Builds the append-only observation for the frozen deterministic candidate.
 * It never publishes a CouponProposal and never calls the LLM. Evaluated
 * markets and VANTAGE are excluded to match the population used to freeze the
 * historical candidate; every retained leg has a ChannelSelection id that can
 * be settled prospectively.
 */
export function buildDeterministicShadowAttempt({
  scoredPool,
  forDate,
  pass,
}: ShadowAttemptInput): GenerationAttempt {
  const eligible = shadowEligible(scoredPool);
  const result = composeDeterministicCoupon(
    eligible,
    DETERMINISTIC_COUPON_CLASS,
    DETERMINISTIC_COUPON_BOUNDS,
    { maxPositiveEdge: DETERMINISTIC_MAX_POSITIVE_EDGE },
  );
  return shadowAttempt({
    scoredPool,
    eligible,
    forDate,
    pass,
    policyVersion: DETERMINISTIC_COUPON_POLICY_VERSION,
    objective: "max_joint_probability_then_coupon_ev_then_fewer_legs",
    result,
  });
}

/**
 * Shadow of `unified-5-15-v2`: the live LLM class and bounds (legs 1.20-1.80,
 * combined 5-15, MAX_LEG_EDGE on the reference price, anti-correlation) with
 * the two EV gates and the value ranking removed. It is the policy change
 * the 2026-10-05 coupon review proposed; recording it beside the LLM
 * attempt on the same pool and days is what lets it be judged per leg
 * before anything is published.
 */
export function buildProbabilityRankedShadowAttempt({
  scoredPool,
  forDate,
  pass,
}: ShadowAttemptInput): GenerationAttempt {
  const eligible = shadowEligible(scoredPool);
  const result = composeDeterministicCoupon(
    eligible,
    UNIFIED_COUPON_CLASS,
    UNIFIED_COUPON_BOUNDS,
    PROBABILITY_SHADOW_OPTIONS,
  );
  return shadowAttempt({
    scoredPool,
    eligible,
    forDate,
    pass,
    policyVersion: PROBABILITY_SHADOW_POLICY_VERSION,
    objective: "max_joint_probability_no_ev_gate",
    result,
  });
}

export const PROBABILITY_SHADOW_OPTIONS: DeterministicComposerOptions = {
  requirePositiveEv: false,
  valuePoolSize: 0,
  maxPositiveEdge: MAX_LEG_EDGE,
};

function shadowEligible(
  scoredPool: readonly ScoredCandidate[],
): ScoredCandidate[] {
  return scoredPool.filter(
    (candidate) =>
      candidate.canal !== STRATEGY_CHANNEL.VANTAGE &&
      candidate.pickSource === "STAKED" &&
      candidate.channelSelectionId !== null,
  );
}

function shadowAttempt(input: {
  scoredPool: readonly ScoredCandidate[];
  eligible: readonly ScoredCandidate[];
  forDate: Date;
  pass: GenerationAttempt["pass"];
  policyVersion: string;
  objective: string;
  result: DeterministicCompositionResult<ScoredCandidate>;
}): GenerationAttempt {
  const { scoredPool, eligible, forDate, pass, policyVersion, result } = input;
  const common = {
    forDate,
    pass,
    candidateCount: eligible.length,
    policyVersion,
  } as const;

  if (result.outcome !== "composed") {
    return {
      ...common,
      outcome: "SHADOW_ABSTAINED",
      reason:
        result.outcome === "empty_pool"
          ? "candidate_pool_too_small"
          : result.reason,
      metadata: {
        schemaVersion: 1,
        mode: "SHADOW",
        sourceCandidateCount: scoredPool.length,
      },
    };
  }

  return {
    ...common,
    outcome: "SHADOW_COMPOSED",
    metadata: {
      schemaVersion: 1,
      mode: "SHADOW",
      objective: input.objective,
      sourceCandidateCount: scoredPool.length,
      combinedOdds: result.coupon.combinedOdds,
      rawJointProbability: result.coupon.rawJointProbability,
      jointProbability: result.coupon.jointProbability,
      couponEV: result.coupon.couponEV,
      legs: result.coupon.legs.map((candidate) => ({
        channelSelectionId: candidate.channelSelectionId,
        modelRunId: candidate.modelRunId,
        fixtureId: candidate.fixtureId,
        scheduledAt: candidate.scheduledAt.toISOString(),
        canal: candidate.canal,
        market: candidate.market,
        pick: candidate.pick,
        probability: candidate.calibratedProbability,
        oddsSnapshot: candidate.oddsSnapshot,
      })),
    },
  };
}
