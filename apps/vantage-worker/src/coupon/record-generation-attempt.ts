import { COUPON_POLICY_VERSION } from "@evcore/analysis-core";
import { Prisma, prisma } from "@evcore/db";
import type { CouponLlmProvenance } from "./generate-coupon-selection";

export type GenerationAttempt = {
  forDate: Date;
  pass: "EVENING" | "INTRADAY";
  outcome: "PUBLISHED" | "PRESERVED" | "ABSTAINED" | "INVALID";
  candidateCount: number;
  reason?: string;
  llmProvenance?: CouponLlmProvenance | null;
  proposalId?: string;
};

/** Append-only operational evidence. The migration owns the table while raw
 * SQL keeps deployment compatible with the currently generated Prisma client. */
export async function recordGenerationAttempt(
  attempt: GenerationAttempt,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO coupon_generation_attempt
      ("forDate", "policyVersion", pass, outcome, "candidateCount", reason,
       metadata, "proposalId")
    VALUES
      (${attempt.forDate}, ${COUPON_POLICY_VERSION}, ${attempt.pass},
       ${attempt.outcome}, ${attempt.candidateCount}, ${attempt.reason ?? null},
       ${JSON.stringify({ llm: attempt.llmProvenance ?? null })}::jsonb,
       ${attempt.proposalId ?? null}::uuid)
  `);
}
