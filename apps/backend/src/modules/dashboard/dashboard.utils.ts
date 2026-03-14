import { NotificationType } from '@evcore/db';
import { toNumber } from '@utils/prisma.utils';
import { startOfUtcDay } from '@utils/date.utils';
import type { WorkerStatus } from './dashboard.types';

export function signedDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function toQualityScore(finalScore: unknown): number {
  return Math.max(0, Math.min(100, Math.round(toNumber(finalScore) * 100)));
}

export function couponWindow(couponDate: Date, now: Date): string {
  const couponDay = startOfUtcDay(couponDate).getTime();
  const currentDay = startOfUtcDay(now).getTime();
  if (couponDay === currentDay) return "Aujourd'hui";
  if (couponDay > currentDay) return 'À venir';
  return 'Soldé';
}

export function buildWorkerStatus(input: {
  worker: string;
  lastRun: Date | null;
  healthyMinutes: number;
  watchMinutes: number;
  detail: string;
  formatTime: (d: Date) => string;
}): WorkerStatus {
  const { worker, lastRun, healthyMinutes, watchMinutes, detail, formatTime } =
    input;

  if (!lastRun) {
    return { worker, lastRun: '--:--', status: 'late', detail };
  }

  const ageMinutes = (Date.now() - lastRun.getTime()) / 60000;
  const status =
    ageMinutes <= healthyMinutes
      ? 'healthy'
      : ageMinutes <= watchMinutes
        ? 'watch'
        : 'late';

  return { worker, lastRun: formatTime(lastRun), status, detail };
}

export function uniqueBetsByFixture<
  T extends { modelRun: { fixture: { id: string } } },
>(bets: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const bet of bets) {
    const id = bet.modelRun.fixture.id;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(bet);
  }
  return unique;
}

export function notificationSeverity(
  type: NotificationType,
): 'high' | 'medium' | 'low' {
  if (
    type === NotificationType.ETL_FAILURE ||
    type === NotificationType.MARKET_SUSPENSION
  ) {
    return 'high';
  }
  if (
    type === NotificationType.ROI_ALERT ||
    type === NotificationType.BRIER_ALERT
  ) {
    return 'medium';
  }
  return 'low';
}

export function notificationLevel(
  type: NotificationType,
): 'INFO' | 'WARN' | 'BET' | 'ALERT' {
  if (
    type === NotificationType.ETL_FAILURE ||
    type === NotificationType.MARKET_SUSPENSION ||
    type === NotificationType.ROI_ALERT ||
    type === NotificationType.BRIER_ALERT
  ) {
    return 'ALERT';
  }
  if (
    type === NotificationType.DAILY_COUPON ||
    type === NotificationType.COUPON_RESULT
  ) {
    return 'BET';
  }
  if (type === NotificationType.WEIGHT_ADJUSTMENT) {
    return 'WARN';
  }
  return 'INFO';
}

export function countHighAlerts(
  notifications: { type: NotificationType }[],
): number {
  return notifications.filter((n) => notificationSeverity(n.type) === 'high')
    .length;
}
