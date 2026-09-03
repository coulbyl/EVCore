import type { Logger } from "pino";
import type { CouponBounds, CouponClass } from "@evcore/analysis-core";
import { requestVantageCompletion, type LlmClients } from "../groq/client";
import {
  admissibleCandidates,
  reduceToLlmPool,
  type ScoredCandidate,
} from "./score-candidates";
import {
  buildCouponSelectionSchema,
  type CouponSelectionResponse,
} from "./selection-schema";
import {
  buildCouponSelectionSystemPrompt,
  buildCouponSelectionUserPrompt,
} from "./selection-prompt";

/** One selected leg, resolved back from the LLM's numeric index to the
 * actual candidate it refers to — the only thing the LLM ever touches is
 * the index; everything else here is looked up, never re-parsed from the
 * model's own output. */
export type SelectedLeg = {
  candidate: ScoredCandidate;
  reasoning: string;
};

export type GenerateCouponSelectionResult =
  | { outcome: "empty_pool" }
  | { outcome: "no_coupon"; reasonDetails: string }
  | { outcome: "invalid_response"; raw: string; error: string }
  | { outcome: "composed"; legs: SelectedLeg[]; reasonDetails: string };

/**
 * One coupon class, one LLM call, start to finish — mirrors analyzeFixture's
 * shape (vantage/analyze-fixture.ts): never throws on a bad LLM response, an
 * invalid response is reported, not partially trusted.
 *
 * Deliberately does NOT do what Phase C (docs/vantage-centric-
 * redesign-2026-09-01.md §9 point 4) is responsible for: re-running the
 * guardrails on the selected legs, checking anti-correlation, computing the
 * real combinedOdds/jointProbability/couponEV, or persisting anything. This
 * function's contract ends at "here are the candidates the model picked,
 * resolved back to real data" — Phase C decides whether that selection is
 * actually publishable.
 */
export async function generateCouponSelection(
  scoredPool: readonly ScoredCandidate[],
  couponClass: CouponClass,
  bounds: CouponBounds,
  clients: LlmClients,
  logger: Logger,
): Promise<GenerateCouponSelectionResult> {
  const withinClassBand = admissibleCandidates(scoredPool).filter(
    (c) =>
      c.oddsSnapshot !== null &&
      c.oddsSnapshot >= couponClass.minLegOdds &&
      c.oddsSnapshot < couponClass.maxLegOdds,
  );

  // Nothing for the LLM to choose from implies nothing for it to say —
  // calling the model on a pool too small to even reach minLegs would just
  // invite it to invent a reason where none exists (same principle as
  // analyzeFixture's own "no readings" early return).
  if (withinClassBand.length < bounds.minLegs) {
    logger.info(
      { couponClass: couponClass.name, poolSize: withinClassBand.length },
      "coupon: pool too small for this class, skipping LLM call",
    );
    return { outcome: "empty_pool" };
  }

  const pool = reduceToLlmPool(withinClassBand);

  const schema = buildCouponSelectionSchema(bounds);
  const systemPrompt = buildCouponSelectionSystemPrompt(couponClass, bounds);
  const userPrompt = buildCouponSelectionUserPrompt(couponClass, pool);

  const raw = await requestVantageCompletion(
    clients,
    systemPrompt,
    userPrompt,
    logger,
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    logger.warn(
      { couponClass: couponClass.name, raw },
      "coupon: response was not valid JSON",
    );
    return { outcome: "invalid_response", raw, error: "not_json" };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.warn(
      {
        couponClass: couponClass.name,
        raw,
        issues: parsed.error.issues,
      },
      "coupon: response failed schema validation",
    );
    return {
      outcome: "invalid_response",
      raw,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  if (parsed.data.verdict === "no_coupon") {
    return { outcome: "no_coupon", reasonDetails: parsed.data.reasonDetails };
  }

  return resolveSelectedLegs(parsed.data, pool, raw);
}

function resolveSelectedLegs(
  data: Extract<CouponSelectionResponse, { verdict: "compose" }>,
  pool: readonly ScoredCandidate[],
  raw: string,
): GenerateCouponSelectionResult {
  const legs: SelectedLeg[] = [];
  const seenIndices = new Set<number>();

  for (const leg of data.legs) {
    if (seenIndices.has(leg.index)) {
      return {
        outcome: "invalid_response",
        raw,
        error: `index ${leg.index} selected more than once`,
      };
    }
    seenIndices.add(leg.index);

    const candidate = pool[leg.index - 1];
    if (!candidate) {
      return {
        outcome: "invalid_response",
        raw,
        error: `index ${leg.index} is out of range for a pool of ${pool.length} candidates`,
      };
    }
    legs.push({ candidate, reasoning: leg.reasoning });
  }

  return { outcome: "composed", legs, reasonDetails: data.reasonDetails };
}
