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

const playSchema = z.object({
  verdict: z.literal("play"),
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
