import { Injectable } from '@nestjs/common';
import { BetStatus, Market } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import {
  CALIBRATION_TRIGGER_THRESHOLD,
  MIN_BET_COUNT,
} from './adjustment.constants';

const CALIBRATION_MARKETS = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
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

export type BetsForCalibration = {
  probEstimated: Decimal;
  status: BetStatus;
};

@Injectable()
export class CalibrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches settled bets for a given market and computes calibration metrics.
   * Returns null if not enough bets have been settled.
   *
   * @param excludeLambdaFloorHit - when true, bets from model runs where
   *   lambdaFloorHit=true are excluded. These fixtures have artificially floored
   *   lambdas that distort probability estimates and should not bias calibration.
   */
  async computeForMarket(
    market: string,
    options: { excludeLambdaFloorHit?: boolean } = {},
  ): Promise<CalibrationResult | null> {
    const bets = await this.prisma.client.bet.findMany({
      where: {
        market: market as never,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
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
      select: { probEstimated: true, status: true },
    });

    if (bets.length < MIN_BET_COUNT) return null;

    const inputs: CalibrationInput[] = bets.map((b) => ({
      probEstimated: b.probEstimated,
      outcome: b.status === BetStatus.WON ? 1 : 0,
    }));

    return this.compute(inputs);
  }

  /**
   * Computes calibration metrics for each tracked market type independently.
   * Markets with fewer than MIN_BET_COUNT settled bets return null.
   * lambdaFloorHit bets are excluded from all market computations to avoid
   * polluting calibration with artificially floored lambda fixtures.
   */
  async computeAllMarkets(): Promise<
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
      });
    }

    return results;
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
