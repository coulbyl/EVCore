import { z } from "zod";

// LLM output for one coupon class (SAFE/BALANCED/BOLD) — selection ONLY, by
// numeric index into the numbered pool the prompt shows it (see
// selection-prompt.ts). No probability, odds, or EV field exists in this
// schema on purpose: the model is never asked to reproduce a number it was
// given, only to choose among indices — every actual number (combinedOdds,
// jointProbability, couponEV) is computed deterministically afterward from
// the real candidate data (docs/vantage-centric-redesign-2026-09-01.md,
// Phase B research note: ID-based selection is measured to hallucinate far
// less than freeform value generation).
//
// Discriminated union, same pattern as vantageResponseSchema
// (response-schema.ts) — "no_coupon" mirrors VANTAGE's own "no_play": a
// required, non-empty reasonDetails even when nothing was built, never a
// silent abstention.
//
// Leg count (`legs.length`) is bounded IN THE SCHEMA by the class's own
// bounds, not left to Phase C's post-generation check to catch — cardinality
// is a free, cheap constraint (per the Phase B research note: schema-level
// constraints cost nothing and eliminate a whole class of invalid
// responses before they ever reach validation logic). Phase C still
// re-verifies everything this schema can't express (odds/edge guardrails,
// anti-correlation, joint probability) — schema validity is necessary, not
// sufficient.
export function buildCouponSelectionSchema(bounds: {
  minLegs: number;
  maxLegs: number;
}) {
  const noCouponSchema = z.object({
    verdict: z.literal("no_coupon"),
    reasonDetails: z
      .string()
      .min(1)
      .max(600)
      .describe(
        "Why no coherent coupon could be built for this class from the pool given.",
      ),
  });

  const composeSchema = z.object({
    verdict: z.literal("compose"),
    reasonDetails: z
      .string()
      .min(1)
      .max(600)
      .describe(
        "The narrative logic behind this specific mix of legs — not a restatement of any leg's probability or odds.",
      ),
    legs: z
      .array(
        z.object({
          /** 1-based index into the numbered pool shown in the prompt. */
          index: z.number().int().min(1),
          /** Short qualitative note on why THIS leg belongs in THIS mix —
           * the model has no license to compute a probability/odds, so
           * there's nothing numeric to restate here. */
          reasoning: z.string().min(1).max(300),
        }),
      )
      .min(bounds.minLegs)
      .max(bounds.maxLegs),
  });

  return z.discriminatedUnion("verdict", [noCouponSchema, composeSchema]);
}

export type CouponSelectionResponse = z.infer<
  ReturnType<typeof buildCouponSelectionSchema>
>;
