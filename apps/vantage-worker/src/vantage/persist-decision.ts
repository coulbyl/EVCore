import { prisma } from "@evcore/db";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import type { VantageResponse } from "./response-schema";
import type { SituationalResearch } from "../research";

/** Writes VANTAGE's decision as a normal ChannelDecision + ChannelSelection,
 * attached to the fixture's existing ModelRun — the exact same shape every
 * other channel writes. Never touches ModelRun.finalScore/llmDelta: VANTAGE
 * proposes its own pick, it never adjusts anyone else's score.
 *
 * Also appends one row to VantageDecisionHistory, append-only, every single
 * call — regardless of whether the upsert below creates or overwrites the
 * live ChannelDecision. A new ModelRun per re-analysis (the common case as
 * kickoff nears) already gives each attempt its own live row for free; this
 * is for the one case that doesn't: two calls landing on the SAME modelRunId
 * (e.g. a retry), where the upsert's `update` branch would otherwise replace
 * the previous attempt with no trace (2026-09-07, user request — wants to be
 * able to see whether VANTAGE's read changed for the better as a match
 * approached, which needs every attempt kept, not just the last one). */
export async function persistVantageDecision(
  fixtureId: string,
  modelRunId: string,
  response: VantageResponse,
  configVersion: string,
  research: SituationalResearch | null,
  // Same value the MIN_ODDS floor check already resolved (analyze-fixture.ts's
  // findKnownOdds) — VANTAGE's LLM response never carries odds itself (its
  // schema has none), but the odds it already checked against the floor are
  // the honest price for this exact pick, not invented. Persisting it here
  // means the frontend reads it like any other channel's selection, instead
  // of guessing at a sibling channel's matching pick (which fails whenever
  // VANTAGE disagrees with every other channel — its whole reason to play).
  odds: number | null = null,
): Promise<void> {
  const status = response.verdict === "play" ? "SELECTED" : "REJECTED";
  const reasonCode =
    response.verdict === "play" ? "VANTAGE_PLAY" : "VANTAGE_NO_PLAY";
  // Citations are logged alongside the verdict's own reasoning — not as
  // proof the model used them (see prompt.ts: it's told to ignore research
  // that doesn't change its reading), but so an audit can always see exactly
  // what was available to it, same spirit as logging deterministic `features`
  // on every ModelRun.
  const reasonDetails = {
    text: response.reasonDetails,
    ...(research ? { researchCitations: research.citations } : {}),
  };
  const newSelection =
    response.verdict === "play"
      ? [
          {
            market: response.market,
            pick: response.pick,
            probability: response.probability,
            odds: odds ?? undefined,
            rank: 1,
          },
        ]
      : [];

  await prisma.$transaction([
    // Re-running the same fixture (e.g. odds moved, decisions were
    // re-evaluated) replaces the previous VANTAGE read rather than
    // duplicating it — `deleteMany` on `update` clears a stale selection
    // from a prior "play" run before a "no_play" (or a different pick) is
    // written, since the upsert's `update` branch otherwise leaves old rows
    // attached silently. This is the "live" read every other consumer
    // (frontend, calibration, settlement) reads from.
    prisma.channelDecision.upsert({
      where: {
        modelRunId_channel: { modelRunId, channel: STRATEGY_CHANNEL.VANTAGE },
      },
      create: {
        modelRunId,
        channel: STRATEGY_CHANNEL.VANTAGE,
        status,
        reasonCode,
        reasonDetails,
        configVersion,
        selections: { create: newSelection },
      },
      update: {
        status,
        reasonCode,
        reasonDetails,
        configVersion,
        selections: { deleteMany: {}, create: newSelection },
      },
    }),
    // The append-only trail — never updated, never deleted, one row per call
    // regardless of what the upsert above did to the live row.
    prisma.vantageDecisionHistory.create({
      data: {
        fixtureId,
        modelRunId,
        status,
        reasonCode,
        reasonDetails,
        configVersion,
        market: response.verdict === "play" ? response.market : undefined,
        pick: response.verdict === "play" ? response.pick : undefined,
        probability:
          response.verdict === "play" ? response.probability : undefined,
        odds: response.verdict === "play" ? (odds ?? undefined) : undefined,
      },
    }),
  ]);
}
