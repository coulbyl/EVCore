import type { Logger } from "pino";
import {
  UNIFIED_COUPON_BOUNDS,
  UNIFIED_COUPON_CLASS,
} from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import { computeChannelReliability } from "./channel-reliability-query";
import { composeCouponClass } from "./compose-coupon-class";
import type { CouponLlmProvenance } from "./generate-coupon-selection";
import { getPoolForRange } from "./pool-query";
import { persistCouponProposal } from "./persist-coupon-proposal";
import { recordGenerationAttempt } from "./record-generation-attempt";
import { scoreCandidates, type ScoredCandidate } from "./score-candidates";

// Weekend (Fri→Sun) and midweek European-nights (Tue→Thu) coupon windows —
// every other day stays single-day. `date` is the day this pipeline runs
// for (tomorrowUtc() by default, see the scheduler), which is also the day
// the resulting CouponProposal.forDate is keyed on; only the fixture pool
// widens to `to`. Ported from apps/backend's retired coupon.worker.ts
// (resolveGenerationWindow) — same logic, no date-fns dependency needed for
// a plain +2-day UTC offset.
function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveGenerationWindow(date: string): { to: string } {
  // Noon UTC — avoids any timezone/DST boundary landing on the wrong UTC
  // calendar day, same trick used elsewhere in this codebase.
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  const dow = noonUtc.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 5 || dow === 2) {
    const to = new Date(noonUtc.getTime() + 2 * 86_400_000);
    return { to: formatDateUtc(to) };
  }
  return { to: date };
}

// One unified compose+persist pass, shared by evening and intraday. Both use
// the same proposal key; every attempt and abstention is recorded separately.
async function runComposePersistPass(
  scoredPool: readonly ScoredCandidate[],
  forDate: Date,
  clients: LlmClients,
  logger: Logger,
  logContext: Record<string, unknown>,
  persistOpts: {
    pass: "EVENING" | "INTRADAY";
    signalWindowDays?: number;
  },
): Promise<void> {
  for (const couponClass of [UNIFIED_COUPON_CLASS]) {
    let llmProvenance: CouponLlmProvenance | null = null;
    const result = await composeCouponClass(
      scoredPool,
      couponClass,
      UNIFIED_COUPON_BOUNDS,
      clients,
      logger,
      { onCompletion: (value) => (llmProvenance = value) },
    );

    if (result.outcome === "composed") {
      const persisted = await persistCouponProposal(
        forDate,
        couponClass,
        result.coupon,
        result.reasonDetails,
        { ...persistOpts, llmProvenance },
      );
      await recordGenerationAttempt({
        forDate,
        pass: persistOpts.pass,
        outcome: persisted.published ? "PUBLISHED" : "PRESERVED",
        candidateCount: scoredPool.length,
        llmProvenance,
        proposalId: persisted.proposalId,
      });
      logger.info(
        {
          ...logContext,
          couponClass: couponClass.name,
          legs: result.coupon.legs.length,
          combinedOdds: result.coupon.combinedOdds,
          couponEV: result.coupon.couponEV,
        },
        persisted.published
          ? "coupon: published"
          : "coupon: existing proposal preserved",
      );
    } else {
      await recordGenerationAttempt({
        forDate,
        pass: persistOpts.pass,
        outcome: result.outcome === "gave_up" ? "INVALID" : "ABSTAINED",
        candidateCount: scoredPool.length,
        llmProvenance,
        reason:
          result.outcome === "no_coupon"
            ? result.reasonDetails
            : result.outcome === "gave_up"
              ? result.lastReason
              : "candidate_pool_too_small",
      });
      logger.info(
        {
          ...logContext,
          couponClass: couponClass.name,
          outcome: result.outcome,
        },
        "coupon: no proposal for this class",
      );
    }
  }
}

// The daily coupon-generation pipeline, with one 5–15 policy
// (docs/vantage-centric-redesign-2026-09-01.md §9bis): pool query → score →
// LLM-select-and-validate → persist. Replaces apps/backend's
// CouponComposerService entirely (retired 2026-09-03) — this is the sole
// composition path now, no fallback.
//
// Flags mirror apps/backend's retired CouponService — all default-on, no
// env kill-switch (DRAW/AVOID/evaluated-markets widening are all
// backtested/product-approved, see that service's own retired doc
// comment for the numbers).
export async function runCouponGeneration(
  date: string,
  clients: LlmClients,
  logger: Logger,
): Promise<void> {
  const { to } = resolveGenerationWindow(date);
  const forDate = new Date(`${date}T00:00:00.000Z`);

  logger.info({ date, to }, "coupon: generation started");

  const [calibration, rawPool] = await Promise.all([
    computeChannelReliability({ asOf: new Date() }),
    getPoolForRange(date, to, {
      includeDraw: true,
      enforceAvoid: true,
      enableAvoidFade: false,
      includeEvaluatedMarkets: true,
    }),
  ]);

  const distinctFixtures = new Set(rawPool.map((p) => p.fixtureId)).size;
  logger.info(
    { date, picks: rawPool.length, distinctFixtures },
    "coupon: pool loaded",
  );

  const scoredPool = scoreCandidates(rawPool, {
    channelReliability: calibration.byChannel,
    pooledReliability: calibration.pooled,
  });

  await runComposePersistPass(
    scoredPool,
    forDate,
    clients,
    logger,
    { date },
    { pass: "EVENING" },
  );

  logger.info({ date }, "coupon: generation complete");
}

/**
 * Intraday pass for fixtures kicking off within `windowHours`, built on data refreshed by
 * `apps/backend`'s `SAME_DAY_ANALYSIS` cron (fresh `ModelRun` rows,
 * VANTAGE re-reading automatically — see project_no_same_day_reanalysis
 * memory). It uses the same immutable daily proposal key as the evening pass.
 *
 * `date`/`forDate` are always "today" (UTC) — the fixtures in the window
 * are, by construction, kicking off later today.
 */
export async function runIntradayCouponGeneration(
  windowHours: number,
  clients: LlmClients,
  logger: Logger,
): Promise<void> {
  const now = new Date();
  const to = new Date(now.getTime() + windowHours * 3_600_000);
  const date = formatDateUtc(now);
  const forDate = new Date(`${date}T00:00:00.000Z`);

  logger.info({ date, windowHours }, "coupon: intraday generation started");

  const [calibration, rawPool] = await Promise.all([
    computeChannelReliability({ asOf: new Date() }),
    getPoolForRange(date, date, {
      includeDraw: true,
      enforceAvoid: true,
      enableAvoidFade: false,
      includeEvaluatedMarkets: true,
      scheduledAtWindow: { from: now, to },
    }),
  ]);

  const distinctFixtures = new Set(rawPool.map((p) => p.fixtureId)).size;
  logger.info(
    { date, windowHours, picks: rawPool.length, distinctFixtures },
    "coupon: intraday pool loaded",
  );

  const scoredPool = scoreCandidates(rawPool, {
    channelReliability: calibration.byChannel,
    pooledReliability: calibration.pooled,
  });

  await runComposePersistPass(
    scoredPool,
    forDate,
    clients,
    logger,
    { date, windowHours, intraday: true },
    { pass: "INTRADAY" },
  );

  logger.info({ date, windowHours }, "coupon: intraday generation complete");
}
