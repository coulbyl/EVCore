import { Injectable } from '@nestjs/common';
import { BetStatus, CouponStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    date: Date;
    status: CouponStatus;
    legCount: number;
  }): Promise<{ id: string }> {
    return this.prisma.client.dailyCoupon.create({
      data,
      select: { id: true },
    });
  }

  async linkBets(couponId: string, betIds: string[]): Promise<void> {
    await this.prisma.client.bet.updateMany({
      where: { id: { in: betIds } },
      data: { dailyCouponId: couponId },
    });
  }

  findLatestByDate(
    date: Date,
  ): Promise<{ id: string; status: CouponStatus } | null> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return this.prisma.client.dailyCoupon.findFirst({
      where: { date: { gte: start, lte: end } },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingCouponsUntil(date: Date): Promise<
    {
      id: string;
      status: CouponStatus;
      bets: { id: string; status: BetStatus }[];
    }[]
  > {
    return this.prisma.client.dailyCoupon.findMany({
      where: {
        status: CouponStatus.PENDING,
        date: { lte: date },
      },
      select: {
        id: true,
        status: true,
        bets: { select: { id: true, status: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  findCouponById(couponId: string): Promise<{
    id: string;
    date: Date;
    status: CouponStatus;
    legCount: number;
    createdAt: Date;
    bets: {
      id: string;
      market: string;
      pick: string;
      ev: unknown;
      oddsSnapshot: unknown;
      comboMarket: string | null;
      comboPick: string | null;
      status: BetStatus;
      modelRun: {
        fixture: {
          scheduledAt: Date;
          homeTeam: { name: string };
          awayTeam: { name: string };
        };
      };
    }[];
  } | null> {
    return this.prisma.client.dailyCoupon.findUnique({
      where: { id: couponId },
      select: {
        id: true,
        date: true,
        status: true,
        legCount: true,
        createdAt: true,
        bets: {
          select: {
            id: true,
            market: true,
            pick: true,
            ev: true,
            oddsSnapshot: true,
            comboMarket: true,
            comboPick: true,
            status: true,
            modelRun: {
              select: {
                fixture: {
                  select: {
                    scheduledAt: true,
                    homeTeam: { select: { name: true } },
                    awayTeam: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async updateStatus(couponId: string, status: CouponStatus): Promise<void> {
    await this.prisma.client.dailyCoupon.update({
      where: { id: couponId },
      data: { status },
    });
  }
}
