import { Injectable } from '@nestjs/common';
import { CONSOLE_RULES as R } from '@config/console.constants';
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
}
