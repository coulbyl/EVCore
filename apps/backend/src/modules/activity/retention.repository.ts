import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

export type CohortRow = {
  week: Date;
  signups: number;
  activated: number;
  d7Eligible: number;
  d7Retained: number;
  d14Eligible: number;
  d14Retained: number;
  d30Eligible: number;
  d30Retained: number;
};

/** « 2026-10-29 » : le jour UTC, passé tel quel à Postgres. */
function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export type ActiveCounts = { dau: number; wau: number; mau: number };

export type EngagementCounts = {
  weeklyActive: number;
  followed: number;
  declared: number;
};

export type NotificationOpenRow = {
  type: string;
  sent: number;
  opened: number;
};

/**
 * Indicateurs de fidélisation (2026-10-29), sur les jours actifs
 * (`user_activity_day`) : activation = au moins 3 jours actifs dans les 14
 * premiers jours ; rétention Jn = actif au moins un jour entre n et n + 6
 * jours après l'inscription, compté seulement pour les inscrits assez
 * anciens. Admins exclus.
 */
@Injectable()
export class RetentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCohorts(opts: { since: Date; asOf: Date }): Promise<CohortRow[]> {
    return this.prisma.client.$queryRaw<CohortRow[]>`
      WITH players AS (
        -- Colonnes en UTC sans fuseau : le cast direct reste juste quel que
        -- soit le TimeZone de la session.
        SELECT id, "createdAt"::date AS signup
        FROM public.users
        WHERE role <> 'ADMIN' AND "createdAt" >= ${opts.since}
      ),
      per_user AS (
        SELECT p.id, p.signup,
          count(a.day) FILTER (WHERE a.day BETWEEN p.signup AND p.signup + 13) AS early_days,
          bool_or(a.day BETWEEN p.signup + 7 AND p.signup + 13) AS d7,
          bool_or(a.day BETWEEN p.signup + 14 AND p.signup + 20) AS d14,
          bool_or(a.day BETWEEN p.signup + 30 AND p.signup + 36) AS d30
        FROM players p
        LEFT JOIN public.user_activity_day a ON a."userId" = p.id
        GROUP BY p.id, p.signup
      ),
      as_of AS (SELECT ${isoDay(opts.asOf)}::date AS today)
      SELECT date_trunc('week', signup)::date AS week,
        count(*)::int AS signups,
        count(*) FILTER (WHERE early_days >= 3)::int AS activated,
        count(*) FILTER (WHERE signup + 13 < today)::int AS "d7Eligible",
        count(*) FILTER (WHERE signup + 13 < today AND d7)::int AS "d7Retained",
        count(*) FILTER (WHERE signup + 20 < today)::int AS "d14Eligible",
        count(*) FILTER (WHERE signup + 20 < today AND d14)::int AS "d14Retained",
        count(*) FILTER (WHERE signup + 36 < today)::int AS "d30Eligible",
        count(*) FILTER (WHERE signup + 36 < today AND d30)::int AS "d30Retained"
      FROM per_user, as_of
      GROUP BY 1
      ORDER BY 1
    `;
  }

  async findActiveCounts(asOf: Date): Promise<ActiveCounts> {
    const [row] = await this.prisma.client.$queryRaw<ActiveCounts[]>`
      WITH as_of AS (SELECT ${isoDay(asOf)}::date AS today)
      SELECT
        count(DISTINCT a."userId") FILTER (WHERE a.day = today - 1)::int AS dau,
        count(DISTINCT a."userId") FILTER (WHERE a.day BETWEEN today - 7 AND today - 1)::int AS wau,
        count(DISTINCT a."userId") FILTER (WHERE a.day BETWEEN today - 30 AND today - 1)::int AS mau
      FROM public.user_activity_day a
      JOIN public.users u ON u.id = a."userId" AND u.role <> 'ADMIN', as_of
    `;
    return row ?? { dau: 0, wau: 0, mau: 0 };
  }

  async findEngagement(asOf: Date): Promise<EngagementCounts> {
    const [row] = await this.prisma.client.$queryRaw<EngagementCounts[]>`
      WITH as_of AS (SELECT ${isoDay(asOf)}::date AS today),
      weekly AS (
        SELECT DISTINCT a."userId"
        FROM public.user_activity_day a
        JOIN public.users u ON u.id = a."userId" AND u.role <> 'ADMIN', as_of
        WHERE a.day BETWEEN today - 7 AND today - 1
      )
      SELECT
        (SELECT count(*) FROM weekly)::int AS "weeklyActive",
        (SELECT count(DISTINCT f."userId") FROM public.coupon_follow f, as_of
           WHERE f."userId" IN (SELECT "userId" FROM weekly)
             AND f."createdAt" >= today - 7 AND f."createdAt" < today)::int AS followed,
        (SELECT count(DISTINCT s."userId") FROM public.bet_slip s, as_of
           WHERE s."userId" IN (SELECT "userId" FROM weekly)
             AND s."createdAt" >= today - 7 AND s."createdAt" < today)::int AS declared
    `;
    return row ?? { weeklyActive: 0, followed: 0, declared: 0 };
  }

  /** Notifications envoyées et ouvertes (événement NOTIFICATION_OPENED). */
  findNotificationOpens(since: Date): Promise<NotificationOpenRow[]> {
    return this.prisma.client.$queryRaw<NotificationOpenRow[]>`
      WITH sent AS (
        SELECT type::text AS type, count(*)::int AS sent
        FROM public.notification
        WHERE type IN ('MORNING_BRIEF', 'WEEKLY_STATEMENT')
          AND "createdAt" >= ${since}
        GROUP BY 1
      ),
      opened AS (
        -- Une ouverture par joueur et par jour : rouvrir le lien ne gonfle
        -- pas le taux au-delà des notifications envoyées.
        SELECT payload->>'notificationType' AS type,
               count(DISTINCT ("userId", at::date))::int AS opened
        FROM public.product_event
        WHERE type = 'NOTIFICATION_OPENED' AND at >= ${since}
        GROUP BY 1
      )
      SELECT coalesce(sent.type, opened.type) AS type,
             coalesce(sent.sent, 0) AS sent,
             coalesce(opened.opened, 0) AS opened
      FROM sent FULL JOIN opened ON opened.type = sent.type
      ORDER BY 1
    `;
  }
}
