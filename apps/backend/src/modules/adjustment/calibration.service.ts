import { Injectable } from '@nestjs/common';
import { BetStatus } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import {
  CALIBRATION_TRIGGER_THRESHOLD,
  MIN_BET_COUNT,
} from './adjustment.constants';

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
   */
  async computeForMarket(market: string): Promise<CalibrationResult | null> {
    const bets = await this.prisma.client.bet.findMany({
      where: {
        market: market as never,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
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
