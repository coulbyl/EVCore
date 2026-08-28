import { prisma } from "@evcore/db";
import type { StrategyChannel } from "@evcore/analysis-core";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import type { ChannelCalibration, ChannelReading, MatchContext } from "./types";

// Minimum settled sample before a channel's calibration is reported to
// VANTAGE as a number rather than "not yet measurable" — mirrors the 30-bet
// floor used for `channels_n30` reporting elsewhere (see track-record page).
// Below this, ROI/hit-rate swing too much on noise to cite as a reason.
const MIN_CALIBRATION_SAMPLE = 30;

/** Assembles everything VANTAGE is allowed to see for one fixture: what every
 * other channel picked (or rejected) on THIS match, and how reliable each of
 * those channels has actually been on THIS competition historically. Never
 * includes VANTAGE's own past decisions — it reads the deterministic layer,
 * it does not read itself. */
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
    return {
      channel: cd.channel,
      status: cd.status === "SELECTED" ? "SELECTED" : "REJECTED",
      reasonCode: cd.reasonCode,
      market: top?.market ?? null,
      pick: top?.pick ?? null,
      probability: top ? Number(top.probability) : null,
      odds: top?.odds ? Number(top.odds) : null,
      ev: top?.ev ? Number(top.ev) : null,
    };
  });

  const competitionCode = fixture.season.competition.code;
  const calibration = await loadChannelCalibration(
    competitionCode,
    readings.map((r) => r.channel),
  );

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
    const avgAnnouncedProbability = bucket.announcedProbabilitySum / bucket.total;
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
