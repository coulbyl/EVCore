import { Injectable } from '@nestjs/common';
import { StrategyChannel, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type SettledEvSelectionRow = {
  market: string;
  result: 'WON' | 'LOST';
  probability: Prisma.Decimal;
  odds: Prisma.Decimal | null;
  createdAt: Date;
  channelDecision: { modelRun: { features: Prisma.JsonValue } };
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

  // Settled single EV-channel selections with odds, in the window, joined to
  // the ModelRun features (which carry shadow_ml_corrected_p).
  async findSettledEvSelections(from: Date): Promise<SettledEvSelectionRow[]> {
    return this.prisma.client.channelSelection.findMany({
      where: {
        comboMarket: null,
        result: { in: ['WON', 'LOST'] },
        odds: { not: null },
        createdAt: { gte: from },
        channelDecision: { channel: StrategyChannel.VALUE },
      },
      select: {
        market: true,
        result: true,
        probability: true,
        odds: true,
        createdAt: true,
        channelDecision: {
          select: { modelRun: { select: { features: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<SettledEvSelectionRow[]>;
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
