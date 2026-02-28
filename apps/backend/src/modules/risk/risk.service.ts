import { Injectable } from '@nestjs/common';
import { Market } from '@evcore/db';
import Decimal from 'decimal.js';
import pino from 'pino';
import { PrismaService } from '@/prisma.service';
import {
  NotificationService,
  type WeeklyReportPayload,
} from '@modules/notification/notification.service';
import { RISK_CONSTANTS } from './risk.constants';

const logger = pino({ name: 'risk-service' });

export type RoiCheckResult = {
  market: Market;
  betCount: number;
  roi: Decimal;
  action: 'suspended' | 'alerted' | 'ok' | 'insufficient_data';
};

export type WeeklyReportResult = WeeklyReportPayload;

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  async isMarketSuspended(market: Market): Promise<boolean> {
    const suspension = await this.prisma.client.marketSuspension.findFirst({
      where: { market, active: true },
    });
    return suspension !== null;
  }

  async checkMarketRoi(market: Market): Promise<RoiCheckResult> {
    const bets = await this.prisma.client.bet.findMany({
      where: { market, status: { not: 'VOID' } },
      select: { status: true, oddsSnapshot: true },
      orderBy: { createdAt: 'desc' },
      take: RISK_CONSTANTS.ROI_SUSPENSION_BET_COUNT,
    });

    if (bets.length < RISK_CONSTANTS.ROI_ALERT_BET_COUNT) {
      return {
        market,
        betCount: bets.length,
        roi: new Decimal(0),
        action: 'insufficient_data',
      };
    }

    // ROI on up to last ROI_SUSPENSION_BET_COUNT bets
    const roi = computeRoi(bets);

    // Auto-suspension: 50+ bets AND ROI < -15%
    if (
      bets.length >= RISK_CONSTANTS.ROI_SUSPENSION_BET_COUNT &&
      roi.lessThan(RISK_CONSTANTS.ROI_SUSPENSION_THRESHOLD)
    ) {
      const alreadySuspended = await this.isMarketSuspended(market);
      if (!alreadySuspended) {
        await this.prisma.client.marketSuspension.create({
          data: {
            market,
            reason: `ROI ${(roi.toNumber() * 100).toFixed(1)}% over ${bets.length} bets — auto-suspended`,
            triggeredBy: 'auto',
          },
        });
        await this.notification.sendMarketSuspensionAlert(
          market,
          roi.toNumber(),
          bets.length,
        );
        logger.warn(
          { market, roi: roi.toNumber(), betCount: bets.length },
          'Market auto-suspended',
        );
      }
      return { market, betCount: bets.length, roi, action: 'suspended' };
    }

    // ROI alert: 30+ bets AND ROI < -10% (recomputed on last 30 bets)
    const alertBets = bets.slice(0, RISK_CONSTANTS.ROI_ALERT_BET_COUNT);
    const alertRoi = computeRoi(alertBets);
    if (alertRoi.lessThan(RISK_CONSTANTS.ROI_ALERT_THRESHOLD)) {
      await this.notification.sendRoiAlert(
        market,
        alertRoi.toNumber(),
        alertBets.length,
      );
      logger.warn(
        { market, roi: alertRoi.toNumber(), betCount: alertBets.length },
        'ROI alert sent',
      );
      return {
        market,
        betCount: alertBets.length,
        roi: alertRoi,
        action: 'alerted',
      };
    }

    return { market, betCount: bets.length, roi, action: 'ok' };
  }

  async checkBrierScore(seasonId: string, brierScore: Decimal): Promise<void> {
    if (brierScore.greaterThan(RISK_CONSTANTS.BRIER_SCORE_ALERT_THRESHOLD)) {
      await this.notification.sendBrierScoreAlert(
        seasonId,
        brierScore.toNumber(),
      );
      logger.warn(
        { seasonId, brierScore: brierScore.toNumber() },
        'Brier score alert sent',
      );
    }
  }

  async generateWeeklyReport(): Promise<WeeklyReportResult> {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const bets = await this.prisma.client.bet.findMany({
      where: {
        market: Market.ONE_X_TWO,
        status: { not: 'VOID' },
        createdAt: { gte: periodStart },
      },
      select: { status: true, oddsSnapshot: true },
    });

    const roiOneXTwo = bets.length > 0 ? computeRoi(bets).toNumber() : 0;

    const result: WeeklyReportResult = {
      periodStart,
      periodEnd,
      roiOneXTwo,
      betsPlaced: bets.length,
      brierScore: 0,
    };

    await this.notification.sendWeeklyReport(result);
    logger.info({ roiOneXTwo, betsPlaced: bets.length }, 'Weekly report sent');

    return result;
  }
}

type BetRow = {
  status: string;
  oddsSnapshot: { toString(): string } | null;
};

function computeRoi(bets: BetRow[]): Decimal {
  if (bets.length === 0) return new Decimal(0);
  let profit = new Decimal(0);
  for (const bet of bets) {
    if (bet.status === 'WON' && bet.oddsSnapshot !== null) {
      profit = profit.plus(new Decimal(bet.oddsSnapshot.toString()).minus(1));
    } else if (bet.status === 'LOST') {
      profit = profit.minus(1);
    }
  }
  return profit.div(bets.length);
}
