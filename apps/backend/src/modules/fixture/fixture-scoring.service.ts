import { Injectable } from '@nestjs/common';
import { Prisma, FixtureStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { toNumber } from '@utils/prisma.utils';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import { formatSigned } from '@modules/dashboard/dashboard.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import type {
  PickSnapshot,
  EvaluatedPickSnapshot,
} from '@utils/model-run.utils';
import type { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export type ScoredFixtureModelRun = {
  modelRunId: string;
  decision: 'BET' | 'NO_BET';
  deterministicScore: string;
  finalScore: string;
  betId: string | null;
  market: string | null;
  pick: string | null;
  betStatus: 'WON' | 'LOST' | 'PENDING' | null;
  probEstimated: string | null;
  ev: string | null;
  predictionSource: string | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  candidatePicks: PickSnapshot[];
  evaluatedPicks: EvaluatedPickSnapshot[];
};

export type ScoredFixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  competitionCode: string;
  scheduledAt: string;
  status: string;
  score: string | null;
  htScore: string | null;
  hasOdds: boolean;
  alreadyInUserTicket: boolean;
  modelRun: ScoredFixtureModelRun | null;
};

export type ScoredFixturesResult = {
  rows: ScoredFixtureRow[];
  total: number;
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
// Sort: BET (EV desc) → NO_BET (finalScore desc) → sans modelRun
// ---------------------------------------------------------------------------

function sortByReliability(rows: ScoredFixtureRow[]): ScoredFixtureRow[] {
  return rows.sort((a, b) => {
    const aHasRun = a.modelRun !== null;
    const bHasRun = b.modelRun !== null;

    if (!aHasRun && !bHasRun) return 0;
    if (!aHasRun) return 1;
    if (!bHasRun) return -1;

    const aIsBet = a.modelRun?.decision === 'BET';
    const bIsBet = b.modelRun?.decision === 'BET';

    if (aIsBet !== bIsBet) return aIsBet ? -1 : 1;

    if (aIsBet) {
      return (
        parseFloat(b.modelRun?.ev ?? '0') - parseFloat(a.modelRun?.ev ?? '0')
      );
    }

    return (
      parseFloat(b.modelRun?.finalScore ?? '0') -
      parseFloat(a.modelRun?.finalScore ?? '0')
    );
  });
}

// ---------------------------------------------------------------------------

@Injectable()
export class FixtureScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getFixtures(
    date: Date,
    filters: Pick<
      FixtureScoringQueryDto,
      'decision' | 'status' | 'competition' | 'timeSlot' | 'betStatus'
    > = {},
    userId?: string,
  ): Promise<ScoredFixturesResult> {
    const dateRange: Prisma.FixtureWhereInput = {
      scheduledAt: { gte: startOfUtcDay(date), lte: endOfUtcDay(date) },
    };

    const where: Prisma.FixtureWhereInput = { ...dateRange };

    if (filters.status) {
      where.status = filters.status as FixtureStatus;
    }

    if (filters.competition) {
      where.season = { competition: { code: filters.competition } };
    }

    const [total, fixtures] = await Promise.all([
      this.prisma.client.fixture.count({ where: dateRange }),
      this.prisma.client.fixture.findMany({
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
              competition: { select: { code: true, name: true } },
            },
          },
          oddsSnapshots: { select: { id: true }, take: 1 },
          modelRuns: {
            select: {
              id: true,
              decision: true,
              deterministicScore: true,
              finalScore: true,
              features: true,
              analyzedAt: true,
              bets: {
                select: {
                  id: true,
                  market: true,
                  pick: true,
                  ev: true,
                  probEstimated: true,
                  status: true,
                },
                orderBy: { ev: 'desc' },
                take: 1,
              },
            },
            orderBy: { analyzedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { season: { competition: { name: 'asc' } } },
          { scheduledAt: 'asc' },
        ],
      }),
    ]);

    const filteredFixtures = filters.timeSlot
      ? fixtures.filter((f) =>
          matchesTimeSlot(f.scheduledAt, filters.timeSlot!),
        )
      : fixtures;

    const userFixtureIds =
      userId && filteredFixtures.length > 0
        ? new Set(
            (
              await this.prisma.client.betSlipItem.findMany({
                where: {
                  userId,
                  fixtureId: {
                    in: filteredFixtures.map((fixture) => fixture.id),
                  },
                },
                distinct: ['fixtureId'],
                select: { fixtureId: true },
              })
            ).map((item) => item.fixtureId),
          )
        : new Set<string>();

    let rows: ScoredFixtureRow[] = filteredFixtures.map((f) => {
      const run = f.modelRuns[0] ?? null;
      const bet = run?.bets[0] ?? null;
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
        competitionCode: f.season.competition.code,
        scheduledAt: formatTimeUtc(f.scheduledAt),
        status: f.status,
        score:
          f.homeScore !== null && f.awayScore !== null
            ? `${f.homeScore} - ${f.awayScore}`
            : null,
        htScore:
          f.homeHtScore !== null && f.awayHtScore !== null
            ? `${f.homeHtScore} - ${f.awayHtScore}`
            : null,
        hasOdds: f.oddsSnapshots.length > 0,
        alreadyInUserTicket: userFixtureIds.has(f.id),
        modelRun: run
          ? {
              modelRunId: run.id,
              decision: run.decision as 'BET' | 'NO_BET',
              deterministicScore: toNumber(run.deterministicScore).toFixed(2),
              finalScore: toNumber(run.finalScore).toFixed(3),
              betId: bet?.id ?? null,
              market: bet?.market ?? null,
              pick: bet?.pick ?? null,
              betStatus,
              probEstimated: bet
                ? `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`
                : null,
              ev: bet ? formatSigned(toNumber(bet.ev), 3) : null,
              predictionSource: featureDiag?.predictionSource ?? null,
              lambdaHome: featureDiag?.lambdaHome ?? null,
              lambdaAway: featureDiag?.lambdaAway ?? null,
              expectedTotalGoals: featureDiag?.expectedTotalGoals ?? null,
              candidatePicks: featureDiag?.candidatePicks ?? [],
              evaluatedPicks: featureDiag?.evaluatedPicks ?? [],
            }
          : null,
      };
    });

    if (filters.decision) {
      rows = rows.filter((r) => r.modelRun?.decision === filters.decision);
    }

    if (filters.betStatus) {
      rows = rows.filter((r) => r.modelRun?.betStatus === filters.betStatus);
    }

    return { rows: sortByReliability(rows), total };
  }
}
