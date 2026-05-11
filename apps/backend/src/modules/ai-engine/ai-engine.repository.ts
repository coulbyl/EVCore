import { Injectable } from '@nestjs/common';
import { CouponProposalStatus, CouponResult, Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type UpsertProposalInput = {
  forDate: Date;
  rank: number;
  signalWindowDays: number;
  targetOddsMin: number;
  targetOddsMax: number;
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  lastFixtureScheduledAt: Date;
  reasoning: Record<string, unknown>;
  legs: Array<{
    fixtureId: string;
    canal: string;
    market: string;
    pick: string;
    probability: number;
    oddsSnapshot: number | null;
    signalScore: number;
    featureSnapshot: Record<string, unknown>;
  }>;
};

export type CouponProposalWithLegs = Prisma.CouponProposalGetPayload<{
  include: {
    legs: {
      include: {
        fixture: {
          include: {
            homeTeam: { select: { name: true; logoUrl: true } };
            awayTeam: { select: { name: true; logoUrl: true } };
            season: { select: { competition: { select: { code: true } } } };
          };
        };
      };
    };
  };
}>;

const WITH_LEGS = {
  legs: {
    include: {
      fixture: {
        include: {
          homeTeam: { select: { name: true, logoUrl: true } },
          awayTeam: { select: { name: true, logoUrl: true } },
          season: { select: { competition: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

@Injectable()
export class AiEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertProposal(data: UpsertProposalInput): Promise<void> {
    const toDecimal = (n: number) => new Prisma.Decimal(n);
    const toJson = (v: unknown) => v as Prisma.InputJsonValue;

    const where = {
      forDate_signalWindowDays_targetOddsMin_targetOddsMax_rank: {
        forDate: data.forDate,
        signalWindowDays: data.signalWindowDays,
        targetOddsMin: toDecimal(data.targetOddsMin),
        targetOddsMax: toDecimal(data.targetOddsMax),
        rank: data.rank,
      },
    };

    const existing = await this.prisma.client.couponProposal.findUnique({
      where,
      select: { id: true, status: true },
    });

    if (existing && existing.status !== CouponProposalStatus.PENDING) {
      return; // preserve ACCEPTED/REJECTED/EXPIRED
    }

    const legData = data.legs.map((leg) => ({
      fixtureId: leg.fixtureId,
      canal: leg.canal as Prisma.CouponProposalLegCreateInput['canal'],
      market: leg.market as Prisma.CouponProposalLegCreateInput['market'],
      pick: leg.pick,
      probability: leg.probability,
      oddsSnapshot: leg.oddsSnapshot,
      signalScore: leg.signalScore,
      featureSnapshot: toJson(leg.featureSnapshot),
    }));

    if (existing) {
      await this.prisma.client.couponProposalLeg.deleteMany({
        where: { couponProposalId: existing.id },
      });
      await this.prisma.client.couponProposal.update({
        where: { id: existing.id },
        data: {
          combinedOdds: toDecimal(data.combinedOdds),
          jointProbability: toDecimal(data.jointProbability),
          signalScore: toDecimal(data.signalScore),
          lastFixtureScheduledAt: data.lastFixtureScheduledAt,
          reasoning: toJson(data.reasoning),
          generatedAt: new Date(),
          legs: { create: legData },
        },
      });
    } else {
      await this.prisma.client.couponProposal.create({
        data: {
          forDate: data.forDate,
          rank: data.rank,
          signalWindowDays: data.signalWindowDays,
          targetOddsMin: toDecimal(data.targetOddsMin),
          targetOddsMax: toDecimal(data.targetOddsMax),
          combinedOdds: toDecimal(data.combinedOdds),
          jointProbability: toDecimal(data.jointProbability),
          signalScore: toDecimal(data.signalScore),
          lastFixtureScheduledAt: data.lastFixtureScheduledAt,
          reasoning: toJson(data.reasoning),
          legs: { create: legData },
        },
      });
    }
  }

  async findByDate(
    forDate: Date,
    status?: CouponProposalStatus,
  ): Promise<CouponProposalWithLegs[]> {
    return this.prisma.client.couponProposal.findMany({
      where: { forDate, ...(status ? { status } : {}) },
      include: WITH_LEGS,
      orderBy: { rank: 'asc' },
    });
  }

  async findPendingReadyToSettle(
    now: Date,
  ): Promise<Array<{ id: string; lastFixtureScheduledAt: Date }>> {
    const threshold = new Date(now.getTime() - 90 * 60 * 1000);
    return this.prisma.client.couponProposal.findMany({
      where: {
        status: CouponProposalStatus.PENDING,
        lastFixtureScheduledAt: { lte: threshold },
      },
      select: { id: true, lastFixtureScheduledAt: true },
    });
  }

  async deletePendingForDate(forDate: Date): Promise<void> {
    const pending = await this.prisma.client.couponProposal.findMany({
      where: { forDate, status: CouponProposalStatus.PENDING },
      select: { id: true },
    });
    if (pending.length === 0) return;
    const ids = pending.map((p) => p.id);
    await this.prisma.client.couponProposalLeg.deleteMany({
      where: { couponProposalId: { in: ids } },
    });
    await this.prisma.client.couponProposal.deleteMany({
      where: { id: { in: ids } },
    });
  }

  async findByIdWithLegs(id: string): Promise<CouponProposalWithLegs | null> {
    return this.prisma.client.couponProposal.findUnique({
      where: { id },
      include: WITH_LEGS,
    });
  }

  async updateResult(id: string, result: CouponResult): Promise<void> {
    await this.prisma.client.couponProposal.update({
      where: { id },
      data: { result, status: CouponProposalStatus.EXPIRED },
    });
  }

  async settleLeg(legId: string, isCorrect: boolean): Promise<void> {
    await this.prisma.client.couponProposalLeg.update({
      where: { id: legId },
      data: { isCorrect, settledAt: new Date() },
    });
  }
}
