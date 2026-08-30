import type { StrategyChannel } from "@evcore/analysis-core";
import type { NearMissReading } from "./types";

// Extracts a REJECTED channel decision's own near-threshold probability from
// its `reasonDetails` payload, when the shape allows it — see
// docs/context-expansion-proposal.md ("C") and the 2026-08-30 audit of all
// 19 strategies' rejection payloads it's built from. Raw values only, no
// interpretation: VANTAGE reads the same numbers a human would, forms its
// own read from them.
//
// Deliberately absent from NEAR_MISS_EXTRACTORS (checked, not an oversight):
// - FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME — 97-100% of their
//   rejections are `market_suspended` (a deliberate quality gate: HT markets
//   restricted to leagues with real half-time decomposition history,
//   following a bivariate-Poisson overestimation risk found in a 2026-08-13
//   audit). The probability exists upstream but is intentionally withheld as
//   untrustworthy there — decision (2026-08-30, user): keep it hidden from
//   VANTAGE too, do not surface it even with a caveat.
// - CONSENSUS, AVOID — meta-channels, no market pick of their own.
type NearMissExtractor = (
  details: Record<string, unknown>,
) => NearMissReading | null;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Channels that log one or more named probabilities plus one shared
 * threshold field — everything from a single `probability`/
 * `impliedProbability` (VALUE's score gate, DRAW, DOUBLE_CHANCE, ...) to two
 * named sides (BTTS's `bttsYes`/`bttsNo`, CLEAN_SHEET's home/away, ...) is
 * the same shape once a bare field is just a one-entry list — a single
 * factory replaces what used to be two near-identical ones (a 2026-08-30
 * code-review finding: a dedicated "direct" extractor was pure duplication
 * of this one called with a 1-element field list). No single shared
 * field-name schema across channels (audited 2026-08-30), hence one small
 * mapping table per channel below rather than a generic key. */
function fieldsExtractor(
  fields: readonly { key: string; label: string }[],
  thresholdKey: string,
): NearMissExtractor {
  return (details) => {
    const values = fields
      .map(({ key, label }) => ({ label, probability: details[key] }))
      .filter((v): v is { label: string; probability: number } =>
        isFiniteNumber(v.probability),
      );
    if (values.length === 0) return null;
    const threshold = details[thresholdKey];
    return { values, threshold: isFiniteNumber(threshold) ? threshold : null };
  };
}

/** GOALS' `no_priced_line` shape: every above-threshold line the book had no
 * price for, each carrying its own computed probability (fixed 2026-08-30 —
 * see goals.strategy.ts, this used to discard the probability entirely). */
function candidateLinesExtractor(listKey: string): NearMissExtractor {
  return (details) => {
    const list = details[listKey];
    if (!Array.isArray(list)) return null;
    const values = list
      .map((entry) => {
        if (
          entry !== null &&
          typeof entry === "object" &&
          "pick" in entry &&
          "probability" in entry &&
          typeof (entry as Record<string, unknown>)["pick"] === "string" &&
          isFiniteNumber((entry as Record<string, unknown>)["probability"])
        ) {
          const record = entry as { pick: string; probability: number };
          return { label: record.pick, probability: record.probability };
        }
        return null;
      })
      .filter((v): v is { label: string; probability: number } => v !== null);
    if (values.length === 0) return null;
    return { values, threshold: null };
  };
}

/** CORRECT_SCORE's `no_odds`/`no_modelable_scoreline` shape: the modal
 * scoreline the Poisson matrix favours, regardless of pricing (fixed
 * 2026-08-30 — see correct-score.strategy.ts, the matrix used to never even
 * be computed before this rejection fired). No threshold — CORRECT_SCORE's
 * gate is a conviction floor on a different reasonCode (`below_conviction`),
 * not applicable here. */
function modalScorelineExtractor(
  scorelineKey: string,
  probabilityKey: string,
): NearMissExtractor {
  return (details) => {
    const scoreline = details[scorelineKey];
    const probability = details[probabilityKey];
    if (typeof scoreline !== "string" || !isFiniteNumber(probability))
      return null;
    return { values: [{ label: scoreline, probability }], threshold: null };
  };
}

/** VALUE/SAFE's `no_viable_pick`/`no_safe_candidate` rejection logs
 * `bestQualityPickDetails(candidates)` — the best Phase-1-selected candidate
 * by quality score, even though it didn't clear the edge floor
 * (`pick-evaluation.ts`: `{market, pick, probability, odds, ev,
 * qualityScore, edge, rejectionReason}`). This *is* a real probability, but
 * it is NOT a "near a threshold" read the way a bare field-lookup implies —
 * there is no `threshold` field here at all, and mislabeling it as one would
 * imply a probability-vs-threshold proximity that was never computed. Kept
 * as its own extractor, with `threshold: null` always, and a "meilleur
 * candidat" label rather than "annoncée" — see near-miss.spec.ts's
 * VALUE/SAFE tests for the distinction from the `score_below_threshold`
 * gate below. */
function bestCandidateExtractor(): NearMissExtractor {
  return (details) => {
    const probability = details["probability"];
    if (!isFiniteNumber(probability)) return null;
    return {
      values: [{ label: "meilleur candidat retenu", probability }],
      threshold: null,
    };
  };
}

const NEAR_MISS_EXTRACTORS: Partial<
  Record<StrategyChannel, readonly NearMissExtractor[]>
> = {
  // VALUE/SAFE's actual rejection shapes, tried in the order they're most
  // likely to fire: `score_below_threshold` (the deterministic-score gate,
  // {score, threshold} — checked 2026-08-30 against value.strategy.ts/
  // safe.strategy.ts, does NOT use a `probability` key) first, then
  // `no_viable_pick`/`no_safe_candidate`'s bestQualityPickDetails shape.
  // A single `{probability, threshold}` field lookup alone (the pre-2026-08-30
  // version of this table) silently matched neither on the common path —
  // fixed after a code-review audit found the mismatch.
  VALUE: [
    fieldsExtractor([{ key: "score", label: "score modèle" }], "threshold"),
    bestCandidateExtractor(),
  ],
  SAFE: [
    fieldsExtractor([{ key: "score", label: "score modèle" }], "threshold"),
    bestCandidateExtractor(),
  ],
  // DOMINANT's `below_threshold` ({probability, threshold}) is the common
  // case; `insufficient_margin` ({margin, minMargin}) and `below_min_odds`
  // ({odds, minOdds}) are real rejection reasons too but aren't probability-
  // vs-threshold reads — reported as their own, correctly-labeled shapes
  // rather than forced into the same shape as the common case above.
  DOMINANT: [
    fieldsExtractor([{ key: "probability", label: "annoncée" }], "threshold"),
    fieldsExtractor(
      [{ key: "margin", label: "écart favori/second" }],
      "minMargin",
    ),
    fieldsExtractor([{ key: "odds", label: "cote" }], "minOdds"),
  ],
  DRAW: [
    fieldsExtractor(
      [{ key: "impliedProbability", label: "annoncée" }],
      "threshold",
    ),
  ],
  DOUBLE_CHANCE: [
    fieldsExtractor([{ key: "probability", label: "annoncée" }], "threshold"),
  ],
  RESULT_TOTAL_GOALS: [
    fieldsExtractor([{ key: "probability", label: "annoncée" }], "threshold"),
  ],
  // Field name confirmed against btts.strategy.ts 2026-08-30 — a single
  // `threshold`, not `yesThreshold`/`noThreshold` (an earlier revision of
  // this strategy used the latter; a prod DB sample from before that change
  // was mistakenly used as the reference when this table was first written,
  // so it silently never matched real rejections until a code-review audit
  // caught it).
  BTTS: [
    fieldsExtractor(
      [
        { key: "bttsYes", label: "Oui" },
        { key: "bttsNo", label: "Non" },
      ],
      "threshold",
    ),
  ],
  CLEAN_SHEET: [
    fieldsExtractor(
      [
        { key: "cleanSheetHome", label: "domicile" },
        { key: "cleanSheetAway", label: "extérieur" },
      ],
      "threshold",
    ),
  ],
  WIN_EITHER_HALF: [
    fieldsExtractor(
      [
        { key: "winEitherHalfHome", label: "domicile" },
        { key: "winEitherHalfAway", label: "extérieur" },
      ],
      "threshold",
    ),
  ],
  DRAW_NO_BET: [
    fieldsExtractor(
      [
        { key: "dnbHome", label: "domicile" },
        { key: "dnbAway", label: "extérieur" },
      ],
      "threshold",
    ),
  ],
  WIN_TO_NIL: [
    fieldsExtractor(
      [
        { key: "winToNilHome", label: "domicile" },
        { key: "winToNilAway", label: "extérieur" },
      ],
      "threshold",
    ),
  ],
  // GOALS has two distinct rejection shapes depending on reasonCode
  // (below_threshold → direct; no_priced_line → a list) — try both in order.
  GOALS: [
    fieldsExtractor([{ key: "probability", label: "annoncée" }], "threshold"),
    candidateLinesExtractor("candidateLines"),
  ],
  CORRECT_SCORE: [modalScorelineExtractor("bestScoreline", "bestProbability")],
};

/** Returns the near-miss reading for one REJECTED channel decision, or
 * `null` when the channel isn't covered (see the module comment above) or
 * its actual payload didn't match the expected shape (schema drift — fails
 * closed, same discipline as the rest of VANTAGE's input handling). */
export function extractNearMiss(
  channel: StrategyChannel,
  reasonDetails: unknown,
): NearMissReading | null {
  const extractors = NEAR_MISS_EXTRACTORS[channel];
  if (!extractors) return null;
  if (
    reasonDetails === null ||
    typeof reasonDetails !== "object" ||
    Array.isArray(reasonDetails)
  ) {
    return null;
  }
  const details = reasonDetails as Record<string, unknown>;
  for (const extractor of extractors) {
    const result = extractor(details);
    if (result) return result;
  }
  return null;
}
