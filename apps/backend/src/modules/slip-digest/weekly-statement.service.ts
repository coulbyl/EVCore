import { Injectable } from '@nestjs/common';
import { NotificationType } from '@evcore/db';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { MailService } from '@modules/mail/mail.service';
import { ProductWeekService } from '@modules/coupon/product-day/product-week.service';
import type { SlipMoney } from '@modules/bet-slip/bet-slip-outcome';
import { previousIsoWeek } from '@utils/date.utils';
import { createLogger } from '@utils/logger';
import {
  composeWeeklyStatement,
  type FollowedResult,
  type WeeklyProduct,
} from './slip-digest.compose';
import { SlipDigestRepository, digestEmailOf } from './slip-digest.repository';
import { isPausedAt, lastKickoffMs, toMoney } from './slip-digest.service';

const logger = createLogger('weekly-statement');

const DAY_MS = 24 * 60 * 60 * 1000;

// Partagé avec « Ta semaine » (screens) : un seul calcul de la semaine.
export { previousIsoWeek };

@Injectable()
export class WeeklyStatementService {
  // eslint-disable-next-line max-params -- Nest DI constructor.
  constructor(
    private readonly repository: SlipDigestRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly productWeek: ProductWeekService,
  ) {}

  /**
   * Nos produits sur la semaine, comptés comme « Ta semaine » et Résultats
   * (product_day, 2026-10-30) : le jour du coupon publié avant son coup
   * d'envoi, un remboursé ni gagné ni perdu ; jamais l'IA.
   */
  private async weekProducts(week: string): Promise<WeeklyProduct[]> {
    const { products } = await this.productWeek.getWeek(week);
    return products.map((p) => ({
      couponClass: p.product,
      won: p.won,
      settled: p.played,
    }));
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
    const [recipients, slips, follows, products, notified] = await Promise.all([
      this.repository.findWeeklyRecipients(),
      this.repository.findSlipsTouching(from, to),
      this.repository.findSettledFollows(from, to),
      this.weekProducts(week),
      this.repository.findNotifiedUserIds({
        types: [NotificationType.WEEKLY_STATEMENT],
        key: 'week',
        value: week,
      }),
    ]);

    const results = new Map<string, SlipMoney[]>();
    for (const slip of slips) {
      const lastKickoff = lastKickoffMs(slip);
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
      if (isPausedAt(recipient.pausedUntil, now)) {
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
      if (notified.has(recipient.id)) continue;
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
      const email = digestEmailOf(recipient);
      if (email) {
        await this.mail.sendPlayerDigest(email, {
          title: message.title,
          body: message.body,
          path: '/dashboard?from=weekly',
        });
      }
      sent += 1;
    }
    logger.info({ week, sent, skippedPaused }, 'Weekly statements sent');
    return { sent, skippedPaused };
  }
}
