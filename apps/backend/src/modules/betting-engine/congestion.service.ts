import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import {
  computeCongestionScoreFromTeams,
  CONGESTION_UPCOMING_WINDOW_MS,
  type TeamCongestionInputs,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

type ComputeCongestionScoreInput = {
  homeTeamId: string;
  awayTeamId: string;
  fixtureDate: Date;
};

// The congestion math (rest penalty + upcoming schedule density) now lives
// in @evcore/analysis-core (extracted 2026-08-18 — same pattern as odds-
// assembly/team-stats-resolution/h2h) so the backtest harness replays the
// exact same signal. This service keeps only the Prisma I/O.
@Injectable()
export class CongestionService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCongestionScore(
    input: ComputeCongestionScoreInput,
  ): Promise<number> {
    const { homeTeamId, awayTeamId, fixtureDate } = input;

    const [homeInputs, awayInputs] = await Promise.all([
      this.fetchTeamCongestionInputs(homeTeamId, fixtureDate),
      this.fetchTeamCongestionInputs(awayTeamId, fixtureDate),
    ]);

    return computeCongestionScoreFromTeams(homeInputs, awayInputs);
  }

  private async fetchTeamCongestionInputs(
    teamId: string,
    fixtureDate: Date,
  ): Promise<TeamCongestionInputs> {
    const [lastPlayedFixture, upcomingFixtureCount] = await Promise.all([
      this.prisma.client.fixture.findFirst({
        where: {
          status: FixtureStatus.FINISHED,
          scheduledAt: { lt: fixtureDate },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        select: { scheduledAt: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: FixtureStatus.SCHEDULED,
          scheduledAt: {
            gt: fixtureDate,
            lte: new Date(
              fixtureDate.getTime() + CONGESTION_UPCOMING_WINDOW_MS,
            ),
          },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
      }),
    ]);

    return {
      lastPlayedAt: lastPlayedFixture?.scheduledAt ?? null,
      upcomingFixtureCount,
      fixtureDate,
    };
  }
}
