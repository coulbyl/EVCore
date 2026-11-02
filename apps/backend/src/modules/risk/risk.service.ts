import { Injectable } from '@nestjs/common';
import { Market } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { NotificationService } from '@modules/notification/notification.service';
import { RISK_CONSTANTS } from './risk.constants';
import { RiskRepository, type SettledLegRow } from './risk.repository';

const logger = createLogger('risk-service');

export type RoiCheckResult = {
  market: Market;
  betCount: number;
  roi: Decimal;
  /** Standard error of the ROI per leg; zero when the sample is empty. */
  standardError: Decimal;
  action: 'suspended' | 'alerted' | 'ok' | 'insufficient_data';
};

/**
 * The market guard-rail, run by the settlement worker's daily sweep. Its
 * HTTP routes (calibration curve, weekly report, alert lists) had no
 * caller since the old admin was retired, and left with it (2026-11-02).
 */
@Injectable()
export class RiskService {
  constructor(
    private readonly notification: NotificationService,
    private readonly repository: RiskRepository,
  ) {}

  async isMarketSuspended(market: Market): Promise<boolean> {
    return this.repository.hasActiveSuspension(market);
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
        await this.repository.createSuspension({
          market,
          reason: `ROI ${(roi.toNumber() * 100).toFixed(1)} % ± ${(standardError.toNumber() * 100).toFixed(1)} sur ${legs.length} jambes réglées en ${RISK_CONSTANTS.ROI_WINDOW_DAYS} jours — suspension automatique`,
          triggeredBy: 'auto',
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
