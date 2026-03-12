import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

type ComputeH2HScoreInput = {
  homeTeamId: string;
  awayTeamId: string;
  favoriteTeamId: string;
  fixtureDate: Date;
  limit?: number;
};

@Injectable()
export class H2HService {
  constructor(private readonly prisma: PrismaService) {}

  async computeH2HScore(input: ComputeH2HScoreInput): Promise<number | null> {
    const {
      homeTeamId,
      awayTeamId,
      favoriteTeamId,
      fixtureDate,
      limit = 5,
    } = input;

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        scheduledAt: { lt: fixtureDate },
        OR: [
          { homeTeamId, awayTeamId },
          { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
        ],
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });

    if (fixtures.length === 0) return null;

    let favoriteWins = 0;
    for (const fixture of fixtures) {
      if (fixture.homeScore === null || fixture.awayScore === null) continue;
      const winnerTeamId =
        fixture.homeScore > fixture.awayScore
          ? fixture.homeTeamId
          : fixture.awayScore > fixture.homeScore
            ? fixture.awayTeamId
            : null;
      if (winnerTeamId === favoriteTeamId) favoriteWins++;
    }

    return favoriteWins / fixtures.length;
  }
}
