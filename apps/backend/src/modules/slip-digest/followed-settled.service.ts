import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import { FOLLOWED_SETTLED_WINDOW } from '@config/slip-digest.constants';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { mapWithConcurrency } from '@utils/async.utils';
import { createLogger } from '@utils/logger';
import {
  composeFollowedSettled,
  type FollowedSettledCoupon,
  type FollowedSettledLeg,
} from './followed-settled.compose';
import {
  FollowedSettledRepository,
  type FollowedSettledRow,
} from './followed-settled.repository';
import { isPausedAt } from './slip-digest.service';

const logger = createLogger('followed-settled');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The evening of `now` (UTC, the time in Abidjan): from 20:00 to 01:00, or
 * null outside it. Its day is the one the evening started on.
 */
export function eveningOf(now: Date): Date | null {
  const hour = now.getUTCHours();
  const { START_HOUR_UTC, END_HOUR_UTC } = FOLLOWED_SETTLED_WINDOW;
  const dayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (hour >= START_HOUR_UTC) return new Date(dayStart);
  if (hour < END_HOUR_UTC) return new Date(dayStart - DAY_MS);
  return null;
}

type Pending = {
  userId: string;
  pausedUntil: Date | null;
  couponId: string;
  coupon: FollowedSettledCoupon;
};

/**
 * « Ton Favori est passé ✓ », the evening a followed coupon settles
 * (docs/refonte-ui/10 § 3): between 20:00 and 01:00 only, never during a
 * pause, one notification per coupon.
 *
 * Keyed on « not yet announced » (docs/review-expectations.md § 4): every
 * run of the evening takes all followed coupons settled since that day
 * began and not announced yet, so a match settled late in the evening, or
 * a run that failed, is caught by the next run. What settles after 01:00
 * is left to the morning brief, which announces followed results too.
 */
@Injectable()
export class FollowedSettledService {
  constructor(
    private readonly repository: FollowedSettledRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
  ) {}

  async notifyEvening(
    now: Date = new Date(),
  ): Promise<{ sent: number; skippedPaused: number }> {
    const evening = eveningOf(now);
    if (!evening) return { sent: 0, skippedPaused: 0 };

    const rows = await this.repository.findSettledSince({
      since: evening,
      forDateFrom: new Date(evening.getTime() - 2 * DAY_MS),
    });
    const pausedUsers = new Set<string>();
    const pending = pendingOf(rows).filter(({ userId, pausedUntil }) => {
      if (!isPausedAt(pausedUntil, now)) return true;
      pausedUsers.add(userId);
      return false;
    });
    const announced = await this.repository.findAnnounced({
      userIds: [...new Set(pending.map((p) => p.userId))],
      // Wider than tonight: a coupon announced yesterday evening and
      // corrected today is not announced again.
      since: new Date(evening.getTime() - DAY_MS),
    });
    const toSend = pending.filter(
      (p) => !announced.has(`${p.userId}:${p.couponId}`),
    );

    let sent = 0;
    await mapWithConcurrency(
      toSend,
      FOLLOWED_SETTLED_WINDOW.CONCURRENCY,
      async ({ userId, couponId, coupon }) => {
        const message = composeFollowedSettled(coupon);
        // The notification is the record of what was announced: no record,
        // no push, and the next run tries again.
        const recorded = await this.notification.notifyUser({
          userId,
          type: NotificationType.FOLLOWED_SETTLED,
          title: message.title,
          body: message.body,
          payload: {
            couponProposalId: couponId,
            evening: evening.toISOString().slice(0, 10),
          },
        });
        if (!recorded) return;
        await this.push.sendToUser(userId, {
          title: message.title,
          body: message.body,
          url: `/me?coupon=${couponId}`,
        });
        sent += 1;
      },
    );
    const skippedPaused = pausedUsers.size;
    logger.info(
      { evening: evening.toISOString().slice(0, 10), sent, skippedPaused },
      'Followed coupon results sent',
    );
    return { sent, skippedPaused };
  }
}

/** Rows (one per follower and leg) grouped into one entry per follow. */
function pendingOf(rows: readonly FollowedSettledRow[]): Pending[] {
  const byFollow = new Map<
    string,
    { first: FollowedSettledRow; legs: FollowedSettledLeg[] }
  >();
  for (const row of rows) {
    const key = `${row.userId}:${row.couponId}`;
    const entry = byFollow.get(key) ?? { first: row, legs: [] };
    entry.legs.push({
      home: row.home,
      away: row.away,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      scheduledAt: row.scheduledAt,
      isCorrect: row.isCorrect,
      operatorOdds:
        row.operatorOdds === null
          ? null
          : new Decimal(row.operatorOdds.toString()),
    });
    byFollow.set(key, entry);
  }
  return [...byFollow.values()].map(({ first, legs }) => ({
    userId: first.userId,
    pausedUntil: first.pausedUntil,
    couponId: first.couponId,
    coupon: {
      targetOddsMin: Number(first.targetOddsMin),
      source: first.source,
      result: first.result,
      legs,
    },
  }));
}
