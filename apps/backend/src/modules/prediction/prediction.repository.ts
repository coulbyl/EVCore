import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { Prisma } from '@evcore/db';

export type PredictionCreateInput = {
  fixtureId: string;
  modelRunId: string;
  competition: string;
  pick: string;
  probability: Prisma.Decimal;
};

export type PredictionRow = {
  id: string;
  fixtureId: string;
  modelRunId: string;
  competition: string;
  market: string;
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
      where: { fixtureId: input.fixtureId },
      create: {
        fixtureId: input.fixtureId,
        modelRunId: input.modelRunId,
        competition: input.competition,
        pick: input.pick,
        probability: input.probability,
      },
      update: {
        modelRunId: input.modelRunId,
        pick: input.pick,
        probability: input.probability,
      },
    });
  }

  async settlePending(fixtureId: string, correct: boolean): Promise<number> {
    const result = await this.prisma.client.prediction.updateMany({
      where: { fixtureId, correct: null },
      data: { correct, settledAt: new Date() },
    });
    return result.count;
  }

  findByDate(
    date: { gte: Date; lte: Date },
    competition?: string,
  ): Promise<PredictionRow[]> {
    const where: Prisma.PredictionWhereInput = {
      createdAt: date,
      ...(competition ? { competition } : {}),
    };
    return this.prisma.client.prediction.findMany({
      where,
      orderBy: [{ competition: 'asc' }, { createdAt: 'asc' }],
    }) as Promise<PredictionRow[]>;
  }

  findForStats(
    from: Date,
    to: Date,
    competition?: string,
  ): Promise<{ competition: string; correct: boolean | null }[]> {
    const where: Prisma.PredictionWhereInput = {
      createdAt: { gte: from, lte: to },
      correct: { not: null },
      ...(competition ? { competition } : {}),
    };
    return this.prisma.client.prediction.findMany({
      where,
      select: { competition: true, correct: true },
    }) as Promise<{ competition: string; correct: boolean | null }[]>;
  }

  findForFixture(fixtureId: string): Promise<PredictionRow | null> {
    return this.prisma.client.prediction.findUnique({
      where: { fixtureId },
    }) as Promise<PredictionRow | null>;
  }
}
