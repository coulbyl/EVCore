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
            // Latest ModelRun only — same "most recent run is the source of
            // truth" convention as build-match-context.ts/find-eligible-
            // fixtures.ts. Needed so the frontend "Jouer ce coupon" button
            // can submit each leg to POST /bet-slips as a USER pick
            // (modelRunId + market + pick, resolved server-side against
            // that run's evaluatedPicks) — the same shape a coupon leg's
            // pool candidate was itself resolved from at generation time.
            modelRuns: {
              orderBy: { analyzedAt: 'desc' };
              take: 1;
              select: { id: true };
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
          modelRuns: {
            orderBy: { analyzedAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  },
} as const;

// Adds real, verifiable engagement counts (CouponProposalView/
// CouponProposalPlacement — never a fabricated number, see their own doc
// comments in schema.prisma) on top of WITH_LEGS — only for the listing
// used by the Coupons page (findByDate), not settlement's findByIdWithLegs,
// which has no per-viewer concept.
function withEngagement(userId: string) {
  return {
    ...WITH_LEGS,
    _count: { select: { views: true, placements: true } },
    // Only the CURRENT user's own placement (0 or 1 row, unique per
    // [couponProposalId, userId]) — drives "Déjà joué par vous"; the total
    // player count comes from _count.placements above instead.
    placements: {
      where: { userId },
      select: { id: true },
      take: 1,
    },
  } satisfies Prisma.CouponProposalInclude;
}

export type CouponProposalWithEngagement = Prisma.CouponProposalGetPayload<{
  include: ReturnType<typeof withEngagement>;
}>;

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  // upsertProposal (CouponComposerService's write path) retired 2026-09-03
  // alongside the composer itself — apps/vantage-worker's
  // persist-coupon-proposal.ts now writes CouponProposal/CouponProposalLeg
  // directly via @evcore/db, same unique key and PENDING-only overwrite
  // guard preserved there. This repository is read/settlement-only now.

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
    userId: string,
    status?: CouponProposalStatus,
  ): Promise<CouponProposalWithEngagement[]> {
    const dayStart = startOfUtcDay(day);
    return this.prisma.client.couponProposal.findMany({
      where: {
        forDate: dayStart,
        ...(status ? { status } : {}),
      },
      include: withEngagement(userId),
      orderBy: { rank: 'asc' },
    });
  }

  async exists(id: string): Promise<boolean> {
    const coupon = await this.prisma.client.couponProposal.findUnique({
      where: { id },
      select: { id: true },
    });
    return coupon !== null;
  }

  /** Idempotent — a repeat view from the same user is a no-op, never a
   * second row (unique on [couponProposalId, userId]). */
  async recordView(couponProposalId: string, userId: string): Promise<void> {
    await this.prisma.client.couponProposalView.upsert({
      where: { couponProposalId_userId: { couponProposalId, userId } },
      create: { couponProposalId, userId },
      update: {},
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

  // deletePendingForDate/deleteExpiredInRange (upsertProposal's own
  // pre-regeneration cleanup, and the dev-only regenerate-coupons.ts
  // backtest script's cleanup) retired alongside upsertProposal and that
  // script — both were single-caller helpers for the retired write path.

  async findByIdWithLegs(id: string): Promise<CouponProposalWithLegs | null> {
    return this.prisma.client.couponProposal.findUnique({
      where: { id },
      include: WITH_LEGS,
    });
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
}
