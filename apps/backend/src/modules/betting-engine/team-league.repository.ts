import { Injectable } from '@nestjs/common';
import {
  EUROPEAN_COMPETITION_CODE_SET,
  NATIONAL_TEAM_COMPETITION_CODE_SET,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

// Friendlies are neither a league nor a cup with a level of their own.
const NON_LEAGUE_CODES = [
  ...EUROPEAN_COMPETITION_CODE_SET,
  ...NATIONAL_TEAM_COMPETITION_CODE_SET,
  'FRI',
];

/**
 * A team's national league as the engine sees it: the competition of its
 * most recent team_stats line before a date, outside the European cups,
 * the national-team competitions and friendlies. Same rule as
 * PointInTimeLoader.loadDomesticLeague in @evcore/backtest-core, which the
 * league-strength replay validated.
 */
@Injectable()
export class TeamLeagueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDomesticLeagueCode(input: {
    teamId: string;
    beforeDate: Date;
  }): Promise<string | null> {
    const row = await this.prisma.client.teamStats.findFirst({
      where: {
        teamId: input.teamId,
        afterFixture: {
          scheduledAt: { lt: input.beforeDate },
          season: { competition: { code: { notIn: NON_LEAGUE_CODES } } },
        },
      },
      orderBy: { afterFixture: { scheduledAt: 'desc' } },
      select: {
        afterFixture: {
          select: {
            season: { select: { competition: { select: { code: true } } } },
          },
        },
      },
    });
    return row?.afterFixture.season.competition.code ?? null;
  }
}
