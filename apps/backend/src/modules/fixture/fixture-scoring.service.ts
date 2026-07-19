import { Injectable } from '@nestjs/common';
import { Prisma, FixtureStatus, BetSource, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { toNumber } from '@utils/prisma.utils';
import { startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { formatSigned } from '@modules/dashboard/dashboard.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import type { EvaluatedPickSnapshot } from '@utils/model-run.utils';
import type { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ScoredFixtureModelRun = {
  modelRunId: string;
  betId: string | null;
  market: string | null;
  pick: string | null;
  betStatus: 'WON' | 'LOST' | 'PENDING' | null;
  probEstimated: string | null;
  ev: string | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  evaluatedPicks: EvaluatedPickSnapshot[];
  factors: {
    recentForm: number | null;
    xg: number | null;
    performanceDomExt: number | null;
    volatiliteLigue: number | null;
  } | null;
};

export type ScoredFixtureSvBet = {
  betId: string;
  market: string;
  pick: string;
};

export type ScoredFixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  status: string;
  score: string | null;
  htScore: string | null;
  modelRun: ScoredFixtureModelRun | null;
  safeValueBet: ScoredFixtureSvBet | null;
};

export type ScoredFixturesResult = {
  rows: ScoredFixtureRow[];
  total: number;
  nextCursor: string | null;
};

// ---------------------------------------------------------------------------
// Time slot definitions (heure UTC)
// ---------------------------------------------------------------------------

const TIME_SLOTS = {
  morning: { start: 0, end: 11 },
  noon: { start: 12, end: 13 },
  afternoon: { start: 14, end: 17 },
  evening: { start: 18, end: 21 },
  night: { start: 22, end: 23 },
} as const;

function matchesTimeSlot(date: Date, slot: keyof typeof TIME_SLOTS): boolean {
  const hour = date.getUTCHours();
  const { start, end } = TIME_SLOTS[slot];
  return hour >= start && hour <= end;
}

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

type FixtureCursor = {
  competitionName: string;
  scheduledAt: string;
  id: string;
};

function decodeCursor(raw: string): FixtureCursor | null {
  try {
    return JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as FixtureCursor;
  } catch {
    return null;
  }
}

function encodeCursor(fixture: {
  id: string;
  scheduledAt: Date;
  season: { competition: { name: string } };
}): string {
  const payload: FixtureCursor = {
    competitionName: fixture.season.competition.name,
    scheduledAt: fixture.scheduledAt.toISOString(),
    id: fixture.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// ---------------------------------------------------------------------------

@Injectable()
export class FixtureScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getFixtures(
    date: Date,
    filters: Pick<
      FixtureScoringQueryDto,
      'status' | 'competition' | 'timeSlot' | 'betStatus'
    > = {},
    options: {
      cursor?: string;
      limit?: number;
    } = {},
  ): Promise<ScoredFixturesResult> {
    const { cursor, limit } = options;
    const usePagination = limit != null;

    const baseWhere: Prisma.FixtureWhereInput = {
      scheduledAt: { gte: startOfUtcDay(date), lte: endOfUtcDay(date) },
      ...(filters.status ? { status: filters.status as FixtureStatus } : {}),
      season: {
        competition: {
          isActive: true,
          ...(filters.competition ? { code: filters.competition } : {}),
        },
      },
    };

    const decoded = usePagination && cursor ? decodeCursor(cursor) : null;
    const where: Prisma.FixtureWhereInput = decoded
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                {
                  season: {
                    competition: { name: { gt: decoded.competitionName } },
                  },
                },
                {
                  season: {
                    competition: { name: { equals: decoded.competitionName } },
                  },
                  scheduledAt: { gt: new Date(decoded.scheduledAt) },
                },
                {
                  season: {
                    competition: { name: { equals: decoded.competitionName } },
                  },
                  scheduledAt: { equals: new Date(decoded.scheduledAt) },
                  id: { gt: decoded.id },
                },
              ],
            },
          ],
        }
      : baseWhere;

    const fixtures = await this.prisma.client.fixture.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season: {
          select: {
            competition: { select: { name: true } },
          },
        },
        modelRuns: {
          select: {
            id: true,
            features: true,
            analyzedAt: true,
            bets: {
              where: {
                source: BetSource.MODEL,
                channelSelection: {
                  is: {
                    channelDecision: {
                      is: {
                        channel: {
                          in: [StrategyChannel.VALUE, StrategyChannel.SAFE],
                        },
                      },
                    },
                  },
                },
              },
              select: {
                id: true,
                market: true,
                pick: true,
                ev: true,
                probEstimated: true,
                status: true,
                channelSelection: {
                  select: { channelDecision: { select: { channel: true } } },
                },
              },
              orderBy: { ev: 'desc' },
              take: 2,
            },
          },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { season: { competition: { name: 'asc' } } },
        { scheduledAt: 'asc' },
        { id: 'asc' },
      ],
      ...(usePagination ? { take: limit + 1 } : {}),
    });

    const hasMore = usePagination && fixtures.length > limit;
    const fixturesPage = hasMore ? fixtures.slice(0, limit) : fixtures;

    const filteredFixtures = filters.timeSlot
      ? fixturesPage.filter((f) =>
          matchesTimeSlot(f.scheduledAt, filters.timeSlot!),
        )
      : fixturesPage;

    let rows: ScoredFixtureRow[] = filteredFixtures.map((f) => {
      const run = f.modelRuns[0] ?? null;
      const bet =
        run?.bets.find(
          (b) =>
            b.channelSelection?.channelDecision.channel ===
            StrategyChannel.VALUE,
        ) ?? null;
      const svBet =
        run?.bets.find(
          (b) =>
            b.channelSelection?.channelDecision.channel ===
            StrategyChannel.SAFE,
        ) ?? null;
      const betStatus =
        bet?.status === 'WON' || bet?.status === 'LOST'
          ? bet.status
          : bet
            ? 'PENDING'
            : null;

      const featureDiag = run
        ? extractModelRunFeatureDiagnostics(run.features)
        : null;

      return {
        fixtureId: f.id,
        fixture: `${f.homeTeam.name} vs ${f.awayTeam.name}`,
        homeLogo: f.homeTeam.logoUrl ?? null,
        awayLogo: f.awayTeam.logoUrl ?? null,
        competition: f.season.competition.name,
        scheduledAt: f.scheduledAt.toISOString(),
        status: f.status,
        score:
          f.homeScore !== null && f.awayScore !== null
            ? `${f.homeScore} - ${f.awayScore}`
            : null,
        htScore:
          f.homeHtScore !== null && f.awayHtScore !== null
            ? `${f.homeHtScore} - ${f.awayHtScore}`
            : null,
        modelRun: run
          ? {
              modelRunId: run.id,
              betId: bet?.id ?? null,
              market: bet?.market ?? null,
              pick: bet?.pick ?? null,
              betStatus,
              probEstimated: bet
                ? `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`
                : null,
              ev: bet ? formatSigned(toNumber(bet.ev), 3) : null,
              lambdaHome: featureDiag?.lambdaHome ?? null,
              lambdaAway: featureDiag?.lambdaAway ?? null,
              expectedTotalGoals: featureDiag?.expectedTotalGoals ?? null,
              evaluatedPicks: featureDiag?.evaluatedPicks ?? [],
              factors: featureDiag?.factors ?? null,
            }
          : null,
        safeValueBet: svBet
          ? {
              betId: svBet.id,
              market: svBet.market ?? '',
              pick: svBet.pick ?? '',
            }
          : null,
      };
    });

    if (filters.betStatus) {
      rows = rows.filter((r) => r.modelRun?.betStatus === filters.betStatus);
    }

    const lastFixture = fixturesPage[fixturesPage.length - 1];
    const nextCursor =
      usePagination && hasMore && lastFixture
        ? encodeCursor(lastFixture)
        : null;

    return { rows, total: rows.length, nextCursor };
  }
}
