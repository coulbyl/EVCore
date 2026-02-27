import { Injectable } from '@nestjs/common';
import { FixtureStatus, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import {
  computePoissonMarkets,
  calculateDeterministicScore,
  type DeterministicFeatures,
} from './betting-engine.utils';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { MODEL_SCORE_THRESHOLD } from './ev.constants';

export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

type AnalyzeFixtureResult =
  | {
      status: 'analyzed';
      fixtureId: string;
      modelRunId: string;
      decision: 'BET' | 'NO_BET';
      deterministicScore: number;
      probabilities: Record<string, number>;
    }
  | {
      status: 'skipped';
      fixtureId: string;
      reason:
        | 'fixture_not_found'
        | 'fixture_not_playable'
        | 'missing_team_stats';
    };

type MatchupFeatures = {
  recentForm: Decimal;
  xg: Decimal;
  domExtPerf: Decimal;
  leagueVolat: Decimal;
};

@Injectable()
export class BettingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  computeProbabilities(
    lambdaHome: number,
    lambdaAway: number,
  ): MatchProbabilities {
    return computePoissonMarkets(lambdaHome, lambdaAway);
  }

  calculateDeterministicScore(features: DeterministicFeatures): Decimal {
    return calculateDeterministicScore(features);
  }

  async analyzeFixture(fixtureId: string): Promise<AnalyzeFixtureResult> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        id: true,
        seasonId: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
      },
    });

    if (!fixture) {
      return { status: 'skipped', fixtureId, reason: 'fixture_not_found' };
    }

    if (
      fixture.status === FixtureStatus.POSTPONED ||
      fixture.status === FixtureStatus.CANCELLED
    ) {
      return { status: 'skipped', fixtureId, reason: 'fixture_not_playable' };
    }

    const [homeStats, awayStats] = await Promise.all([
      this.prisma.client.teamStats.findFirst({
        where: {
          teamId: fixture.homeTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
        orderBy: { afterFixture: { scheduledAt: 'desc' } },
      }),
      this.prisma.client.teamStats.findFirst({
        where: {
          teamId: fixture.awayTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
        orderBy: { afterFixture: { scheduledAt: 'desc' } },
      }),
    ]);

    if (!homeStats || !awayStats) {
      return { status: 'skipped', fixtureId, reason: 'missing_team_stats' };
    }

    const matchupFeatures = buildMatchupFeatures(homeStats, awayStats);
    const deterministicScore =
      this.calculateDeterministicScore(matchupFeatures);
    const lambda = deriveLambdas(homeStats, awayStats);
    const probabilities = this.computeProbabilities(lambda.home, lambda.away);
    const decision = deterministicScore.greaterThanOrEqualTo(
      MODEL_SCORE_THRESHOLD,
    )
      ? 'BET'
      : 'NO_BET';

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        decision,
        deterministicScore: toPrismaDecimal(deterministicScore, 4),
        llmDelta: null,
        finalScore: toPrismaDecimal(deterministicScore, 4),
        features: {
          recentForm: matchupFeatures.recentForm.toNumber(),
          xg: matchupFeatures.xg.toNumber(),
          performanceDomExt: matchupFeatures.domExtPerf.toNumber(),
          volatiliteLigue: matchupFeatures.leagueVolat.toNumber(),
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          probabilities: mapProbabilitiesToNumber(probabilities),
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    return {
      status: 'analyzed',
      fixtureId,
      modelRunId: modelRun.id,
      decision,
      deterministicScore: deterministicScore.toNumber(),
      probabilities: mapProbabilitiesToNumber(probabilities),
    };
  }

  async analyzeSeason(seasonId: string): Promise<{
    seasonId: string;
    analyzed: number;
    skipped: number;
  }> {
    const fixtures = await this.prisma.client.fixture.findMany({
      where: { seasonId, status: FixtureStatus.FINISHED },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    let analyzed = 0;
    let skipped = 0;

    for (const fixture of fixtures) {
      const result = await this.analyzeFixture(fixture.id);
      if (result.status === 'analyzed') analyzed++;
      else skipped++;
    }

    return { seasonId, analyzed, skipped };
  }
}

function mapProbabilitiesToNumber(
  probabilities: MatchProbabilities,
): Record<string, number> {
  return {
    home: probabilities.home.toNumber(),
    draw: probabilities.draw.toNumber(),
    away: probabilities.away.toNumber(),
    over25: probabilities.over25.toNumber(),
    under25: probabilities.under25.toNumber(),
    bttsYes: probabilities.bttsYes.toNumber(),
    bttsNo: probabilities.bttsNo.toNumber(),
    dc1X: probabilities.dc1X.toNumber(),
    dcX2: probabilities.dcX2.toNumber(),
    dc12: probabilities.dc12.toNumber(),
  };
}

function asNumber(value: unknown): number {
  return Number(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveLambdas(
  homeStats: Record<string, unknown>,
  awayStats: Record<string, unknown>,
) {
  const homeXgFor = asNumber(homeStats.xgFor);
  const awayXgFor = asNumber(awayStats.xgFor);
  const homeXgAgainst = asNumber(homeStats.xgAgainst);
  const awayXgAgainst = asNumber(awayStats.xgAgainst);

  const leagueAvg = Math.max(
    0.5,
    (homeXgFor + awayXgFor + homeXgAgainst + awayXgAgainst) / 4,
  );

  return {
    home: clamp((homeXgFor * awayXgAgainst) / leagueAvg, 0.05, 5),
    away: clamp((awayXgFor * homeXgAgainst) / leagueAvg, 0.05, 5),
  };
}

function buildMatchupFeatures(
  homeStats: Record<string, unknown>,
  awayStats: Record<string, unknown>,
): MatchupFeatures {
  const recentForm = clamp01(
    (asNumber(homeStats.recentForm) + (1 - asNumber(awayStats.recentForm))) / 2,
  );
  const xg = clamp01(
    asNumber(homeStats.xgFor) /
      Math.max(0.1, asNumber(homeStats.xgFor) + asNumber(awayStats.xgFor)),
  );
  const domExtPerf = clamp01(
    (asNumber(homeStats.homeWinRate) + (1 - asNumber(awayStats.awayWinRate))) /
      2,
  );
  const leagueVolat = clamp01(
    Math.max(
      asNumber(homeStats.leagueVolatility),
      asNumber(awayStats.leagueVolatility),
    ) / 3,
  );

  return {
    recentForm: new Decimal(recentForm),
    xg: new Decimal(xg),
    domExtPerf: new Decimal(domExtPerf),
    leagueVolat: new Decimal(leagueVolat),
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
