import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { StrategyChannel } from '@modules/betting-engine/channel-strategy.types';

export type ChannelMarketCalibration = {
  meanError: number;
  n: number;
};

// channel -> market -> calibration
export type ChannelMarketCalibrationMap = Record<
  string,
  Record<string, ChannelMarketCalibration>
>;

type CalibrationRow = {
  channel: string;
  market: string;
  mean_error: number;
  n: bigint;
};

/**
 * Shared calibration primitive: per (channel, market) signed bias, measured
 * directly off settled `channel_decision`/`channel_selection` rank=1 rows —
 * the same universal source and rolling-window philosophy as
 * `InvestmentCalibrationRepository.computeMeanError` (validated 2026-07-06:
 * overconfidence is channel-specific, not a single flat number), generalized
 * with a market dimension.
 *
 * Built 2026-08-20 to replace two narrower, disconnected calibrations found
 * drifting independently during a full-session audit:
 * - `VALUE_MARKET_TRUST_MAP` (ev.constants.ts): a static multiplier fit once,
 *   never refreshed — VALUE's real bias more than doubled since (9.8pp ->
 *   18-26pp per market) without the static map catching up.
 * - `CalibrationService`/`MarketCalibration` (adjustment module, used by the
 *   coupon composer's `calibrateLegProbability`): scoped to the `bet` table,
 *   which structurally excludes any channel never materialized as a real
 *   `Bet` row (confirmed: DOMINANT has ZERO rows in `bet` despite being a
 *   real, staked-in-coupons channel with hundreds of settled
 *   channel_selection picks) — DOMINANT-sourced coupon legs could never be
 *   calibrated by that path, forever, regardless of volume. Also unbounded
 *   (all-time average, no rolling window) and capped at 6 markets.
 *
 * Reading from channel_decision/channel_selection directly (like Investment)
 * fixes both: every channel that ever produces a rank=1 SELECTED pick is
 * calibratable, and the window is rolling like Investment's.
 */
@Injectable()
export class ChannelMarketCalibrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param channels channels to compute a correction for
   * @param windowDays rolling window ending at `asOf`
   * @param opts.asOf point-in-time cutoff (defaults to now) — pass the target
   *   date's start to keep a past-date computation reproducible and leak-free.
   * @param opts.minSamples below this many settled picks for a (channel,
   *   market) pair, its measured bias is too noisy to trust — omitted from
   *   the map rather than overcorrecting on a thin sample.
   */
  async computeMeanError(
    channels: readonly StrategyChannel[],
    windowDays: number,
    opts: { asOf?: Date; minSamples?: number } = {},
  ): Promise<ChannelMarketCalibrationMap> {
    const { asOf = new Date(), minSamples = 30 } = opts;
    const since = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.client.$queryRaw<CalibrationRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (mr."fixtureId", cd.channel, cs.market)
          cd.channel, cs.market, cs.probability, cs.result
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
        ORDER BY mr."fixtureId", cd.channel, cs.market, mr."analyzedAt" DESC
      )
      SELECT
        channel,
        market,
        AVG(probability - (CASE WHEN result = 'WON' THEN 1.0 ELSE 0.0 END))::float8 AS mean_error,
        COUNT(*) AS n
      FROM latest
      WHERE result IN ('WON', 'LOST')
      GROUP BY channel, market
    `;

    const map: ChannelMarketCalibrationMap = {};
    for (const row of rows) {
      const n = Number(row.n);
      if (n < minSamples) continue;
      map[row.channel] ??= {};
      map[row.channel][row.market] = { meanError: row.mean_error, n };
    }
    return map;
  }
}
