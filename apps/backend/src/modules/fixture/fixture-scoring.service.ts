import { Injectable } from '@nestjs/common';
import { Prisma, FixtureStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import type { EvaluatedPickSnapshot } from '@utils/model-run.utils';
import type { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

// betId, market, pick, betStatus, probEstimated, ev et safeValueBet venaient
// des paris internes VALUE/SAFE de la table `bet`, plus écrite depuis le
// 2026-09-04 : ils étaient nuls sur tous les matchs récents, et l'écran
// affichait « Aucun marché ne répond aux critères » partout (revue UX du
// 2026-10-27, Matchs P1-3). Retirés.
export type ScoredFixtureModelRun = {
  modelRunId: string;
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
};

/**
 * Fiche d'un match, ouverte depuis Décisions : les buts attendus, les
 * facteurs et toutes les lectures évaluées avec leur motif de rejet. C'est un
 * diagnostic : le front n'y filtre ni ne classe rien de ce que le moteur a
 * évalué (mémoire projet « fiche = diagnostic »).
 */
export type FixtureSheet = ScoredFixtureRow & {
  homeTeam: string;
  awayTeam: string;
  country: string | null;
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

// Absolute [start, end] bounds of a time slot on the given day, so the slot
// can be applied as a `scheduledAt` bound in the Prisma `where` instead of
// filtering fetched rows in memory.
function timeSlotBounds(
  date: Date,
  slot: keyof typeof TIME_SLOTS,
): { gte: Date; lte: Date } {
  const { start, end } = TIME_SLOTS[slot];
  const dayStart = startOfUtcDay(date);
  const gte = new Date(dayStart);
  gte.setUTCHours(start, 0, 0, 0);
  const lte = new Date(dayStart);
  lte.setUTCHours(end, 59, 59, 999);
  return { gte, lte };
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
      'status' | 'competition' | 'timeSlot'
    > = {},
    options: {
      cursor?: string;
      limit?: number;
    } = {},
  ): Promise<ScoredFixturesResult> {
    const { cursor, limit } = options;
    const usePagination = limit != null;

    const scheduledAtBounds = filters.timeSlot
      ? timeSlotBounds(date, filters.timeSlot)
      : { gte: startOfUtcDay(date), lte: endOfUtcDay(date) };

    const baseWhere: Prisma.FixtureWhereInput = {
      scheduledAt: scheduledAtBounds,
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
      select: FIXTURE_ROW_SELECT,
      orderBy: [
        { season: { competition: { name: 'asc' } } },
        { scheduledAt: 'asc' },
        { id: 'asc' },
      ],
      ...(usePagination ? { take: limit + 1 } : {}),
    });

    const hasMore = usePagination && fixtures.length > limit;
    const fixturesPage = hasMore ? fixtures.slice(0, limit) : fixtures;

    const rows: ScoredFixtureRow[] = fixturesPage.map((f) => toScoredRow(f));

    const lastFixture = fixturesPage[fixturesPage.length - 1];
    const nextCursor =
      usePagination && hasMore && lastFixture
        ? encodeCursor(lastFixture)
        : null;

    return { rows, total: rows.length, nextCursor };
  }

  async getFixtureSheet(fixtureId: string): Promise<FixtureSheet | null> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        ...FIXTURE_ROW_SELECT,
        season: {
          select: { competition: { select: { name: true, country: true } } },
        },
      },
    });
    if (!fixture) return null;
    return {
      ...toScoredRow(fixture),
      homeTeam: fixture.homeTeam.name,
      awayTeam: fixture.awayTeam.name,
      country: fixture.season.competition.country ?? null,
    };
  }
}

/** Champs d'un match et de sa dernière analyse, partagés par la liste et la
 * fiche. */
const FIXTURE_ROW_SELECT = {
  id: true,
  scheduledAt: true,
  status: true,
  homeScore: true,
  awayScore: true,
  homeHtScore: true,
  awayHtScore: true,
  homeTeam: { select: { name: true, logoUrl: true } },
  awayTeam: { select: { name: true, logoUrl: true } },
  season: { select: { competition: { select: { name: true } } } },
  modelRuns: {
    select: { id: true, features: true, analyzedAt: true },
    orderBy: { analyzedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.FixtureSelect;

type FixtureRowSource = Prisma.FixtureGetPayload<{
  select: typeof FIXTURE_ROW_SELECT;
}>;

function toScoredRow(f: FixtureRowSource): ScoredFixtureRow {
  const run = f.modelRuns[0] ?? null;
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
          lambdaHome: featureDiag?.lambdaHome ?? null,
          lambdaAway: featureDiag?.lambdaAway ?? null,
          expectedTotalGoals: featureDiag?.expectedTotalGoals ?? null,
          evaluatedPicks: featureDiag?.evaluatedPicks ?? [],
          factors: featureDiag?.factors ?? null,
        }
      : null,
  };
}
