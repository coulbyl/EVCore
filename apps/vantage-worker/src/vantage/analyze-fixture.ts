import type { Logger } from "pino";
import type Groq from "groq-sdk";
import type { Config } from "../config";
import { buildMatchContext } from "../context/build-match-context";
import { requestVantageCompletion } from "../groq/client";
import { requestSituationalResearch } from "../groq/research";
import { persistVantageDecision } from "./persist-decision";
import { vantageResponseSchema } from "./response-schema";
import { isValidPickForMarket } from "./known-picks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

const CONFIG_VERSION = "vantage-v2-research";

export type AnalyzeResult =
  | { outcome: "no_context" }
  | { outcome: "skipped_no_readings" }
  | { outcome: "invalid_response"; raw: string; error: string }
  | { outcome: "persisted"; verdict: "play" | "no_play" };

/** One fixture, one VANTAGE read, start to finish. Never throws on a bad LLM
 * response — an invalid response is logged and reported, not persisted (see
 * response-schema.ts: malformed output is rejected, never half-written). */
export async function analyzeFixture(
  fixtureId: string,
  groqClient: Groq,
  config: Config,
  logger: Logger,
): Promise<AnalyzeResult> {
  const context = await buildMatchContext(fixtureId);
  if (!context) return { outcome: "no_context" };

  // Nothing for VANTAGE to read across implies nothing for it to say —
  // calling the model on an empty context would just invite it to invent a
  // reason where none exists.
  if (context.readings.length === 0) return { outcome: "skipped_no_readings" };

  const research = await requestSituationalResearch(
    groqClient,
    config,
    context.homeTeam,
    context.awayTeam,
    context.competitionCode,
    context.competitionName,
    context.kickoff,
    logger,
  );

  const userPrompt = buildUserPrompt(context, research);
  const raw = await requestVantageCompletion(
    groqClient,
    config,
    SYSTEM_PROMPT,
    userPrompt,
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    logger.warn({ fixtureId, raw }, "vantage: response was not valid JSON");
    return { outcome: "invalid_response", raw, error: "not_json" };
  }

  const parsed = vantageResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.warn(
      { fixtureId, raw, issues: parsed.error.issues },
      "vantage: response failed schema validation",
    );
    return {
      outcome: "invalid_response",
      raw,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  if (
    parsed.data.verdict === "play" &&
    !isValidPickForMarket(parsed.data.market, parsed.data.pick)
  ) {
    logger.warn(
      { fixtureId, market: parsed.data.market, pick: parsed.data.pick },
      "vantage: pick is not a legal value for its market — rejecting",
    );
    return {
      outcome: "invalid_response",
      raw,
      error: `illegal pick "${parsed.data.pick}" for market "${parsed.data.market}"`,
    };
  }

  await persistVantageDecision(
    context.modelRunId,
    parsed.data,
    CONFIG_VERSION,
    research,
  );
  logger.info(
    { fixtureId, verdict: parsed.data.verdict },
    "vantage: decision persisted",
  );
  return { outcome: "persisted", verdict: parsed.data.verdict };
}
