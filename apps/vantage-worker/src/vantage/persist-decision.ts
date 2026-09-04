import { prisma } from "@evcore/db";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import type { VantageResponse } from "./response-schema";
import type { SituationalResearch } from "../research";

/** Writes VANTAGE's decision as a normal ChannelDecision + ChannelSelection,
 * attached to the fixture's existing ModelRun — the exact same shape every
 * other channel writes. Never touches ModelRun.finalScore/llmDelta: VANTAGE
 * proposes its own pick, it never adjusts anyone else's score. */
export async function persistVantageDecision(
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

  // Re-running the same fixture (e.g. odds moved, decisions were
  // re-evaluated) replaces the previous VANTAGE read rather than duplicating
  // it — `deleteMany` on `update` clears a stale selection from a prior
  // "play" run before a "no_play" (or a different pick) is written, since the
  // upsert's `update` branch otherwise leaves old rows attached silently.
  await prisma.channelDecision.upsert({
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
  });
}
