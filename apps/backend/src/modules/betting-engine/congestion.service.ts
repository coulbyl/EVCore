import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

type ComputeCongestionScoreInput = {
  homeTeamId: string;
  awayTeamId: string;
  fixtureDate: Date;
};

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const THREE_DAYS_REST = 3;

@Injectable()
export class CongestionService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCongestionScore(
    input: ComputeCongestionScoreInput,
  ): Promise<number> {
    const { homeTeamId, awayTeamId, fixtureDate } = input;

    const [homeScore, awayScore] = await Promise.all([
      this.computeTeamCongestion(homeTeamId, fixtureDate),
      this.computeTeamCongestion(awayTeamId, fixtureDate),
    ]);

    return (homeScore + awayScore) / 2;
  }

  private async computeTeamCongestion(
    teamId: string,
    fixtureDate: Date,
  ): Promise<number> {
    const [lastPlayedFixture, nextFourDaysFixtures] = await Promise.all([
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
            lte: new Date(fixtureDate.getTime() + FOUR_DAYS_MS),
          },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
      }),
    ]);

    const restPenalty =
      lastPlayedFixture === null
        ? 0
        : this.computeRestPenalty(lastPlayedFixture.scheduledAt, fixtureDate);
    const upcomingPenalty = clamp(nextFourDaysFixtures / 3, 0, 1);

    // Weight rest slightly higher than short-horizon schedule density.
    return 0.6 * restPenalty + 0.4 * upcomingPenalty;
  }

  private computeRestPenalty(lastMatchDate: Date, fixtureDate: Date): number {
    const daysSinceLastMatch =
      (fixtureDate.getTime() - lastMatchDate.getTime()) / (24 * 60 * 60 * 1000);
    return clamp(
      (THREE_DAYS_REST - daysSinceLastMatch) / THREE_DAYS_REST,
      0,
      1,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
