import { Injectable } from '@nestjs/common';
import {
  BetSource,
  BetStatus,
  CouponProposalStatus,
  CouponResult,
  Market,
  Prisma,
  PredictionChannel,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const FIXTURE_SELECT = {
  id: true,
  scheduledAt: true,
  homeTeam: { select: { name: true, logoUrl: true } },
  awayTeam: { select: { name: true, logoUrl: true } },
  season: { select: { competition: { select: { name: true, code: true } } } },
} as const;

export type InvestmentSummaryBetRow = {
  id: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  oddsSnapshot: Prisma.Decimal | null;
  qualityScore: Prisma.Decimal | null;
  probEstimated: Prisma.Decimal;
  status: string;
  fixture: {
    id: string;
    scheduledAt: Date;
    homeTeam: { name: string; logoUrl: string | null };
    awayTeam: { name: string; logoUrl: string | null };
    season: { competition: { name: string; code: string } };
  };
};

export type InvestmentSummaryPredictionRow = {
  id: string;
  channel: string;
  market: string;
  pick: string;
  probability: Prisma.Decimal;
  correct: boolean | null;
  fixture: {
    id: string;
    scheduledAt: Date;
    homeTeam: { name: string; logoUrl: string | null };
    awayTeam: { name: string; logoUrl: string | null };
    season: { competition: { name: string; code: string } };
    oddsSnapshots: Array<{
      homeOdds: Prisma.Decimal | null;
      drawOdds: Prisma.Decimal | null;
      awayOdds: Prisma.Decimal | null;
      pick: string | null;
      odds: Prisma.Decimal | null;
    }>;
  };
};

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
            season: {
              select: {
                competition: { select: { code: true; country: true } };
              };
            };
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
          season: {
            select: { competition: { select: { code: true, country: true } } },
          },
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

  async findResolvedCouponsInRange(
    from: Date,
    to: Date,
  ): Promise<CouponProposalWithLegs[]> {
    return this.prisma.client.couponProposal.findMany({
      where: {
        result: { in: [CouponResult.WON, CouponResult.LOST] },
        forDate: { gte: from, lte: to },
      },
      include: WITH_LEGS,
      orderBy: [{ forDate: 'asc' }, { rank: 'asc' }],
    }) as unknown as Promise<CouponProposalWithLegs[]>;
  }

  async findSettledBetsForIndices(
    isSafeValue: boolean,
    from: Date,
    to: Date,
  ): Promise<
    {
      probEstimated: Prisma.Decimal;
      status: string;
      market: string;
      oddsSnapshot: Prisma.Decimal | null;
    }[]
  > {
    return this.prisma.client.bet.findMany({
      where: {
        isSafeValue,
        source: BetSource.MODEL,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        fixture: { scheduledAt: { gte: from, lte: to } },
      },
      select: {
        probEstimated: true,
        status: true,
        market: true,
        oddsSnapshot: true,
      },
    });
  }

  async findSettledPredictionsForIndices(opts: {
    channel: PredictionChannel;
    oddsMarket: Market;
    from: Date;
    to: Date;
  }): Promise<
    {
      probability: Prisma.Decimal;
      correct: boolean | null;
      market: string;
      pick: string;
      fixture: {
        oddsSnapshots: {
          homeOdds: Prisma.Decimal | null;
          drawOdds: Prisma.Decimal | null;
          awayOdds: Prisma.Decimal | null;
          pick: string | null;
          odds: Prisma.Decimal | null;
        }[];
      };
    }[]
  > {
    const { channel, oddsMarket, from, to } = opts;
    return this.prisma.client.prediction.findMany({
      where: {
        channel,
        correct: { not: null },
        fixture: { scheduledAt: { gte: from, lte: to } },
      },
      select: {
        probability: true,
        correct: true,
        market: true,
        pick: true,
        fixture: {
          select: {
            oddsSnapshots: {
              where: { market: oddsMarket },
              orderBy: { snapshotAt: 'desc' },
              take: 1,
              select: {
                homeOdds: true,
                drawOdds: true,
                awayOdds: true,
                pick: true,
                odds: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<any>;
  }

  async findResolvedCouponsForIndices(
    from: Date,
    to: Date,
  ): Promise<
    {
      jointProbability: Prisma.Decimal;
      result: CouponResult;
      combinedOdds: Prisma.Decimal;
    }[]
  > {
    return this.prisma.client.couponProposal.findMany({
      where: {
        result: { in: [CouponResult.WON, CouponResult.LOST] },
        forDate: { gte: from, lte: to },
      },
      select: { jointProbability: true, result: true, combinedOdds: true },
    }) as unknown as Promise<
      {
        jointProbability: Prisma.Decimal;
        result: CouponResult;
        combinedOdds: Prisma.Decimal;
      }[]
    >;
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

  findSettledBetsForInvestmentSummary(
    isSafeValue: boolean,
    from: Date,
    to: Date,
  ): Promise<InvestmentSummaryBetRow[]> {
    return this.prisma.client.bet.findMany({
      where: {
        isSafeValue,
        source: BetSource.MODEL,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        fixture: { scheduledAt: { gte: from, lte: to } },
      },
      select: {
        id: true,
        market: true,
        pick: true,
        comboMarket: true,
        comboPick: true,
        oddsSnapshot: true,
        qualityScore: true,
        probEstimated: true,
        status: true,
        fixture: { select: FIXTURE_SELECT },
      },
      orderBy: { fixture: { scheduledAt: 'asc' } },
    }) as unknown as Promise<InvestmentSummaryBetRow[]>;
  }

  // eslint-disable-next-line max-params
  findSettledPredictionsForInvestmentSummary(
    channel: PredictionChannel,
    oddsMarket: Market,
    from: Date,
    to: Date,
  ): Promise<InvestmentSummaryPredictionRow[]> {
    return this.prisma.client.prediction.findMany({
      where: {
        channel,
        correct: { not: null },
        fixture: { scheduledAt: { gte: from, lte: to } },
      },
      select: {
        id: true,
        channel: true,
        market: true,
        pick: true,
        probability: true,
        correct: true,
        fixture: {
          select: {
            ...FIXTURE_SELECT,
            oddsSnapshots: {
              where: { market: oddsMarket },
              orderBy: { snapshotAt: 'desc' },
              select: {
                homeOdds: true,
                drawOdds: true,
                awayOdds: true,
                pick: true,
                odds: true,
              },
            },
          },
        },
      },
      orderBy: { fixture: { scheduledAt: 'asc' } },
    }) as unknown as Promise<InvestmentSummaryPredictionRow[]>;
  }
}
