import { Injectable } from '@nestjs/common';
import { RetentionRepository } from './retention.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_WEEKS = 12;
const OPENS_WINDOW_DAYS = 30;

export type RetentionCohort = {
  week: string;
  signups: number;
  /** Part des inscrits actifs au moins 3 jours dans leurs 14 premiers. */
  activation: number | null;
  d7: { eligible: number; rate: number | null };
  d14: { eligible: number; rate: number | null };
  d30: { eligible: number; rate: number | null };
};

export type RetentionView = {
  asOf: string;
  active: { dau: number; wau: number; mau: number };
  /** Parmi les actifs des 7 derniers jours, part qui suit ou déclare un coupon. */
  engagement: {
    weeklyActive: number;
    followedRate: number | null;
    declaredRate: number | null;
  };
  notifications: {
    type: string;
    sent: number;
    opened: number;
    rate: number | null;
  }[];
  cohorts: RetentionCohort[];
};

/** Part arrondie à 3 décimales ; null sans dénominateur. */
function rate(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 1000 : null;
}

/**
 * Tableau de fidélisation de l'admin (2026-10-29) : ce que le plan du 23/10
 * exige avant toute offre payante (activation ≥ 40 %, rétention J14 ≥ 30 %,
 * sur au moins 300 inscrits).
 */
@Injectable()
export class RetentionService {
  constructor(private readonly repository: RetentionRepository) {}

  async getRetention(now: Date = new Date()): Promise<RetentionView> {
    const since = new Date(now.getTime() - COHORT_WEEKS * 7 * DAY_MS);
    const [cohorts, active, engagement, opens] = await Promise.all([
      this.repository.findCohorts({ since, asOf: now }),
      this.repository.findActiveCounts(now),
      this.repository.findEngagement(now),
      this.repository.findNotificationOpens(
        new Date(now.getTime() - OPENS_WINDOW_DAYS * DAY_MS),
      ),
    ]);
    return {
      asOf: now.toISOString().slice(0, 10),
      active,
      engagement: {
        weeklyActive: engagement.weeklyActive,
        followedRate: rate(engagement.followed, engagement.weeklyActive),
        declaredRate: rate(engagement.declared, engagement.weeklyActive),
      },
      notifications: opens.map((o) => ({ ...o, rate: rate(o.opened, o.sent) })),
      cohorts: cohorts.map((c) => ({
        week: new Date(c.week).toISOString().slice(0, 10),
        signups: c.signups,
        activation: rate(c.activated, c.signups),
        d7: { eligible: c.d7Eligible, rate: rate(c.d7Retained, c.d7Eligible) },
        d14: {
          eligible: c.d14Eligible,
          rate: rate(c.d14Retained, c.d14Eligible),
        },
        d30: {
          eligible: c.d30Eligible,
          rate: rate(c.d30Retained, c.d30Eligible),
        },
      })),
    };
  }
}
