import { Injectable } from '@nestjs/common';
import {
  AdjustmentStatus,
  BetStatus,
  Decision,
  FixtureStatus,
  Market,
  Prisma,
} from '@evcore/db';
import Decimal from 'decimal.js';
import {
  computePoissonMarkets,
  calculateDeterministicScore,
  calculateEV as calcEV,
  type DeterministicFeatures,
  type FeatureWeights,
} from './betting-engine.utils';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import {
  DEFAULT_STAKE_PCT,
  EV_THRESHOLD,
  FEATURE_WEIGHTS,
  MODEL_SCORE_THRESHOLD,
} from './ev.constants';
import type {
  MatchComputation,
  MatchupFeatures,
  TeamStatsInput,
} from './betting-engine.types';

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

type OneXTwoPick = 'HOME' | 'DRAW' | 'AWAY';

type OneXTwoOddsSnapshot = {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: Prisma.Decimal;
  drawOdds: Prisma.Decimal;
  awayOdds: Prisma.Decimal;
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

  calculateDeterministicScore(
    features: DeterministicFeatures,
    weights?: FeatureWeights,
  ): Decimal {
    return calculateDeterministicScore(features, weights);
  }

  calculateEV(probability: Decimal.Value, odds: Decimal.Value): Decimal {
    return calcEV(probability, odds);
  }

  computeFromTeamStats(
    homeStats: TeamStatsInput,
    awayStats: TeamStatsInput,
    weights?: FeatureWeights,
  ): MatchComputation {
    const features = buildMatchupFeatures(homeStats, awayStats);
    const deterministicScore = this.calculateDeterministicScore(
      features,
      weights,
    );
    const lambda = deriveLambdas(homeStats, awayStats);
    const probabilities = this.computeProbabilities(lambda.home, lambda.away);

    return { deterministicScore, probabilities, lambda, features };
  }

  async getEffectiveWeights(): Promise<FeatureWeights> {
    const latest = await this.prisma.client.adjustmentProposal.findFirst({
      where: { status: AdjustmentStatus.APPLIED },
      orderBy: { appliedAt: 'desc' },
      select: { proposedWeights: true },
    });

    if (!latest) return FEATURE_WEIGHTS;

    const w = latest.proposedWeights as Record<string, unknown>;
    return {
      recentForm: new Decimal(
        String(w['recentForm'] ?? FEATURE_WEIGHTS.recentForm),
      ),
      xg: new Decimal(String(w['xg'] ?? FEATURE_WEIGHTS.xg)),
      domExtPerf: new Decimal(
        String(w['domExtPerf'] ?? FEATURE_WEIGHTS.domExtPerf),
      ),
      leagueVolat: new Decimal(
        String(w['leagueVolat'] ?? FEATURE_WEIGHTS.leagueVolat),
      ),
    };
  }

  async settleOpenBets(fixtureId: string): Promise<{ settled: number }> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: { homeScore: true, awayScore: true, status: true },
    });

    if (!fixture || fixture.status !== FixtureStatus.FINISHED) {
      return { settled: 0 };
    }

    const modelRuns = await this.prisma.client.modelRun.findMany({
      where: { fixtureId },
      select: { id: true },
    });

    const modelRunIds = modelRuns.map((r) => r.id);
    if (modelRunIds.length === 0) return { settled: 0 };

    const bets = await this.prisma.client.bet.findMany({
      where: { modelRunId: { in: modelRunIds }, status: BetStatus.PENDING },
      select: { id: true, pick: true },
    });

    if (bets.length === 0) return { settled: 0 };

    let settled = 0;
    for (const bet of bets) {
      const status = resolveOneXTwoBetStatus(
        bet.pick,
        fixture.homeScore,
        fixture.awayScore,
      );
      await this.prisma.client.bet.update({
        where: { id: bet.id },
        data: { status },
      });
      settled++;
    }

    return { settled };
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

    const weights = await this.getEffectiveWeights();
    const { features, deterministicScore, lambda, probabilities } =
      this.computeFromTeamStats(homeStats, awayStats, weights);
    const deterministicDecision = deterministicScore.greaterThanOrEqualTo(
      MODEL_SCORE_THRESHOLD,
    )
      ? Decision.BET
      : Decision.NO_BET;

    const [latestOdds, suspension] = await Promise.all([
      this.findLatestOneXTwoOddsSnapshot(fixture),
      this.prisma.client.marketSuspension.findFirst({
        where: { market: Market.ONE_X_TWO, active: true },
        select: { id: true },
      }),
    ]);
    const valueBet = latestOdds
      ? this.selectBestOneXTwoValueBet(probabilities, latestOdds)
      : null;
    const decision =
      deterministicDecision === Decision.BET &&
      valueBet !== null &&
      valueBet.ev.greaterThanOrEqualTo(EV_THRESHOLD) &&
      suspension === null
        ? Decision.BET
        : Decision.NO_BET;

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        decision,
        deterministicScore: toPrismaDecimal(deterministicScore, 4),
        llmDelta: null,
        finalScore: toPrismaDecimal(deterministicScore, 4),
        features: {
          recentForm: features.recentForm.toNumber(),
          xg: features.xg.toNumber(),
          performanceDomExt: features.domExtPerf.toNumber(),
          volatiliteLigue: features.leagueVolat.toNumber(),
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          probabilities: mapProbabilitiesToNumber(probabilities),
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    if (decision === Decision.BET && valueBet !== null) {
      await this.prisma.client.bet.create({
        data: {
          modelRunId: modelRun.id,
          market: Market.ONE_X_TWO,
          pick: valueBet.pick,
          probEstimated: toPrismaDecimal(valueBet.probability, 4),
          oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
          ev: toPrismaDecimal(valueBet.ev, 4),
          stakePct: toPrismaDecimal(DEFAULT_STAKE_PCT, 4),
        },
      });
    }

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

  private async findLatestOneXTwoOddsSnapshot(fixture: {
    id: string;
    scheduledAt: Date;
  }): Promise<OneXTwoOddsSnapshot | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId: fixture.id,
        market: Market.ONE_X_TWO,
        snapshotAt: { lte: fixture.scheduledAt },
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        bookmaker: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: { snapshotAt: 'desc' },
    });

    if (rows.length === 0) {
      return null;
    }

    const latestSnapshotAt = rows[0].snapshotAt.getTime();
    const sameSnapshotRows = rows.filter(
      (row) => row.snapshotAt.getTime() === latestSnapshotAt,
    );
    const best = sameSnapshotRows.reduce((currentBest, row) =>
      bookmakerRank(row.bookmaker) < bookmakerRank(currentBest.bookmaker)
        ? row
        : currentBest,
    );

    if (
      best.homeOdds === null ||
      best.drawOdds === null ||
      best.awayOdds === null
    ) {
      return null;
    }

    return {
      bookmaker: best.bookmaker,
      snapshotAt: best.snapshotAt,
      homeOdds: best.homeOdds,
      drawOdds: best.drawOdds,
      awayOdds: best.awayOdds,
    };
  }

  private selectBestOneXTwoValueBet(
    probabilities: MatchProbabilities,
    oddsSnapshot: OneXTwoOddsSnapshot,
  ): {
    pick: OneXTwoPick;
    probability: Decimal;
    odds: Decimal;
    ev: Decimal;
  } {
    const candidates: Array<{
      pick: OneXTwoPick;
      probability: Decimal;
      odds: Decimal;
      ev: Decimal;
    }> = [
      {
        pick: 'HOME',
        probability: probabilities.home,
        odds: new Decimal(oddsSnapshot.homeOdds.toString()),
        ev: this.calculateEV(probabilities.home, oddsSnapshot.homeOdds),
      },
      {
        pick: 'DRAW',
        probability: probabilities.draw,
        odds: new Decimal(oddsSnapshot.drawOdds.toString()),
        ev: this.calculateEV(probabilities.draw, oddsSnapshot.drawOdds),
      },
      {
        pick: 'AWAY',
        probability: probabilities.away,
        odds: new Decimal(oddsSnapshot.awayOdds.toString()),
        ev: this.calculateEV(probabilities.away, oddsSnapshot.awayOdds),
      },
    ];

    return candidates.reduce((best, current) =>
      current.ev.greaterThan(best.ev) ? current : best,
    );
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

function deriveLambdas(homeStats: TeamStatsInput, awayStats: TeamStatsInput) {
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
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
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

function bookmakerRank(bookmaker: string): number {
  if (bookmaker === 'Pinnacle') return 0;
  if (bookmaker === 'Bet365') return 1;
  if (bookmaker === 'MarketAvg') return 2;
  return 3;
}

function resolveOneXTwoBetStatus(
  pick: string,
  homeScore: number | null,
  awayScore: number | null,
): BetStatus {
  if (homeScore === null || awayScore === null) return BetStatus.VOID;
  if (pick === 'HOME')
    return homeScore > awayScore ? BetStatus.WON : BetStatus.LOST;
  if (pick === 'AWAY')
    return awayScore > homeScore ? BetStatus.WON : BetStatus.LOST;
  if (pick === 'DRAW')
    return homeScore === awayScore ? BetStatus.WON : BetStatus.LOST;
  return BetStatus.VOID;
}
