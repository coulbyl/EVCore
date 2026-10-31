import { Injectable } from '@nestjs/common';
import { CONSOLE_RULES as R } from '@config/console.constants';
import { vantageCohortSql } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The signals behind the admin's lights (12-admin.md § 1). One small read
 * each, all indexed or on small tables: the home is read often.
 */
@Injectable()
export class ConsoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** When we last fetched any odds (odds_latest: one row per price). */
  async lastOddsAt(): Promise<Date | null> {
    const [row] = await this.prisma.client.$queryRaw<{ at: Date | null }[]>`
      SELECT max("observedAt") AS at FROM public.odds_latest
    `;
    return row?.at ?? null;
  }

  /** ETL failures (passes, the quota) sent to the team since `since`. */
  async etlFailures(since: Date): Promise<{
    count: number;
    lastBody: string | null;
    quotaBody: string | null;
  }> {
    const rows = await this.prisma.client.notification.findMany({
      where: { type: 'ETL_FAILURE', userId: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { body: true },
    });
    const quota = rows.find((row) => /quota/i.test(row.body));
    return {
      count: rows.length,
      lastBody: rows.find((row) => row !== quota)?.body ?? null,
      quotaBody: quota?.body ?? null,
    };
  }

  /**
   * Finished matches still without stats after STATS_LATE_DAYS, in the
   * competitions whose stats usually arrive (a share over 60 days).
   */
  async statsLate(now: Date): Promise<{
    fixtures: number;
    competitions: number;
  }> {
    const lateUntil = new Date(now.getTime() - R.STATS_LATE_DAYS * DAY_MS);
    const lateFrom = new Date(
      now.getTime() - R.STATS_LATE_WINDOW_DAYS * DAY_MS,
    );
    const reliableFrom = new Date(
      now.getTime() - R.STATS_RELIABLE_WINDOW_DAYS * DAY_MS,
    );
    const [row] = await this.prisma.client.$queryRaw<
      { fixtures: bigint; competitions: bigint }[]
    >`
      WITH finished AS (
        SELECT f.id, s."competitionId",
               EXISTS (SELECT 1 FROM public.fixture_statistic fs
                       WHERE fs."fixtureId" = f.id) AS has_stats,
               f."scheduledAt", f."statisticsUnavailable" AS unavailable
        FROM public.fixture f
        JOIN public.season s ON s.id = f."seasonId"
        WHERE f.status = 'FINISHED'
          AND f."scheduledAt" >= ${reliableFrom}
          AND f."scheduledAt" < ${lateUntil}
      ),
      reliable AS (
        SELECT "competitionId" FROM finished
        GROUP BY "competitionId"
        HAVING count(*) >= ${R.STATS_RELIABLE_MIN_FIXTURES}
           AND avg(CASE WHEN has_stats THEN 1 ELSE 0 END) >= ${R.STATS_RELIABLE_SHARE}
      )
      SELECT count(*) AS fixtures,
             count(DISTINCT f."competitionId") AS competitions
      FROM finished f
      JOIN reliable r ON r."competitionId" = f."competitionId"
      WHERE NOT f.has_stats AND NOT f.unavailable
        AND f."scheduledAt" >= ${lateFrom}
    `;
    return {
      fixtures: Number(row?.fixtures ?? 0),
      competitions: Number(row?.competitions ?? 0),
    };
  }

  /** Coupons composed for a day (rank 1 or not, any source). */
  countCouponsFor(forDate: Date): Promise<number> {
    return this.prisma.client.couponProposal.count({ where: { forDate } });
  }

  async lastAnalysisAt(): Promise<Date | null> {
    const row = await this.prisma.client.modelRun.findFirst({
      orderBy: { analyzedAt: 'desc' },
      select: { analyzedAt: true },
    });
    return row?.analyzedAt ?? null;
  }

  /** The last opinion the AI published (channel VANTAGE). */
  async lastAiAt(): Promise<Date | null> {
    const [row] = await this.prisma.client.$queryRaw<{ at: Date | null }[]>`
      SELECT max("createdAt") AS at FROM public.channel_decision
      WHERE channel = 'VANTAGE'
    `;
    return row?.at ?? null;
  }

  activeSuspensions(): Promise<{ market: string; createdAt: Date }[]> {
    return this.prisma.client.marketSuspension.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: { market: true, createdAt: true },
    });
  }

  /** The last time a player (not the team) opened the app. */
  async lastPlayerSeenAt(): Promise<Date | null> {
    const [row] = await this.prisma.client.$queryRaw<{ at: Date | null }[]>`
      SELECT max(a."firstSeenAt") AS at
      FROM public.user_activity_day a
      JOIN public.users u ON u.id = a."userId"
      WHERE u.role <> 'ADMIN'
    `;
    return row?.at ?? null;
  }

  /**
   * Open conversations whose last message is the player's, older than
   * SUPPORT_UNANSWERED_HOURS: the team owes an answer.
   */
  async unansweredMessages(now: Date): Promise<number> {
    const before = new Date(
      now.getTime() - R.SUPPORT_UNANSWERED_HOURS * HOUR_MS,
    );
    const [row] = await this.prisma.client.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n
      FROM public.support_conversation c
      JOIN LATERAL (
        SELECT m."senderId", m."createdAt" FROM public.support_message m
        WHERE m."conversationId" = c.id
        ORDER BY m."createdAt" DESC LIMIT 1
      ) last ON true
      WHERE c.status = 'OPEN'
        AND last."senderId" = c."userId"
        AND last."createdAt" < ${before}
    `;
    return Number(row?.n ?? 0);
  }

  lights(): Promise<
    { light: string; state: string; changedAt: Date; notifiedAt: Date | null }[]
  > {
    return this.prisma.client.consoleLight.findMany({
      select: { light: true, state: true, changedAt: true, notifiedAt: true },
    });
  }

  /**
   * Records a light's state at a check: a new state resets when it changed
   * and its e-mail, the same state only moves checkedAt.
   */
  async recordLight(input: {
    light: string;
    state: string;
    now: Date;
  }): Promise<void> {
    const { light, state, now } = input;
    await this.prisma.client.$executeRaw`
      INSERT INTO public.console_light (light, state, "changedAt", "notifiedAt", "checkedAt")
      VALUES (${light}, ${state}, ${now}, NULL, ${now})
      ON CONFLICT (light) DO UPDATE SET
        "changedAt" = CASE WHEN console_light.state = EXCLUDED.state
                           THEN console_light."changedAt" ELSE EXCLUDED."changedAt" END,
        "notifiedAt" = CASE WHEN console_light.state = EXCLUDED.state
                            THEN console_light."notifiedAt" ELSE NULL END,
        state = EXCLUDED.state,
        "checkedAt" = EXCLUDED."checkedAt"
    `;
  }

  /**
   * Claims the red e-mail of a light: true once per red, whoever checks
   * first (two checks at once never send it twice).
   */
  async claimRedNotice(light: string, now: Date): Promise<boolean> {
    const claimed = await this.prisma.client.$executeRaw`
      UPDATE public.console_light SET "notifiedAt" = ${now}
      WHERE light = ${light} AND state = 'red' AND "notifiedAt" IS NULL
    `;
    return claimed === 1;
  }

  /** Players (not the team) active, follows and sign-ups on one UTC day. */
  async dayFigures(day: Date): Promise<{
    active: number;
    follows: number;
    signups: number;
  }> {
    const next = new Date(day.getTime() + DAY_MS);
    const [row] = await this.prisma.client.$queryRaw<
      { active: bigint; follows: bigint; signups: bigint }[]
    >`
      SELECT
        (SELECT count(DISTINCT a."userId") FROM public.user_activity_day a
         JOIN public.users u ON u.id = a."userId"
         WHERE a.day = ${day}::date AND u.role <> 'ADMIN') AS active,
        (SELECT count(*) FROM public.coupon_follow
         WHERE "createdAt" >= ${day} AND "createdAt" < ${next}) AS follows,
        (SELECT count(*) FROM public.users
         WHERE "createdAt" >= ${day} AND "createdAt" < ${next}
           AND role <> 'ADMIN') AS signups
    `;
    return {
      active: Number(row?.active ?? 0),
      follows: Number(row?.follows ?? 0),
      signups: Number(row?.signups ?? 0),
    };
  }

  /** The scheduled passes' switch when it is off: since when, by whom. */
  async passesOff(): Promise<{ since: Date; by: string | null } | null> {
    const row = await this.prisma.client.appSetting.findUnique({
      where: { key: 'scheduling.enabled' },
      select: {
        value: true,
        updatedAt: true,
        updatedBy: { select: { fullName: true } },
      },
    });
    if (!row || row.value !== false) return null;
    return { since: row.updatedAt, by: row.updatedBy?.fullName ?? null };
  }

  /**
   * Per product, the legs of its coupons in a span of days: how many, their
   * mean closing line value and 1xBet margin (unknown ones left out).
   */
  async productLegs(span: { from: Date | null; to: Date }): Promise<
    {
      product: string;
      legs: number;
      clv: number | null;
      margin: number | null;
    }[]
  > {
    const rows = await this.prisma.client.$queryRaw<
      {
        product: string;
        legs: bigint;
        clv: number | null;
        margin: number | null;
      }[]
    >`
      SELECT pd.product::text AS product,
             count(l.id) AS legs,
             avg(l."closingLineValue")::float AS clv,
             avg(l."operatorMargin")::float AS margin
      FROM public.product_day pd
      JOIN public.coupon_proposal_leg l ON l."couponProposalId" = pd."couponProposalId"
      WHERE pd."forDate" <= ${span.to}
        AND (${span.from}::timestamp IS NULL OR pd."forDate" >= ${span.from})
      GROUP BY pd.product
    `;
    return rows.map((row) => ({ ...row, legs: Number(row.legs) }));
  }

  /**
   * The AI's settled opinions by configuration version, in a span: the
   * same cohort as Résultats (one frozen opinion per match, vantageCohortSql),
   * never every re-analysis.
   */
  async aiVersions(input: {
    span: { from: Date | null; to: Date };
    asOf: Date;
  }): Promise<
    {
      version: string;
      from: Date;
      to: Date;
      won: bigint;
      lost: bigint;
      announced: number | null;
      margin: number | null;
    }[]
  > {
    const since = input.span.from ?? new Date('2020-01-01T00:00:00.000Z');
    const until = new Date(input.span.to.getTime() + DAY_MS - 1);
    return this.prisma.client.$queryRaw`
      WITH cohort AS (
        ${vantageCohortSql({ asOf: input.asOf, since, until })}
      )
      SELECT coalesce(h."configVersion", '—') AS version,
             min(f."scheduledAt") AS "from", max(f."scheduledAt") AS "to",
             count(*) FILTER (WHERE h.result = 'WON') AS won,
             count(*) FILTER (WHERE h.result = 'LOST') AS lost,
             avg(h.probability)::float AS announced,
             avg(h."marginPaid")::float AS margin
      FROM cohort c
      JOIN public.vantage_decision_history h ON h.id = c.id
      JOIN public.fixture f ON f.id = h."fixtureId"
      WHERE h.result IN ('WON', 'LOST')
      GROUP BY 1
      ORDER BY min(f."scheduledAt") DESC
    `;
  }
}
