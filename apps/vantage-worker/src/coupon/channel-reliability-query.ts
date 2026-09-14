import { prematchCohortSql, prisma } from "@evcore/db";
import {
  BetStatus,
  BETTING_ENGINE_CONFIG_VERSION,
  fitReliability,
  shrinkTowardPooled,
  type ChannelReliability,
  type ChannelReliabilityMap,
  type ReliabilityObservation,
} from "@evcore/analysis-core";

// Mirrors apps/backend's CalibrationService.computeChannelReliability
// (apps/backend/src/modules/adjustment/calibration.service.ts) — same query,
// same pure Platt-curve fit (fitReliability/shrinkTowardPooled, already in
// analysis-core), reading `@evcore/db`'s `prisma` client directly instead of
// going through apps/backend's NestJS-injectable PrismaService. See
// docs/vantage-centric-redesign-2026-09-01.md §9bis.
//
// @param asOf point-in-time bound — only fixtures played strictly before
//   this instant feed the calibration. Defaults to "now" (live generation);
//   pass the start of the target day for a reproducible, leak-free rebuild.
export async function computeChannelReliability(
  options: { asOf?: Date } = {},
): Promise<{ byChannel: ChannelReliabilityMap; pooled: ChannelReliability }> {
  const cohort = await prisma.$queryRaw<{ id: string }[]>(
    prematchCohortSql({
      asOf: options.asOf ?? new Date(),
      configVersion: BETTING_ENGINE_CONFIG_VERSION,
    }),
  );
  const selections = await prisma.channelSelection.findMany({
    where: {
      id: { in: cohort.map((row) => row.id) },
      result: { in: [BetStatus.WON, BetStatus.LOST] },
    },
    select: {
      probability: true,
      result: true,
      channelDecision: { select: { channel: true } },
    },
  });

  const byChannelObservations = new Map<string, ReliabilityObservation[]>();
  const all: ReliabilityObservation[] = [];
  for (const sel of selections) {
    const observation: ReliabilityObservation = {
      probability: Number(sel.probability),
      won: sel.result === BetStatus.WON,
    };
    all.push(observation);
    const channel = sel.channelDecision.channel;
    const bucket = byChannelObservations.get(channel) ?? [];
    bucket.push(observation);
    byChannelObservations.set(channel, bucket);
  }

  const pooled = fitReliability(all);
  const byChannel: ChannelReliabilityMap = {};
  for (const [channel, observations] of byChannelObservations) {
    byChannel[channel] = shrinkTowardPooled(
      fitReliability(observations),
      pooled,
    );
  }

  return { byChannel, pooled };
}
