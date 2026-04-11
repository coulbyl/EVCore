import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class BetSlipRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserBetSlips(userId: string) {
    return this.prisma.client.betSlip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            bet: {
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                oddsSnapshot: true,
              },
            },
            fixture: {
              select: {
                id: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  findUserBetSlipById(userId: string, betSlipId: string) {
    return this.prisma.client.betSlip.findFirst({
      where: { id: betSlipId, userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            bet: {
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                oddsSnapshot: true,
              },
            },
            fixture: {
              select: {
                id: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }
}
