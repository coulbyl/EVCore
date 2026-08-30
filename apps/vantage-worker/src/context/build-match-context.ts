import { prisma } from "@evcore/db";
import { Market } from "@evcore/analysis-core";
import type { StrategyChannel } from "@evcore/analysis-core";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import type { ChannelCalibration, ChannelReading, MatchContext } from "./types";
import { extractNearMiss } from "./near-miss";
import { loadTeamSignal, loadCoachSignal } from "./team-signals";
import { loadH2HSignal } from "./h2h-signal";
import { extractShadowPrediction, extractShadowMl } from "./shadow-signals";
import { loadUncoveredMarketOdds } from "./market-odds";

// Minimum settled sample before a channel's calibration is reported to
// VANTAGE as a number rather than "not yet measurable" — mirrors the 30-bet
// floor used for `channels_n30` reporting elsewhere (see track-record page).
// Below this, ROI/hit-rate swing too much on noise to cite as a reason.
const MIN_CALIBRATION_SAMPLE = 30;

/** Assembles everything VANTAGE is allowed to see for one fixture: what every
 * other channel picked (or rejected) on THIS match, how reliable each of
 * those channels has actually been on THIS competition historically, and —
 * since 2026-08-30 (docs/context-expansion-proposal.md) — additive raw
 * context no channel's own probability already carries: near-miss reads
 * from channels that abstained, both teams' raw team_stats/coach signals,
 * the H2H scoreline signal, two independent second opinions (shadow_
 * predictions, shadow_ml_by_channel), and the raw market price for
 * ONE_X_TWO when no channel selected it. Never includes VANTAGE's own past
 * decisions — it reads the deterministic layer, it does not read itself. */
export async function buildMatchContext(
  fixtureId: string,
): Promise<MatchContext | null> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { include: { competition: true } },
      modelRuns: {
        orderBy: { analyzedAt: "desc" },
        take: 1,
        include: {
          channelDecisions: {
            where: { channel: { not: STRATEGY_CHANNEL.VANTAGE } },
            include: { selections: { orderBy: { rank: "asc" }, take: 1 } },
          },
        },
      },
    },
  });

  const latestRun = fixture?.modelRuns[0];
  if (!fixture || !latestRun) return null;

  const readings: ChannelReading[] = latestRun.channelDecisions.map((cd) => {
    const top = cd.selections[0];
    const status = cd.status === "SELECTED" ? "SELECTED" : "REJECTED";
    return {
      channel: cd.channel,
      status,
      reasonCode: cd.reasonCode,
      market: top?.market ?? null,
      pick: top?.pick ?? null,
      probability: top ? Number(top.probability) : null,
      odds: top?.odds ? Number(top.odds) : null,
      ev: top?.ev ? Number(top.ev) : null,
      nearMiss:
        status === "REJECTED"
          ? extractNearMiss(cd.channel, cd.reasonDetails)
          : null,
    };
  });

  const competitionCode = fixture.season.competition.code;
  const kickoff = fixture.scheduledAt;

  // analyzeFixture discards the whole context one line later when readings
  // is empty (nothing to compare across channels) — short-circuit here too
  // rather than still running 6 additive queries (team stats × 2, coach × 2,
  // H2H, market odds) plus the calibration scan for a context that's about
  // to be thrown away (2026-08-30 code-review finding).
  if (readings.length === 0) {
    return {
      fixtureId: fixture.id,
      modelRunId: latestRun.id,
      homeTeam: fixture.homeTeam.name,
      awayTeam: fixture.awayTeam.name,
      competitionCode,
      competitionName: fixture.season.competition.name,
      kickoff: fixture.scheduledAt.toISOString(),
      readings,
      calibration: [],
    };
  }

  const coveredMarkets = new Set<Market>(
    readings
      .filter((r) => r.status === "SELECTED" && r.market !== null)
      .map((r) => r.market as Market),
  );

  // Every one of these is additive context (MatchContext documents them all
  // as optional/nullable, precisely so a missing one degrades gracefully —
  // see types.ts). `calibration` is the one exception (a hard-required
  // field, unchanged from before this expansion) and is allowed to
  // propagate a failure; every signal added 2026-08-30 is caught locally so
  // one flaky query (a transient DB error on, say, the H2H leg fetch)
  // doesn't fail the whole context build and lose readings/calibration too —
  // a 2026-08-30 code-review finding: this Promise.all previously had no
  // per-query fallback at all.
  const [
    calibration,
    homeTeamStats,
    awayTeamStats,
    homeCoach,
    awayCoach,
    h2h,
    uncoveredMarketOdds,
  ] = await Promise.all([
    loadChannelCalibration(
      competitionCode,
      readings.map((r) => r.channel),
    ),
    loadTeamSignal(fixture.homeTeamId, fixture.seasonId, kickoff).catch(
      () => null,
    ),
    loadTeamSignal(fixture.awayTeamId, fixture.seasonId, kickoff).catch(
      () => null,
    ),
    loadCoachSignal(fixture.homeTeamId, kickoff).catch(() => null),
    loadCoachSignal(fixture.awayTeamId, kickoff).catch(() => null),
    loadH2HSignal(fixture.homeTeamId, fixture.awayTeamId, kickoff).catch(
      () => null,
    ),
    loadUncoveredMarketOdds(fixture.id, coveredMarkets).catch(() => []),
  ]);

  return {
    fixtureId: fixture.id,
    modelRunId: latestRun.id,
    homeTeam: fixture.homeTeam.name,
    awayTeam: fixture.awayTeam.name,
    competitionCode,
    competitionName: fixture.season.competition.name,
    kickoff: fixture.scheduledAt.toISOString(),
    readings,
    calibration,
    homeTeamStats,
    awayTeamStats,
    homeCoach,
    awayCoach,
    h2h,
    shadowPrediction: extractShadowPrediction(latestRun.features),
    shadowMl: extractShadowMl(latestRun.features),
    uncoveredMarketOdds,
  };
}

/** Ratio réel/annoncé per channel, scoped to one competition — same
 * calibration-first admission logic as the rest of the system (see
 * feedback_admission_par_calibration), computed directly against settled
 * `channel_selection` rows rather than re-deriving it from a cached table. */
async function loadChannelCalibration(
  competitionCode: string,
  channels: StrategyChannel[],
): Promise<ChannelCalibration[]> {
  if (channels.length === 0) return [];

  const rows = await prisma.channelSelection.findMany({
    where: {
      result: { in: ["WON", "LOST"] },
      channelDecision: {
        channel: { in: channels },
        modelRun: {
          fixture: { season: { competition: { code: competitionCode } } },
        },
      },
    },
    select: {
      result: true,
      probability: true,
      channelDecision: { select: { channel: true } },
    },
  });

  const byChannel = new Map<
    StrategyChannel,
    { won: number; total: number; announcedProbabilitySum: number }
  >();
  for (const row of rows) {
    const channel = row.channelDecision.channel;
    const bucket = byChannel.get(channel) ?? {
      won: 0,
      total: 0,
      announcedProbabilitySum: 0,
    };
    bucket.total += 1;
    bucket.announcedProbabilitySum += Number(row.probability);
    if (row.result === "WON") bucket.won += 1;
    byChannel.set(channel, bucket);
  }

  return channels.map((channel) => {
    const bucket = byChannel.get(channel);
    if (!bucket || bucket.total < MIN_CALIBRATION_SAMPLE) {
      return {
        channel,
        sampleSize: bucket?.total ?? 0,
        hitRate: null,
        calibrationRatio: null,
      };
    }
    const hitRate = bucket.won / bucket.total;
    const avgAnnouncedProbability =
      bucket.announcedProbabilitySum / bucket.total;
    return {
      channel,
      sampleSize: bucket.total,
      hitRate,
      // avgAnnouncedProbability is always > 0 here — probability is a
      // required, non-nullable Decimal(5,4) column on ChannelSelection.
      calibrationRatio: hitRate / avgAnnouncedProbability,
    };
  });
}
