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
  buildPoissonDistributions,
  computePoissonMarkets,
  calculateDeterministicScore,
  calculateEV as calcEV,
  calculateKellyStakePct,
  COMBO_WHITELIST,
  HALF_TIME_FULL_TIME_PICKS,
  computeJointProbability,
  resolveComboPickBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  type ComboPick,
  type HalfTimeFullTimePick,
  type DeterministicFeatures,
  type FeatureWeights,
} from './betting-engine.utils';
import { PrismaService } from '@/prisma.service';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { createLogger } from '@utils/logger';
import {
  COMBO_CORRELATION_ALPHA,
  COMBO_CORRELATION_MAX_FACTOR,
  COMBO_CORRELATION_MIN_FACTOR,
  DEFAULT_STAKE_PCT,
  EV_HARD_CAP,
  EV_MAX_SOFT_ALERT,
  EV_THRESHOLD,
  FEATURE_WEIGHTS,
  getModelScoreThreshold,
  KELLY_FRACTION,
  KELLY_MAX_STAKE_PCT,
  AWAY_DISADVANTAGE_LAMBDA_FACTOR,
  HOME_ADVANTAGE_LAMBDA_FACTOR,
  MAX_SELECTION_ODDS,
  MIN_DRAW_DIRECTION_PROBABILITY,
  MIN_PICK_DIRECTION_PROBABILITY,
  MIN_QUALITY_SCORE,
  getLeagueEvThreshold,
  ONE_X_TWO_AWAY_MAX_ODDS,
  ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_DRAW_MAX_ODDS,
  ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT,
  LAMBDA_SHRINKAGE_FACTOR,
  getLeagueMeanLambda,
  getLeagueMinSelectionOdds,
  getPickMinSelectionOdds,
} from './ev.constants';
import { FEATURE_FLAGS } from '@config/feature-flags.constants';
import { LINE_MOVEMENT_THRESHOLD } from '@config/coupon.constants';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchComputation,
  MatchupFeatures,
  PredictionSource,
  TeamStatsInput,
  ViablePick,
} from './betting-engine.types';
import { isSeniorNationalTeam } from './fri-elo.utils';

export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

const logger = createLogger('betting-engine-service');
const MIN_LAMBDA = 0.05;
const FRI_HOME_ADVANTAGE_ELO = 50;
const FRI_DRAW_RATE = 0.22;

export type BetCandidate = {
  fixtureId: string;
  modelRunId: string;
  market: Market;
  pick: string;
  pickKey: string;
  comboMarket: Market | null;
  comboPick: string | null;
  probability: Decimal;
  odds: Decimal;
  ev: Decimal;
  stakePct: Decimal;
  qualityScore: Decimal;
};

type AnalyzeFixtureResult =
  | {
      status: 'analyzed';
      fixtureId: string;
      modelRunId: string;
      decision: 'BET' | 'NO_BET';
      deterministicScore: number;
      probabilities: Record<string, number | Record<string, number>>;
      valueBet: BetCandidate | null;
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

  // eslint-disable-next-line max-params
  computeFromTeamStats(
    homeStats: TeamStatsInput,
    awayStats: TeamStatsInput,
    weights?: FeatureWeights,
    competitionCode?: string | null,
  ): MatchComputation {
    const features = buildMatchupFeatures(homeStats, awayStats);
    const deterministicScore = this.calculateDeterministicScore(
      features,
      weights,
    );
    const lambda = deriveLambdas(homeStats, awayStats, competitionCode);
    const probabilities = this.computeProbabilities(lambda.home, lambda.away);

    return { deterministicScore, probabilities, lambda, features };
  }

  selectBestViablePickForBacktest(input: {
    probabilities: MatchProbabilities;
    odds: FullOddsSnapshot;
    deterministicScore: Decimal;
    distHome: number[];
    distAway: number[];
    lambdaFloorHit: boolean;
    competitionCode?: string | null;
  }): ViablePick | null {
    return this.selectBestViablePick(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      input.distHome,
      input.distAway,
      input.lambdaFloorHit,
      new Set<Market>(),
      input.competitionCode,
    );
  }

  listEvaluatedPicksForBacktest(input: {
    probabilities: MatchProbabilities;
    odds: FullOddsSnapshot;
    deterministicScore: Decimal;
    distHome: number[];
    distAway: number[];
    lambdaFloorHit: boolean;
    competitionCode?: string | null;
  }): EvaluatedPick[] {
    return this.listEvaluatedPicks(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      input.distHome,
      input.distAway,
      input.lambdaFloorHit,
      new Set<Market>(),
      input.competitionCode ?? null,
    );
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

    const bets = await this.prisma.client.bet.findMany({
      where: { fixtureId, status: BetStatus.PENDING },
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
        status = resolveHalfTimeFullTimeBetStatus({
          pick: bet.pick,
          homeHtScore: fixture.homeHtScore,
          awayHtScore: fixture.awayHtScore,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
        });
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
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: { select: { competition: { select: { code: true } } } },
      },
    });

    if (!fixture) {
      logger.info(
        { fixtureId, reason: 'fixture_not_found' },
        'Fixture skipped',
      );
      return { status: 'skipped', fixtureId, reason: 'fixture_not_found' };
    }

    if (
      fixture.status === FixtureStatus.POSTPONED ||
      fixture.status === FixtureStatus.CANCELLED ||
      fixture.status === FixtureStatus.IN_PROGRESS
    ) {
      logger.info(
        { fixtureId, status: fixture.status, reason: 'fixture_not_playable' },
        'Fixture skipped',
      );
      return { status: 'skipped', fixtureId, reason: 'fixture_not_playable' };
    }

    if (getFixtureCompetitionCode(fixture) === 'FRI') {
      return this.analyzeFriFixture(fixture);
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
      logger.info(
        {
          fixtureId,
          competitionCode: getFixtureCompetitionCode(fixture),
          homeTeam: getFixtureHomeTeamName(fixture),
          awayTeam: getFixtureAwayTeamName(fixture),
          hasHomeStats: homeStats !== null,
          hasAwayStats: awayStats !== null,
          reason: 'missing_team_stats',
        },
        'Fixture skipped',
      );
      return { status: 'skipped', fixtureId, reason: 'missing_team_stats' };
    }

    const weights = await this.getEffectiveWeights();
    const predictionSource: PredictionSource = 'POISSON_MAIN';
    const { features, deterministicScore, lambda, probabilities } =
      this.computeFromTeamStats(
        homeStats,
        awayStats,
        weights,
        getFixtureCompetitionCode(fixture),
      );
    const lambdaFloorHit =
      lambda.home <= MIN_LAMBDA + Number.EPSILON ||
      lambda.away <= MIN_LAMBDA + Number.EPSILON;

    if (lambdaFloorHit) {
      logger.warn(
        {
          fixtureId,
          competitionCode: getFixtureCompetitionCode(fixture),
          homeTeam: getFixtureHomeTeamName(fixture),
          awayTeam: getFixtureAwayTeamName(fixture),
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          homeStats: summarizeTeamStats(homeStats),
          awayStats: summarizeTeamStats(awayStats),
        },
        'Lambda floor hit',
      );
    }

    const deterministicDecision = deterministicScore.greaterThanOrEqualTo(
      getModelScoreThreshold(getFixtureCompetitionCode(fixture)),
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

    const competitionCode = getFixtureCompetitionCode(fixture);
    const evaluatedPicks: EvaluatedPick[] = latestOdds
      ? this.listEvaluatedPicks(
          probabilities,
          latestOdds,
          deterministicScore,
          distHome,
          distAway,
          lambdaFloorHit,
          suspendedMarkets,
          competitionCode,
        )
      : [];
    const candidatePicks = evaluatedPicks.filter(
      (pick): pick is ViablePick => pick.rejectionReason === undefined,
    );

    let valueBet: ViablePick | null = candidatePicks[0] ?? null;
    const initialValueBet = valueBet;

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

    if (valueBet !== null && valueBet.ev.greaterThan(EV_MAX_SOFT_ALERT)) {
      logger.warn(
        {
          fixtureId,
          competitionCode: getFixtureCompetitionCode(fixture),
          homeTeam: getFixtureHomeTeamName(fixture),
          awayTeam: getFixtureAwayTeamName(fixture),
          market: valueBet.market,
          pick: valueBet.pick,
          ev: valueBet.ev.toNumber(),
          evSoftAlertThreshold: EV_MAX_SOFT_ALERT.toNumber(),
        },
        'EV soft alert: high EV may indicate calibration anomaly (biased lambda or xG proxy error)',
      );
    }

    const decision =
      deterministicDecision === Decision.BET && valueBet !== null
        ? Decision.BET
        : Decision.NO_BET;

    logger.info(
      {
        fixtureId,
        competitionCode: getFixtureCompetitionCode(fixture),
        homeTeam: getFixtureHomeTeamName(fixture),
        awayTeam: getFixtureAwayTeamName(fixture),
        deterministicScore: deterministicScore.toNumber(),
        deterministicDecision,
        lambdaHome: lambda.home,
        lambdaAway: lambda.away,
        hasOdds: latestOdds !== null,
        initialCandidate: initialValueBet
          ? summarizePick(initialValueBet)
          : null,
        finalCandidate: valueBet ? summarizePick(valueBet) : null,
        lineMovement: shadowLineMovement,
        h2hScore: shadowH2h,
        congestionScore: shadowCongestion,
        decision,
      },
      'Fixture analysis complete',
    );

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        decision,
        deterministicScore: toPrismaDecimal(deterministicScore, 4),
        llmDelta: null,
        finalScore: toPrismaDecimal(deterministicScore, 4),
        features: {
          predictionSource,
          recentForm: features.recentForm.toNumber(),
          xg: features.xg.toNumber(),
          performanceDomExt: features.domExtPerf.toNumber(),
          volatiliteLigue: features.leagueVolat.toNumber(),
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          probabilities: mapProbabilitiesToNumber(probabilities),
          lambdaFloorHit,
          shadow_lineMovement: shadowLineMovement,
          shadow_h2h: shadowH2h,
          shadow_congestion: shadowCongestion,
          shadow_lineups: null,
          shadow_injuries: null,
          candidatePicks: summarizePicks(candidatePicks.slice(0, 5)),
          evaluatedPicks: summarizeEvaluatedPicks(evaluatedPicks.slice(0, 10)),
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    let betCandidate: BetCandidate | null = null;

    if (decision === Decision.BET && valueBet !== null) {
      const stakePct = this.kellyEnabled
        ? calculateKellyStakePct(valueBet.probability, valueBet.odds, {
            fraction: KELLY_FRACTION,
            maxStake: KELLY_MAX_STAKE_PCT,
          })
        : DEFAULT_STAKE_PCT;

      const pickKey = buildBetPickKey({
        market: valueBet.market,
        pick: valueBet.pick,
        comboMarket: valueBet.comboMarket ?? null,
        comboPick: valueBet.comboPick ?? null,
      });

      betCandidate = {
        fixtureId,
        modelRunId: modelRun.id,
        market: valueBet.market,
        pick: valueBet.pick,
        pickKey,
        comboMarket: valueBet.comboMarket ?? null,
        comboPick: valueBet.comboPick ?? null,
        probability: valueBet.probability,
        odds: valueBet.odds,
        ev: valueBet.ev,
        stakePct,
        qualityScore: valueBet.qualityScore,
      };
    }

    return {
      status: 'analyzed',
      fixtureId,
      modelRunId: modelRun.id,
      decision,
      deterministicScore: deterministicScore.toNumber(),
      probabilities: mapProbabilitiesToNumber(probabilities),
      valueBet: betCandidate,
    };
  }

  private async analyzeFriFixture(fixture: {
    id: string;
    scheduledAt: Date;
    season?: { competition?: { code?: string } };
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
  }): Promise<AnalyzeFixtureResult> {
    const fixtureId = fixture.id;
    const competitionCode = getFixtureCompetitionCode(fixture);
    const [marketOdds, pinnacleOdds, activeSuspensions, realEloSnapshot] =
      await Promise.all([
        this.findLatestBestOneXTwoOddsSnapshot(fixtureId, fixture.scheduledAt),
        this.findLatestOneXTwoOddsSnapshotByBookmaker(
          fixtureId,
          fixture.scheduledAt,
          'Pinnacle',
        ),
        this.prisma.client.marketSuspension.findMany({
          where: { active: true },
          select: { market: true },
        }),
        this.getLatestFriEloRatings(),
      ]);

    const suspendedMarkets = new Set(activeSuspensions.map((s) => s.market));
    const homeTeamName = getFixtureHomeTeamName(fixture);
    const awayTeamName = getFixtureAwayTeamName(fixture);
    const isSenior =
      homeTeamName !== null &&
      awayTeamName !== null &&
      isSeniorNationalTeam(homeTeamName) &&
      isSeniorNationalTeam(awayTeamName);
    const eloHome =
      isSenior && homeTeamName !== null
        ? (realEloSnapshot.ratings.get(homeTeamName) ?? null)
        : null;
    const eloAway =
      isSenior && awayTeamName !== null
        ? (realEloSnapshot.ratings.get(awayTeamName) ?? null)
        : null;

    let predictionSource: PredictionSource | null = null;
    let probabilities: MatchProbabilities | null = null;
    let fallbackReason: string | null = null;

    if (eloHome !== null && eloAway !== null) {
      probabilities = eloProbabilities(eloHome, eloAway);
      predictionSource = 'FRI_ELO_REAL';
    } else if (pinnacleOdds !== null) {
      probabilities = devigOneXTwoOdds(pinnacleOdds);
      predictionSource = 'ODDS_DEVIG';
    } else {
      if (marketOdds === null) {
        fallbackReason = 'missing_market_odds';
      } else if (!isSenior) {
        fallbackReason = 'non_senior_fixture';
      } else if (eloHome === null || eloAway === null) {
        fallbackReason =
          eloHome === null && eloAway === null
            ? 'missing_both_elo_mappings'
            : eloHome === null
              ? 'missing_home_elo_mapping'
              : 'missing_away_elo_mapping';
      } else if (pinnacleOdds === null) {
        fallbackReason = 'missing_pinnacle_odds';
      } else {
        fallbackReason = 'missing_reference_probs';
      }
    }

    const deterministicScore =
      probabilities !== null
        ? Decimal.max(
            probabilities.home,
            probabilities.draw,
            probabilities.away,
          )
        : new Decimal(0);
    const evaluatedPicks =
      marketOdds !== null && probabilities !== null
        ? this.listEvaluatedOneXTwoPicks(
            probabilities,
            marketOdds.snapshot,
            deterministicScore,
            suspendedMarkets,
            competitionCode,
          )
        : [];
    const candidatePicks = evaluatedPicks.filter(
      (pick): pick is ViablePick => pick.rejectionReason === undefined,
    );
    const valueBet = candidatePicks[0] ?? null;
    const decision =
      marketOdds !== null &&
      deterministicScore.greaterThanOrEqualTo(
        getModelScoreThreshold(competitionCode),
      ) &&
      valueBet !== null
        ? Decision.BET
        : Decision.NO_BET;

    if (deterministicScore.isZero()) {
      logger.warn(
        {
          fixtureId,
          competitionCode,
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          isSenior,
          fallbackReason,
          hasMarketOdds: marketOdds !== null,
          bestBookmaker: marketOdds?.offeredBy ?? null,
          hasPinnacleOdds: pinnacleOdds !== null,
          eloSnapshotAt: realEloSnapshot.snapshotAt?.toISOString() ?? null,
          hasHomeElo: eloHome !== null,
          hasAwayElo: eloAway !== null,
          predictionSource,
        },
        'FRI fixture resolved to zero score',
      );
    }

    logger.info(
      {
        fixtureId,
        competitionCode,
        homeTeam: getFixtureHomeTeamName(fixture),
        awayTeam: getFixtureAwayTeamName(fixture),
        predictionSource,
        fallbackReason,
        deterministicScore: deterministicScore.toNumber(),
        hasOdds: marketOdds !== null,
        finalCandidate: valueBet ? summarizePick(valueBet) : null,
        decision,
      },
      'FRI fixture analysis complete',
    );

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        decision,
        deterministicScore: toPrismaDecimal(deterministicScore, 4),
        llmDelta: null,
        finalScore: toPrismaDecimal(deterministicScore, 4),
        features: {
          predictionSource,
          fallbackReason,
          isSeniorNationalFixture: isSenior,
          hasMarketOdds: marketOdds !== null,
          hasPinnacleOdds: pinnacleOdds !== null,
          hasHomeElo: eloHome !== null,
          hasAwayElo: eloAway !== null,
          devigBookmaker: pinnacleOdds?.bookmaker ?? null,
          offeredBookmakers: marketOdds?.offeredBy ?? null,
          eloHome,
          eloAway,
          eloDelta:
            eloHome !== null && eloAway !== null ? eloHome - eloAway : null,
          eloSnapshotAt: realEloSnapshot.snapshotAt?.toISOString() ?? null,
          lambdaHome: null,
          lambdaAway: null,
          probabilities:
            probabilities !== null
              ? mapProbabilitiesToNumber(probabilities)
              : null,
          lambdaFloorHit: false,
          shadow_lineMovement: null,
          shadow_h2h: null,
          shadow_congestion: null,
          shadow_lineups: null,
          shadow_injuries: null,
          candidatePicks: summarizePicks(candidatePicks.slice(0, 5)),
          evaluatedPicks: summarizeEvaluatedPicks(evaluatedPicks.slice(0, 10)),
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    let betCandidate: BetCandidate | null = null;
    if (decision === Decision.BET && valueBet !== null) {
      const stakePct = this.kellyEnabled
        ? calculateKellyStakePct(valueBet.probability, valueBet.odds, {
            fraction: KELLY_FRACTION,
            maxStake: KELLY_MAX_STAKE_PCT,
          })
        : DEFAULT_STAKE_PCT;

      const pickKey = buildBetPickKey({
        market: valueBet.market,
        pick: valueBet.pick,
        comboMarket: valueBet.comboMarket ?? null,
        comboPick: valueBet.comboPick ?? null,
      });

      betCandidate = {
        fixtureId,
        modelRunId: modelRun.id,
        market: valueBet.market,
        pick: valueBet.pick,
        pickKey,
        comboMarket: valueBet.comboMarket ?? null,
        comboPick: valueBet.comboPick ?? null,
        probability: valueBet.probability,
        odds: valueBet.odds,
        ev: valueBet.ev,
        stakePct,
        qualityScore: valueBet.qualityScore,
      };
    }

    return {
      status: 'analyzed',
      fixtureId,
      modelRunId: modelRun.id,
      decision,
      deterministicScore: deterministicScore.toNumber(),
      probabilities:
        probabilities !== null ? mapProbabilitiesToNumber(probabilities) : {},
      valueBet: betCandidate,
    };
  }

  private async getLatestFriEloRatings(): Promise<{
    snapshotAt: Date | null;
    ratings: Map<string, number>;
  }> {
    const latest = await this.prisma.client.nationalTeamEloRating.findFirst({
      select: { snapshotAt: true },
      orderBy: [{ snapshotAt: 'desc' }, { teamName: 'asc' }],
    });

    if (latest === null) {
      return { snapshotAt: null, ratings: new Map<string, number>() };
    }

    const rows = await this.prisma.client.nationalTeamEloRating.findMany({
      where: { snapshotAt: latest.snapshotAt },
      select: { teamName: true, rating: true },
      orderBy: { teamName: 'asc' },
    });

    return {
      snapshotAt: latest.snapshotAt,
      ratings: new Map(rows.map((row) => [row.teamName, row.rating])),
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

  private async findBestBookmakerForMarket(
    fixtureId: string,
    market: Market,
    _cutoff: Date,
  ): Promise<string | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market,
        odds: { not: null },
      },
      select: { bookmaker: true, snapshotAt: true },
      orderBy: { snapshotAt: 'desc' },
    });
    if (rows.length === 0) return null;
    const latestTs = rows[0].snapshotAt.getTime();
    const seen = new Set<string>();
    const atLatest = rows
      .filter((r) => r.snapshotAt.getTime() === latestTs)
      .filter((r) => (seen.has(r.bookmaker) ? false : seen.add(r.bookmaker)));
    return atLatest.reduce((a, b) =>
      bookmakerRank(a.bookmaker) <= bookmakerRank(b.bookmaker) ? a : b,
    ).bookmaker;
  }

  private async findLatestOddsSnapshot(
    fixtureId: string,
    _cutoff: Date,
  ): Promise<FullOddsSnapshot | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
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

    // Resolve the best available bookmaker for each secondary market
    // independently — their coverage differs from 1X2 (e.g. Pinnacle covers
    // OVER_UNDER while Bet365 may not).
    const [ouBookmaker, bttsBookmaker, htftBookmaker] = await Promise.all([
      this.findBestBookmakerForMarket(fixtureId, Market.OVER_UNDER, _cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.BTTS, _cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.HALF_TIME_FULL_TIME,
        _cutoff,
      ),
    ]);

    const [overRow, underRow, bttsYesRow, bttsNoRow, htftRows] =
      await Promise.all([
        ouBookmaker
          ? this.prisma.client.oddsSnapshot.findFirst({
              where: {
                fixtureId,
                bookmaker: ouBookmaker,
                market: Market.OVER_UNDER,
                pick: 'OVER',
              },
              select: { odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
        ouBookmaker
          ? this.prisma.client.oddsSnapshot.findFirst({
              where: {
                fixtureId,
                bookmaker: ouBookmaker,
                market: Market.OVER_UNDER,
                pick: 'UNDER',
              },
              select: { odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
        bttsBookmaker
          ? this.prisma.client.oddsSnapshot.findFirst({
              where: {
                fixtureId,
                bookmaker: bttsBookmaker,
                market: Market.BTTS,
                pick: 'YES',
              },
              select: { odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
        bttsBookmaker
          ? this.prisma.client.oddsSnapshot.findFirst({
              where: {
                fixtureId,
                bookmaker: bttsBookmaker,
                market: Market.BTTS,
                pick: 'NO',
              },
              select: { odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
        htftBookmaker
          ? this.prisma.client.oddsSnapshot.findMany({
              where: {
                fixtureId,
                bookmaker: htftBookmaker,
                market: Market.HALF_TIME_FULL_TIME,
              },
              select: { pick: true, odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : [],
      ]);

    const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
    for (const row of htftRows) {
      if (!row.pick || !row.odds) continue;
      if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
        htftOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }

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
      htftOdds,
    };
  }

  private async findLatestOneXTwoOddsSnapshotByBookmaker(
    fixtureId: string,
    _cutoff: Date,
    bookmaker: string,
  ): Promise<FullOddsSnapshot | null> {
    const row = await this.prisma.client.oddsSnapshot.findFirst({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
        bookmaker,
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

    if (
      row === null ||
      row.homeOdds === null ||
      row.drawOdds === null ||
      row.awayOdds === null
    ) {
      return null;
    }

    return {
      bookmaker: row.bookmaker,
      snapshotAt: row.snapshotAt,
      homeOdds: new Decimal(row.homeOdds.toString()),
      drawOdds: new Decimal(row.drawOdds.toString()),
      awayOdds: new Decimal(row.awayOdds.toString()),
      overOdds: null,
      underOdds: null,
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
    };
  }

  private async findLatestBestOneXTwoOddsSnapshot(
    fixtureId: string,
    _cutoff: Date,
  ): Promise<{
    snapshot: FullOddsSnapshot;
    offeredBy: { home: string; draw: string; away: string };
  } | null> {
    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId,
        market: Market.ONE_X_TWO,
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
      orderBy: [{ snapshotAt: 'desc' }, { bookmaker: 'asc' }],
    });

    if (rows.length === 0) return null;

    const latestByBookmaker = new Map<
      string,
      {
        bookmaker: string;
        snapshotAt: Date;
        homeOdds: Prisma.Decimal | null;
        drawOdds: Prisma.Decimal | null;
        awayOdds: Prisma.Decimal | null;
      }
    >();
    for (const row of rows) {
      if (!latestByBookmaker.has(row.bookmaker)) {
        latestByBookmaker.set(row.bookmaker, row);
      }
    }

    const latestRows = Array.from(latestByBookmaker.values()).filter(
      (row) =>
        row.homeOdds !== null && row.drawOdds !== null && row.awayOdds !== null,
    );
    if (latestRows.length === 0) return null;

    const bestHome = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.homeOdds!.toString()).greaterThan(
          new Decimal(best.homeOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );
    const bestDraw = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.drawOdds!.toString()).greaterThan(
          new Decimal(best.drawOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );
    const bestAway = latestRows.reduce(
      (best, row) =>
        best === null ||
        new Decimal(row.awayOdds!.toString()).greaterThan(
          new Decimal(best.awayOdds!.toString()),
        )
          ? row
          : best,
      null as (typeof latestRows)[number] | null,
    );

    if (bestHome === null || bestDraw === null || bestAway === null) {
      return null;
    }

    return {
      snapshot: {
        bookmaker: 'MarketBest',
        snapshotAt: latestRows[0]!.snapshotAt,
        homeOdds: new Decimal(bestHome.homeOdds!.toString()),
        drawOdds: new Decimal(bestDraw.drawOdds!.toString()),
        awayOdds: new Decimal(bestAway.awayOdds!.toString()),
        overOdds: null,
        underOdds: null,
        bttsYesOdds: null,
        bttsNoOdds: null,
        htftOdds: {},
      },
      offeredBy: {
        home: bestHome.bookmaker,
        draw: bestDraw.bookmaker,
        away: bestAway.bookmaker,
      },
    };
  }

  // eslint-disable-next-line max-params -- Eight domain parameters; grouping into an object would obscure intent.
  private selectBestViablePick(
    probabilities: MatchProbabilities,
    odds: FullOddsSnapshot,
    deterministicScore: Decimal,
    distHome: number[],
    distAway: number[],
    lambdaFloorHit: boolean,
    suspendedMarkets: Set<Market>,
    competitionCode: string | null = null,
  ): ViablePick | null {
    const viable = this.listViablePicks(
      probabilities,
      odds,
      deterministicScore,
      distHome,
      distAway,
      lambdaFloorHit,
      suspendedMarkets,
      competitionCode,
    );

    return viable[0] ?? null;
  }

  // eslint-disable-next-line max-params -- Eight domain parameters; grouping into an object would obscure intent.
  private listViablePicks(
    probabilities: MatchProbabilities,
    odds: FullOddsSnapshot,
    deterministicScore: Decimal,
    distHome: number[],
    distAway: number[],
    lambdaFloorHit: boolean,
    suspendedMarkets: Set<Market>,
    competitionCode: string | null = null,
  ): ViablePick[] {
    return this.listEvaluatedPicks(
      probabilities,
      odds,
      deterministicScore,
      distHome,
      distAway,
      lambdaFloorHit,
      suspendedMarkets,
      competitionCode,
    )
      .filter((pick): pick is ViablePick => pick.rejectionReason === undefined)
      .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));
  }

  private listEvaluatedOneXTwoPicks(
    probabilities: MatchProbabilities,
    odds: FullOddsSnapshot,
    deterministicScore: Decimal,
    suspendedMarkets: Set<Market>,
    competitionCode: string | null = null,
  ): EvaluatedPick[] {
    const minEv = getLeagueEvThreshold(competitionCode);
    const candidates: ViablePick[] = [
      {
        market: Market.ONE_X_TWO,
        pick: 'HOME',
        probability: probabilities.home,
        odds: odds.homeOdds,
        ev: calcEV(probabilities.home, odds.homeOdds),
        qualityScore: buildQualityScore(
          calcEV(probabilities.home, odds.homeOdds),
          deterministicScore,
          Market.ONE_X_TWO,
          'HOME',
          odds.homeOdds,
        ),
        isCombo: false,
      },
      {
        market: Market.ONE_X_TWO,
        pick: 'DRAW',
        probability: probabilities.draw,
        odds: odds.drawOdds,
        ev: calcEV(probabilities.draw, odds.drawOdds),
        qualityScore: buildQualityScore(
          calcEV(probabilities.draw, odds.drawOdds),
          deterministicScore,
          Market.ONE_X_TWO,
          'DRAW',
          odds.drawOdds,
        ),
        isCombo: false,
      },
      {
        market: Market.ONE_X_TWO,
        pick: 'AWAY',
        probability: probabilities.away,
        odds: odds.awayOdds,
        ev: calcEV(probabilities.away, odds.awayOdds),
        qualityScore: buildQualityScore(
          calcEV(probabilities.away, odds.awayOdds),
          deterministicScore,
          Market.ONE_X_TWO,
          'AWAY',
          odds.awayOdds,
        ),
        isCombo: false,
      },
    ];

    return candidates
      .map((candidate) => {
        const rejectionReason = getPickRejectionReason(
          candidate,
          suspendedMarkets,
          probabilities,
          minEv,
          competitionCode,
        );
        return rejectionReason ? { ...candidate, rejectionReason } : candidate;
      })
      .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));
  }

  // eslint-disable-next-line max-params -- Eight domain parameters; grouping into an object would obscure intent.
  private listEvaluatedPicks(
    probabilities: MatchProbabilities,
    odds: FullOddsSnapshot,
    deterministicScore: Decimal,
    distHome: number[],
    distAway: number[],
    lambdaFloorHit: boolean,
    suspendedMarkets: Set<Market>,
    competitionCode: string | null = null,
  ): EvaluatedPick[] {
    const minEv = getLeagueEvThreshold(competitionCode);
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
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.ONE_X_TWO,
          c.pick,
          c.pickOdds,
        ),
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
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.OVER_UNDER,
          'OVER',
          odds.overOdds,
        ),
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
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.OVER_UNDER,
          'UNDER',
          odds.underOdds,
        ),
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
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.BTTS,
          'YES',
          odds.bttsYesOdds,
        ),
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
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.BTTS,
          'NO',
          odds.bttsNoOdds,
        ),
        isCombo: false,
      });
    }

    // Singles HALF_TIME_FULL_TIME
    for (const pick of HALF_TIME_FULL_TIME_PICKS) {
      const pickOdds = odds.htftOdds[pick] ?? null;
      if (pickOdds === null) continue;

      const probability = probabilities.htft[pick];
      const ev = calcEV(probability, pickOdds);
      candidates.push({
        market: Market.HALF_TIME_FULL_TIME,
        pick,
        probability,
        odds: pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.HALF_TIME_FULL_TIME,
          pick,
          pickOdds,
        ),
        isCombo: false,
      });
    }

    // Combos from COMBO_WHITELIST. When lambdas collapse to the floor, Poisson
    // scoreline mass becomes unrealistic and combo joint probabilities become
    // unreliable, so combos are disabled for that fixture.
    if (!lambdaFloorHit) {
      for (const combo of COMBO_WHITELIST) {
        const p1Odds = getPickOddsFromSnapshot(
          combo.market1,
          combo.pick1,
          odds,
        );
        const p2Odds = getPickOddsFromSnapshot(
          combo.market2,
          combo.pick2,
          odds,
        );
        if (p1Odds === null || p2Odds === null) continue;
        if (
          p1Odds.greaterThan(MAX_SELECTION_ODDS) ||
          p2Odds.greaterThan(MAX_SELECTION_ODDS)
        )
          continue;

        const jointProbability = computeJointProbability(
          combo,
          distHome,
          distAway,
        );
        const oddsCombo = estimateComboOdds({
          combo,
          probabilities,
          jointProbability,
          odds1: p1Odds,
          odds2: p2Odds,
        });
        const ev = calcEV(jointProbability, oddsCombo);
        candidates.push({
          market: combo.market1,
          pick: combo.pick1,
          comboMarket: combo.market2,
          comboPick: combo.pick2,
          probability: jointProbability,
          odds: oddsCombo,
          ev,
          qualityScore: buildQualityScore(
            ev,
            deterministicScore,
            combo.market1,
            combo.pick1,
            oddsCombo,
          ),
          isCombo: true,
        });
      }
    }

    // Filter: EV >= league threshold and no suspended market
    const evaluated = candidates.map((candidate) => {
      const rejectionReason = getPickRejectionReason(
        candidate,
        suspendedMarkets,
        probabilities,
        minEv,
        competitionCode,
      );
      return rejectionReason ? { ...candidate, rejectionReason } : candidate;
    });

    return evaluated.sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

function mapProbabilitiesToNumber(
  probabilities: MatchProbabilities,
): Record<string, number | Record<string, number>> {
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
    htft: Object.fromEntries(
      Object.entries(probabilities.htft).map(([pick, value]) => [
        pick,
        value.toNumber(),
      ]),
    ),
  };
}

function asNumber(value: unknown): number {
  return Number(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveLambdas(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
  competitionCode?: string | null,
) {
  const homeXgFor = asNumber(homeStats.xgFor);
  const awayXgFor = asNumber(awayStats.xgFor);
  const homeXgAgainst = asNumber(homeStats.xgAgainst);
  const awayXgAgainst = asNumber(awayStats.xgAgainst);

  const leagueAvg = Math.max(
    0.5,
    (homeXgFor + awayXgFor + homeXgAgainst + awayXgAgainst) / 4,
  );

  const anchor = getLeagueMeanLambda(competitionCode);
  const rawHome =
    LAMBDA_SHRINKAGE_FACTOR * ((homeXgFor * awayXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * anchor;
  const rawAway =
    LAMBDA_SHRINKAGE_FACTOR * ((awayXgFor * homeXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * anchor;

  return {
    home: clamp(rawHome * HOME_ADVANTAGE_LAMBDA_FACTOR, 0.05, 5),
    away: clamp(rawAway * AWAY_DISADVANTAGE_LAMBDA_FACTOR, 0.05, 5),
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

function devigOneXTwoOdds(odds: FullOddsSnapshot): MatchProbabilities {
  const invHome = new Decimal(1).div(odds.homeOdds);
  const invDraw = new Decimal(1).div(odds.drawOdds);
  const invAway = new Decimal(1).div(odds.awayOdds);
  const margin = invHome.plus(invDraw).plus(invAway);

  const home = invHome.div(margin);
  const draw = invDraw.div(margin);
  const away = invAway.div(margin);
  const zero = new Decimal(0);

  return {
    home,
    draw,
    away,
    over25: zero,
    under25: zero,
    bttsYes: zero,
    bttsNo: zero,
    dc1X: home.plus(draw),
    dcX2: draw.plus(away),
    dc12: home.plus(away),
    htft: {
      HOME_HOME: zero,
      HOME_DRAW: zero,
      HOME_AWAY: zero,
      DRAW_HOME: zero,
      DRAW_DRAW: zero,
      DRAW_AWAY: zero,
      AWAY_HOME: zero,
      AWAY_DRAW: zero,
      AWAY_AWAY: zero,
    },
  };
}

function eloExpectedScore(
  homeElo: number,
  awayElo: number,
  homeAdvantage = FRI_HOME_ADVANTAGE_ELO,
): number {
  return 1 / (10 ** (-(homeElo - awayElo + homeAdvantage) / 400) + 1);
}

function eloProbabilities(
  homeElo: number,
  awayElo: number,
): MatchProbabilities {
  const winExpectation = eloExpectedScore(homeElo, awayElo);
  const draw = FRI_DRAW_RATE * (1 - Math.abs(2 * winExpectation - 1));
  const home = new Decimal(winExpectation * (1 - draw));
  const away = new Decimal((1 - winExpectation) * (1 - draw));
  const drawProb = new Decimal(draw);
  const zero = new Decimal(0);

  return {
    home,
    draw: drawProb,
    away,
    over25: zero,
    under25: zero,
    bttsYes: zero,
    bttsNo: zero,
    dc1X: home.plus(drawProb),
    dcX2: drawProb.plus(away),
    dc12: home.plus(away),
    htft: {
      HOME_HOME: zero,
      HOME_DRAW: zero,
      HOME_AWAY: zero,
      DRAW_HOME: zero,
      DRAW_DRAW: zero,
      DRAW_AWAY: zero,
      AWAY_HOME: zero,
      AWAY_DRAW: zero,
      AWAY_AWAY: zero,
    },
  };
}

function bookmakerRank(bookmaker: string): number {
  if (bookmaker === 'Pinnacle') return 0;
  if (bookmaker === 'Bet365') return 1;
  if (bookmaker === 'Unibet') return 2;
  if (bookmaker === 'Marathonbet') return 3;
  if (bookmaker === 'Bwin') return 4;
  if (bookmaker === 'MarketAvg') return 5;
  return 6;
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
  if (market === Market.HALF_TIME_FULL_TIME) {
    if (isHalfTimeFullTimePick(pick)) {
      return odds.htftOdds[pick] ?? null;
    }
  }
  return null;
}

// Returns the odds of the primary market pick for a ViablePick.
// Used for line movement comparison.
function getPickOdds(pick: ViablePick, odds: FullOddsSnapshot): Decimal | null {
  return getPickOddsFromSnapshot(pick.market, pick.pick, odds);
}

function isHalfTimeFullTimePick(value: string): value is HalfTimeFullTimePick {
  return (HALF_TIME_FULL_TIME_PICKS as readonly string[]).includes(value);
}

function getModelProbabilityForPick(
  market: Market,
  pick: string,
  probabilities: MatchProbabilities,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === 'HOME') return probabilities.home;
    if (pick === 'DRAW') return probabilities.draw;
    if (pick === 'AWAY') return probabilities.away;
  }
  if (market === Market.DOUBLE_CHANCE) {
    if (pick === '1X') return probabilities.dc1X;
    if (pick === 'X2') return probabilities.dcX2;
    if (pick === '12') return probabilities.dc12;
  }
  if (market === Market.OVER_UNDER) {
    if (pick === 'OVER') return probabilities.over25;
    if (pick === 'UNDER') return probabilities.under25;
  }
  if (market === Market.BTTS) {
    if (pick === 'YES') return probabilities.bttsYes;
    if (pick === 'NO') return probabilities.bttsNo;
  }
  if (market === Market.HALF_TIME_FULL_TIME && isHalfTimeFullTimePick(pick)) {
    return probabilities.htft[pick];
  }
  return null;
}

export function estimateComboOdds(input: {
  combo: ComboPick;
  probabilities: MatchProbabilities;
  jointProbability: Decimal;
  odds1: Decimal;
  odds2: Decimal;
}): Decimal {
  const { combo, probabilities, jointProbability, odds1, odds2 } = input;
  const probability1 = getModelProbabilityForPick(
    combo.market1,
    combo.pick1,
    probabilities,
  );
  const probability2 = getModelProbabilityForPick(
    combo.market2,
    combo.pick2,
    probabilities,
  );

  const rawProduct = odds1.mul(odds2);
  if (
    probability1 === null ||
    probability2 === null ||
    jointProbability.lte(0) ||
    probability1.lte(0) ||
    probability2.lte(0)
  ) {
    return rawProduct;
  }

  const independentProbability = probability1.mul(probability2);
  if (independentProbability.lte(0)) {
    return rawProduct;
  }

  const correlationFactor = independentProbability
    .div(jointProbability)
    .pow(COMBO_CORRELATION_ALPHA);
  const clampedFactor = Decimal.min(
    COMBO_CORRELATION_MAX_FACTOR,
    Decimal.max(COMBO_CORRELATION_MIN_FACTOR, correlationFactor),
  );

  return rawProduct.mul(clampedFactor);
}

function summarizePick(pick: ViablePick): {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
} {
  return {
    market: pick.market,
    pick: pick.pick,
    comboMarket: pick.comboMarket,
    comboPick: pick.comboPick,
    probability: pick.probability.toNumber(),
    odds: pick.odds.toNumber(),
    ev: pick.ev.toNumber(),
    qualityScore: pick.qualityScore.toNumber(),
  };
}

function summarizePicks(picks: ViablePick[]): {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
}[] {
  return picks.map((pick) => summarizePick(pick));
}

function summarizeEvaluatedPicks(picks: EvaluatedPick[]): {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
  status: 'viable' | 'rejected';
  rejectionReason?: string;
}[] {
  return picks.map((pick) => ({
    ...summarizePick(pick),
    status: pick.rejectionReason ? 'rejected' : 'viable',
    ...(pick.rejectionReason ? { rejectionReason: pick.rejectionReason } : {}),
  }));
}

// eslint-disable-next-line max-params -- Five domain parameters; minEv and minOdds are derived from competition context and kept explicit for testability.
function getPickRejectionReason(
  pick: ViablePick,
  suspendedMarkets: Set<Market>,
  probabilities: MatchProbabilities,
  minEv: Decimal = EV_THRESHOLD,
  competitionCode: string | null = null,
): EvaluatedPick['rejectionReason'] {
  if (pick.ev.greaterThan(EV_HARD_CAP)) {
    return 'ev_above_hard_cap';
  }

  if (pick.market === Market.ONE_X_TWO) {
    if (
      pick.pick === 'HOME' &&
      probabilities.home.lessThan(MIN_PICK_DIRECTION_PROBABILITY)
    ) {
      return 'probability_too_low';
    }
    if (
      pick.pick === 'AWAY' &&
      probabilities.away.lessThan(MIN_PICK_DIRECTION_PROBABILITY)
    ) {
      return 'probability_too_low';
    }
    // Combo picks with DRAW as primary leg (e.g. NUL + MOINS 2.5) passed the EV
    // floor via high combo odds while P(draw) was 19-27% — audit 2026-03-28: 0/3.
    // Require a minimum draw probability before accepting DRAW-based combos.
    if (
      pick.pick === 'DRAW' &&
      pick.isCombo &&
      probabilities.draw.lessThan(MIN_DRAW_DIRECTION_PROBABILITY)
    ) {
      return 'probability_too_low';
    }
  }

  if (pick.ev.lessThan(minEv)) {
    return 'ev_below_threshold';
  }

  if (pick.qualityScore.lessThan(MIN_QUALITY_SCORE)) {
    return 'quality_score_below_threshold';
  }

  const minSelectionOdds = getPickMinSelectionOdds(
    competitionCode,
    pick.market,
    pick.pick,
  );

  if (pick.odds.lessThan(minSelectionOdds)) {
    return 'odds_below_floor';
  }

  // For combos, individual leg odds are already filtered upstream — only apply
  // the cap to single picks where the pick odds IS the leg odds.
  if (!pick.isCombo && pick.odds.greaterThan(MAX_SELECTION_ODDS)) {
    return 'odds_above_cap';
  }

  if (
    suspendedMarkets.has(pick.market) ||
    (pick.comboMarket !== undefined && suspendedMarkets.has(pick.comboMarket))
  ) {
    return 'market_suspended';
  }

  return undefined;
}

// eslint-disable-next-line max-params -- Five domain parameters; no meaningful grouping possible without obscuring intent.
function buildQualityScore(
  ev: Decimal,
  deterministicScore: Decimal,
  market: Market,
  pick: string,
  odds?: Decimal,
): Decimal {
  return ev
    .mul(deterministicScore)
    .mul(getOneXTwoLongshotPenalty(market, pick, odds ?? new Decimal(0)));
}

function getOneXTwoLongshotPenalty(
  market: Market,
  pick: string,
  odds: Decimal,
): Decimal {
  if (market !== Market.ONE_X_TWO) {
    return new Decimal(1);
  }

  if (pick === 'AWAY' && odds.greaterThanOrEqualTo(ONE_X_TWO_AWAY_MAX_ODDS)) {
    return progressiveLongshotPenalty({
      threshold: ONE_X_TWO_AWAY_MAX_ODDS,
      odds,
      floor: ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR,
    });
  }

  if (pick === 'DRAW' && odds.greaterThanOrEqualTo(ONE_X_TWO_DRAW_MAX_ODDS)) {
    return progressiveLongshotPenalty({
      threshold: ONE_X_TWO_DRAW_MAX_ODDS,
      odds,
      floor: ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR,
    });
  }

  return new Decimal(1);
}

function progressiveLongshotPenalty(input: {
  threshold: Decimal;
  odds: Decimal;
  floor: Decimal;
}): Decimal {
  const { threshold, odds, floor } = input;
  if (odds.lte(0)) {
    return floor;
  }

  const ratio = threshold.div(odds);
  const progressive = ratio.pow(ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT);
  return Decimal.max(floor, Decimal.min(new Decimal(1), progressive));
}

function buildBetPickKey(input: {
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
}): string {
  return [
    input.market,
    input.pick,
    input.comboMarket ?? '-',
    input.comboPick ?? '-',
  ].join('|');
}

function summarizeTeamStats(stats: TeamStatsInput): {
  recentForm: number;
  xgFor: number;
  xgAgainst: number;
  homeWinRate: number;
  awayWinRate: number;
  drawRate: number;
  leagueVolatility: number;
} {
  return {
    recentForm: asNumber(stats.recentForm),
    xgFor: asNumber(stats.xgFor),
    xgAgainst: asNumber(stats.xgAgainst),
    homeWinRate: asNumber(stats.homeWinRate),
    awayWinRate: asNumber(stats.awayWinRate),
    drawRate: asNumber(stats.drawRate),
    leagueVolatility: asNumber(stats.leagueVolatility),
  };
}

function getFixtureCompetitionCode(fixture: {
  season?: { competition?: { code?: string } };
}): string | null {
  return fixture.season?.competition?.code ?? null;
}

function getFixtureHomeTeamName(fixture: {
  homeTeam?: { name?: string };
}): string | null {
  return fixture.homeTeam?.name ?? null;
}

function getFixtureAwayTeamName(fixture: {
  awayTeam?: { name?: string };
}): string | null {
  return fixture.awayTeam?.name ?? null;
}
