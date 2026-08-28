import type { Logger } from "pino";
import type { Config } from "../config";
import type { MatchContext } from "../context/types";
import { buildMatchContext } from "../context/build-match-context";
import { requestVantageCompletion, type LlmClients } from "../groq/client";
import { requestSituationalResearch } from "../groq/research";
import { persistVantageDecision } from "./persist-decision";
import { vantageResponseSchema } from "./response-schema";
import { isValidPickForMarket } from "./known-picks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

const CONFIG_VERSION = "vantage-v2-research";

/** Same empirically-justified floor used elsewhere in the system — see
 * apps/backend/src/modules/coupon/coupon.constants.ts's MIN_LEG_ODDS and
 * analysis-core's DOMINANT_MIN_ODDS: below 1.20, a leg's ROI turns sharply
 * negative (measured: -5.17%±1.59 in the 1.10-1.20 band vs -3.06%±1.16 just
 * above it) while adding almost no volume. Kept as VANTAGE's own constant
 * rather than importing one of those — same number today, independently
 * adjustable, not implicitly coupled to another channel's threshold.
 *
 * VANTAGE never computes odds itself (its response schema has no odds
 * field), so this can only be enforced when its pick happens to match a
 * reading's exact (market, pick) — see findKnownOdds below. The prompt also
 * instructs the model directly not to propose anything it can see is under
 * 1.20; this is the defense-in-depth backstop, same pattern as
 * isValidPickForMarket. */
const MIN_ODDS = 1.2;

/** The odds VANTAGE's own pick would carry, if another channel's reading
 * for this exact (market, pick) happens to have them. VANTAGE has no other
 * source of odds — see MIN_ODDS above. */
function findKnownOdds(
  context: MatchContext,
  market: string,
  pick: string,
): number | null {
  const reading = context.readings.find(
    (r) => r.market === market && r.pick === pick && r.odds !== null,
  );
  return reading?.odds ?? null;
}

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

  // Attached to every log line below — a bare fixtureId is meaningless
  // without opening the DB, and this is on the hot path for reading prod
  // logs (see the 2026-08-28 incident).
  const fixtureName = `${context.homeTeam} vs ${context.awayTeam}`;

  // Nothing for VANTAGE to read across implies nothing for it to say —
  // calling the model on an empty context would just invite it to invent a
  // reason where none exists.
  if (context.readings.length === 0) {
    logger.info(
      { fixtureId, fixtureName, scheduledAt: context.kickoff },
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
    logger.warn(
      { fixtureId, fixtureName, scheduledAt: context.kickoff, raw },
      "vantage: response was not valid JSON",
    );
    return { outcome: "invalid_response", raw, error: "not_json" };
  }

  const parsed = vantageResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.warn(
      { fixtureId, fixtureName, scheduledAt: context.kickoff, raw, issues: parsed.error.issues },
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
      {
        fixtureId,
        fixtureName,
        scheduledAt: context.kickoff,
        market: parsed.data.market,
        pick: parsed.data.pick,
      },
      "vantage: pick is not a legal value for its market — rejecting",
    );
    return {
      outcome: "invalid_response",
      raw,
      error: `illegal pick "${parsed.data.pick}" for market "${parsed.data.market}"`,
    };
  }

  if (parsed.data.verdict === "play") {
    const knownOdds = findKnownOdds(context, parsed.data.market, parsed.data.pick);
    if (knownOdds !== null && knownOdds < MIN_ODDS) {
      logger.warn(
        {
          fixtureId,
          fixtureName,
          scheduledAt: context.kickoff,
          market: parsed.data.market,
          pick: parsed.data.pick,
          odds: knownOdds,
        },
        "vantage: pick's known odds are below the 1.20 floor — rejecting",
      );
      return {
        outcome: "invalid_response",
        raw,
        error: `odds ${knownOdds} for market "${parsed.data.market}" pick "${parsed.data.pick}" are below the ${MIN_ODDS} floor`,
      };
    }
  }

  await persistVantageDecision(
    context.modelRunId,
    parsed.data,
    CONFIG_VERSION,
    research,
  );
  logger.info(
    { fixtureId, fixtureName, scheduledAt: context.kickoff, verdict: parsed.data.verdict },
    "vantage: decision persisted",
  );
  return { outcome: "persisted", verdict: parsed.data.verdict };
}
