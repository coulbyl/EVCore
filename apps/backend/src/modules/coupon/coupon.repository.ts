import { Injectable } from '@nestjs/common';
import {
  CouponProposalStatus,
  CouponResult,
  CouponSource,
  FixtureStatus,
  type Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import { POOL_EXCLUDED_MARKETS } from '@evcore/analysis-core';
import { PRICE_COMPOSER_SIGNAL_WINDOW_DAYS } from './coupon.constants';
import { PrismaService } from '@/prisma.service';
import { startOfUtcDay } from '@utils/date.utils';

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

export type AiPlayRow = {
  fixtureId: string;
  competition: string;
  market: string;
  pick: string;
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

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le premier coup d'envoi d'un coupon, ou null s'il n'existe pas : on ne
   * suit plus un coupon commencé (04 § 3).
   */
  async findFirstKickoff(id: string): Promise<{
    firstKickoffAt: Date | null;
    source: string;
    rank: number;
    targetOddsMin: Prisma.Decimal;
  } | null> {
    const [row] = await this.prisma.client.$queryRaw<
      {
        firstKickoffAt: Date | null;
        source: string;
        rank: number;
        targetOddsMin: Prisma.Decimal;
      }[]
    >`
      SELECT min(f."scheduledAt") AS "firstKickoffAt",
             cp.source::text AS source, cp.rank, cp."targetOddsMin"
      FROM public.coupon_proposal cp
      LEFT JOIN public.coupon_proposal_leg l ON l."couponProposalId" = cp.id
      LEFT JOIN public.fixture f ON f.id = l."fixtureId"
      WHERE cp.id = ${id}::uuid
      GROUP BY cp.id
    `;
    return row ?? null;
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

  /** Matchs des jambes d'une proposition, pour la régler. */
  async findFixturesForSettlement(ids: readonly string[]): Promise<
    {
      id: string;
      status: FixtureStatus;
      scheduledAt: Date;
      homeScore: number | null;
      awayScore: number | null;
      homeHtScore: number | null;
      awayHtScore: number | null;
      /** Corners des deux équipes (stats de match) ; null s'il en manque une. */
      totalCorners: number | null;
    }[]
  > {
    const fixtures = await this.prisma.client.fixture.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        fixtureStatistics: {
          where: { type: 'corner_kicks' },
          select: { value: true },
        },
      },
    });
    return fixtures.map(({ fixtureStatistics, ...fixture }) => ({
      ...fixture,
      totalCorners:
        fixtureStatistics.length === 2
          ? fixtureStatistics.reduce((sum, s) => sum + Number(s.value), 0)
          : null,
    }));
  }

  /**
   * Cote et marge 1xBet d'une jambe, écrites une seule fois : une jambe déjà
   * cotée n'est jamais réécrite (rejouable).
   */
  async applyLegOperatorPrices(
    updates: readonly {
      legId: string;
      operatorOdds: number;
      operatorMargin: number | null;
      operatorFairProbability: number | null;
    }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.prisma.client.$transaction(
      updates.map((update) =>
        this.prisma.client.couponProposalLeg.updateMany({
          where: { id: update.legId, operatorOdds: null },
          data: {
            operatorOdds: new Prisma.Decimal(update.operatorOdds.toFixed(3)),
            operatorMargin:
              update.operatorMargin === null
                ? null
                : new Prisma.Decimal(update.operatorMargin.toFixed(4)),
            operatorFairProbability:
              update.operatorFairProbability === null
                ? null
                : new Prisma.Decimal(update.operatorFairProbability.toFixed(4)),
          },
        }),
      ),
    );
  }

  async findByIdWithLegs(id: string): Promise<CouponProposalWithLegs | null> {
    return this.prisma.client.couponProposal.findUnique({
      where: { id },
      include: WITH_LEGS,
    });
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
   * Écrit la proposition du compositeur et ses jambes en une transaction.
   *
   * `source` fait partie de la clé unique : l'upsert ne peut donc jamais
   * écraser la proposition d'une autre source du même jour sur la même cible.
   *
   * Une proposition existante n'est jamais réécrite : `created` dit si
   * cette passe l'a écrite ou l'a trouvée publiée (la passe de 21 h trouve
   * celle de 17 h, ENV-PROD § 3).
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
      /** Ligne des marchés qui la portent en colonne (corners). */
      line?: number | null;
      odds: number;
      expectedReturn: number;
      /** Canal d'origine de la jambe (combiné du moteur) ; PRICE sinon. */
      canal?: StrategyChannel;
      /** Probabilité annoncée par le canal (combiné du moteur) ; sinon
       * retour attendu / cote, l'estimation du prix. */
      probability?: number;
      /** Prix et marge chez le book des joueurs (1xBet), quand il cote. */
      operatorOdds?: number | null;
      operatorMargin?: number | null;
      /** Fréquence de Shin chez 1xBet, du même relevé que operatorOdds. */
      operatorFairProbability?: number | null;
    }[];
    /** Profil écrit dans la clé unique et dans `reasoning.policyVersion` :
     * la bande et la version de la classe qui compose. */
    profile: {
      targetOddsMin: number;
      targetOddsMax: number;
      policyVersion: string;
      /** PRICE_COMPOSER par défaut ; ENGINE pour le combiné du moteur. */
      source?: CouponSource;
      /** Canal écrit sur chaque jambe ; PRICE par défaut. */
      legCanal?: StrategyChannel;
    };
  }): Promise<{ proposalId: string; created: boolean }> {
    const { profile } = input;
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

    const uniqueKey = {
      forDate_source_signalWindowDays_targetOddsMin_targetOddsMax_rank: key,
    };
    const existing = await this.prisma.client.couponProposal.findUnique({
      where: uniqueKey,
      select: { id: true },
    });
    if (existing) return { proposalId: existing.id, created: false };

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
            line: leg.line == null ? null : new Prisma.Decimal(leg.line),
            probability: new Prisma.Decimal(
              Math.min(
                leg.probability ?? leg.expectedReturn / leg.odds,
                0.9999,
              ).toFixed(4),
            ),
            oddsSnapshot: new Prisma.Decimal(leg.odds),
            operatorOdds:
              leg.operatorOdds == null
                ? null
                : new Prisma.Decimal(leg.operatorOdds),
            operatorMargin:
              leg.operatorMargin == null
                ? null
                : new Prisma.Decimal(leg.operatorMargin.toFixed(4)),
            operatorFairProbability:
              leg.operatorFairProbability == null
                ? null
                : new Prisma.Decimal(leg.operatorFairProbability.toFixed(4)),
            signalScore: new Prisma.Decimal(0),
            featureSnapshot: { expectedReturn: leg.expectedReturn },
          })),
        },
      },
      // Une proposition déjà réglée ou décidée n'est jamais réécrite (et une
      // passe concurrente qui l'aurait créée entre-temps la garde).
      update: {},
      select: { id: true },
    });
    return { proposalId: proposal.id, created: true };
  }

  async recordPriceComposerAttempt(input: {
    forDate: Date;
    outcome: string;
    candidateCount: number;
    reason?: string;
    proposalId?: string;
    pass: { name: string; policyVersion: string };
  }): Promise<void> {
    await this.prisma.client.couponGenerationAttempt.create({
      data: {
        forDate: startOfUtcDay(input.forDate),
        policyVersion: input.pass.policyVersion,
        pass: input.pass.name,
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
   * Les avis joués par l'IA sur les matchs à venir de la plage (Combiné IA,
   * 2026-11-03) : son dernier avis par match, quand il joue, avec son pari.
   * Jamais un avis remplacé par une analyse plus récente qui ne joue pas.
   */
  async findAiPlays(opts: {
    from: Date;
    to: Date;
  }): Promise<readonly AiPlayRow[]> {
    return this.prisma.client.$queryRaw<AiPlayRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (mr."fixtureId")
               mr."fixtureId", cd.id, cd.status
        FROM public.channel_decision cd
        JOIN public.model_run mr ON mr.id = cd."modelRunId"
        JOIN public.fixture f ON f.id = mr."fixtureId"
        WHERE cd.channel = 'VANTAGE'
          AND f.status = 'SCHEDULED'
          AND f."scheduledAt" >= ${opts.from}
          AND f."scheduledAt" < ${opts.to}
          AND f."scheduledAt" > now()
        ORDER BY mr."fixtureId", cd."createdAt" DESC
      )
      SELECT l."fixtureId", c.code AS competition,
             cs.market::text AS market, cs.pick, f."scheduledAt"
      FROM latest l
      JOIN public.channel_selection cs
        ON cs."channelDecisionId" = l.id AND cs.rank = 1
      JOIN public.fixture f ON f.id = l."fixtureId"
      JOIN public.season se ON se.id = f."seasonId"
      JOIN public.competition c ON c.id = se."competitionId"
      WHERE l.status = 'SELECTED'
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
    // Borne haute exclusive : le relevé du lundi lit une semaine fermée,
    // rejouable plus tard sans compter les jours suivants.
    until: Date = new Date('9999-12-31T00:00:00.000Z'),
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
          AND "forDate" < ${until}
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
  /**
   * Dernière tentative de chaque passe pour un jour : les abstentions
   * expliquées au joueur (2026-10-29). La dernière fait foi (la passe de
   * rattrapage peut avoir composé après une abstention).
   */
  findLatestAttempts(
    forDate: Date,
  ): Promise<{ pass: string; outcome: string; reason: string | null }[]> {
    return this.prisma.client.$queryRaw<
      { pass: string; outcome: string; reason: string | null }[]
    >`
      SELECT DISTINCT ON (pass) pass, outcome, reason
      FROM public.coupon_generation_attempt
      WHERE "forDate" = ${startOfUtcDay(forDate)}::date
      ORDER BY pass, "generatedAt" DESC
    `;
  }

  /**
   * Les abstentions de chaque jour de [from, to[ (2026-10-30, 04 § 5 et
   * 08 § 6) : la dernière tentative de chaque passe fait foi, et une passe
   * dont le produit a quand même un coupon déterministe publié ce jour-là
   * dans sa bande n'est pas une abstention. Les tentatives ne sont jamais
   * purgées : la raison d'un jour se relit autant qu'on veut.
   */
  findAbstentionsBetween(input: {
    from: Date;
    to: Date;
    passes: readonly { pass: string; targetOddsMin: number }[];
  }): Promise<{ forDate: Date; pass: string; reason: string | null }[]> {
    return this.prisma.client.$queryRaw<
      { forDate: Date; pass: string; reason: string | null }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON ("forDate", pass) "forDate", pass, outcome, reason
        FROM public.coupon_generation_attempt
        WHERE "forDate" >= ${startOfUtcDay(input.from)}::date
          AND "forDate" < ${startOfUtcDay(input.to)}::date
          AND pass = ANY(${input.passes.map((p) => p.pass)}::text[])
        ORDER BY "forDate", pass, "generatedAt" DESC
      ), product AS (
        SELECT * FROM unnest(
          ${input.passes.map((p) => p.pass)}::text[],
          ${input.passes.map((p) => p.targetOddsMin)}::numeric[]
        ) AS p(pass, target)
      )
      SELECT latest."forDate", latest.pass, latest.reason
      FROM latest
      JOIN product ON product.pass = latest.pass
      WHERE latest.outcome = 'abstained'
        AND NOT EXISTS (
          SELECT 1 FROM public.coupon_proposal cp
          WHERE cp."forDate" = latest."forDate"
            AND cp."targetOddsMin" = product.target
            AND cp.source <> 'LLM'
            AND cp.rank = 1
        )
      ORDER BY latest."forDate", latest.pass
    `;
  }

  /** Bandes cibles des coupons publiés pour un jour, toutes sources. */
  async findPublishedTargets(forDate: Date): Promise<number[]> {
    const rows = await this.prisma.client.couponProposal.findMany({
      where: { forDate: startOfUtcDay(forDate) },
      select: { targetOddsMin: true },
      distinct: ['targetOddsMin'],
    });
    return rows.map((row) => Number(row.targetOddsMin));
  }

  /**
   * Dernier prix d'avant coup d'envoi des lignes de corners, chez les books
   * demandés, pour les matchs à venir d'une journée (Chasseur Corners).
   */
  findCornersQuotes(opts: {
    from: Date;
    to: Date;
    bookmakers: readonly string[];
  }): Promise<
    {
      fixtureId: string;
      competitionId: string;
      scheduledAt: Date;
      line: number;
      pick: 'OVER' | 'UNDER';
      bookmaker: string;
      odds: number;
      snapshotAt: Date;
    }[]
  > {
    return this.prisma.client.$queryRaw`
      SELECT DISTINCT ON (o."fixtureId", o.line, o.pick, o.bookmaker)
             o."fixtureId"::text AS "fixtureId",
             s."competitionId"::text AS "competitionId",
             f."scheduledAt", o.line::float AS line, o.pick, o.bookmaker,
             o.odds::float AS odds, o."snapshotAt"
      FROM public.odds_snapshot o
      JOIN public.fixture f ON f.id = o."fixtureId"
      JOIN public.season s ON s.id = f."seasonId"
      WHERE o.market = 'CORNERS'
        AND o.pick IN ('OVER', 'UNDER')
        AND o.line IS NOT NULL AND o.odds IS NOT NULL
        AND o.bookmaker = ANY(ARRAY[${Prisma.join([...opts.bookmakers])}]::text[])
        AND f.status = 'SCHEDULED'
        AND f."scheduledAt" >= ${opts.from} AND f."scheduledAt" < ${opts.to}
        AND o."snapshotAt" <= f."scheduledAt"
      ORDER BY o."fixtureId", o.line, o.pick, o.bookmaker, o."snapshotAt" DESC
    `;
  }

  /**
   * Championnats où les stats de corners arrivent presque toujours : part des
   * matchs finis entre `since` et `until` dont les deux équipes ont leurs
   * corners enregistrés.
   */
  async findReliableCornerCompetitions(opts: {
    since: Date;
    until: Date;
    minShare: number;
    minFixtures: number;
  }): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<
      { competitionId: string }[]
    >`
      WITH finished AS (
        SELECT f.id, f."scheduledAt", s."competitionId"
        FROM public.fixture f
        JOIN public.season s ON s.id = f."seasonId"
        WHERE f.status = 'FINISHED'
          AND f."scheduledAt" >= ${opts.since}
          AND f."scheduledAt" < ${opts.until}
      ), arrived AS (
        SELECT fs."fixtureId", count(*) AS teams
        FROM public.fixture_statistic fs
        WHERE fs.type = 'corner_kicks'
          AND fs."fixtureId" IN (SELECT id FROM finished)
        GROUP BY fs."fixtureId"
      )
      SELECT fin."competitionId"::text AS "competitionId"
      FROM finished fin
      LEFT JOIN arrived a ON a."fixtureId" = fin.id
      GROUP BY fin."competitionId"
      HAVING count(*) >= ${opts.minFixtures}
         AND avg(CASE WHEN a.teams = 2 THEN 1.0 ELSE 0.0 END) >= ${opts.minShare}
    `;
    return rows.map((row) => row.competitionId);
  }

  /**
   * Matchs que le méta-canal AVOID signale sur la dernière analyse d'avant
   * coup d'envoi : les chasseurs ne les jouent pas.
   */
  async findAvoidedFixtureIds(opts: {
    from: Date;
    to: Date;
  }): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<{ fixtureId: string }[]>`
      WITH latest AS (
        SELECT DISTINCT ON (mr."fixtureId") mr.id, mr."fixtureId"
        FROM public.model_run mr
        JOIN public.fixture f ON f.id = mr."fixtureId"
        WHERE f."scheduledAt" >= ${opts.from}
          AND f."scheduledAt" < ${opts.to}
          AND mr."analyzedAt" < f."scheduledAt"
        ORDER BY mr."fixtureId", mr."analyzedAt" DESC
      )
      SELECT latest."fixtureId"::text AS "fixtureId"
      FROM latest
      JOIN public.channel_decision cd ON cd."modelRunId" = latest.id
      WHERE cd.channel = 'AVOID' AND cd.status = 'SELECTED'
    `;
    return rows.map((r) => r.fixtureId);
  }

  async findDoubleCandidates(opts: {
    from: Date;
    to: Date;
  }): Promise<readonly PriceCandidateRow[]> {
    return this.findPricedRows(
      opts,
      Prisma.sql`coalesce(rejection_reason, '') <> 'market_suspended'
        AND market <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])`,
    );
  }

  /**
   * Un marché coté le jour dit, toutes ses issues pour que la marge se
   * retire sur le groupe complet (Chasseur Nul à la mi-temps, 2026-11-04).
   *
   * Contrairement au vivier de `findDoubleCandidates`, le refus
   * `market_suspended` du moteur n'écarte rien : sur le 1X2 de la mi-temps,
   * c'est sa porte des championnats sans historique de mi-temps
   * (`htftCalibrated`), qui rejette ~85 % des lignes pour protéger son
   * Poisson ; ce produit ne lit que le prix. Une vraie suspension du marché
   * (`calibration.market_suspension`) reste respectée, comme les alertes de
   * calibration.
   */
  async findMarketCandidates(opts: {
    from: Date;
    to: Date;
    market: string;
  }): Promise<readonly PriceCandidateRow[]> {
    return this.findPricedRows(
      opts,
      Prisma.sql`market = ${opts.market}
        AND NOT EXISTS (
          SELECT 1 FROM calibration.market_suspension s
          WHERE s.active AND s.market::text = ${opts.market}
        )`,
    );
  }

  /** Ce qui est coté sur les matchs à venir de la plage, hors alertes de
   * calibration, restreint par `filter`. */
  private findPricedRows(
    opts: { from: Date; to: Date },
    filter: Prisma.Sql,
  ): Promise<PriceCandidateRow[]> {
    return this.prisma.client.$queryRaw<PriceCandidateRow[]>`
      SELECT "fixtureId",
             competition,
             market,
             pick,
             odds::float                AS odds,
             "scheduledAt"
      FROM public.evaluated_pick
      WHERE "fixtureStatus" NOT IN ('FINISHED', 'POSTPONED', 'CANCELLED')
        AND "scheduledAt" >= ${opts.from}
        AND "scheduledAt" < ${opts.to}
        AND ${filter}
        AND "fixtureId" NOT IN (${calibrationAlertedFixtureIds(opts.from, opts.to)})
    `;
  }

  async findPriceCandidates(opts: {
    from: Date;
    to: Date;
  }): Promise<readonly PriceCandidateRow[]> {
    return this.findPricedRows(
      opts,
      Prisma.sql`market <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])`,
    );
  }
}
