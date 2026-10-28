import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { slipMoney, type SlipMoney } from '@modules/bet-slip/bet-slip-outcome';
import { createLogger } from '@utils/logger';
import { composeSlipDigest } from './slip-digest.compose';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import {
  SlipDigestRepository,
  type DigestSlip,
} from './slip-digest.repository';

const logger = createLogger('slip-digest');

const DAY_MS = 24 * 60 * 60 * 1000;

type UserBucket = {
  currency: string | null;
  results: SlipMoney[];
  /** Coupons annoncés réglés dans ce résumé. */
  settledSlipIds: string[];
};

/** « 2026-10-27 » : la veille, en UTC, du moment du passage. */
export function previousUtcDay(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
}

function toMoney(slip: DigestSlip): SlipMoney {
  return slipMoney({
    type: slip.type,
    unitStake: new Decimal(slip.unitStake.toString()),
    items: slip.items.map((item) => ({
      status: item.bet.status,
      odds:
        item.bet.oddsSnapshot === null
          ? null
          : new Decimal(item.bet.oddsSnapshot.toString()),
      stake: new Decimal((item.stakeOverride ?? slip.unitStake).toString()),
    })),
  });
}

@Injectable()
export class SlipDigestService {
  constructor(
    private readonly repository: SlipDigestRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
  ) {}

  /**
   * Un résumé par joueur : les coupons réglés depuis le dernier résumé, dont
   * la dernière jambe se jouait ce jour-là ou dans les jours d'avant
   * (SLIP_DIGEST.LOOKBACK_DAYS) — un coupon encore en attente à 8 h est
   * annoncé le jour où il est réglé, une seule fois. Les coupons de ce jour
   * encore en attente sont seulement comptés. Jamais pendant une pause : le
   * joueur a choisi de ne plus être sollicité. Rejouable : un joueur déjà
   * notifié pour ce jour est sauté.
   */
  async sendDigests(
    day: string,
    now: Date = new Date(),
  ): Promise<{ sent: number; skippedPaused: number }> {
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const to = new Date(dayStart.getTime() + DAY_MS);
    const from = new Date(to.getTime() - SLIP_DIGEST.LOOKBACK_DAYS * DAY_MS);
    const slips = await this.repository.findSlipsTouching(from, to);
    const reported = await this.repository.findReportedSlipIds(
      [...new Set(slips.map((slip) => slip.user.id))],
      from,
    );

    const byUser = new Map<string, UserBucket>();
    const pausedUsers = new Set<string>();
    for (const slip of slips) {
      const lastKickoff = Math.max(
        ...slip.items.map((item) => item.fixture.scheduledAt.getTime()),
      );
      if (lastKickoff < from.getTime() || lastKickoff >= to.getTime()) continue;
      const { user } = slip;
      if (user.pausedUntil && user.pausedUntil.getTime() > now.getTime()) {
        pausedUsers.add(user.id);
        continue;
      }
      const money = toMoney(slip);
      const pending = money.status === 'PENDING';
      if (pending && lastKickoff < dayStart.getTime()) continue;
      if (!pending && reported.has(slip.id)) continue;
      const bucket = byUser.get(user.id) ?? {
        currency: user.currency,
        results: [],
        settledSlipIds: [],
      };
      bucket.results.push(money);
      if (!pending) bucket.settledSlipIds.push(slip.id);
      byUser.set(user.id, bucket);
    }
    const skippedPaused = pausedUsers.size;

    let sent = 0;
    for (const [userId, bucket] of byUser) {
      const message = composeSlipDigest(bucket.results, bucket.currency);
      if (!message) continue;
      if (await this.repository.hasDigest(userId, day)) continue;
      await this.notification.notifyUser({
        userId,
        type: NotificationType.SLIPS_SETTLED_DIGEST,
        title: message.title,
        body: message.body,
        payload: {
          day,
          settled: message.settled,
          net: message.net,
          slipIds: bucket.settledSlipIds,
        },
      });
      await this.push.sendToUser(userId, {
        title: message.title,
        body: message.body,
        url: '/dashboard/bet-slips',
      });
      sent += 1;
    }
    logger.info({ day, sent, skippedPaused }, 'Slip digests sent');
    return { sent, skippedPaused };
  }
}
