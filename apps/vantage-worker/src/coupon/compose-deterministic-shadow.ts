import {
  DETERMINISTIC_COUPON_BOUNDS,
  DETERMINISTIC_COUPON_CLASS,
  DETERMINISTIC_COUPON_POLICY_VERSION,
  DETERMINISTIC_MAX_POSITIVE_EDGE,
  STRATEGY_CHANNEL,
  composeDeterministicCoupon,
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
  const eligible = scoredPool.filter(
    (candidate) =>
      candidate.canal !== STRATEGY_CHANNEL.VANTAGE &&
      candidate.pickSource === "STAKED" &&
      candidate.channelSelectionId !== null,
  );
  const result = composeDeterministicCoupon(
    eligible,
    DETERMINISTIC_COUPON_CLASS,
    DETERMINISTIC_COUPON_BOUNDS,
    { maxPositiveEdge: DETERMINISTIC_MAX_POSITIVE_EDGE },
  );
  const common = {
    forDate,
    pass,
    candidateCount: eligible.length,
    policyVersion: DETERMINISTIC_COUPON_POLICY_VERSION,
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
      objective: "max_joint_probability_then_coupon_ev_then_fewer_legs",
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
