import { Injectable } from '@nestjs/common';
import { BetStatus, ChannelDecisionStatus, Market } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import {
  CALIBRATION_TRIGGER_THRESHOLD,
  MIN_BET_COUNT,
} from './adjustment.constants';
import {
  fitReliability,
  shrinkTowardPooled,
  type ChannelReliability,
  type ChannelReliabilityMap,
  type ReliabilityObservation,
} from './channel-reliability';

const CALIBRATION_MARKETS = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.TEAM_TOTAL_HOME,
  Market.TEAM_TOTAL_AWAY,
  Market.OVER_UNDER_HT,
] as const;

export type CalibrationInput = {
  probEstimated: Decimal.Value;
  outcome: 0 | 1; // 1 = WON, 0 = LOST
};

export type CalibrationResult = {
  brierScore: Decimal;
  meanError: Decimal;
  betCount: number;
  needsAdjustment: boolean;
};

@Injectable()
export class CalibrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches settled channel selections for a given market and computes
   * calibration metrics. Returns null if not enough have been settled.
   *
   * Reads `channel_selection` (every channel), NOT `bet` (2026-08-21). The
   * `bet` table only ever holds VALUE and SAFE rows — `persistChannelBet`
   * (betting-engine.service.ts) materialises exactly those two channels from
   * their Phase-2 selection and nothing else — so calibrating on it measured
   * the two least-calibrated channels in the system and applied the result to
   * every market, for every channel. Measured on the same data the day of the
   * switch:
   *
   *   market           bet n  bet meanError   selection n  true meanError
   *   TEAM_TOTAL_HOME      0  (never calibrated)    18536         +0.0321
   *   TEAM_TOTAL_AWAY      0  (never calibrated)    19943         +0.0280
   *   OVER_UNDER_HT        2  (never calibrated)     5880         +0.0473
   *   OVER_UNDER         228          +0.1943       24670         +0.0581
   *   ONE_X_TWO          266          +0.0871       18306         +0.0420
   *   BTTS                67          -0.0407       19746         +0.0455
   *
   * Three markets never reached MIN_BET_COUNT at all (TEAM_TOTAL_* produces no
   * `bet` row by construction, so the `betCount >= MIN_BET_COUNT` gate in
   * `calibrateLegProbability` could never have ramped them up, contrary to
   * what its comment assumed); two were over-corrected 2-3x; BTTS was
   * corrected with the WRONG SIGN. Sample sizes go from 67-266 to 18k-25k.
   *
   * Still pooled per market across channels — splitting per (channel, market)
   * was tried 2026-08-20 and backtested worse, but on the `bet` population,
   * i.e. on a ~200-row sample it never had the volume to split. Worth
   * revisiting on this source, not on that evidence.
   *
   * @param excludeLambdaFloorHit - when true, selections from model runs where
   *   lambdaFloorHit=true are excluded. These fixtures have artificially floored
   *   lambdas that distort probability estimates and should not bias calibration.
   */
  async computeForMarket(
    market: string,
    options: { excludeLambdaFloorHit?: boolean; asOf?: Date } = {},
  ): Promise<CalibrationResult | null> {
    const selections = await this.prisma.client.channelSelection.findMany({
      where: {
        market: market as never,
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        // rank 1 only: a channel's own pick, mirroring what persistChannelBet
        // used to materialise (`selections[0]`). Lower ranks are alternates
        // the channel did NOT decide on — counting them would calibrate on
        // picks the system never stood behind.
        rank: 1,
        channelDecision: {
          status: ChannelDecisionStatus.SELECTED,
          // Point-in-time guard: only fixtures whose result was known before
          // the cutoff. Prevents look-ahead leakage when calibrating for a
          // past date. Reached through modelRun (the selection has no direct
          // fixture relation), unlike the `bet` version which had one.
          ...(options.asOf
            ? { modelRun: { fixture: { scheduledAt: { lt: options.asOf } } } }
            : {}),
          ...(options.excludeLambdaFloorHit
            ? {
                NOT: {
                  modelRun: {
                    features: { path: ['lambdaFloorHit'], equals: true },
                  },
                },
              }
            : {}),
        },
      },
      select: { probability: true, result: true },
    });

    if (selections.length < MIN_BET_COUNT) return null;

    const inputs: CalibrationInput[] = selections.map((s) => ({
      probEstimated: s.probability,
      outcome: s.result === BetStatus.WON ? 1 : 0,
    }));

    return this.compute(inputs);
  }

  /**
   * Computes calibration metrics for each tracked market type independently.
   * Markets with fewer than MIN_BET_COUNT settled selections return null.
   * lambdaFloorHit selections are excluded from all market computations to
   * avoid polluting calibration with artificially floored lambda fixtures.
   */
  async computeAllMarkets(
    options: { asOf?: Date } = {},
  ): Promise<
    Partial<
      Record<(typeof CALIBRATION_MARKETS)[number], CalibrationResult | null>
    >
  > {
    const results: Partial<
      Record<(typeof CALIBRATION_MARKETS)[number], CalibrationResult | null>
    > = {};

    for (const market of CALIBRATION_MARKETS) {
      results[market] = await this.computeForMarket(market, {
        excludeLambdaFloorHit: true,
        asOf: options.asOf,
      });
    }

    return results;
  }

  /**
   * Per-channel reliability curves (Platt scaling on the logit scale), fitted
   * on settled rank-1 SELECTED selections carrying real odds.
   *
   * Answers a question `computeForMarket` structurally cannot: how much does
   * THIS channel's announced probability need bending, given that the bias
   * differs enormously between channels (realised/announced ranged from 1.016
   * for DRAW down to 0.623 for RESULT_BTTS on 2026-08-22) and is a wrong
   * SLOPE, not a constant offset.
   *
   * Every channel's own fit is shrunk toward the pooled fit in proportion to
   * its sample size (see shrinkTowardPooled) — continuous, so a thin channel
   * degrades gracefully toward the pooled curve instead of falling off a
   * MIN_BET_COUNT cliff.
   *
   * `asOf` is the same point-in-time guard as computeForMarket: only fixtures
   * whose result was known before the cutoff, so a backtest never calibrates
   * on its own future.
   */
  async computeChannelReliability(
    options: { asOf?: Date } = {},
  ): Promise<{ byChannel: ChannelReliabilityMap; pooled: ChannelReliability }> {
    const selections = await this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        rank: 1,
        odds: { not: null },
        channelDecision: {
          status: ChannelDecisionStatus.SELECTED,
          ...(options.asOf
            ? { modelRun: { fixture: { scheduledAt: { lt: options.asOf } } } }
            : {}),
        },
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

  /**
   * Pure calibration computation — deterministic, testable without DB.
   */
  compute(inputs: CalibrationInput[]): CalibrationResult {
    if (inputs.length === 0) {
      return {
        brierScore: new Decimal(0),
        meanError: new Decimal(0),
        betCount: 0,
        needsAdjustment: false,
      };
    }

    let brierSum = new Decimal(0);
    let errorSum = new Decimal(0);

    for (const { probEstimated, outcome } of inputs) {
      const p = new Decimal(probEstimated);
      const o = new Decimal(outcome);
      // Brier contribution: (p - outcome)^2
      brierSum = brierSum.plus(p.minus(o).pow(2));
      // Signed error: p - outcome (positive = overconfident, negative = underconfident)
      errorSum = errorSum.plus(p.minus(o));
    }

    const n = new Decimal(inputs.length);
    const brierScore = brierSum.div(n);
    const meanError = errorSum.div(n);

    return {
      brierScore,
      meanError,
      betCount: inputs.length,
      needsAdjustment: brierScore.greaterThan(CALIBRATION_TRIGGER_THRESHOLD),
    };
  }
}
