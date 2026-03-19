import { Injectable } from '@nestjs/common';
import { toNumber } from '@utils/prisma.utils';
import { startOfUtcDay, endOfUtcDay, formatTimeUtc } from '@utils/date.utils';
import { formatSigned } from '@modules/dashboard/dashboard.utils';
import { AuditRepository } from './audit.repository';
import type { AuditFixtureRow, AuditOverview } from './audit.types';

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
        hasOdds: f.oddsSnapshots.length > 0,
        modelRun: run
          ? {
              decision: run.decision as 'BET' | 'NO_BET',
              deterministicScore: toNumber(run.deterministicScore).toFixed(2),
              finalScore: toNumber(run.finalScore).toFixed(3),
              market: bet?.market ?? null,
              pick: bet?.pick ?? null,
              ev: bet ? formatSigned(toNumber(bet.ev), 3) : null,
            }
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
