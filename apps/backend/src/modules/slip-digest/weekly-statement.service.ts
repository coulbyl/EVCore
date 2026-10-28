import { Injectable } from '@nestjs/common';
import { NotificationType } from '@evcore/db';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { CouponService } from '@modules/coupon/coupon.service';
import type { SlipMoney } from '@modules/bet-slip/bet-slip-outcome';
import { createLogger } from '@utils/logger';
import {
  composeWeeklyStatement,
  type FollowedResult,
  type WeeklyProduct,
} from './slip-digest.compose';
import { SlipDigestRepository } from './slip-digest.repository';
import { toMoney } from './slip-digest.service';

const logger = createLogger('weekly-statement');

const DAY_MS = 24 * 60 * 60 * 1000;

/** « 2026-10-19 » : le lundi de la semaine passée, en UTC. */
export function previousIsoWeek(now: Date): string {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  return new Date(today - (sinceMonday + 7) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class WeeklyStatementService {
  // eslint-disable-next-line max-params -- Nest DI constructor.
  constructor(
    private readonly repository: SlipDigestRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
    private readonly coupons: CouponService,
  ) {}

  /** Nos produits sur la semaine : le générateur déterministe, pas l'IA. */
  private async weekProducts(from: Date, to: Date): Promise<WeeklyProduct[]> {
    const rows = await this.coupons.getTrackRecordBetween(from, to);
    const byClass = new Map<string, WeeklyProduct>();
    for (const row of rows) {
      if (row.source === 'LLM' || !row.couponClass) continue;
      const held = byClass.get(row.couponClass) ?? {
        couponClass: row.couponClass,
        won: 0,
        settled: 0,
      };
      byClass.set(row.couponClass, {
        ...held,
        won: held.won + row.won,
        settled: held.settled + row.settled,
      });
    }
    return [...byClass.values()];
  }

  /**
   * Le relevé du lundi, une fois par joueur et par semaine (`week` = son
   * lundi), aux joueurs qui l'ont gardé, jamais pendant une pause. La
   * semaine est fermée : un relevé rejoué plus tard dit la même chose,
   * hormis les coupons réglés entre-temps.
   */
  async sendStatements(
    week: string,
    now: Date = new Date(),
  ): Promise<{ sent: number; skippedPaused: number }> {
    const from = new Date(`${week}T00:00:00.000Z`);
    const to = new Date(from.getTime() + 7 * DAY_MS);
    const [recipients, slips, follows, products] = await Promise.all([
      this.repository.findWeeklyRecipients(),
      this.repository.findSlipsTouching(from, to),
      this.repository.findSettledFollows(from, to),
      this.weekProducts(from, to),
    ]);

    const results = new Map<string, SlipMoney[]>();
    for (const slip of slips) {
      const lastKickoff = Math.max(
        ...slip.items.map((item) => item.fixture.scheduledAt.getTime()),
      );
      if (lastKickoff < from.getTime() || lastKickoff >= to.getTime()) continue;
      const list = results.get(slip.user.id) ?? [];
      list.push(toMoney(slip));
      results.set(slip.user.id, list);
    }
    const followed = new Map<string, FollowedResult[]>();
    for (const { user, couponProposal: coupon } of follows) {
      if (coupon.result === null) continue;
      const list = followed.get(user.id) ?? [];
      list.push({
        targetOddsMin: Number(coupon.targetOddsMin),
        result: coupon.result,
      });
      followed.set(user.id, list);
    }

    let sent = 0;
    let skippedPaused = 0;
    for (const recipient of recipients) {
      if (
        recipient.pausedUntil !== null &&
        recipient.pausedUntil.getTime() > now.getTime()
      ) {
        skippedPaused += 1;
        continue;
      }
      const message = composeWeeklyStatement({
        results: results.get(recipient.id) ?? [],
        currency: recipient.currency,
        follows: followed.get(recipient.id) ?? [],
        products,
      });
      if (!message) continue;
      if (await this.repository.hasStatement(recipient.id, week)) continue;
      await this.notification.notifyUser({
        userId: recipient.id,
        type: NotificationType.WEEKLY_STATEMENT,
        title: message.title,
        body: message.body,
        payload: { week, settled: message.settled, net: message.net },
      });
      await this.push.sendToUser(recipient.id, {
        title: message.title,
        body: message.body,
        url: '/dashboard?from=weekly',
      });
      sent += 1;
    }
    logger.info({ week, sent, skippedPaused }, 'Weekly statements sent');
    return { sent, skippedPaused };
  }
}
