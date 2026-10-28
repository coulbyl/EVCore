import { Injectable } from '@nestjs/common';
import {
  BetSource,
  BetStatus,
  CouponProposalStatus,
  CouponResult,
  CouponSource,
  FixtureStatus,
  type Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import {
  POOL_EXCLUDED_MARKETS,
  UNIFIED_COUPON_CLASS,
} from '@evcore/analysis-core';
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
 *
 * Au-dessus de 2,5 les tranches sont FERMÉES. Une tranche ouverte « 2,5+ »
 * créditait à une jambe à cote 12 le coût moyen d'une cellule faite à 3,5,
 * alors que la queue coûte bien plus (mesuré le 2026-10-05, `evaluated_pick`
 * réglé : ONE_X_TWO 2,5–3,5 → 0,926 ; 5–7 → 0,996 ; 7+ → 0,585 sur 588
 * jambes ; OVER_UNDER 5–7 → 0,856 ; 7+ → 0,714). Le compositeur minimise le
 * coût total, donc prend le moins de jambes possible : la plus longue d'une
 * tranche ouverte gagnait à coût crédité égal.
 */
const ODDS_BAND_SQL = `CASE
  WHEN odds < 1.3 THEN '<1.3'
  WHEN odds < 1.45 THEN '1.3-1.45'
  WHEN odds < 1.6 THEN '1.45-1.6'
  WHEN odds < 1.8 THEN '1.6-1.8'
  WHEN odds < 2.5 THEN '1.8-2.5'
  WHEN odds < 3.5 THEN '2.5-3.5'
  WHEN odds < 5 THEN '3.5-5'
  WHEN odds < 7 THEN '5-7'
  ELSE '7+'
END`;

/**
 * Matchs du créneau dont la dernière analyse d'avant-match porte l'alerte de
 * cohérence modèle↔marché : « Données suspectes » sur Décisions, dont
 * l'info-bulle promet que le match est retiré des paris réels.
 *
 * Seul le vivier du combiné IA appliquait cette règle (vantage-worker,
 * `classifyAvoidSignal`). Le Favori, le coupon long et le combiné moteur ne
 * la lisaient pas : sur la copie de production, du 24/09 au 24/10, 22 des 72
 * jambes PRICE et 9 des 41 jambes ENGINE tombaient sur un match signalé
 * (audit du 2026-10-23, P1-8). Même définition que `hasCalibrationAlert` :
 * alerte 1X2 non nulle, ou au moins une alerte Plus/Moins.
 *
 * Mesuré avant de l'appliquer (sélections réglées depuis le 01/07, hors
 * VALUE/SAFE/VANTAGE) : sous 1,45 les matchs signalés passent comme les
 * autres (réalisé ÷ annoncé 1,04 contre 1,01) ; de 1,45 à 1,80, 0,85 contre
 * 0,92 ; au-dessus de 1,80, 0,63–0,73 contre 0,86. L'exclusion ne coûte rien
 * aux produits à cote courte et retire les estimations les plus fausses.
 */
function calibrationAlertedFixtureIds(from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT lr."fixtureId"
    FROM (
      SELECT DISTINCT ON (mr."fixtureId") mr."fixtureId", mr.features
      FROM public.model_run mr
      JOIN public.fixture fx ON fx.id = mr."fixtureId"
      WHERE fx."scheduledAt" >= ${from}
        AND fx."scheduledAt" < ${to}
        AND mr."analyzedAt" < fx."scheduledAt"
      ORDER BY mr."fixtureId", mr."analyzedAt" DESC
    ) lr
    WHERE jsonb_typeof(lr.features -> 'calibration_alert') = 'object'
       OR CASE
            WHEN jsonb_typeof(lr.features -> 'calibration_alert_over_under') = 'array'
            THEN jsonb_array_length(lr.features -> 'calibration_alert_over_under') > 0
            ELSE false
          END
  `;
}

export type MarketCostCell = {
  market: string;
  band: string;
  legCount: number;
  meanPayout: number;
  payoutVariance: number;
};

export type EngineComboCandidateRow = {
  fixtureId: string;
  competition: string;
  channel: string;
  market: string;
  pick: string;
  odds: number;
  probability: number;
  scheduledAt: Date;
};

export type ChannelCompetitionCalibrationRow = {
  channel: string;
  competition: string;
  sampleSize: number;
  ratio: number | null;
};

export type ClassTrackRecordRow = {
  source: string;
  targetOddsMin: number;
  settled: number;
  won: number;
  avgOdds: number;
  returnPerUnit: number;
  /** Premier et dernier `forDate` réglés de la classe dans la fenêtre. */
  firstDay: Date;
  lastDay: Date;
  /** Plus longue suite de coupons perdus d'affilée, remboursés ignorés. */
  worstLosingStreak: number;
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

  /**
   * Proposals the settlement pass must (re)visit:
   * - PENDING ones whose last fixture kicked off at least 90 min ago;
   * - EXPIRED ones that early-failed (one leg lost before the others were
   *   played) and still carry a leg never graded although its fixture is now
   *   FINISHED, POSTPONED or CANCELLED. Without this second branch those
   *   legs stayed `settledAt IS NULL` forever (128 of them measured
   *   2026-10-05), and since they are systematically the late kick-offs of
   *   losing days, every per-leg comparison between generators read high.
   */
  async findPendingReadyToSettle(
    now: Date,
  ): Promise<Array<{ id: string; lastFixtureScheduledAt: Date }>> {
    const threshold = new Date(now.getTime() - 90 * 60 * 1000);
    return this.prisma.client.couponProposal.findMany({
      where: {
        OR: [
          {
            status: CouponProposalStatus.PENDING,
            lastFixtureScheduledAt: { lte: threshold },
          },
          {
            status: CouponProposalStatus.EXPIRED,
            legs: {
              some: {
                settledAt: null,
                fixture: {
                  status: {
                    in: [
                      FixtureStatus.FINISHED,
                      FixtureStatus.POSTPONED,
                      FixtureStatus.CANCELLED,
                    ],
                  },
                },
              },
            },
          },
        ],
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

  async findResolvedCouponsForIndices(opts: {
    from: Date;
    to: Date;
    source?: CouponSource;
  }): Promise<
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
        forDate: { gte: opts.from, lte: opts.to },
        ...(opts.source ? { source: opts.source } : {}),
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

  // `realizedOdds` n'a de sens que sur un gain : un LOST ou un VOID l'efface,
  // sinon un coupon re-réglé WON → LOST par `settleRange` gardait la cote
  // payée d'un gain qui n'existe plus et comptait deux fois dans l'indice.
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
        realizedOdds:
          realizedOdds !== undefined ? new Prisma.Decimal(realizedOdds) : null,
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
   * `won IS NULL` sur une rencontre terminée n'est un remboursement que pour
   * un Draw No Bet sur match nul : il rapporte exactement la mise. Pour tout
   * autre marché, NULL veut dire « non réglable » — score de mi-temps absent,
   * ou marché sans règle de règlement dans la vue (handicap asiatique,
   * corners, cartons, …). Les compter comme remboursés leur donnerait un coût
   * nul et le compositeur les préférerait à tout le reste.
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
          AND (won IS NOT NULL OR market = 'DRAW_NO_BET')
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
      /** Canal d'origine de la jambe (combiné du moteur) ; PRICE sinon. */
      canal?: StrategyChannel;
      /** Probabilité annoncée par le canal (combiné du moteur) ; sinon
       * retour attendu / cote, l'estimation du prix. */
      probability?: number;
    }[];
    /**
     * Profil écrit dans la clé unique et dans `reasoning.policyVersion`. Par
     * défaut le coupon long 5–15 du compositeur ; le pari sûr du jour passe
     * sa propre bande (FAVOURITE_COUPON_CLASS) et sa propre version.
     */
    profile?: {
      targetOddsMin: number;
      targetOddsMax: number;
      policyVersion: string;
      /** PRICE_COMPOSER par défaut ; ENGINE pour le combiné du moteur. */
      source?: CouponSource;
      /** Canal écrit sur chaque jambe ; PRICE par défaut. */
      legCanal?: StrategyChannel;
    };
  }): Promise<string> {
    const profile = input.profile ?? {
      targetOddsMin: UNIFIED_COUPON_CLASS.targetOddsMin,
      targetOddsMax: UNIFIED_COUPON_CLASS.targetOddsMax,
      policyVersion: PRICE_COMPOSER_POLICY.version,
    };
    const key = {
      forDate: startOfUtcDay(input.forDate),
      source: profile.source ?? CouponSource.PRICE_COMPOSER,
      signalWindowDays: PRICE_COMPOSER_SIGNAL_WINDOW_DAYS,
      targetOddsMin: new Prisma.Decimal(profile.targetOddsMin),
      targetOddsMax: new Prisma.Decimal(profile.targetOddsMax),
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
        policyVersion: profile.policyVersion,
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
            canal: leg.canal ?? profile.legCanal ?? StrategyChannel.PRICE,
            market: leg.market,
            pick: leg.pick,
            probability: new Prisma.Decimal(
              Math.min(
                leg.probability ?? leg.expectedReturn / leg.odds,
                0.9999,
              ).toFixed(4),
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
    /** Par défaut la passe du compositeur 5–15 ; le pari sûr passe la sienne. */
    pass?: { name: string; policyVersion: string };
  }): Promise<void> {
    await this.prisma.client.couponGenerationAttempt.create({
      data: {
        forDate: startOfUtcDay(input.forDate),
        policyVersion:
          input.pass?.policyVersion ?? PRICE_COMPOSER_POLICY.version,
        pass: input.pass?.name ?? 'price-composer',
        outcome: input.outcome,
        candidateCount: input.candidateCount,
        reason: input.reason ?? null,
        proposalId: input.proposalId ?? null,
      },
    });
  }

  async updateLegClosingLine(
    legId: string,
    closing: {
      closingOdds: number;
      closingBookmaker: string;
      closingObservedAt: Date;
      closingLineValue: number;
    },
  ): Promise<void> {
    await this.prisma.client.couponProposalLeg.update({
      where: { id: legId },
      data: {
        closingOdds: new Prisma.Decimal(closing.closingOdds),
        closingBookmaker: closing.closingBookmaker,
        closingObservedAt: closing.closingObservedAt,
        closingLineValue: new Prisma.Decimal(closing.closingLineValue),
      },
    });
  }

  /**
   * Vivier du jour : tout ce qui est coté sur des rencontres pas encore jouées.
   *
   * Le coup d'envoi est comparé à `now` et non à la date seule — un vivier qui
   * garde les rencontres déjà commencées propose des paris impossibles à poser.
   */
  /**
   * Vivier du combiné du moteur : les sélections retenues (SELECTED) des
   * canaux affichés sur Décisions, dernière analyse d'avant coup d'envoi,
   * sur les rencontres pas encore jouées de la journée. C'est exactement ce
   * que l'écran montre — la vue dédupliquée porte déjà le filtre
   * `analyzedAt < scheduledAt` et le DISTINCT ON par (canal, match, marché,
   * pick).
   */
  async findEngineComboCandidates(opts: {
    from: Date;
    to: Date;
    excludedChannels: readonly string[];
  }): Promise<readonly EngineComboCandidateRow[]> {
    return this.prisma.client.$queryRaw<EngineComboCandidateRow[]>`
      SELECT s."fixtureId",
             c.code                 AS competition,
             s.channel::text        AS channel,
             s.market::text         AS market,
             s.pick,
             s.odds::float          AS odds,
             s.probability::float   AS probability,
             s."scheduledAt"
      FROM public.channel_selection_deduped s
      JOIN public.channel_decision cd ON cd.id = s."channelDecisionId"
      JOIN public.fixture f ON f.id = s."fixtureId"
      JOIN public.season se ON se.id = f."seasonId"
      JOIN public.competition c ON c.id = se."competitionId"
      WHERE cd.status = 'SELECTED'
        AND f.status = 'SCHEDULED'
        AND s.odds IS NOT NULL
        AND s."scheduledAt" >= ${opts.from}
        AND s."scheduledAt" < ${opts.to}
        AND s."scheduledAt" > now()
        AND NOT (s.channel::text = ANY(${[...opts.excludedChannels]}::text[]))
        AND s.market::text <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])
        AND s."fixtureId" NOT IN (${calibrationAlertedFixtureIds(opts.from, opts.to)})
    `;
  }

  /**
   * Calibration canal × compétition sur une fenêtre glissante : réel /
   * annoncé et volume, sur les sélections réglées (WON/LOST) d'avant coup
   * d'envoi. Même matière que la pastille de confiance de l'écran.
   */
  async findChannelCompetitionCalibration(
    since: Date,
  ): Promise<readonly ChannelCompetitionCalibrationRow[]> {
    return this.prisma.client.$queryRaw<ChannelCompetitionCalibrationRow[]>`
      SELECT s.channel::text AS channel,
             c.code          AS competition,
             count(*)::int   AS "sampleSize",
             CASE WHEN sum(s.probability) > 0
                  THEN (sum((s.result = 'WON')::int) / sum(s.probability))::float
                  ELSE NULL END AS ratio
      FROM public.channel_selection_deduped s
      JOIN public.fixture f ON f.id = s."fixtureId"
      JOIN public.season se ON se.id = f."seasonId"
      JOIN public.competition c ON c.id = se."competitionId"
      WHERE s.result IN ('WON', 'LOST')
        AND s."scheduledAt" >= ${since}
      GROUP BY s.channel, c.code
    `;
  }

  /**
   * Historique par produit de coupon : une ligne par (source, bande cible),
   * sur les propositions réglées dont `forDate` est dans la fenêtre. Gagné =
   * WON ou PARTIAL (toutes les jambes jouées ont gagné) ; le retour d'une
   * mise de 1 utilise la cote payée quand elle existe, remboursement = 1.
   */
  async findClassTrackRecord(
    since: Date,
  ): Promise<readonly ClassTrackRecordRow[]> {
    // La pire série se compte sur la suite des coupons réglés de la classe,
    // dans l'ordre des jours : chaque coupon non perdu ouvre un nouveau
    // groupe, la plus longue suite de « perdu » dans un groupe est la série.
    // Un remboursement ne compte ni pour ni contre. Chaque produit doit dire
    // sa pire série (apps/web/PRODUCT.md, principe 2).
    return this.prisma.client.$queryRaw<ClassTrackRecordRow[]>`
      WITH settled AS (
        SELECT id, source, "targetOddsMin", "forDate", result,
               "combinedOdds", "realizedOdds"
        FROM public.coupon_proposal
        WHERE result IS NOT NULL
          AND "forDate" >= ${since}
      ), streaks AS (
        SELECT source, "targetOddsMin", max(run)::int AS "worstLosingStreak"
        FROM (
          SELECT source, "targetOddsMin", grp, count(*) AS run
          FROM (
            SELECT source, "targetOddsMin", result,
                   count(*) FILTER (WHERE result <> 'LOST') OVER (
                     PARTITION BY source, "targetOddsMin"
                     ORDER BY "forDate", id
                   ) AS grp
            FROM settled
            WHERE result <> 'VOID'
          ) grouped
          WHERE result = 'LOST'
          GROUP BY source, "targetOddsMin", grp
        ) runs
        GROUP BY source, "targetOddsMin"
      )
      SELECT s.source::text                       AS source,
             s."targetOddsMin"::float             AS "targetOddsMin",
             count(*)::int                        AS settled,
             count(*) FILTER (WHERE s.result IN ('WON', 'PARTIAL'))::int AS won,
             avg(s."combinedOdds")::float         AS "avgOdds",
             avg(CASE s.result
                   WHEN 'WON' THEN coalesce(s."realizedOdds", s."combinedOdds")
                   WHEN 'PARTIAL' THEN coalesce(s."realizedOdds", s."combinedOdds")
                   WHEN 'VOID' THEN 1
                   ELSE 0 END)::float             AS "returnPerUnit",
             min(s."forDate")                     AS "firstDay",
             max(s."forDate")                     AS "lastDay",
             coalesce(k."worstLosingStreak", 0)   AS "worstLosingStreak"
      FROM settled s
      LEFT JOIN streaks k
        ON k.source = s.source AND k."targetOddsMin" = s."targetOddsMin"
      GROUP BY s.source, s."targetOddsMin", k."worstLosingStreak"
    `;
  }

  /**
   * Vivier du coupon cote 2 : tout ce que le moteur a envisagé et qui est
   * coté, retenu ou rejeté, hors types de pari suspendus (cohérence avec
   * Décisions) et hors matchs « Données suspectes ». Le groupe d'issues
   * complet est nécessaire pour retirer la marge : on garde toutes les
   * issues, le compositeur filtre lui-même la bande de cote.
   */
  async findDoubleCandidates(opts: {
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
        AND coalesce(rejection_reason, '') <> 'market_suspended'
        AND market <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])
        AND "fixtureId" NOT IN (${calibrationAlertedFixtureIds(opts.from, opts.to)})
    `;
  }

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
        AND market <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])
        AND "fixtureId" NOT IN (${calibrationAlertedFixtureIds(opts.from, opts.to)})
    `;
  }
}
