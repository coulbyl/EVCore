import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  calculateKellyStakePct,
  buildPoissonDistributions,
  COMBO_WHITELIST,
  computeJointProbability,
  resolveComboPickBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  type ComboPick,
  type DeterministicFeatures,
  type FeatureWeights,
} from './betting-engine.utils';
import { PrismaService } from '@/prisma.service';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import {
  DEFAULT_STAKE_PCT,
  EV_THRESHOLD,
  FEATURE_WEIGHTS,
  KELLY_FRACTION,
  KELLY_MAX_STAKE_PCT,
  MODEL_SCORE_THRESHOLD,
} from './ev.constants';
import { FEATURE_FLAGS } from '@config/feature-flags.constants';
import { LINE_MOVEMENT_THRESHOLD } from '@config/coupon.constants';
import type {
  FullOddsSnapshot,
  MatchComputation,
  MatchupFeatures,
  TeamStatsInput,
  ViablePick,
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
      betId: string | null;
      qualityScore: number | null;
    }
  | {
      status: 'skipped';
      fixtureId: string;
      reason:
        | 'fixture_not_found'
        | 'fixture_not_playable'
        | 'missing_team_stats';
    };

@Injectable()
export class BettingEngineService {
  private readonly kellyEnabled: boolean;

  // eslint-disable-next-line max-params -- Explicit service injection keeps scoring dependencies transparent.
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly h2hService: H2HService,
    private readonly congestionService: CongestionService,
  ) {
    this.kellyEnabled = config.get<string>('KELLY_ENABLED', 'false') === 'true';
  }

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
    const toDecimal = (val: unknown, fallback: Decimal): Decimal => {
      if (typeof val === 'string' || typeof val === 'number') {
        return new Decimal(val);
      }
      return fallback;
    };
    return {
      recentForm: toDecimal(w['recentForm'], FEATURE_WEIGHTS.recentForm),
      xg: toDecimal(w['xg'], FEATURE_WEIGHTS.xg),
      domExtPerf: toDecimal(w['domExtPerf'], FEATURE_WEIGHTS.domExtPerf),
      leagueVolat: toDecimal(w['leagueVolat'], FEATURE_WEIGHTS.leagueVolat),
    };
  }

  async settleOpenBets(fixtureId: string): Promise<{ settled: number }> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        status: true,
      },
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
      select: {
        id: true,
        market: true,
        pick: true,
        comboMarket: true,
        comboPick: true,
      },
    });

    if (bets.length === 0) return { settled: 0 };

    let settled = 0;
    for (const bet of bets) {
      let status: BetStatus;

      if (bet.comboMarket !== null && bet.comboPick !== null) {
        const combo: ComboPick = {
          market1: bet.market,
          pick1: bet.pick,
          market2: bet.comboMarket,
          pick2: bet.comboPick,
        };
        status = resolveComboPickBetStatus(
          combo,
          fixture.homeScore,
          fixture.awayScore,
        );
      } else if (bet.market === Market.HALF_TIME_FULL_TIME) {
        status = resolveHalfTimeFullTimeBetStatus(
          bet.pick,
          fixture.homeHtScore,
          fixture.awayHtScore,
          fixture.homeScore,
          fixture.awayScore,
        );
      } else {
        status = resolvePickBetStatus(
          bet.pick,
          fixture.homeScore,
          fixture.awayScore,
        );
      }

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

    const { distHome, distAway } = buildPoissonDistributions(
      lambda.home,
      lambda.away,
    );

    const [latestOdds, activeSuspensions] = await Promise.all([
      this.findLatestOddsSnapshot(fixtureId, fixture.scheduledAt),
      this.prisma.client.marketSuspension.findMany({
        where: { active: true },
        select: { market: true },
      }),
    ]);

    const suspendedMarkets = new Set(activeSuspensions.map((s) => s.market));

    let valueBet = latestOdds
      ? this.selectBestViablePick(
          probabilities,
          latestOdds,
          deterministicScore,
          distHome,
          distAway,
          suspendedMarkets,
        )
      : null;

    const favoriteTeamId = probabilities.home.greaterThanOrEqualTo(
      probabilities.away,
    )
      ? fixture.homeTeamId
      : fixture.awayTeamId;
    const shadowH2h = await this.h2hService.computeH2HScore({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      favoriteTeamId,
      fixtureDate: fixture.scheduledAt,
      limit: 5,
    });
    const shadowCongestion =
      await this.congestionService.computeCongestionScore({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        fixtureDate: fixture.scheduledAt,
      });

    // Line movement filter — exclude picks with >10% adverse odds drop over 7 days.
    let shadowLineMovement: number | null = null;
    if (
      FEATURE_FLAGS.SCORING.LINE_MOVEMENT &&
      latestOdds !== null &&
      valueBet !== null
    ) {
      const cutoff7d = new Date(
        fixture.scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const earliestOdds = await this.findLatestOddsSnapshot(
        fixtureId,
        cutoff7d,
      );
      if (earliestOdds !== null) {
        const latestPickOdds = getPickOdds(valueBet, latestOdds);
        const earliestPickOdds = getPickOdds(valueBet, earliestOdds);
        if (
          latestPickOdds !== null &&
          earliestPickOdds !== null &&
          earliestPickOdds.gt(0)
        ) {
          const movement = earliestPickOdds
            .minus(latestPickOdds)
            .div(earliestPickOdds);
          shadowLineMovement = movement.toNumber();
          // Adverse: odds shortened by more than threshold → exclude pick.
          if (movement.gt(LINE_MOVEMENT_THRESHOLD)) {
            valueBet = null;
          }
        }
      }
    }

    const decision =
      deterministicDecision === Decision.BET && valueBet !== null
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
          shadow_lineMovement: shadowLineMovement,
          shadow_h2h: shadowH2h,
          shadow_congestion: shadowCongestion,
          shadow_lineups: null,
          shadow_injuries: null,
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    let betId: string | null = null;
    let qualityScore: number | null = null;

    if (decision === Decision.BET && valueBet !== null) {
      const stakePct = this.kellyEnabled
        ? calculateKellyStakePct(valueBet.probability, valueBet.odds, {
            fraction: KELLY_FRACTION,
            maxStake: KELLY_MAX_STAKE_PCT,
          })
        : DEFAULT_STAKE_PCT;

      const createdBet = await this.prisma.client.bet.create({
        data: {
          modelRunId: modelRun.id,
          market: valueBet.market,
          pick: valueBet.pick,
          comboMarket: valueBet.comboMarket ?? null,
          comboPick: valueBet.comboPick ?? null,
          probEstimated: toPrismaDecimal(valueBet.probability, 4),
          oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
          ev: toPrismaDecimal(valueBet.ev, 4),
          stakePct: toPrismaDecimal(stakePct, 4),
        },
        select: { id: true },
      });

      betId = createdBet.id;
      qualityScore = valueBet.qualityScore.toNumber();
    }

    return {
      status: 'analyzed',
      fixtureId,
      modelRunId: modelRun.id,
      decision,
      deterministicScore: deterministicScore.toNumber(),
      probabilities: mapProbabilitiesToNumber(probabilities),
      betId,
      qualityScore,
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

  // Kept as alias for backward compatibility with existing tests.
  private findLatestOneXTwoOddsSnapshot(fixture: {
    id: string;
    scheduledAt: Date;
  }): Promise<FullOddsSnapshot | null> {
    return this.findLatestOddsSnapshot(fixture.id, fixture.scheduledAt);
  }

  private async findLatestOddsSnapshot(
    fixtureId: string,
    cutoff: Date,
  ): Promise<FullOddsSnapshot | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        snapshotAt: { lte: cutoff },
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

    if (rows.length === 0) return null;

    const latestSnapshotAt = rows[0].snapshotAt.getTime();
    const sameSnapshotRows = rows.filter(
      (row) => row.snapshotAt.getTime() === latestSnapshotAt,
    );
    const best = sameSnapshotRows.reduce((a, b) =>
      bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
    );

    if (
      best.homeOdds === null ||
      best.drawOdds === null ||
      best.awayOdds === null
    ) {
      return null;
    }

    const [overRow, underRow, bttsYesRow, bttsNoRow] = await Promise.all([
      this.prisma.client.oddsSnapshot.findFirst({
        where: {
          fixtureId,
          bookmaker: best.bookmaker,
          market: Market.OVER_UNDER,
          pick: 'OVER',
          snapshotAt: { lte: cutoff },
        },
        select: { odds: true },
        orderBy: { snapshotAt: 'desc' },
      }),
      this.prisma.client.oddsSnapshot.findFirst({
        where: {
          fixtureId,
          bookmaker: best.bookmaker,
          market: Market.OVER_UNDER,
          pick: 'UNDER',
          snapshotAt: { lte: cutoff },
        },
        select: { odds: true },
        orderBy: { snapshotAt: 'desc' },
      }),
      this.prisma.client.oddsSnapshot.findFirst({
        where: {
          fixtureId,
          bookmaker: best.bookmaker,
          market: Market.BTTS,
          pick: 'YES',
          snapshotAt: { lte: cutoff },
        },
        select: { odds: true },
        orderBy: { snapshotAt: 'desc' },
      }),
      this.prisma.client.oddsSnapshot.findFirst({
        where: {
          fixtureId,
          bookmaker: best.bookmaker,
          market: Market.BTTS,
          pick: 'NO',
          snapshotAt: { lte: cutoff },
        },
        select: { odds: true },
        orderBy: { snapshotAt: 'desc' },
      }),
    ]);

    return {
      bookmaker: best.bookmaker,
      snapshotAt: best.snapshotAt,
      homeOdds: new Decimal(best.homeOdds.toString()),
      drawOdds: new Decimal(best.drawOdds.toString()),
      awayOdds: new Decimal(best.awayOdds.toString()),
      overOdds: overRow?.odds ? new Decimal(overRow.odds.toString()) : null,
      underOdds: underRow?.odds ? new Decimal(underRow.odds.toString()) : null,
      bttsYesOdds: bttsYesRow?.odds
        ? new Decimal(bttsYesRow.odds.toString())
        : null,
      bttsNoOdds: bttsNoRow?.odds
        ? new Decimal(bttsNoRow.odds.toString())
        : null,
    };
  }

  // eslint-disable-next-line max-params -- Six domain parameters; grouping into an object would obscure intent.
  private selectBestViablePick(
    probabilities: MatchProbabilities,
    odds: FullOddsSnapshot,
    deterministicScore: Decimal,
    distHome: number[],
    distAway: number[],
    suspendedMarkets: Set<Market>,
  ): ViablePick | null {
    const candidates: ViablePick[] = [];

    // Singles 1X2
    const oneXTwoPicks = [
      {
        pick: 'HOME',
        probability: probabilities.home,
        pickOdds: odds.homeOdds,
      },
      {
        pick: 'DRAW',
        probability: probabilities.draw,
        pickOdds: odds.drawOdds,
      },
      {
        pick: 'AWAY',
        probability: probabilities.away,
        pickOdds: odds.awayOdds,
      },
    ];
    for (const c of oneXTwoPicks) {
      const ev = calcEV(c.probability, c.pickOdds);
      candidates.push({
        market: Market.ONE_X_TWO,
        pick: c.pick,
        probability: c.probability,
        odds: c.pickOdds,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: false,
      });
    }

    // Singles Over/Under
    if (odds.overOdds !== null) {
      const ev = calcEV(probabilities.over25, odds.overOdds);
      candidates.push({
        market: Market.OVER_UNDER,
        pick: 'OVER',
        probability: probabilities.over25,
        odds: odds.overOdds,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: false,
      });
    }
    if (odds.underOdds !== null) {
      const ev = calcEV(probabilities.under25, odds.underOdds);
      candidates.push({
        market: Market.OVER_UNDER,
        pick: 'UNDER',
        probability: probabilities.under25,
        odds: odds.underOdds,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: false,
      });
    }

    // Singles BTTS
    if (odds.bttsYesOdds !== null) {
      const ev = calcEV(probabilities.bttsYes, odds.bttsYesOdds);
      candidates.push({
        market: Market.BTTS,
        pick: 'YES',
        probability: probabilities.bttsYes,
        odds: odds.bttsYesOdds,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: false,
      });
    }
    if (odds.bttsNoOdds !== null) {
      const ev = calcEV(probabilities.bttsNo, odds.bttsNoOdds);
      candidates.push({
        market: Market.BTTS,
        pick: 'NO',
        probability: probabilities.bttsNo,
        odds: odds.bttsNoOdds,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: false,
      });
    }

    // Combos from COMBO_WHITELIST
    for (const combo of COMBO_WHITELIST) {
      const p1Odds = getPickOddsFromSnapshot(combo.market1, combo.pick1, odds);
      const p2Odds = getPickOddsFromSnapshot(combo.market2, combo.pick2, odds);
      if (p1Odds === null || p2Odds === null) continue;

      const prob = computeJointProbability(combo, distHome, distAway);
      const oddsCombo = p1Odds.mul(p2Odds); // independent approximation
      const ev = calcEV(prob, oddsCombo);
      candidates.push({
        market: combo.market1,
        pick: combo.pick1,
        comboMarket: combo.market2,
        comboPick: combo.pick2,
        probability: prob,
        odds: oddsCombo,
        ev,
        qualityScore: ev.mul(deterministicScore),
        isCombo: true,
      });
    }

    // Filter: EV >= threshold and no suspended market
    const viable = candidates.filter(
      (c) =>
        c.ev.greaterThanOrEqualTo(EV_THRESHOLD) &&
        !suspendedMarkets.has(c.market) &&
        (c.comboMarket === undefined || !suspendedMarkets.has(c.comboMarket)),
    );

    if (viable.length === 0) return null;

    return viable.reduce((best, c) =>
      c.qualityScore.greaterThan(best.qualityScore) ? c : best,
    );
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

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

// Returns odds for a pick within a FullOddsSnapshot (single-market, no combo).
function getPickOddsFromSnapshot(
  market: Market,
  pick: string,
  odds: FullOddsSnapshot,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === 'HOME') return odds.homeOdds;
    if (pick === 'DRAW') return odds.drawOdds;
    if (pick === 'AWAY') return odds.awayOdds;
  }
  if (market === Market.OVER_UNDER) {
    if (pick === 'OVER') return odds.overOdds;
    if (pick === 'UNDER') return odds.underOdds;
  }
  if (market === Market.BTTS) {
    if (pick === 'YES') return odds.bttsYesOdds;
    if (pick === 'NO') return odds.bttsNoOdds;
  }
  return null;
}

// Returns the odds of the primary market pick for a ViablePick.
// Used for line movement comparison.
function getPickOdds(pick: ViablePick, odds: FullOddsSnapshot): Decimal | null {
  return getPickOddsFromSnapshot(pick.market, pick.pick, odds);
}
