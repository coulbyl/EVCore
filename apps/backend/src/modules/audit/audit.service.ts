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

  async getFixtures(date: Date): Promise<AuditFixtureRow[]> {
    const fixtures = await this.repo.getFixturesForDate(
      startOfUtcDay(date),
      endOfUtcDay(date),
    );

    return fixtures.map((f) => {
      const run = f.modelRuns[0] ?? null;
      const bet = run?.bets[0] ?? null;

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
                betStatus: bet
                  ? bet.status === 'WON' || bet.status === 'LOST'
                    ? bet.status
                    : 'PENDING'
                  : null,
                probEstimated: bet
                  ? `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`
                  : null,
                ev: bet ? formatSigned(toNumber(bet.ev), 3) : null,
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
  }

  async getOverview(): Promise<AuditOverview> {
    const data = await this.repo.getOverviewData();

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        fixtures: data.fixturesTotal,
        modelRuns: data.modelRunsTotal,
        bets: data.betsTotal,
        coupons: data.couponsTotal,
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
      couponsByStatus: data.couponsByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      settledBets: data.settledBets,
      adjustmentProposals: data.adjustmentProposals,
      activeSuspensions: data.activeSuspensions,
    };
  }
}
