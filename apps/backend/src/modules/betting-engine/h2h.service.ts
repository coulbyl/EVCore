import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import {
  computeH2HScoreFromLegs,
  computeH2HMarketSignalsFromLegs,
  computeH2HScorelineSignalFromLegs,
  H2H_LIMIT_DEFAULT,
  type H2HLeg,
  type H2HMarketSignals,
  type H2HScorelineSignal,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

export type { H2HMarketSignals, H2HScorelineSignal };

type FetchLegsInput = {
  homeTeamId: string;
  awayTeamId: string;
  fixtureDate: Date;
  limit?: number;
};

type ComputeH2HScoreInput = FetchLegsInput & {
  favoriteTeamId: string;
};

// The H2H computations (decay-weighted score, per-market signals, top
// scoreline) now live in @evcore/analysis-core (extracted 2026-08-18 —
// same pattern as odds-assembly and team-stats-resolution) so the backtest
// harness replays the exact same signals as this live engine. This service
// keeps only the Prisma I/O: fetching legs, point-in-time-safe by
// construction (`scheduledAt < fixtureDate`).
@Injectable()
export class H2HService {
  constructor(private readonly prisma: PrismaService) {}

  async computeH2HScore(input: ComputeH2HScoreInput): Promise<number | null> {
    const legs = await this.fetchLegs(input);
    return computeH2HScoreFromLegs(legs, input.favoriteTeamId);
  }

  async computeH2HMarketSignals(
    input: FetchLegsInput,
  ): Promise<H2HMarketSignals> {
    const legs = await this.fetchLegs(input);
    return computeH2HMarketSignalsFromLegs(legs, input);
  }

  async computeH2HScorelineSignal(
    input: FetchLegsInput,
  ): Promise<H2HScorelineSignal> {
    const legs = await this.fetchLegs(input);
    return computeH2HScorelineSignalFromLegs(legs, input);
  }

  private async fetchLegs(input: FetchLegsInput): Promise<H2HLeg[]> {
    const {
      homeTeamId,
      awayTeamId,
      fixtureDate,
      limit = H2H_LIMIT_DEFAULT,
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

    return fixtures
      .filter(
        (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
      )
      .map((fixture) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeScore: fixture.homeScore as number,
        awayScore: fixture.awayScore as number,
      }));
  }
}
