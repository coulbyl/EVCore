import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type SettledEvBetRow = {
  market: string;
  status: 'WON' | 'LOST';
  probEstimated: Prisma.Decimal;
  oddsSnapshot: Prisma.Decimal | null;
  createdAt: Date;
  modelRun: { features: Prisma.JsonValue };
};

export type ActiveModelRow = {
  id: string;
  segment: string;
  algorithm: string;
  activatedAt: Date | null;
  createdAt: Date;
  metrics: Prisma.JsonValue;
};

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Settled single EV-channel model bets with odds, in the window, joined to
  // the ModelRun features (which carry shadow_ml_corrected_p).
  async findSettledEvBets(from: Date): Promise<SettledEvBetRow[]> {
    return this.prisma.client.bet.findMany({
      where: {
        source: 'MODEL',
        isSafeValue: false,
        comboMarket: null,
        status: { in: ['WON', 'LOST'] },
        oddsSnapshot: { not: null },
        createdAt: { gte: from },
      },
      select: {
        market: true,
        status: true,
        probEstimated: true,
        oddsSnapshot: true,
        createdAt: true,
        modelRun: { select: { features: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<SettledEvBetRow[]>;
  }

  async findActiveModels(): Promise<ActiveModelRow[]> {
    return this.prisma.client.mlModelVersion.findMany({
      where: { isActive: true },
      select: {
        id: true,
        segment: true,
        algorithm: true,
        activatedAt: true,
        createdAt: true,
        metrics: true,
      },
    });
  }
}
