import { Injectable } from '@nestjs/common';
import {
  BetSource,
  BetStatus,
  CouponProposalStatus,
  CouponResult,
  CouponSource,
  type Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import { UNIFIED_COUPON_CLASS } from '@evcore/analysis-core';
import {
  PRICE_COMPOSER_POLICY,
  PRICE_COMPOSER_SIGNAL_WINDOW_DAYS,
} from './coupon.constants';
import { PrismaService } from '@/prisma.service';
import { startOfUtcDay } from '@utils/date.utils';

/**
 * Découpage des cotes en tranches, partagé par la calibration et le vivier.
 *
 * Une seule définition : deux expressions séparées finiraient par diverger, et
 * le compositeur appliquerait alors à une jambe le coût d'une autre tranche.
 * Les bornes suivent les paliers mesurés sur la calibration des jambes —
 * ratio 0,899 sous 1,45, 0,836 entre 1,45 et 1,80, 0,619 au-delà.
 */
const ODDS_BAND_SQL = `CASE
  WHEN odds < 1.3 THEN '<1.3'
  WHEN odds < 1.45 THEN '1.3-1.45'
  WHEN odds < 1.6 THEN '1.45-1.6'
  WHEN odds < 1.8 THEN '1.6-1.8'
  WHEN odds < 2.5 THEN '1.8-2.5'
  ELSE '2.5+'
END`;

export type MarketCostCell = {
  market: string;
  band: string;
  legCount: number;
  meanPayout: number;
  payoutVariance: number;
};

export type PriceCandidateRow = {
  fixtureId: string;
  competition: string;
  market: string;
  pick: string;
  odds: number;
  band: string;
  scheduledAt: Date;
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
            // Legacy fallback only. New proposals read the exact modelRunId
            // captured inside CouponProposalLeg.featureSnapshot.
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

  /**
   * Coût mesuré de chaque cellule (marché × tranche de cote).
   *
   * Lit `evaluated_pick`, qui règle contre le score tout ce que le moteur a
   * envisagé — retenus comme rejetés. Le vivier du compositeur sort de la même
   * vue : calibrer sur un espace et composer dans un autre donnerait des coûts
   * qui ne s'appliquent à rien.
   *
   * `won IS NULL` couvre deux cas — rencontre non jouée et remboursement — d'où
   * le filtre sur le statut plutôt que sur `won` seul : un Draw No Bet remboursé
   * est une observation réglée qui rapporte exactement la mise.
   */
  async findMarketCostCalibration(
    before: Date,
  ): Promise<readonly MarketCostCell[]> {
    return this.prisma.client.$queryRaw<MarketCostCell[]>`
      WITH settled AS (
        SELECT market,
               ${Prisma.raw(ODDS_BAND_SQL)} AS band,
               CASE WHEN won IS NULL THEN 1 WHEN won THEN odds ELSE 0 END AS payout
        FROM public.evaluated_pick
        WHERE "fixtureStatus" = 'FINISHED'
          AND "scheduledAt" < ${before}
      )
      SELECT market,
             band,
             count(*)::int              AS "legCount",
             avg(payout)::float         AS "meanPayout",
             coalesce(var_pop(payout), 0)::float AS "payoutVariance"
      FROM settled
      GROUP BY market, band
    `;
  }

  /**
   * Écrit la proposition du compositeur et ses jambes en une transaction.
   *
   * `source` fait partie de la clé unique : l'upsert ne peut donc jamais
   * écraser la proposition du LLM du même jour sur la même cible.
   */
  async upsertPriceComposerProposal(input: {
    forDate: Date;
    combinedOdds: number;
    expectedReturn: number;
    lastFixtureScheduledAt: Date;
    legs: readonly {
      fixtureId: string;
      market: Market;
      pick: string;
      odds: number;
      expectedReturn: number;
    }[];
  }): Promise<string> {
    const key = {
      forDate: startOfUtcDay(input.forDate),
      source: CouponSource.PRICE_COMPOSER,
      signalWindowDays: PRICE_COMPOSER_SIGNAL_WINDOW_DAYS,
      targetOddsMin: new Prisma.Decimal(UNIFIED_COUPON_CLASS.targetOddsMin),
      targetOddsMax: new Prisma.Decimal(UNIFIED_COUPON_CLASS.targetOddsMax),
      rank: 1,
    };
    // Probabilité de gain implicite du coupon : retour attendu rapporté à la
    // cote. C'est une estimation issue du PRIX, jamais du moteur — la colonne
    // s'appelle `jointProbability` pour des raisons historiques.
    const jointProbability = Math.min(
      input.expectedReturn / input.combinedOdds,
      0.9999,
    );
    const data = {
      combinedOdds: new Prisma.Decimal(input.combinedOdds),
      jointProbability: new Prisma.Decimal(jointProbability.toFixed(4)),
      // `signalScore` est un vestige retiré du scoring en 2026-08-22 pour
      // anti-prédictivité : le compositeur n'en produit aucun.
      signalScore: new Prisma.Decimal(0),
      lastFixtureScheduledAt: input.lastFixtureScheduledAt,
      reasoning: {
        policyVersion: PRICE_COMPOSER_POLICY.version,
        expectedReturn: input.expectedReturn,
        legs: input.legs.map((leg) => ({
          market: leg.market,
          pick: leg.pick,
          odds: leg.odds,
          expectedReturn: leg.expectedReturn,
        })),
      } satisfies Prisma.InputJsonValue,
    };

    const proposal = await this.prisma.client.couponProposal.upsert({
      where: {
        forDate_source_signalWindowDays_targetOddsMin_targetOddsMax_rank: key,
      },
      create: {
        ...key,
        ...data,
        legs: {
          create: input.legs.map((leg) => ({
            fixtureId: leg.fixtureId,
            canal: StrategyChannel.PRICE,
            market: leg.market,
            pick: leg.pick,
            probability: new Prisma.Decimal(
              Math.min(leg.expectedReturn / leg.odds, 0.9999).toFixed(4),
            ),
            oddsSnapshot: new Prisma.Decimal(leg.odds),
            signalScore: new Prisma.Decimal(0),
            featureSnapshot: { expectedReturn: leg.expectedReturn },
          })),
        },
      },
      // Une proposition déjà réglée ou décidée n'est jamais réécrite.
      update: {},
      select: { id: true },
    });
    return proposal.id;
  }

  async recordPriceComposerAttempt(input: {
    forDate: Date;
    outcome: string;
    candidateCount: number;
    reason?: string;
    proposalId?: string;
  }): Promise<void> {
    await this.prisma.client.couponGenerationAttempt.create({
      data: {
        forDate: startOfUtcDay(input.forDate),
        policyVersion: PRICE_COMPOSER_POLICY.version,
        pass: 'price-composer',
        outcome: input.outcome,
        candidateCount: input.candidateCount,
        reason: input.reason ?? null,
        proposalId: input.proposalId ?? null,
      },
    });
  }

  /**
   * Vivier du jour : tout ce qui est coté sur des rencontres pas encore jouées.
   *
   * Le coup d'envoi est comparé à `now` et non à la date seule — un vivier qui
   * garde les rencontres déjà commencées propose des paris impossibles à poser.
   */
  async findPriceCandidates(opts: {
    from: Date;
    to: Date;
  }): Promise<readonly PriceCandidateRow[]> {
    return this.prisma.client.$queryRaw<PriceCandidateRow[]>`
      SELECT "fixtureId",
             competition,
             market,
             pick,
             odds::float                AS odds,
             ${Prisma.raw(ODDS_BAND_SQL)} AS band,
             "scheduledAt"
      FROM public.evaluated_pick
      WHERE "fixtureStatus" NOT IN ('FINISHED', 'POSTPONED', 'CANCELLED')
        AND "scheduledAt" >= ${opts.from}
        AND "scheduledAt" < ${opts.to}
    `;
  }
}
