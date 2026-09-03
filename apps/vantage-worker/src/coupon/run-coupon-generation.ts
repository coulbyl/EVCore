import type { Logger } from "pino";
import { COUPON_BOUNDS, COUPON_CLASSES } from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import { computeChannelReliability } from "./channel-reliability-query";
import { composeCouponClass } from "./compose-coupon-class";
import { getPoolForRange } from "./pool-query";
import { persistCouponProposal } from "./persist-coupon-proposal";
import { scoreCandidates } from "./score-candidates";

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

// The daily coupon-generation pipeline, one class at a time
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
    computeChannelReliability({ asOf: forDate }),
    getPoolForRange(date, to, {
      includeDraw: true,
      enforceAvoid: true,
      enableAvoidFade: true,
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

  for (const couponClass of COUPON_CLASSES) {
    const result = await composeCouponClass(
      scoredPool,
      couponClass,
      COUPON_BOUNDS,
      clients,
      logger,
    );

    if (result.outcome === "composed") {
      await persistCouponProposal(
        forDate,
        couponClass,
        result.coupon,
        result.reasonDetails,
      );
      logger.info(
        {
          date,
          couponClass: couponClass.name,
          legs: result.coupon.legs.length,
          combinedOdds: result.coupon.combinedOdds,
          couponEV: result.coupon.couponEV,
        },
        "coupon: published",
      );
    } else {
      logger.info(
        { date, couponClass: couponClass.name, outcome: result.outcome },
        "coupon: no proposal for this class",
      );
    }
  }

  logger.info({ date }, "coupon: generation complete");
}
