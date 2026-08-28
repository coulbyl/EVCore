import type { Logger } from "pino";
import type { Config } from "../config";
import { buildMatchContext } from "../context/build-match-context";
import { requestVantageCompletion, type LlmClients } from "../groq/client";
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
  clients: LlmClients,
  config: Config,
  logger: Logger,
): Promise<AnalyzeResult> {
  const context = await buildMatchContext(fixtureId);
  if (!context) {
    // The sweep only ever selects fixtures with a ModelRun already carrying
    // non-VANTAGE decisions (see find-eligible-fixtures.ts), so this should
    // not normally happen — logged as a warning, not silently, since a
    // silent "no_context" here is exactly what let 206 fixtures sit stuck
    // and unexplained in prod (see incident 2026-08-28).
    logger.warn({ fixtureId }, "vantage: no match context available, skipping");
    return { outcome: "no_context" };
  }

  // Nothing for VANTAGE to read across implies nothing for it to say —
  // calling the model on an empty context would just invite it to invent a
  // reason where none exists.
  if (context.readings.length === 0) {
    logger.info(
      { fixtureId },
      "vantage: no channel readings on this fixture yet, skipping",
    );
    return { outcome: "skipped_no_readings" };
  }

  // Situational research is a Groq-only feature (native `groq/compound` web
  // search — see research.ts) — it only ever runs when `config.llmProvider`
  // (the primary) is "groq", so `clients.primary.client` is always the
  // right client for it regardless of whether the verdict call below ends
  // up falling back to a different provider.
  const research = await requestSituationalResearch(
    clients.primary.client,
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
    clients,
    SYSTEM_PROMPT,
    userPrompt,
    logger,
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
