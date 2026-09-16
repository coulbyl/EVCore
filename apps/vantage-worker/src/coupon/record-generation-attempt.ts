import { COUPON_POLICY_VERSION } from "@evcore/analysis-core";
import { Prisma, prisma } from "@evcore/db";
import type { CouponLlmProvenance } from "./generate-coupon-selection";

export type GenerationAttempt = {
  forDate: Date;
  pass: "EVENING" | "INTRADAY";
  outcome:
    | "PUBLISHED"
    | "PRESERVED"
    | "ABSTAINED"
    | "INVALID"
    | "SHADOW_COMPOSED"
    | "SHADOW_ABSTAINED";
  candidateCount: number;
  reason?: string;
  llmProvenance?: CouponLlmProvenance | null;
  metadata?: Record<string, unknown>;
  policyVersion?: string;
  proposalId?: string;
};

/** Append-only operational evidence. The migration owns the table while raw
 * SQL keeps deployment compatible with the currently generated Prisma client. */
export async function recordGenerationAttempt(
  attempt: GenerationAttempt,
): Promise<void> {
  const metadata = attempt.metadata ?? { llm: attempt.llmProvenance ?? null };
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO coupon_generation_attempt
      ("forDate", "policyVersion", pass, outcome, "candidateCount", reason,
       metadata, "proposalId")
    VALUES
      (${attempt.forDate}, ${attempt.policyVersion ?? COUPON_POLICY_VERSION}, ${attempt.pass},
       ${attempt.outcome}, ${attempt.candidateCount}, ${attempt.reason ?? null},
       ${JSON.stringify(metadata)}::jsonb,
       ${attempt.proposalId ?? null}::uuid)
  `);
}
