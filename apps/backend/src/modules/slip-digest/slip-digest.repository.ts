import { Injectable } from '@nestjs/common';
import {
  type CouponResult,
  type CouponSource,
  NotificationType,
  type Prisma,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type DigestFollow = {
  user: { id: string; pausedUntil: Date | null };
  couponProposal: {
    id: string;
    result: CouponResult | null;
    targetOddsMin: Prisma.Decimal;
  };
};

export type DayCoupon = {
  source: CouponSource;
  targetOddsMin: Prisma.Decimal;
  combinedOdds: Prisma.Decimal;
  legs: { operatorOdds: Prisma.Decimal | null }[];
};

const DIGEST_RECIPIENT_SELECT = {
  id: true,
  pausedUntil: true,
  email: true,
  emailVerified: true,
  emailNotificationsEnabled: true,
} as const;

export type DigestRecipient = {
  id: string;
  pausedUntil: Date | null;
  email: string;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
};

/**
 * L'adresse où envoyer aussi la matinée ou la semaine : « Par e-mail aussi »
 * activé et adresse vérifiée (09 § 5, § 7), sinon rien.
 */
export function digestEmailOf(recipient: DigestRecipient): string | null {
  return recipient.emailNotificationsEnabled && recipient.emailVerified
    ? recipient.email
    : null;
}

function idsOf(payload: Prisma.JsonValue | null, key: string): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const ids = payload[key];
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}

@Injectable()
export class SlipDigestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Coupons suivis (« Suivre ce coupon ») réglés, dont le dernier match se
   * jouait entre `from` et `to`.
   */
  findSettledFollows(from: Date, to: Date): Promise<DigestFollow[]> {
    return this.prisma.client.couponFollow.findMany({
      where: {
        couponProposal: {
          result: { not: null },
          lastFixtureScheduledAt: { gte: from, lt: to },
        },
      },
      select: {
        user: { select: { id: true, pausedUntil: true } },
        couponProposal: {
          select: { id: true, result: true, targetOddsMin: true },
        },
      },
    });
  }

  /** Coupons suivis déjà annoncés dans une matinée envoyée depuis `since`. */
  async findReported(
    userIds: readonly string[],
    since: Date,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const digests = await this.prisma.client.notification.findMany({
      where: {
        userId: { in: [...userIds] },
        // La matinée remplace le résumé seul depuis le 2026-10-29 : les deux
        // portent les coupons déjà annoncés.
        type: {
          in: [
            NotificationType.SLIPS_SETTLED_DIGEST,
            NotificationType.MORNING_BRIEF,
          ],
        },
        createdAt: { gte: since },
      },
      select: { payload: true },
    });
    return new Set(digests.flatMap((d) => idsOf(d.payload, 'followedIds')));
  }

  /** Joueurs qui reçoivent la matinée (réglage actif, 2026-10-29). */
  findMorningRecipients(): Promise<DigestRecipient[]> {
    return this.prisma.client.user.findMany({
      where: { morningBriefEnabled: true, suspended: false },
      select: DIGEST_RECIPIENT_SELECT,
    });
  }

  /**
   * Coupons publiés pour un jour, avec la cote 1xBet de leurs jambes quand
   * elle est connue : la ligne « coupons du jour » de la matinée.
   */
  findDayCoupons(day: Date): Promise<DayCoupon[]> {
    return this.prisma.client.couponProposal.findMany({
      where: { forDate: day },
      select: {
        source: true,
        targetOddsMin: true,
        combinedOdds: true,
        legs: { select: { operatorOdds: true } },
      },
      orderBy: { rank: 'asc' },
    });
  }

  /** Joueurs qui reçoivent le relevé du lundi (réglage actif, 2026-10-29). */
  findWeeklyRecipients(): Promise<DigestRecipient[]> {
    return this.prisma.client.user.findMany({
      where: { weeklyStatementEnabled: true, suspended: false },
      select: DIGEST_RECIPIENT_SELECT,
    });
  }

  /**
   * Joueurs déjà notifiés pour une clé du payload (`day` de la matinée,
   * `week` du relevé) : un relancement du job n'envoie rien deux fois. Une
   * seule requête pour tous les destinataires.
   */
  async findNotifiedUserIds(opts: {
    types: readonly NotificationType[];
    key: 'day' | 'week';
    value: string;
  }): Promise<Set<string>> {
    const rows = await this.prisma.client.notification.findMany({
      where: {
        userId: { not: null },
        type: { in: [...opts.types] },
        payload: { path: [opts.key], equals: opts.value },
      },
      select: { userId: true },
    });
    return new Set(
      rows.flatMap((row) => (row.userId === null ? [] : [row.userId])),
    );
  }
}
