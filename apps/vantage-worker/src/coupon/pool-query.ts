import { prisma } from "@evcore/db";
import {
  BetStatus,
  CHANNEL_DECISION_STATUS,
  DRAW_STAKED_LEAGUES,
  Market,
  POOL_ELIGIBLE_CHANNELS,
  calculateEV,
  classifyAvoidSignal,
  computeDataCoverage,
  computeMarketFair,
  extractEvaContextFromFeatures,
  extractModelRunFeatureDiagnostics,
  getPickOddsFromSnapshot,
  hasCalibrationAlert,
  isExtremeDivergence,
  oppositePick,
  readShadowConflict,
  resolveEvaluatedMarketLeg,
  STRATEGY_CHANNEL,
  type FullOddsSnapshot,
  type StrategyChannel,
} from "@evcore/analysis-core";
import { findBestPricesBatch, findLatestOddsSnapshotsBatch } from "./odds-batch";

// Mirrors apps/backend's CouponPoolService.getPoolForRange
// (apps/backend/src/modules/coupon/coupon-pool.service.ts) — same query,
// same assembly logic, reading `@evcore/db`'s `prisma` client directly
// instead of going through apps/backend's NestJS layer. This is the pool the
// LLM coupon generator (docs/vantage-centric-redesign-2026-09-01.md §9)
// selects from — it replaces `CouponComposerService.compose()` entirely
// (not a shadow/fallback), so unlike the backend original this pool is not
// consumed by a `scorePicks()`/glouton step: probability calibration folds
// into the LLM-facing prompt step (§9 point 1-2), not here.

export type GetPoolOpts = {
  /** Restrict DRAW legs to DRAW_STAKED_LEAGUES — see that constant. */
  includeDraw?: boolean;
  enforceAvoid?: boolean;
  /** Stake the FADE regime's opposite pick instead of dropping it. */
  enableAvoidFade?: boolean;
  /**
   * Widen the pool with `ModelRun.features.evaluatedPicks` ('viable' entries
   * not already staked as a rank-1 channel_selection) — see
   * `EVALUATED_MARKET_CANAL` doc (analysis-core's evaluated-market-leg.ts).
   */
  includeEvaluatedMarkets?: boolean;
};

export type PoolCandidate = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string;
  scheduledAt: Date;
  /** Fixture's own scheduled day (`YYYY-MM-DD`, UTC). */
  dayBucket: string;
  canal: StrategyChannel;
  market: string;
  pick: string;
  probability: number;
  /** Market-implied EV against `oddsSnapshot`, on the raw (uncalibrated)
   * probability — a later scoring step recomputes this on the calibrated
   * probability before it reaches the LLM prompt. */
  legEV: number | null;
  oddsSnapshot: number | null;
  /** Reference odds (best-ranked single bookmaker) — measures model↔market
   * divergence (clearsMaxLegEdge); never the stake price. */
  referenceOdds: number | null;
  /** Fair (overround-removed) probability of the selected outcome. */
  pMarketFair: number | null;
  bookmakerMargin: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  xg: number | null;
  finalScore: number | null;
  dataCoverage: number | null;
  shadowConflict: boolean | null;
  offensiveBalance: "BALANCED" | "ASYMMETRIC" | "STRONGLY_ASYMMETRIC" | null;
  /** Number of the fixture's earlier ModelRun passes (of the 5 preceding
   * the current one) where this exact (market, pick) was already selected —
   * stability signal. */
  priorAnalysisCount: number;
  isCorrect: boolean | null;
  pickSource: "STAKED" | "EVALUATED";
  featureSnapshot: Record<string, unknown>;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
  channelSelectionId: string | null;
  modelRunId: string | null;
};

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== "object") return null;
  const v = (features as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type PriorRun = {
  channelDecisions: Array<{
    selections: Array<{ market: Market; pick: string }>;
  }>;
};

// Number of the fixture's earlier ModelRun passes where this exact
// (market, pick) was already the retained selection — stability signal.
function countPriorAnalyses(
  priorRuns: PriorRun[],
  market: Market,
  pick: string,
): number {
  return priorRuns.filter((run) =>
    run.channelDecisions.some((cd) =>
      cd.selections.some((s) => s.market === market && s.pick === pick),
    ),
  ).length;
}

/**
 * The candidate pool over a `[fromDate, toDate]` window (inclusive, both in
 * `date` form; pass the same date twice for a single day). Every
 * {@link PoolCandidate} carries a `dayBucket` (the fixture's own scheduled
 * day) so a downstream anti-correlation check can apply a per-day cap on top
 * of the per-fixture/per-canal-market/per-competition ones (guardrails.ts).
 *
 * Reads every {@link POOL_ELIGIBLE_CHANNELS} channel's own rank-1
 * `channel_selection`, plus (`opts.includeEvaluatedMarkets`) the wider raw
 * `evaluatedPicks` population per fixture.
 */
export async function getPoolForRange(
  fromDate: string,
  toDate: string,
  opts: GetPoolOpts = {},
): Promise<PoolCandidate[]> {
  const dayStart = new Date(`${fromDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${toDate}T23:59:59.999Z`);

  const fixtures = await prisma.fixture.findMany({
    where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
    select: {
      id: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeHtScore: true,
      awayHtScore: true,
      homeTeam: { select: { name: true, logoUrl: true } },
      awayTeam: { select: { name: true, logoUrl: true } },
      season: {
        select: {
          competition: { select: { code: true, name: true, country: true } },
        },
      },
      modelRuns: {
        select: {
          id: true,
          finalScore: true,
          features: true,
          analyzedAt: true,
          channelDecisions: {
            where: {
              channel: { in: [...POOL_ELIGIBLE_CHANNELS] },
              status: CHANNEL_DECISION_STATUS.SELECTED,
            },
            select: {
              channel: true,
              selections: {
                where: { rank: 1, odds: { not: null } },
                select: {
                  id: true,
                  market: true,
                  pick: true,
                  probability: true,
                  odds: true,
                  result: true,
                },
                take: 1,
              },
            },
            take: POOL_ELIGIBLE_CHANNELS.length,
          },
        },
        orderBy: { analyzedAt: "desc" },
        // modelRuns[0] is the current run, modelRuns[1..] feed
        // priorAnalysisCount below.
        take: 6,
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const oddsTargets = fixtures
    .filter((f) => f.modelRuns[0])
    .map((f) => ({ fixtureId: f.id, cutoff: f.scheduledAt }));
  const [oddsSnapshots, bestPrices] = await Promise.all([
    findLatestOddsSnapshotsBatch(oddsTargets),
    findBestPricesBatch(oddsTargets),
  ]);

  const picks: PoolCandidate[] = [];

  for (const f of fixtures) {
    const run = f.modelRuns[0];
    const priorRuns = f.modelRuns.slice(1);
    const comp = f.season.competition.code;
    const competitionName = f.season.competition.name;
    const country = f.season.competition.country;
    const feat = run?.features;
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const xg =
      lambdaHome !== null && lambdaAway !== null
        ? lambdaHome + lambdaAway
        : null;
    const finalScore = run?.finalScore ? Number(run.finalScore) : null;

    const dataCoverage = feat !== undefined ? computeDataCoverage(feat) : null;
    const shadowConflict =
      feat !== undefined ? readShadowConflict(feat) : null;
    const offensiveBalance =
      feat !== undefined
        ? (extractEvaContextFromFeatures(feat).offensiveBalance
            ?.classification ?? null)
        : null;

    const base = {
      fixtureId: f.id,
      homeTeam: f.homeTeam.name,
      awayTeam: f.awayTeam.name,
      homeLogo: f.homeTeam.logoUrl ?? null,
      awayLogo: f.awayTeam.logoUrl ?? null,
      competition: competitionName,
      country,
      scheduledAt: f.scheduledAt,
      dayBucket: f.scheduledAt.toISOString().slice(0, 10),
      homeScore: f.homeScore ?? null,
      awayScore: f.awayScore ?? null,
      homeHtScore: f.homeHtScore ?? null,
      awayHtScore: f.awayHtScore ?? null,
      lambdaHome,
      lambdaAway,
      xg,
      finalScore,
      dataCoverage,
      shadowConflict,
      offensiveBalance,
      featureSnapshot: {
        lambdaHome,
        lambdaAway,
        xg,
        finalScore,
        competitionCode: comp,
        dataCoverage,
        shadowConflict,
        offensiveBalance,
      } as Record<string, unknown>,
    };

    const calibAlert = hasCalibrationAlert(feat);

    if (run) {
      const snapshot: FullOddsSnapshot | null = oddsSnapshots.get(f.id) ?? null;
      const stakedKeys = new Set<string>();

      for (const decision of run.channelDecisions) {
        const sel = decision.selections[0];
        if (!sel || sel.odds === null) continue;

        if (
          decision.channel === STRATEGY_CHANNEL.DRAW &&
          (!opts.includeDraw ||
            !(DRAW_STAKED_LEAGUES as readonly string[]).includes(comp))
        ) {
          continue;
        }
        const selOdds = Number(sel.odds);
        const regime = opts.enforceAvoid
          ? classifyAvoidSignal(
              isExtremeDivergence(Number(sel.probability), selOdds),
              calibAlert,
            )
          : "CLEAN";
        if (regime === "DROP") continue;

        const market = sel.market;
        let pick = sel.pick;
        let probability = Number(sel.probability);
        let legOdds = selOdds;
        let isCorrect =
          sel.result === BetStatus.WON
            ? true
            : sel.result === BetStatus.LOST
              ? false
              : null;

        if (regime === "FADE") {
          const opp = oppositePick(sel.pick);
          const oppOdds =
            opp && snapshot
              ? getPickOddsFromSnapshot(sel.market, opp, snapshot)
              : null;
          if (!opts.enableAvoidFade || opp === null || oppOdds === null) {
            continue; // shadow-only for now — same net effect as DROP
          }
          pick = opp;
          probability = 1 - probability;
          legOdds = oppOdds.toNumber();
          isCorrect =
            sel.result === BetStatus.LOST
              ? true
              : sel.result === BetStatus.WON
                ? false
                : null;
        }

        const fair = snapshot ? computeMarketFair(market, pick, snapshot) : null;
        const bestOdds = bestPrices.get(`${f.id}:${market}:${pick}`);
        const stakeOdds =
          bestOdds !== undefined && bestOdds > legOdds ? bestOdds : legOdds;

        picks.push({
          ...base,
          canal: decision.channel,
          market,
          pick,
          probability,
          legEV: calculateEV(probability, stakeOdds).toNumber(),
          oddsSnapshot: stakeOdds,
          referenceOdds: legOdds,
          pMarketFair: fair?.pMarketFair ?? null,
          bookmakerMargin: fair?.bookmakerMargin ?? null,
          priorAnalysisCount:
            regime === "FADE"
              ? 0
              : countPriorAnalyses(priorRuns, sel.market, sel.pick),
          isCorrect,
          channelSelectionId: sel.id,
          modelRunId: run.id,
          pickSource: "STAKED",
        });
        stakedKeys.add(`${market}:${pick}`);
      }

      if (opts.includeEvaluatedMarkets) {
        const evaluatedPicks = extractModelRunFeatureDiagnostics(
          run.features,
        ).evaluatedPicks;
        for (const evaluated of evaluatedPicks) {
          const resolved = resolveEvaluatedMarketLeg(evaluated, {
            stakedKeys,
            enforceAvoid: opts.enforceAvoid ?? false,
            calibrationAlert: calibAlert,
          });
          if (!resolved) continue;
          const { canal, probability, oddsSnapshot: legOdds } = resolved;
          const fair = snapshot
            ? computeMarketFair(
                evaluated.market as Market,
                evaluated.pick,
                snapshot,
              )
            : null;
          picks.push({
            ...base,
            canal,
            market: evaluated.market,
            pick: evaluated.pick,
            probability,
            legEV: calculateEV(probability, legOdds).toNumber(),
            oddsSnapshot: legOdds,
            referenceOdds: legOdds,
            pMarketFair: fair?.pMarketFair ?? null,
            bookmakerMargin: fair?.bookmakerMargin ?? null,
            priorAnalysisCount: countPriorAnalyses(
              priorRuns,
              evaluated.market as Market,
              evaluated.pick,
            ),
            isCorrect: null,
            channelSelectionId: null,
            modelRunId: run.id,
            pickSource: "EVALUATED",
          });
        }
      }
    }
  }

  return picks;
}
