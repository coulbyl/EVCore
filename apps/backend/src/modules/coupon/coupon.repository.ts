import { Injectable } from '@nestjs/common';
import { CouponStatus } from '@evcore/db';
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

  findByDate(date: Date): Promise<{ id: string; status: CouponStatus } | null> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return this.prisma.client.dailyCoupon.findFirst({
      where: { date: { gte: start, lte: end } },
      select: { id: true, status: true },
    });
  }
}
