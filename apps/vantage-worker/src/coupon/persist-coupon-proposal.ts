import { prisma, Prisma } from "@evcore/db";
import { COUPON_POLICY_VERSION, type Market } from "@evcore/analysis-core";
import type { CouponClass } from "@evcore/analysis-core";
import type { ComposedCoupon } from "./validate-coupon-selection";
import type { CouponLlmProvenance } from "./generate-coupon-selection";

// One immutable proposal per UTC date and policy. Historical batches retain
// their original discriminants; the new policy uses the same slot for all passes.
export const LEGACY_SIGNAL_WINDOW_DAYS = 38;
export const INTRADAY_SIGNAL_WINDOW_DAYS = 39;

export type PersistCouponProposalResult = {
  proposalId: string;
  published: boolean;
};

export async function persistCouponProposal(
  forDate: Date,
  couponClass: CouponClass,
  coupon: ComposedCoupon,
  reasonDetails: string,
  opts: {
    rank?: number;
    signalWindowDays?: number;
    llmProvenance?: CouponLlmProvenance | null;
    pass?: "EVENING" | "INTRADAY";
  } = {},
): Promise<PersistCouponProposalResult> {
  const generatedAt = new Date();
  if (
    coupon.legs.length === 0 ||
    coupon.legs.some((leg) => leg.candidate.scheduledAt <= generatedAt)
  ) {
    throw new Error("Cannot publish a coupon after its first kickoff");
  }
  const rank = opts.rank ?? 1;
  const signalWindowDays = opts.signalWindowDays ?? LEGACY_SIGNAL_WINDOW_DAYS;
  const toDecimal = (n: number) => new Prisma.Decimal(n);
  const toJson = (v: unknown) => v as Prisma.InputJsonValue;

  const where = {
    forDate_signalWindowDays_targetOddsMin_targetOddsMax_rank: {
      forDate,
      signalWindowDays,
      targetOddsMin: toDecimal(couponClass.targetOddsMin),
      targetOddsMax: toDecimal(couponClass.targetOddsMax),
      rank,
    },
  };

  const existing = await prisma.couponProposal.findUnique({
    where,
    select: { id: true, status: true },
  });

  // Every proposal is immutable, including PENDING. A later pass can abstain,
  // but it cannot rewrite what users may already have seen.
  if (existing) {
    return { proposalId: existing.id, published: false };
  }

  const lastFixtureScheduledAt = coupon.legs.reduce(
    (latest, leg) =>
      leg.candidate.scheduledAt > latest ? leg.candidate.scheduledAt : latest,
    coupon.legs[0]?.candidate.scheduledAt ?? forDate,
  );

  // signalScore's original meaning (a 38-day rolling hit-rate blend) is gone
  // since 2026-08-22 — the column now carries each leg's own calibrated
  // probability, and at coupon level, their mean. Same repurposing the
  // retired CouponComposerService already did (see its own doc comment,
  // preserved in coupon-composer.service.ts's git history).
  const meanCalibratedProbability =
    coupon.legs.reduce((sum, l) => sum + l.candidate.calibratedProbability, 0) /
    coupon.legs.length;

  const legData = coupon.legs.map((leg) => ({
    fixtureId: leg.candidate.fixtureId,
    canal: leg.candidate.canal,
    market: leg.candidate.market as Market,
    pick: leg.candidate.pick,
    probability: leg.candidate.calibratedProbability,
    oddsSnapshot: leg.candidate.oddsSnapshot,
    signalScore: leg.candidate.calibratedProbability,
    featureSnapshot: toJson({
      ...leg.candidate.featureSnapshot,
      modelRunId: leg.candidate.modelRunId,
      channelSelectionId: leg.candidate.channelSelectionId,
      pickSource: leg.candidate.pickSource,
      scheduledAt: leg.candidate.scheduledAt.toISOString(),
      policyVersion: COUPON_POLICY_VERSION,
      calibratedProbability: leg.candidate.calibratedProbability,
      legEV: leg.candidate.legEV,
      edge: leg.candidate.edge,
      // The LLM's own qualitative note for this specific leg, in this
      // specific mix — never a number it computed, see selection-schema.ts.
      llmReasoning: leg.reasoning,
    }),
  }));

  const reasoning = toJson({
    policyVersion: COUPON_POLICY_VERSION,
    generationPass: opts.pass ?? "EVENING",
    llm: opts.llmProvenance ?? null,
    probabilityAssumption: "product_assuming_independence",
    couponClass: couponClass.name,
    legs: coupon.legs.map((leg) => ({
      fixture: `${leg.candidate.homeTeam} vs ${leg.candidate.awayTeam}`,
      canal: leg.candidate.canal,
      pick: `${leg.candidate.market}/${leg.candidate.pick}`,
      calibratedProbability: leg.candidate.calibratedProbability,
      oddsSnapshot: leg.candidate.oddsSnapshot,
      llmReasoning: leg.reasoning,
    })),
    combinedOdds: coupon.combinedOdds,
    rawJointProbability: coupon.rawJointProbability,
    jointProbability: coupon.jointProbability,
    couponEV: coupon.couponEV,
    llmReasonDetails: reasonDetails,
  });

  try {
    const created = await prisma.couponProposal.create({
      data: {
        forDate,
        generatedAt,
        rank,
        signalWindowDays,
        targetOddsMin: toDecimal(couponClass.targetOddsMin),
        targetOddsMax: toDecimal(couponClass.targetOddsMax),
        combinedOdds: toDecimal(coupon.combinedOdds),
        jointProbability: toDecimal(coupon.jointProbability),
        signalScore: toDecimal(meanCalibratedProbability),
        lastFixtureScheduledAt,
        reasoning,
        legs: { create: legData },
      },
      select: { id: true },
    });
    return { proposalId: created.id, published: true };
  } catch (error) {
    // The database unique constraint arbitrates concurrent evening/intraday attempts.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await prisma.couponProposal.findUnique({
        where,
        select: { id: true },
      });
      if (!winner) {
        throw error;
      }
      return { proposalId: winner.id, published: false };
    }
    throw error;
  }
}
