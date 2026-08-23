import { Injectable } from '@nestjs/common';
import {
  BetSource,
  BetStatus,
  CouponProposalStatus,
  CouponResult,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { startOfUtcDay } from '@utils/date.utils';

const FIXTURE_SELECT = {
  id: true,
  scheduledAt: true,
  homeTeam: { select: { name: true, logoUrl: true } },
  awayTeam: { select: { name: true, logoUrl: true } },
  season: { select: { competition: { select: { name: true, code: true } } } },
} as const;

export type SummaryBetRow = {
  id: string;
  market: string;
  pick: string;
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
    canal: StrategyChannel;
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
          select: {
            id: true;
            scheduledAt: true;
            homeTeam: { select: { name: true; logoUrl: true } };
            awayTeam: { select: { name: true; logoUrl: true } };
            homeScore: true;
            awayScore: true;
            homeHtScore: true;
            awayHtScore: true;
            season: {
              select: {
                competition: {
                  select: { code: true; name: true; country: true };
                };
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
        select: {
          id: true,
          scheduledAt: true,
          homeTeam: { select: { name: true, logoUrl: true } },
          awayTeam: { select: { name: true, logoUrl: true } },
          homeScore: true,
          awayScore: true,
          homeHtScore: true,
          awayHtScore: true,
          season: {
            select: {
              competition: {
                select: { code: true, name: true, country: true },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class CouponRepository {
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
      canal: leg.canal,
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

  // `forDate` equality — the coupon's own generation date, not an overlap
  // window. A prior version matched any batch whose [forDate,
  // lastFixtureScheduledAt] window overlapped the requested day, so a
  // multi-day weekend/midweek LONGSHOT batch (forDate = the Friday it was
  // generated) stayed visible on Saturday/Sunday too — but that meant one
  // viewed day could surface TWO independently-ranked batches at once (each
  // showing its own "rank 1"), with no way to tell them apart in the UI
  // (2026-08-19 incident). Pinning to `forDate` removes the ambiguity: one
  // day shows exactly the batch generated that day, full stop.
  async findByDate(
    day: Date,
    status?: CouponProposalStatus,
  ): Promise<CouponProposalWithLegs[]> {
    const dayStart = startOfUtcDay(day);
    return this.prisma.client.couponProposal.findMany({
      where: {
        forDate: dayStart,
        ...(status ? { status } : {}),
      },
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

  /** All proposal ids in a `forDate` range, regardless of status — used to force
   * re-settlement of already-EXPIRED proposals (e.g. after fixing a settlement bug). */
  async findIdsInRange(from: Date, to: Date): Promise<string[]> {
    const proposals = await this.prisma.client.couponProposal.findMany({
      where: { forDate: { gte: from, lte: to } },
      select: { id: true },
    });
    return proposals.map((p) => p.id);
  }

  // Scoped to the profile about to be regenerated (targetOddsMin/Max, same
  // fields as the upsert unique key) — NOT every pending proposal for the
  // date. Generating a second profile for the same date (e.g. LONGSHOT after
  // the default) must never wipe out the first profile's freshly-created
  // PENDING proposals, which a date-only delete would do.
  async deletePendingForDate(
    forDate: Date,
    targetOddsMin: number,
    targetOddsMax: number,
  ): Promise<void> {
    const pending = await this.prisma.client.couponProposal.findMany({
      where: {
        forDate,
        status: CouponProposalStatus.PENDING,
        targetOddsMin: new Prisma.Decimal(targetOddsMin),
        targetOddsMax: new Prisma.Decimal(targetOddsMax),
      },
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

  /**
   * Dev/backtest only — wipes EXPIRED proposals (and their legs) in a
   * `forDate` range, never ACCEPTED/REJECTED/PENDING. Needed because
   * `upsertProposal` deliberately bails out on any non-PENDING status
   * (including EXPIRED) to protect human decisions — but that same guard
   * silently no-ops a backtest re-run against a date range that was already
   * settled by a PRIOR run: `generateCoupons` would compute fresh legs under
   * updated code, find an EXPIRED row already sitting at that (forDate,
   * signalWindowDays, targetOddsMin, targetOddsMax, rank) key, and discard
   * the fresh computation entirely, leaving the OLD legs in place forever
   * (found 2026-08-20: several backtest iterations this session re-measured
   * the exact same frozen dataset from one early run instead of the current
   * code). Call this BEFORE regenerating a range that was previously
   * regenerated+settled, so `upsertProposal` sees no `existing` row and
   * actually persists the new computation.
   */
  async deleteExpiredInRange(from: Date, to: Date): Promise<number> {
    const expired = await this.prisma.client.couponProposal.findMany({
      where: {
        forDate: { gte: from, lte: to },
        status: CouponProposalStatus.EXPIRED,
      },
      select: { id: true },
    });
    if (expired.length === 0) return 0;
    const ids = expired.map((p) => p.id);
    await this.prisma.client.couponProposalLeg.deleteMany({
      where: { couponProposalId: { in: ids } },
    });
    await this.prisma.client.couponProposal.deleteMany({
      where: { id: { in: ids } },
    });
    return ids.length;
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
        // VOID reste exclu (aucun gain, aucune perte) ; PARTIAL est inclus —
        // son ROI se calcule sur `realizedOdds`, pas `combinedOdds` (voir
        // CouponSettlementService).
        result: {
          in: [CouponResult.WON, CouponResult.LOST, CouponResult.PARTIAL],
        },
        forDate: { gte: from, lte: to },
      },
      include: WITH_LEGS,
      orderBy: [{ forDate: 'asc' }, { rank: 'asc' }],
    }) as unknown as Promise<CouponProposalWithLegs[]>;
  }

  async findSettledBetsForIndices(opts: {
    channel: StrategyChannel;
    from: Date;
    to: Date;
  }): Promise<
    {
      probEstimated: Prisma.Decimal;
      status: string;
      market: string;
      oddsSnapshot: Prisma.Decimal | null;
    }[]
  > {
    const { channel, from, to } = opts;
    return this.prisma.client.bet.findMany({
      where: {
        channelSelection: {
          is: { channelDecision: { is: { channel } } },
        },
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

  async findResolvedCouponsForIndices(
    from: Date,
    to: Date,
  ): Promise<
    {
      jointProbability: Prisma.Decimal;
      result: CouponResult;
      combinedOdds: Prisma.Decimal;
      realizedOdds: Prisma.Decimal | null;
    }[]
  > {
    return this.prisma.client.couponProposal.findMany({
      where: {
        result: {
          in: [CouponResult.WON, CouponResult.LOST, CouponResult.PARTIAL],
        },
        forDate: { gte: from, lte: to },
      },
      select: {
        jointProbability: true,
        result: true,
        combinedOdds: true,
        realizedOdds: true,
      },
    }) as unknown as Promise<
      {
        jointProbability: Prisma.Decimal;
        result: CouponResult;
        combinedOdds: Prisma.Decimal;
        realizedOdds: Prisma.Decimal | null;
      }[]
    >;
  }

  /**
   * Settled channel selections in a date window — the source for the rolling
   * ROI-by-channel × EV-bin promotion view. Reads every channel (incl.
   * DRAW/BTTS/DOMINANT) straight from `channel_selection`; no `Bet` needed.
   */
  async findSettledChannelSelections(opts: { from: Date; to: Date }): Promise<
    {
      channel: StrategyChannel;
      ev: Prisma.Decimal | null;
      odds: Prisma.Decimal | null;
      result: BetStatus;
    }[]
  > {
    const { from, to } = opts;
    const rows = await this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        odds: { not: null },
        channelDecision: {
          is: {
            modelRun: {
              is: { fixture: { is: { scheduledAt: { gte: from, lte: to } } } },
            },
          },
        },
      },
      select: {
        ev: true,
        odds: true,
        result: true,
        channelDecision: { select: { channel: true } },
      },
    });
    return rows.map((r) => ({
      channel: r.channelDecision.channel,
      ev: r.ev,
      odds: r.odds,
      result: r.result as BetStatus,
    }));
  }

  async updateResult(
    id: string,
    result: CouponResult,
    realizedOdds?: number,
  ): Promise<void> {
    await this.prisma.client.couponProposal.update({
      where: { id },
      data: {
        result,
        status: CouponProposalStatus.EXPIRED,
        ...(realizedOdds !== undefined
          ? { realizedOdds: new Prisma.Decimal(realizedOdds) }
          : {}),
      },
    });
  }

  // `isCorrect: null` marks a voided leg (postponed/cancelled fixture) —
  // distinct from "not yet settled" (isCorrect null AND settledAt null).
  async settleLeg(legId: string, isCorrect: boolean | null): Promise<void> {
    await this.prisma.client.couponProposalLeg.update({
      where: { id: legId },
      data: { isCorrect, settledAt: new Date() },
    });
  }

  findSettledBetsForSummary(opts: {
    channel: StrategyChannel;
    from: Date;
    to: Date;
  }): Promise<SummaryBetRow[]> {
    const { channel, from, to } = opts;
    return this.prisma.client.bet.findMany({
      where: {
        channelSelection: {
          is: { channelDecision: { is: { channel } } },
        },
        source: BetSource.MODEL,
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        fixture: { scheduledAt: { gte: from, lte: to } },
      },
      select: {
        id: true,
        market: true,
        pick: true,
        oddsSnapshot: true,
        qualityScore: true,
        probEstimated: true,
        status: true,
        fixture: { select: FIXTURE_SELECT },
      },
      orderBy: { fixture: { scheduledAt: 'asc' } },
    }) as unknown as Promise<SummaryBetRow[]>;
  }
}
