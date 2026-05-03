import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { Market, Prisma, PredictionChannel } from '@evcore/db';

export type PredictionCreateInput = {
  fixtureId: string;
  modelRunId: string;
  competition: string;
  channel: PredictionChannel;
  market: Market;
  pick: string;
  probability: Prisma.Decimal;
};

export type PredictionRow = {
  id: string;
  fixtureId: string;
  modelRunId: string;
  competition: string;
  channel: PredictionChannel;
  market: Market;
  pick: string;
  probability: Prisma.Decimal;
  correct: boolean | null;
  settledAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class PredictionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: PredictionCreateInput): Promise<void> {
    await this.prisma.client.prediction.upsert({
      where: {
        fixtureId_channel: {
          fixtureId: input.fixtureId,
          channel: input.channel,
        },
      },
      create: {
        fixtureId: input.fixtureId,
        modelRunId: input.modelRunId,
        competition: input.competition,
        channel: input.channel,
        market: input.market,
        pick: input.pick,
        probability: input.probability,
      },
      update: {
        modelRunId: input.modelRunId,
        competition: input.competition,
        market: input.market,
        pick: input.pick,
        probability: input.probability,
      },
    });
  }

  async deleteForFixtureChannel(
    fixtureId: string,
    channel: PredictionChannel,
  ): Promise<void> {
    await this.prisma.client.prediction.deleteMany({
      where: { fixtureId, channel },
    });
  }

  async settleById(id: string, correct: boolean): Promise<void> {
    await this.prisma.client.prediction.update({
      where: { id },
      data: { correct, settledAt: new Date() },
    });
  }

  findByDate(
    date: { gte: Date; lte: Date },
    competition?: string,
    channel?: PredictionChannel,
  ) {
    const where: Prisma.PredictionWhereInput = {
      fixture: { scheduledAt: date },
      ...(competition ? { competition } : {}),
      ...(channel ? { channel } : {}),
    };
    return this.prisma.client.prediction.findMany({
      where,
      orderBy: [
        { channel: 'asc' },
        { competition: 'asc' },
        { fixture: { scheduledAt: 'asc' } },
      ],
      select: {
        id: true,
        fixtureId: true,
        competition: true,
        channel: true,
        market: true,
        pick: true,
        probability: true,
        correct: true,
        settledAt: true,
        createdAt: true,
        fixture: {
          select: {
            scheduledAt: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
    });
  }

  findForStats(input: {
    from: Date;
    to: Date;
    competition?: string;
    channel?: PredictionChannel;
  }): Promise<{ competition: string; correct: boolean | null }[]> {
    const { from, to, competition, channel } = input;
    const where: Prisma.PredictionWhereInput = {
      fixture: { scheduledAt: { gte: from, lte: to } },
      correct: { not: null },
      ...(competition ? { competition } : {}),
      ...(channel ? { channel } : {}),
    };
    return this.prisma.client.prediction.findMany({
      where,
      select: { competition: true, correct: true },
    }) as Promise<{ competition: string; correct: boolean | null }[]>;
  }

  findPendingForFixture(fixtureId: string): Promise<PredictionRow[]> {
    return this.prisma.client.prediction.findMany({
      where: { fixtureId, correct: null },
      orderBy: { channel: 'asc' },
    }) as Promise<PredictionRow[]>;
  }
}
