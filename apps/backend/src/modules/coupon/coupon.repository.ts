import { Injectable } from '@nestjs/common';
import { BetStatus, CouponStatus, Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const couponBetSelect = {
  id: true,
  market: true,
  pick: true,
  probEstimated: true,
  ev: true,
  oddsSnapshot: true,
  comboMarket: true,
  comboPick: true,
  status: true,
  modelRun: {
    select: {
      features: true,
      fixture: {
        select: {
          id: true,
          scheduledAt: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    code: string;
    date: Date;
    status: CouponStatus;
    legCount: number;
  }): Promise<{ id: string; code: string }> {
    return this.prisma.client.dailyCoupon.create({
      data,
      select: { id: true, code: true },
    });
  }

  async linkBets(couponId: string, betIds: string[]): Promise<void> {
    if (betIds.length === 0) return;
    await this.prisma.client.couponLeg.createMany({
      data: betIds.map((betId) => ({ couponId, betId })),
      skipDuplicates: true,
    });
  }

  async createPendingCouponWithBets(input: {
    code: string;
    date: Date;
    legCount: number;
    betIds: string[];
  }): Promise<{ id: string; code: string }> {
    const { code, date, legCount, betIds } = input;

    return this.prisma.client.$transaction(async (tx) => {
      const coupon = await tx.dailyCoupon.create({
        data: {
          code,
          date,
          status: CouponStatus.PENDING,
          legCount,
        },
        select: { id: true, code: true },
      });

      if (betIds.length > 0) {
        const result = await tx.couponLeg.createMany({
          data: betIds.map((betId) => ({ couponId: coupon.id, betId })),
          skipDuplicates: true,
        });

        if (result.count !== betIds.length) {
          throw new Error(
            `Failed linking coupon bets atomically: expected ${betIds.length}, linked ${result.count}`,
          );
        }
      }

      return coupon;
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

  async findCouponsForDate(
    date: Date,
  ): Promise<{ id: string; status: CouponStatus; betIds: string[] }[]> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const coupons = await this.prisma.client.dailyCoupon.findMany({
      where: { date: { gte: start, lte: end } },
      select: {
        id: true,
        status: true,
        couponLegs: { select: { betId: true } },
      },
    });

    return coupons.map((c) => ({
      id: c.id,
      status: c.status,
      betIds: c.couponLegs.map((l) => l.betId).sort(),
    }));
  }

  async findPendingCouponsUntil(date: Date): Promise<
    {
      id: string;
      status: CouponStatus;
      bets: { id: string; status: BetStatus }[];
    }[]
  > {
    const coupons = await this.prisma.client.dailyCoupon.findMany({
      where: {
        status: CouponStatus.PENDING,
        date: { lte: date },
      },
      select: {
        id: true,
        status: true,
        couponLegs: {
          select: { bet: { select: { id: true, status: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    return coupons.map((coupon) => ({
      id: coupon.id,
      status: coupon.status,
      bets: coupon.couponLegs.map((leg) => leg.bet),
    }));
  }

  async findPendingCouponsByFixture(fixtureId: string): Promise<
    {
      id: string;
      status: CouponStatus;
      bets: { id: string; status: BetStatus }[];
    }[]
  > {
    const coupons = await this.prisma.client.dailyCoupon.findMany({
      where: {
        status: CouponStatus.PENDING,
        couponLegs: { some: { bet: { fixtureId } } },
      },
      select: {
        id: true,
        status: true,
        couponLegs: {
          select: { bet: { select: { id: true, status: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    return coupons.map((coupon) => ({
      id: coupon.id,
      status: coupon.status,
      bets: coupon.couponLegs.map((leg) => leg.bet),
    }));
  }

  async findCouponById(couponId: string): Promise<{
    id: string;
    date: Date;
    status: CouponStatus;
    legCount: number;
    createdAt: Date;
    bets: {
      id: string;
      market: string;
      pick: string;
      probEstimated: unknown;
      ev: unknown;
      oddsSnapshot: unknown;
      comboMarket: string | null;
      comboPick: string | null;
      status: BetStatus;
      modelRun: {
        features: unknown;
        fixture: {
          scheduledAt: Date;
          homeTeam: { name: string };
          awayTeam: { name: string };
        };
      };
    }[];
  } | null> {
    const coupon = await this.prisma.client.dailyCoupon.findUnique({
      where: { id: couponId },
      select: {
        id: true,
        date: true,
        status: true,
        legCount: true,
        createdAt: true,
        couponLegs: {
          select: {
            bet: {
              select: couponBetSelect,
            },
          },
        },
      },
    });

    if (!coupon) return null;

    return {
      id: coupon.id,
      date: coupon.date,
      status: coupon.status,
      legCount: coupon.legCount,
      createdAt: coupon.createdAt,
      bets: coupon.couponLegs.map((leg) => leg.bet),
    };
  }

  async updateStatus(couponId: string, status: CouponStatus): Promise<void> {
    await this.prisma.client.dailyCoupon.update({
      where: { id: couponId },
      data: { status },
    });
  }

  async findCouponsByDateRange(input: {
    from: Date;
    to: Date;
    query?: string;
    status?: 'PENDING' | 'WON' | 'LOST';
    limit?: number;
  }): Promise<
    {
      id: string;
      code: string;
      date: Date;
      status: CouponStatus;
      bets: {
        id: string;
        market: string;
        pick: string;
        comboMarket: string | null;
        comboPick: string | null;
        probEstimated: unknown;
        oddsSnapshot: unknown;
        ev: unknown;
        status: BetStatus;
        modelRun: {
          features: unknown;
          fixture: {
            id: string;
            scheduledAt: Date;
            homeTeam: { name: string };
            awayTeam: { name: string };
          };
        };
      }[];
    }[]
  > {
    const { from, to, query, status, limit = 200 } = input;
    const trimmedQuery = query?.trim();

    const where: Prisma.DailyCouponWhereInput = {
      date: { gte: from, lte: to },
      couponLegs: { some: {} },
    };

    if (status === 'WON' || status === 'LOST') {
      where.status = status;
    } else if (status === 'PENDING') {
      where.status = { notIn: ['WON', 'LOST'] };
    }

    if (trimmedQuery) {
      where.OR = [
        {
          code: {
            contains: trimmedQuery,
            mode: 'insensitive',
          },
        },
        {
          couponLegs: {
            some: {
              bet: {
                OR: [
                  {
                    pick: {
                      contains: trimmedQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    comboPick: {
                      contains: trimmedQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    modelRun: {
                      fixture: {
                        OR: [
                          {
                            homeTeam: {
                              name: {
                                contains: trimmedQuery,
                                mode: 'insensitive',
                              },
                            },
                          },
                          {
                            awayTeam: {
                              name: {
                                contains: trimmedQuery,
                                mode: 'insensitive',
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ];
    }

    const coupons = await this.prisma.client.dailyCoupon.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        code: true,
        date: true,
        status: true,
        couponLegs: {
          select: {
            bet: {
              select: couponBetSelect,
            },
          },
        },
      },
    });

    return coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      date: coupon.date,
      status: coupon.status,
      bets: coupon.couponLegs.map((leg) => leg.bet),
    }));
  }
}
