import { Injectable } from '@nestjs/common';
import { DOMESTIC_LEAGUE_EXCLUDED_CODES } from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

/**
 * A team's national league as the engine sees it: the competition of its
 * most recent team_stats line before a date, outside
 * DOMESTIC_LEAGUE_EXCLUDED_CODES (European cups, national-team competitions,
 * friendlies). Same rule as
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
          season: {
            competition: {
              code: { notIn: [...DOMESTIC_LEAGUE_EXCLUDED_CODES] },
            },
          },
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
