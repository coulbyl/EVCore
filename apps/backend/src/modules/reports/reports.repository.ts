import { Injectable } from '@nestjs/common';
import { StrategyChannel, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type SettledEvSelectionRow = {
  market: string;
  result: 'WON' | 'LOST';
  probability: Prisma.Decimal;
  odds: Prisma.Decimal | null;
  createdAt: Date;
  channelDecision: {
    channel: StrategyChannel;
    modelRun: { features: Prisma.JsonValue };
  };
};

// Channels with per-pick shadow ML correction wired at inference time
// (betting-engine.service.ts computeShadowMlByChannel) — mirrors
// ML_SHADOW_CHANNELS minus SAFE (intentionally excluded from live inference,
// see docs/ml-worker-sync.md).
export const REPORTED_CHANNELS = [
  StrategyChannel.VALUE,
  StrategyChannel.DOMINANT,
  StrategyChannel.BTTS,
  StrategyChannel.DRAW,
  StrategyChannel.GOALS,
] as const;

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

  // Settled selections (across every channel with shadow ML correction
  // wired) with odds, in the window, joined to the ModelRun features (which
  // carry shadow_ml_by_channel).
  async findSettledEvSelections(from: Date): Promise<SettledEvSelectionRow[]> {
    return this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: ['WON', 'LOST'] },
        odds: { not: null },
        createdAt: { gte: from },
        channelDecision: { channel: { in: [...REPORTED_CHANNELS] } },
      },
      select: {
        market: true,
        result: true,
        probability: true,
        odds: true,
        createdAt: true,
        channelDecision: {
          select: {
            channel: true,
            modelRun: { select: { features: true } },
          },
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
