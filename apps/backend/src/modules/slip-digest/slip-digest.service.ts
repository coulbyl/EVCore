import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { NotificationType } from '@evcore/db';
import { NotificationService } from '@modules/notification/notification.service';
import { PushService } from '@modules/push/push.service';
import { slipMoney, type SlipMoney } from '@modules/bet-slip/bet-slip-outcome';
import { createLogger } from '@utils/logger';
import { composeSlipDigest } from './slip-digest.compose';
import { SlipDigestRepository } from './slip-digest.repository';

const logger = createLogger('slip-digest');

const DAY_MS = 24 * 60 * 60 * 1000;

type UserBucket = {
  currency: string | null;
  results: SlipMoney[];
};

/** « 2026-10-27 » : la veille, en UTC, du moment du passage. */
export function previousUtcDay(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
}

@Injectable()
export class SlipDigestService {
  constructor(
    private readonly repository: SlipDigestRepository,
    private readonly notification: NotificationService,
    private readonly push: PushService,
  ) {}

  /**
   * Un résumé par joueur pour les coupons dont la dernière jambe se jouait
   * ce jour-là. Jamais pendant une pause : le joueur a choisi de ne plus être
   * sollicité. Rejouable : un joueur déjà notifié pour ce jour est sauté.
   */
  async sendDigests(
    day: string,
    now: Date = new Date(),
  ): Promise<{ sent: number; skippedPaused: number }> {
    const from = new Date(`${day}T00:00:00.000Z`);
    const to = new Date(from.getTime() + DAY_MS);
    const slips = await this.repository.findSlipsTouchingDay(from, to);

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
      const bucket = byUser.get(user.id) ?? {
        currency: user.currency,
        results: [],
      };
      bucket.results.push(
        slipMoney({
          type: slip.type,
          unitStake: new Decimal(slip.unitStake.toString()),
          items: slip.items.map((item) => ({
            status: item.bet.status,
            odds:
              item.bet.oddsSnapshot === null
                ? null
                : new Decimal(item.bet.oddsSnapshot.toString()),
            stake: new Decimal(
              (item.stakeOverride ?? slip.unitStake).toString(),
            ),
          })),
        }),
      );
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
        payload: { day, settled: message.settled, net: message.net },
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
