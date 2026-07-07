import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { StrategyChannel } from '@modules/betting-engine/channel-strategy.types';
import { INVESTMENT_CALIBRATION } from './investment.constants';

export type ChannelCalibration = Record<string, number>;

type CalibrationRow = {
  channel: string;
  mean_error: number;
  n: bigint;
};

/**
 * Per-channel calibration bias, measured directly from settled picks: verified
 * 2026-07-06 on 3 years of data that model overconfidence is channel-specific
 * (SAFE +12.5pp, VALUE +9.8pp, GOALS +6.9pp, DOMINANT +3.0pp, BTTS +1.0pp,
 * DRAW -1.8pp) — a flat correction or a per-market one (as used by the coupon
 * composer, which doesn't cover GOALS) would miss this. Kept as its own query
 * rather than reusing SignalWindowService: that one is scoped to the coupon
 * composer's 5-channel staking pool and excludes GOALS entirely.
 */
@Injectable()
export class InvestmentCalibrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param channels channels to compute a correction for
   * @param windowDays rolling window ending at `asOf`
   * @param asOf point-in-time cutoff (defaults to now) — pass the target
   *   date's start to keep a past-date review reproducible and leak-free.
   */
  async computeMeanError(
    channels: readonly StrategyChannel[],
    windowDays: number,
    asOf: Date = new Date(),
  ): Promise<ChannelCalibration> {
    const since = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.client.$queryRaw<CalibrationRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (mr."fixtureId", cd.channel)
          cd.channel, cs.probability, cs.result
        FROM channel_decision cd
        JOIN model_run mr ON mr.id = cd."modelRunId"
        JOIN fixture f ON f.id = mr."fixtureId"
        JOIN channel_selection cs
          ON cs."channelDecisionId" = cd.id AND cs.rank = 1
        WHERE cd.status = 'SELECTED'
          AND cd.channel = ANY(${channels}::"StrategyChannel"[])
          AND cs.odds IS NOT NULL
          AND f."scheduledAt" >= ${since}
          AND f."scheduledAt" < ${asOf}
        ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC
      )
      SELECT
        channel,
        AVG(probability - (CASE WHEN result = 'WON' THEN 1.0 ELSE 0.0 END))::float8 AS mean_error,
        COUNT(*) AS n
      FROM latest
      WHERE result IN ('WON', 'LOST')
      GROUP BY channel
    `;

    return Object.fromEntries(
      rows
        .filter((r) => Number(r.n) >= INVESTMENT_CALIBRATION.minSamples)
        .map((r) => [r.channel, r.mean_error]),
    );
  }
}
