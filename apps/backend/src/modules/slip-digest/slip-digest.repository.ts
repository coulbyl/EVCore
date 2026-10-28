import { Injectable } from '@nestjs/common';
import { NotificationType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class SlipDigestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Coupons dont au moins une jambe se jouait ce jour-là, avec toutes leurs
   * jambes : le service ne garde que ceux dont la dernière jambe tombait ce
   * jour-là.
   */
  findSlipsTouchingDay(from: Date, to: Date) {
    return this.prisma.client.betSlip.findMany({
      where: {
        items: { some: { fixture: { scheduledAt: { gte: from, lt: to } } } },
      },
      select: {
        type: true,
        unitStake: true,
        user: { select: { id: true, currency: true, pausedUntil: true } },
        items: {
          select: {
            stakeOverride: true,
            fixture: { select: { scheduledAt: true } },
            bet: { select: { status: true, oddsSnapshot: true } },
          },
        },
      },
    });
  }

  /** Un relancement du job ne doit pas envoyer deux fois le même jour. */
  async hasDigest(userId: string, day: string): Promise<boolean> {
    const existing = await this.prisma.client.notification.findFirst({
      where: {
        userId,
        type: NotificationType.SLIPS_SETTLED_DIGEST,
        payload: { path: ['day'], equals: day },
      },
      select: { id: true },
    });
    return existing !== null;
  }
}
