import type { Logger } from "pino";
import type { CouponBounds, CouponClass } from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import { generateCouponSelection } from "./generate-coupon-selection";
import type { ScoredCandidate } from "./score-candidates";
import {
  validateCouponSelection,
  type ComposedCoupon,
} from "./validate-coupon-selection";

const DEFAULT_MAX_ATTEMPTS = 3;

export type ComposeCouponClassResult =
  | { outcome: "empty_pool" }
  | { outcome: "no_coupon"; reasonDetails: string }
  | { outcome: "gave_up"; attempts: number; lastReason: string }
  | { outcome: "composed"; coupon: ComposedCoupon; reasonDetails: string };

/**
 * One class (SAFE/BALANCED/BOLD), generate → validate → retry-with-feedback
 * loop, start to finish. Ties together generateCouponSelection (Phase B) and
 * validateCouponSelection (Phase C, docs/vantage-centric-
 * redesign-2026-09-01.md §9 point 4).
 *
 * "Régénérer si violation" per the plan means exactly this: on a rejected
 * selection (schema-invalid OR failed deterministic validation), retry with
 * the rejection reason fed back into the next prompt — never a blind retry,
 * which at `temperature: 0` would just reproduce the identical output (see
 * buildCouponSelectionUserPrompt's doc comment).
 *
 * No fallback to a deterministic composer after `maxAttempts` — the LLM is
 * the sole composition path (docs/vantage-centric-redesign-2026-09-01.md
 * §9bis, "pas de shadow mode, le LLM est master"). Giving up means no
 * coupon for this class today, not a degraded one.
 */
export async function composeCouponClass(
  scoredPool: readonly ScoredCandidate[],
  couponClass: CouponClass,
  bounds: CouponBounds,
  clients: LlmClients,
  logger: Logger,
  opts: { maxAttempts?: number } = {},
): Promise<ComposeCouponClassResult> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let feedback: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const generated = await generateCouponSelection(
      scoredPool,
      couponClass,
      bounds,
      clients,
      logger,
      feedback,
    );

    if (generated.outcome === "empty_pool") {
      return { outcome: "empty_pool" };
    }
    if (generated.outcome === "no_coupon") {
      return { outcome: "no_coupon", reasonDetails: generated.reasonDetails };
    }
    if (generated.outcome === "invalid_response") {
      feedback = `réponse précédente invalide (${generated.error})`;
      logger.warn(
        { couponClass: couponClass.name, attempt, reason: feedback },
        "coupon: attempt failed schema validation, retrying with feedback",
      );
      continue;
    }

    const validated = validateCouponSelection(
      generated.legs,
      couponClass,
      bounds,
    );
    if (validated.outcome === "valid") {
      return {
        outcome: "composed",
        coupon: validated.coupon,
        reasonDetails: generated.reasonDetails,
      };
    }

    feedback = validated.reason;
    logger.warn(
      { couponClass: couponClass.name, attempt, reason: feedback },
      "coupon: selection failed deterministic validation, retrying with feedback",
    );
  }

  logger.warn(
    { couponClass: couponClass.name, maxAttempts, lastReason: feedback },
    "coupon: gave up after max attempts — no coupon published for this class",
  );
  return {
    outcome: "gave_up",
    attempts: maxAttempts,
    lastReason: feedback ?? "no attempt produced a usable response",
  };
}
