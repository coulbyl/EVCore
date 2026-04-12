import { Injectable } from '@nestjs/common';
import { toNumber } from '@utils/prisma.utils';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import { formatSigned } from '@modules/dashboard/dashboard.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import { AuditRepository } from './audit.repository';
import type {
  AuditDiagnostics,
  AuditFixtureRow,
  AuditOverview,
} from './audit.types';
import type { AuditFixturesQueryDto } from './dto/audit-fixtures-query.dto';

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

function getUtcHour(isoDatetime: string): number {
  return new Date(isoDatetime).getUTCHours();
}

function matchesTimeSlot(
  isoDatetime: string,
  slot: keyof typeof TIME_SLOTS,
): boolean {
  const hour = getUtcHour(isoDatetime);
  const { start, end } = TIME_SLOTS[slot];
  return hour >= start && hour <= end;
}

// ---------------------------------------------------------------------------
// Sort by reliability: BET (EV desc) → NO_BET (finalScore desc) → sans run
// ---------------------------------------------------------------------------

function sortByReliability(rows: AuditFixtureRow[]): AuditFixtureRow[] {
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
      const aEv = parseFloat(a.modelRun?.ev ?? '0');
      const bEv = parseFloat(b.modelRun?.ev ?? '0');
      return bEv - aEv;
    }

    const aScore = parseFloat(a.modelRun?.finalScore ?? '0');
    const bScore = parseFloat(b.modelRun?.finalScore ?? '0');
    return bScore - aScore;
  });
}

// ---------------------------------------------------------------------------

function extractDiagnostics(features: unknown): AuditDiagnostics {
  if (features === null || typeof features !== 'object') {
    return {
      lambdaFloorHit: false,
      lineMovement: null,
      h2hScore: null,
      congestionScore: null,
    };
  }
  const f = features as Record<string, unknown>;
  return {
    lambdaFloorHit: f['lambdaFloorHit'] === true,
    lineMovement:
      typeof f['shadow_lineMovement'] === 'number'
        ? f['shadow_lineMovement']
        : null,
    h2hScore: typeof f['shadow_h2h'] === 'number' ? f['shadow_h2h'] : null,
    congestionScore:
      typeof f['shadow_congestion'] === 'number'
        ? f['shadow_congestion']
        : null,
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async getFixtures(
    date: Date,
    filters: Pick<
      AuditFixturesQueryDto,
      'decision' | 'status' | 'competition' | 'timeSlot'
    > = {},
  ): Promise<AuditFixtureRow[]> {
    const fixtures = await this.repo.getFixturesForDate(
      startOfUtcDay(date),
      endOfUtcDay(date),
      {
        status: filters.status,
        competitionCode: filters.competition,
      },
    );

    let rows: AuditFixtureRow[] = fixtures.map((f) => {
      const run = f.modelRuns[0] ?? null;
      const bet = run?.bets[0] ?? null;
      const betStatus: AuditFixtureRow['modelRun'] extends infer T
        ? T extends { betStatus: infer S }
          ? S
          : never
        : never = bet
        ? bet.status === 'WON' || bet.status === 'LOST'
          ? bet.status
          : 'PENDING'
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
        modelRun: run
          ? (() => {
              const featureDiag = extractModelRunFeatureDiagnostics(
                run.features,
              );
              return {
                decision: run.decision as 'BET' | 'NO_BET',
                deterministicScore: toNumber(run.deterministicScore).toFixed(2),
                finalScore: toNumber(run.finalScore).toFixed(3),
                market: bet?.market ?? null,
                pick: bet?.pick ?? null,
                betStatus,
                probEstimated: bet
                  ? `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`
                  : null,
                ev: bet ? formatSigned(toNumber(bet.ev), 3) : null,
                predictionSource: featureDiag.predictionSource,
                lambdaHome: featureDiag.lambdaHome,
                lambdaAway: featureDiag.lambdaAway,
                expectedTotalGoals: featureDiag.expectedTotalGoals,
                candidatePicks: featureDiag.candidatePicks,
                evaluatedPicks: featureDiag.evaluatedPicks,
                diagnostics: extractDiagnostics(run.features),
              };
            })()
          : null,
      };
    });

    // Filtres appliqués après mapping (décision sur le dernier run, créneau horaire)
    if (filters.decision) {
      rows = rows.filter((r) => r.modelRun?.decision === filters.decision);
    }

    if (filters.timeSlot) {
      rows = rows.filter((r) =>
        matchesTimeSlot(r.scheduledAt, filters.timeSlot!),
      );
    }

    return sortByReliability(rows);
  }

  async getOverview(): Promise<AuditOverview> {
    const data = await this.repo.getOverviewData();

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        fixtures: data.fixturesTotal,
        modelRuns: data.modelRunsTotal,
        bets: data.betsTotal,
      },
      leagueBreakdown: data.leagueBreakdown.map((r) => {
        const fixtures = Number(r.fixtures);
        const finished = Number(r.finished);
        const withXg = Number(r.with_xg);
        return {
          code: r.code,
          name: r.name,
          isActive: r.active,
          fixtures,
          finished,
          withXg,
          withOdds: Number(r.with_odds),
          teamStats: Number(r.team_stats),
          xgCoveragePct:
            finished > 0 ? Math.round((withXg / finished) * 100) : 0,
        };
      }),
      betsByStatus: data.betsByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      betsByMarket: data.betsByMarket.map((r) => ({
        market: r.market,
        count: r._count.id,
      })),
      settledBets: data.settledBets,
      adjustmentProposals: data.adjustmentProposals,
      activeSuspensions: data.activeSuspensions,
    };
  }
}
