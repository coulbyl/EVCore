import { Injectable } from '@nestjs/common';
import { Market, NotificationType } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { PrismaService } from '@/prisma.service';
import {
  NotificationService,
  type WeeklyReportPayload,
} from '@modules/notification/notification.service';
import { RISK_CONSTANTS } from './risk.constants';
import { RiskRepository, type SettledLegRow } from './risk.repository';

const logger = createLogger('risk-service');

export type CalibrationBin = {
  minProb: number;
  maxProb: number;
  avgProb: number;
  actualRate: number;
  count: number;
};

export type RoiCheckResult = {
  market: Market;
  betCount: number;
  roi: Decimal;
  /** Standard error of the ROI per leg; zero when the sample is empty. */
  standardError: Decimal;
  action: 'suspended' | 'alerted' | 'ok' | 'insufficient_data';
};

export type WeeklyReportResult = WeeklyReportPayload;

export type ActiveMarketSuspension = {
  market: Market;
  reason: string;
  triggeredBy: string;
  createdAt: string;
};

export type RiskAlert = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const RISK_ALERT_TYPES = [
  NotificationType.MARKET_SUSPENSION,
  NotificationType.ROI_ALERT,
  NotificationType.BRIER_ALERT,
] as const;

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly repository: RiskRepository,
  ) {}

  async isMarketSuspended(market: Market): Promise<boolean> {
    const suspension = await this.prisma.client.marketSuspension.findFirst({
      where: { market, active: true },
    });
    return suspension !== null;
  }

  // Every currently-active suspension, detail (not just isMarketSuspended's
  // per-market boolean) — the admin health view needs to list which markets
  // are suspended and why, not just count them (audit.service.ts's
  // getOverview already exposes a bare count).
  async listActiveSuspensions(): Promise<ActiveMarketSuspension[]> {
    const rows = await this.prisma.client.marketSuspension.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      market: row.market,
      reason: row.reason,
      triggeredBy: row.triggeredBy,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // MARKET_SUSPENSION/ROI_ALERT/BRIER_ALERT notifications from the last
  // `days` days — narrower than dashboard.service.ts's buildActiveAlerts
  // (which also includes ETL_FAILURE, dedups to one per type per day, and
  // caps at 3): the admin health view wants the full, undeduped risk
  // picture, not a "top 3 alerts of any kind" digest.
  async getRecentAlerts(days: number): Promise<RiskAlert[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.client.notification.findMany({
      where: {
        type: { in: [...RISK_ALERT_TYPES] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      read: row.read,
    }));
  }

  /**
   * Garde-fou de ROI par marché (CLAUDE.md : suspension automatique à
   * ROI < −15 % sur 50+ paris).
   *
   * Lit l'échantillon réel du moteur — ses jambes réglées, dédoublonnées,
   * sur une fenêtre glissante — et non plus la table `bet` (derniers paris
   * du moteur le 2026-09-04 : le balayage évaluait un échantillon mort).
   * La suspension exige en plus que la perte soit établie (borne haute à
   * 95 % du ROI sous zéro) : sur 50 jambes l'erreur-type vaut 10 points,
   * une mauvaise semaine ne suspend rien. Ce que la mesure du 2026-10-18
   * suspend sont les marchés dont le coût persiste (docs/audits/2026-10-18/
   * SUSPENSION-MARCHES.md), pas une ligue ni un canal.
   */
  async checkMarketRoi(market: Market): Promise<RoiCheckResult> {
    const since = daysAgo(RISK_CONSTANTS.ROI_WINDOW_DAYS);
    const legs = await this.repository.findSettledLegs(market, since);
    const roi = computeRoi(legs);
    const standardError = computeStandardError(legs, roi);
    const base = { market, betCount: legs.length, roi, standardError };

    if (legs.length < RISK_CONSTANTS.ROI_ALERT_BET_COUNT) {
      return { ...base, action: 'insufficient_data' };
    }

    const upperBound = roi.plus(
      standardError.times(RISK_CONSTANTS.ROI_SUSPENSION_Z),
    );
    if (
      legs.length >= RISK_CONSTANTS.ROI_SUSPENSION_BET_COUNT &&
      roi.lessThan(RISK_CONSTANTS.ROI_SUSPENSION_THRESHOLD) &&
      upperBound.lessThan(0)
    ) {
      const alreadySuspended = await this.isMarketSuspended(market);
      if (!alreadySuspended) {
        await this.prisma.client.marketSuspension.create({
          data: {
            market,
            reason: `ROI ${(roi.toNumber() * 100).toFixed(1)} % ± ${(standardError.toNumber() * 100).toFixed(1)} sur ${legs.length} jambes réglées en ${RISK_CONSTANTS.ROI_WINDOW_DAYS} jours — suspension automatique`,
            triggeredBy: 'auto',
          },
        });
        await this.notification.sendMarketSuspensionAlert(
          market,
          roi.toNumber(),
          legs.length,
        );
        logger.warn(
          {
            market,
            roi: roi.toNumber(),
            standardError: standardError.toNumber(),
            betCount: legs.length,
          },
          'Market auto-suspended',
        );
      }
      return { ...base, action: 'suspended' };
    }

    if (roi.lessThan(RISK_CONSTANTS.ROI_ALERT_THRESHOLD)) {
      const alreadyAlerted = await this.repository.hasRoiAlertSince(
        market,
        daysAgo(RISK_CONSTANTS.ROI_ALERT_COOLDOWN_DAYS),
      );
      if (!alreadyAlerted) {
        await this.notification.sendRoiAlert(
          market,
          roi.toNumber(),
          legs.length,
        );
        logger.warn(
          { market, roi: roi.toNumber(), betCount: legs.length },
          'ROI alert sent',
        );
      }
      return { ...base, action: 'alerted' };
    }

    return { ...base, action: 'ok' };
  }

  /**
   * Balaye tous les marchés et applique le garde-fou de ROI.
   *
   * Le garde-fou existait depuis l'origine mais n'était atteignable que par
   * un appel HTTP manuel : rien ne l'invoquait, donc aucun marché n'a jamais
   * été suspendu automatiquement malgré la règle documentée
   * (ROI < −15 % sur 50+ paris). Câblé le 2026-09-15, tâche `J-1` du plan de
   * rentabilité.
   *
   * `checkMarketRoi` vérifie lui-même qu'un marché n'est pas déjà suspendu
   * avant d'en créer une nouvelle : ce balayage est donc idempotent côté
   * suspensions. Les alertes de ROI, en revanche, sont réémises à chaque
   * passage — d'où une cadence quotidienne et non toutes les demi-heures.
   */
  async checkAllMarkets(): Promise<RoiCheckResult[]> {
    const results: RoiCheckResult[] = [];
    for (const market of Object.values(Market)) {
      results.push(await this.checkMarketRoi(market));
    }
    const suspended = results.filter((row) => row.action === 'suspended');
    const alerted = results.filter((row) => row.action === 'alerted');
    logger.info(
      {
        markets: results.length,
        suspended: suspended.map((row) => row.market),
        alerted: alerted.map((row) => row.market),
      },
      'Market ROI sweep complete',
    );
    return results;
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

  async getCalibrationCurve(): Promise<CalibrationBin[]> {
    const bets = await this.prisma.client.bet.findMany({
      where: {
        status: { in: ['WON', 'LOST'] },
        source: 'MODEL',
      },
      select: { status: true, probEstimated: true },
    });

    const BIN_COUNT = 10;
    const bins: { sumProb: number; wins: number; count: number }[] = Array.from(
      { length: BIN_COUNT },
      () => ({ sumProb: 0, wins: 0, count: 0 }),
    );

    for (const bet of bets) {
      const prob = new Decimal(bet.probEstimated.toString()).toNumber();
      const idx = Math.min(Math.floor(prob * BIN_COUNT), BIN_COUNT - 1);
      bins[idx].sumProb += prob;
      bins[idx].count += 1;
      if (bet.status === 'WON') bins[idx].wins += 1;
    }

    return bins
      .map((bin, i) => ({
        minProb: i / BIN_COUNT,
        maxProb: (i + 1) / BIN_COUNT,
        avgProb:
          bin.count > 0 ? bin.sumProb / bin.count : (i + 0.5) / BIN_COUNT,
        actualRate: bin.count > 0 ? bin.wins / bin.count : 0,
        count: bin.count,
      }))
      .filter((bin) => bin.count > 0);
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
      select: { status: true, oddsSnapshot: true, probEstimated: true },
    });

    const settledBets = bets.filter(
      (bet) => bet.status === 'WON' || bet.status === 'LOST',
    );
    // Le rapport hebdomadaire lit encore la table `bet` (paris USER
    // uniquement depuis le 2026-09-04) ; un gain sans cote compte zéro.
    const roiOneXTwo =
      settledBets.length > 0
        ? computeRoi(
            settledBets.map((bet) => ({
              result:
                bet.status === 'WON' ? ('WON' as const) : ('LOST' as const),
              odds: bet.oddsSnapshot !== null ? Number(bet.oddsSnapshot) : 1,
            })),
          ).toNumber()
        : 0;
    const brierScore =
      settledBets.length > 0 ? computeBrierScore(settledBets) : 0;

    const result: WeeklyReportResult = {
      periodStart,
      periodEnd,
      roiOneXTwo,
      betsPlaced: bets.length,
      brierScore,
    };

    await this.notification.sendWeeklyReport(result);
    logger.info({ roiOneXTwo, betsPlaced: bets.length }, 'Weekly report sent');

    return result;
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** Profit of one leg at one unit: odds − 1 when won, −1 when lost. */
function legProfit(leg: SettledLegRow): Decimal {
  return leg.result === 'WON'
    ? new Decimal(leg.odds).minus(1)
    : new Decimal(-1);
}

function computeRoi(legs: readonly SettledLegRow[]): Decimal {
  if (legs.length === 0) return new Decimal(0);
  return legs
    .reduce((sum, leg) => sum.plus(legProfit(leg)), new Decimal(0))
    .div(legs.length);
}

/** Standard error of the mean profit per leg (sample standard deviation
 * over √n); zero under two legs. */
function computeStandardError(
  legs: readonly SettledLegRow[],
  roi: Decimal,
): Decimal {
  if (legs.length < 2) return new Decimal(0);
  const sumSquares = legs.reduce(
    (sum, leg) => sum.plus(legProfit(leg).minus(roi).pow(2)),
    new Decimal(0),
  );
  return sumSquares
    .div(legs.length - 1)
    .sqrt()
    .div(new Decimal(legs.length).sqrt());
}

type SettledBetRow = {
  status: string;
  probEstimated: { toString(): string };
};

// Brier score = mean((probEstimated - outcome)^2), outcome = 1 if WON else 0.
// Was previously hardcoded to 0 in generateWeeklyReport, silently claiming
// perfect calibration every week.
function computeBrierScore(bets: SettledBetRow[]): number {
  const sumSquaredError = bets.reduce((sum, bet) => {
    const prob = new Decimal(bet.probEstimated.toString());
    const outcome = bet.status === 'WON' ? 1 : 0;
    return sum + prob.minus(outcome).pow(2).toNumber();
  }, 0);
  return sumSquaredError / bets.length;
}
