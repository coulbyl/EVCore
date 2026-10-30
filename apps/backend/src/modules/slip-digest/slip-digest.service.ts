import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { MailService } from '@modules/mail/mail.service';
import { createLogger } from '@utils/logger';
import { classForTargetOddsMin } from '@evcore/analysis-core';
import { CouponService } from '@modules/coupon/coupon.service';
import {
  PRODUCT_SHORT_LABEL,
  composeMorningBrief,
  type FollowedResult,
  type MorningCoupon,
} from './slip-digest.compose';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { SlipDigestRepository, digestEmailOf } from './slip-digest.repository';

const logger = createLogger('slip-digest');

const DAY_MS = 24 * 60 * 60 * 1000;

type UserBucket = {
  /** Coupons suivis, réglés, annoncés dans ce résumé. */
  follows: FollowedResult[];
  followedIds: string[];
};

/** « 2026-10-27 » : la veille, en UTC, du moment du passage. */
export function previousUtcDay(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
}

/** En pause à `now` : le joueur a choisi de ne plus être sollicité. */
export function isPausedAt(pausedUntil: Date | null, now: Date): boolean {
  return pausedUntil !== null && pausedUntil.getTime() > now.getTime();
}

@Injectable()
export class SlipDigestService {
  // eslint-disable-next-line max-params -- Nest DI constructor.
  constructor(
    private readonly repository: SlipDigestRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly coupons: CouponService,
  ) {}

  /**
   * Coupons du jour pour la matinée : un par produit de l'Accueil (le
   * générateur déterministe d'abord, l'IA ensuite), à la cote 1xBet quand
   * toutes les jambes l'ont, sinon à la cote d'analyse.
   */
  private async morningCoupons(day: Date): Promise<MorningCoupon[]> {
    const rows = await this.repository.findDayCoupons(day);
    const byClass = new Map<string, MorningCoupon & { llm: boolean }>();
    for (const row of rows) {
      const couponClass = classForTargetOddsMin(Number(row.targetOddsMin));
      if (!couponClass || !(couponClass in PRODUCT_SHORT_LABEL)) continue;
      const llm = row.source === 'LLM';
      const held = byClass.get(couponClass);
      if (held && !(held.llm && !llm)) continue;
      const operator = row.legs.every((leg) => leg.operatorOdds !== null)
        ? row.legs.reduce(
            (acc, leg) => acc.times(leg.operatorOdds!.toString()),
            new Decimal(1),
          )
        : null;
      byClass.set(couponClass, {
        couponClass,
        odds: (operator ?? new Decimal(row.combinedOdds.toString())).toNumber(),
        llm,
      });
    }
    const order = Object.keys(PRODUCT_SHORT_LABEL);
    return [...byClass.values()]
      .sort(
        (a, b) => order.indexOf(a.couponClass) - order.indexOf(b.couponClass),
      )
      .map(({ couponClass, odds }) => ({ couponClass, odds }));
  }

  /**
   * Une matinée par joueur : les coupons suivis réglés depuis la dernière,
   * sur SLIP_DIGEST.LOOKBACK_DAYS — un coupon réglé en retard est annoncé le
   * jour où il l'est, une seule fois —, puis les coupons du jour. Jamais
   * pendant une pause : le joueur a choisi de ne plus être sollicité.
   * Rejouable : un joueur déjà notifié pour ce jour est sauté.
   */
  async sendDigests(
    day: string,
    now: Date = new Date(),
  ): Promise<{ sent: number; skippedPaused: number }> {
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const to = new Date(dayStart.getTime() + DAY_MS);
    const from = new Date(to.getTime() - SLIP_DIGEST.LOOKBACK_DAYS * DAY_MS);
    const follows = await this.repository.findSettledFollows(from, to);
    const reported = await this.repository.findReported(
      [...new Set(follows.map((follow) => follow.user.id))],
      from,
    );

    const byUser = new Map<string, UserBucket>();
    const pausedUsers = new Set<string>();
    const bucketFor = (user: { id: string }): UserBucket => {
      const bucket = byUser.get(user.id) ?? { follows: [], followedIds: [] };
      byUser.set(user.id, bucket);
      return bucket;
    };
    const isPaused = (pausedUntil: Date | null) => isPausedAt(pausedUntil, now);
    for (const follow of follows) {
      const { user, couponProposal: coupon } = follow;
      if (isPaused(user.pausedUntil)) {
        pausedUsers.add(user.id);
        continue;
      }
      if (coupon.result === null || reported.has(coupon.id)) {
        continue;
      }
      const bucket = bucketFor(user);
      bucket.follows.push({
        targetOddsMin: Number(coupon.targetOddsMin),
        result: coupon.result,
      });
      bucket.followedIds.push(coupon.id);
    }
    // La matinée part à tous les joueurs qui l'ont gardée (2026-10-29) :
    // coupons suivis s'ils en ont, coupons du jour pour tous.
    const today = new Date(to.getTime());
    const todayIso = today.toISOString().slice(0, 10);
    const [recipients, coupons, abstentions, notified] = await Promise.all([
      this.repository.findMorningRecipients(),
      this.morningCoupons(today),
      this.coupons.getAbstentions(todayIso),
      this.repository.findNotifiedUserIds({
        types: [
          NotificationType.SLIPS_SETTLED_DIGEST,
          NotificationType.MORNING_BRIEF,
        ],
        key: 'day',
        value: day,
      }),
    ]);

    let sent = 0;
    for (const recipient of recipients) {
      if (isPaused(recipient.pausedUntil)) {
        pausedUsers.add(recipient.id);
        continue;
      }
      const bucket = byUser.get(recipient.id) ?? {
        follows: [],
        followedIds: [],
      };
      const message = composeMorningBrief({
        follows: bucket.follows,
        coupons,
        abstentions,
      });
      if (!message) continue;
      if (notified.has(recipient.id)) continue;
      await this.notification.notifyUser({
        userId: recipient.id,
        type: NotificationType.MORNING_BRIEF,
        title: message.title,
        body: message.body,
        payload: { day, followedIds: bucket.followedIds },
      });
      await this.push.sendToUser(recipient.id, {
        title: message.title,
        body: message.body,
        url: '/dashboard?from=morning',
      });
      const email = digestEmailOf(recipient);
      if (email) {
        await this.mail.sendPlayerDigest(email, {
          title: message.title,
          body: message.body,
          path: '/dashboard?from=morning',
        });
      }
      sent += 1;
    }
    const skippedPaused = pausedUsers.size;
    logger.info({ day, sent, skippedPaused }, 'Slip digests sent');
    return { sent, skippedPaused };
  }
}
