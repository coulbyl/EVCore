import { z } from "zod";
import { Market } from "@evcore/analysis-core";

// Every value Market can take, as a Zod enum — VANTAGE is never allowed to
// invent a market. If the model names anything outside this list, Zod
// rejects the whole response (see CLAUDE.md: "toute réponse non conforme est
// rejetée automatiquement"). Cast to `[Market, ...Market[]]` rather than
// `[string, ...string[]]` so the inferred response type keeps the literal
// union — persist-decision.ts writes it straight into a Prisma `Market`
// column and needs the narrow type, not `string`.
const MARKET_VALUES = Object.values(Market) as [Market, ...Market[]];

const noPlaySchema = z.object({
  verdict: z.literal("no_play"),
  reasonDetails: z
    .string()
    .min(1)
    .max(600)
    .describe(
      "Why nothing stood out on this fixture — required even for no_play.",
    ),
});

/** The basis a "play" declares. Optional in the schema (an older model
 * output without it is still a valid verdict) but asked for by the prompt
 * and persisted, so each basis can be measured on its own.
 *
 * "tension" stays parseable although the prompt no longer offers it since
 * v5 (2026-10-27): a model that still answers with it gets a recorded,
 * deterministic refusal (analyze-fixture.ts, VANTAGE_GATED_BASIS) instead of
 * an invalid response retried in a loop. */
export const PLAY_BASES = ["tension", "near_threshold", "raw_stats"] as const;

const playSchema = z.object({
  verdict: z.literal("play"),
  basis: z.enum(PLAY_BASES).optional(),
  market: z.enum(MARKET_VALUES),
  // Free text, but must be one of the pick strings the chosen market already
  // uses elsewhere in the system (checked separately against
  // KNOWN_PICKS_BY_MARKET in validate-response.ts) — Zod alone can't express
  // "valid for this specific market", only "is a non-empty string".
  pick: z.string().min(1).max(64),
  probability: z.number().min(0.01).max(0.99),
  reasonDetails: z
    .string()
    .min(1)
    .max(600)
    .describe(
      "The tension or convergence across channels that justifies this pick.",
    ),
});

export const vantageResponseSchema = z.discriminatedUnion("verdict", [
  noPlaySchema,
  playSchema,
]);

export type VantageResponse = z.infer<typeof vantageResponseSchema>;
