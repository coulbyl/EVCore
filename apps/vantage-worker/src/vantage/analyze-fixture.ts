import type { Logger } from "pino";
import type { Config } from "../config";
import type { ChannelCalibration, MatchContext } from "../context/types";
import { buildMatchContext } from "../context/build-match-context";
import { requestVantageCompletion, type LlmClients } from "../groq/client";
import { requestSituationalResearch } from "../research";
import { persistVantageDecision } from "./persist-decision";
import { vantageResponseSchema } from "./response-schema";
import { isValidPickForMarket } from "./known-picks";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

// v3-context (2026-08-30): expanded context (near-miss reads, raw team_stats,
// H2H scoreline, two independent second opinions, raw ONE_X_TWO market
// price) + a broadened "when to play" rule — see docs/context-expansion-
// proposal.md. Bumped deliberately so this cohort's calibration is tracked
// separately from v2-research's, never blended (see project memory
// project_vantage_channel: v2's near-perfect calibration came from playing
// rarely — widening scope should be measured on its own, not assumed safe).
const CONFIG_VERSION = "vantage-v3-context";

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

/** The odds VANTAGE's own pick would carry, if another channel's reading for
 * this exact (market, pick) happens to have them, or (since 2026-08-30) the
 * raw ONE_X_TWO market-context block does. Checked in that order; VANTAGE
 * has no other source of odds — see MIN_ODDS above. */
function findKnownOdds(
  context: MatchContext,
  market: string,
  pick: string,
): number | null {
  const reading = context.readings.find(
    (r) => r.market === market && r.pick === pick && r.odds !== null,
  );
  if (reading?.odds != null) return reading.odds;

  const marketOdds = context.uncoveredMarketOdds?.find(
    (m) => m.market === market,
  );
  if (!marketOdds) return null;
  if (pick === "HOME") return marketOdds.homeOdds;
  if (pick === "DRAW") return marketOdds.drawOdds;
  if (pick === "AWAY") return marketOdds.awayOdds;
  return null;
}

/** Same floor CLAUDE.md already names for these markets ("ratio réel/annoncé
 * < 0.85"), and the same 30-sample floor the prompt itself uses before
 * showing a channel's calibration as "mesurable" (see prompt.ts's
 * readingsBlock) — below that, a ratio is too noisy to gate on either way. */
const MIN_CALIBRATION_RATIO = 0.85;
const MIN_CALIBRATION_SAMPLE = 30;

/** (market, pick) → the channel whose measured calibration should gate it.
 * Scoped to exactly the cases CLAUDE.md/docs/vantage-centric-redesign-2026-
 * 09-01.md §4 point 3 and §5.8 name as measured bad (ONE_X_TWO/DRAW,
 * CLEAN_SHEET, RESULT_BTTS) — not a general (market, pick) → channel map,
 * which doesn't exist cleanly (a market like ONE_X_TWO/HOME can come from
 * more than one channel's own read). Widen this list only after a
 * calibration audit names another (market, pick) as measured bad, same
 * discipline as shadow-ml's DOMINANT/VALUE-only allowlist (types.ts).
 *
 * Audit 2026-09-03 (docs/vantage-centric-redesign-2026-09-01.md §5.8):
 * ONE_X_TWO/DRAW was VANTAGE's single most-played pick (35% of its
 * "play" volume) despite ratio 0.77 — the prompt already surfaces the
 * calibration number as context (prompt.ts), but a number in a prompt is
 * not a filter: the model still played it. This is the actual filter,
 * same defense-in-depth pattern as MIN_ODDS above. */
const GATED_PICKS: readonly { market: string; pick: string; channel: string }[] = [
  { market: "ONE_X_TWO", pick: "DRAW", channel: "DRAW" },
  { market: "CLEAN_SHEET_HOME", pick: "YES", channel: "CLEAN_SHEET" },
  { market: "CLEAN_SHEET_AWAY", pick: "YES", channel: "CLEAN_SHEET" },
  { market: "RESULT_BTTS", pick: "*", channel: "RESULT_BTTS" },
];

/** Returns the poorly-calibrated channel backing this (market, pick), or
 * `null` if it isn't gated or its calibration isn't measured badly enough
 * (or isn't measured at all — see MIN_CALIBRATION_SAMPLE) to reject on. */
function findPoorCalibration(
  context: MatchContext,
  market: string,
  pick: string,
): ChannelCalibration | null {
  const gate = GATED_PICKS.find(
    (g) => g.market === market && (g.pick === "*" || g.pick === pick),
  );
  if (!gate) return null;

  const calib = context.calibration.find((c) => c.channel === gate.channel);
  if (!calib || calib.calibrationRatio === null) return null;
  if (calib.sampleSize < MIN_CALIBRATION_SAMPLE) return null;
  if (calib.calibrationRatio >= MIN_CALIBRATION_RATIO) return null;
  return calib;
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
  const context = await buildMatchContext(fixtureId, logger);
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

  // Situational research dispatches to whichever backend `config.
  // researchProvider` names — "groq" (native `groq/compound` web search,
  // using whichever configured client is actually Groq, primary or
  // fallback — findProviderClient in client.ts; fixed 2026-08-30 after a
  // real prod config — LLM_PROVIDER=cerebras with groq only as a fallback —
  // showed research silently no-op'd because the old gate only ever
  // checked the primary) or "tavily" (a direct search API call,
  // independent of any LLM provider) — see research/index.ts. Either way,
  // independent from whichever provider ends up serving the verdict call
  // below.
  const research = await requestSituationalResearch({
    clients,
    config,
    input: {
      homeTeam: context.homeTeam,
      awayTeam: context.awayTeam,
      competitionCode: context.competitionCode,
      competitionName: context.competitionName,
      kickoff: context.kickoff,
    },
    logger,
  });

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
      {
        fixtureId,
        fixtureName,
        scheduledAt: context.kickoff,
        raw,
        issues: parsed.error.issues,
      },
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
    const knownOdds = findKnownOdds(
      context,
      parsed.data.market,
      parsed.data.pick,
    );
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

    const poorCalibration = findPoorCalibration(
      context,
      parsed.data.market,
      parsed.data.pick,
    );
    if (poorCalibration) {
      logger.warn(
        {
          fixtureId,
          fixtureName,
          scheduledAt: context.kickoff,
          market: parsed.data.market,
          pick: parsed.data.pick,
          channel: poorCalibration.channel,
          calibrationRatio: poorCalibration.calibrationRatio,
          sampleSize: poorCalibration.sampleSize,
        },
        "vantage: pick's channel is measured poorly calibrated on this competition — rejecting",
      );
      return {
        outcome: "invalid_response",
        raw,
        error: `channel "${poorCalibration.channel}" calibration ratio ${poorCalibration.calibrationRatio} (n=${poorCalibration.sampleSize}) is below the ${MIN_CALIBRATION_RATIO} floor for market "${parsed.data.market}" pick "${parsed.data.pick}"`,
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
    {
      fixtureId,
      fixtureName,
      scheduledAt: context.kickoff,
      verdict: parsed.data.verdict,
    },
    "vantage: decision persisted",
  );
  return { outcome: "persisted", verdict: parsed.data.verdict };
}
