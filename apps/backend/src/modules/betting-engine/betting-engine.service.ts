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
  resolveFirstHalfBetStatus,
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
  getLeagueHomeAwayFactors,
  MAX_SELECTION_ODDS,
  MIN_DRAW_DIRECTION_PROBABILITY,
  MIN_QUALITY_SCORE,
  getLeagueEvThreshold,
  ONE_X_TWO_AWAY_MAX_ODDS,
  ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_DRAW_MAX_ODDS,
  ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR,
  ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT,
  LAMBDA_SHRINKAGE_FACTOR,
  getLeagueMeanLambda,
  getPickDirectionProbabilityThreshold,
  getPickEvFloor,
  getPickEvSoftCap,
  getPickMaxSelectionOdds,
  getPickMinSelectionOdds,
  isEuropeanCompetition,
  EUROPEAN_CROSS_COMP_FORM_WEIGHT,
  EUROPEAN_CROSS_COMP_XG_WEIGHT,
  SAFE_VALUE_MIN_PROBABILITY,
  SAFE_VALUE_MIN_EV,
  SAFE_VALUE_MIN_ODDS,
  SAFE_VALUE_MAX_ODDS,
} from './ev.constants';
import { FEATURE_FLAGS } from '@config/feature-flags.constants';
import { LINE_MOVEMENT_THRESHOLD } from './ev.constants';
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

  selectSafeValuePickForBacktest(input: {
    evaluatedPicks: EvaluatedPick[];
    evPickKey: string | null;
  }): ViablePick | null {
    return this.selectSafeValuePick(
      input.evaluatedPicks,
      new Set<Market>(),
      input.evPickKey,
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
      } else if (
        bet.market === Market.OVER_UNDER_HT ||
        bet.market === Market.FIRST_HALF_WINNER
      ) {
        status = resolveFirstHalfBetStatus(
          bet.pick,
          fixture.homeHtScore,
          fixture.awayHtScore,
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

    const competitionCode = getFixtureCompetitionCode(fixture);

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

    // For European competitions, supplement (or replace) European stats with
    // domestic form when the European sample is absent or thin.
    let effectiveHomeStats: TeamStatsInput | null = homeStats;
    let effectiveAwayStats: TeamStatsInput | null = awayStats;

    if (isEuropeanCompetition(competitionCode)) {
      const [homeCross, awayCross] = await Promise.all([
        this.findCrossCompStats(
          fixture.homeTeamId,
          fixture.scheduledAt,
          fixture.seasonId,
        ),
        this.findCrossCompStats(
          fixture.awayTeamId,
          fixture.scheduledAt,
          fixture.seasonId,
        ),
      ]);

      if (homeCross) {
        effectiveHomeStats = homeStats
          ? blendTeamStats({
              primary: homeStats,
              secondary: homeCross,
              formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
              xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
            })
          : homeCross;
      }
      if (awayCross) {
        effectiveAwayStats = awayStats
          ? blendTeamStats({
              primary: awayStats,
              secondary: awayCross,
              formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
              xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
            })
          : awayCross;
      }
    }

    if (!effectiveHomeStats || !effectiveAwayStats) {
      logger.info(
        {
          fixtureId,
          competitionCode,
          homeTeam: getFixtureHomeTeamName(fixture),
          awayTeam: getFixtureAwayTeamName(fixture),
          hasHomeStats: effectiveHomeStats !== null,
          hasAwayStats: effectiveAwayStats !== null,
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
        effectiveHomeStats,
        effectiveAwayStats,
        weights,
        competitionCode,
      );
    const lambdaFloorHit =
      lambda.home <= MIN_LAMBDA + Number.EPSILON ||
      lambda.away <= MIN_LAMBDA + Number.EPSILON;

    if (lambdaFloorHit) {
      logger.warn(
        {
          fixtureId,
          competitionCode,
          homeTeam: getFixtureHomeTeamName(fixture),
          awayTeam: getFixtureAwayTeamName(fixture),
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          homeStats: summarizeTeamStats(effectiveHomeStats),
          awayStats: summarizeTeamStats(effectiveAwayStats),
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
    let evPickKey: string | null = null;

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
      evPickKey = pickKey;

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

      const existingBet = await this.prisma.client.bet.findFirst({
        where: { fixtureId, pickKey, userId: null },
        select: { id: true },
      });
      if (existingBet) {
        await this.prisma.client.bet.update({
          where: { id: existingBet.id },
          data: {
            modelRunId: modelRun.id,
            probEstimated: toPrismaDecimal(valueBet.probability, 4),
            oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
            ev: toPrismaDecimal(valueBet.ev, 4),
            qualityScore: toPrismaDecimal(valueBet.qualityScore, 4),
            stakePct: toPrismaDecimal(stakePct, 4),
            status: BetStatus.PENDING,
          },
        });
      } else {
        await this.prisma.client.bet.create({
          data: {
            modelRunId: modelRun.id,
            fixtureId,
            market: valueBet.market,
            pick: valueBet.pick,
            pickKey,
            comboMarket: valueBet.comboMarket ?? null,
            comboPick: valueBet.comboPick ?? null,
            probEstimated: toPrismaDecimal(valueBet.probability, 4),
            oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
            ev: toPrismaDecimal(valueBet.ev, 4),
            qualityScore: toPrismaDecimal(valueBet.qualityScore, 4),
            stakePct: toPrismaDecimal(stakePct, 4),
          },
        });
      }
    }

    // Safe value pass — only when the model score threshold is met (same guard as EV).
    // Reuses the already-computed evaluatedPicks but applies SAFE_VALUE criteria.
    if (deterministicDecision === Decision.BET && latestOdds !== null) {
      const svPick = this.selectSafeValuePick(
        evaluatedPicks,
        suspendedMarkets,
        evPickKey,
      );

      if (svPick !== null) {
        const svPickKey = `sv:${buildBetPickKey({
          market: svPick.market,
          pick: svPick.pick,
          comboMarket: null,
          comboPick: null,
        })}`;

        const existingSvBet = await this.prisma.client.bet.findFirst({
          where: { fixtureId, pickKey: svPickKey, userId: null },
          select: { id: true },
        });
        if (existingSvBet) {
          await this.prisma.client.bet.update({
            where: { id: existingSvBet.id },
            data: {
              modelRunId: modelRun.id,
              probEstimated: toPrismaDecimal(svPick.probability, 4),
              oddsSnapshot: toPrismaDecimal(svPick.odds, 3),
              ev: toPrismaDecimal(svPick.ev, 4),
              qualityScore: toPrismaDecimal(svPick.qualityScore, 4),
              stakePct: toPrismaDecimal(DEFAULT_STAKE_PCT, 4),
              status: BetStatus.PENDING,
              isSafeValue: true,
            },
          });
        } else {
          await this.prisma.client.bet.create({
            data: {
              modelRunId: modelRun.id,
              fixtureId,
              market: svPick.market,
              pick: svPick.pick,
              pickKey: svPickKey,
              comboMarket: null,
              comboPick: null,
              probEstimated: toPrismaDecimal(svPick.probability, 4),
              oddsSnapshot: toPrismaDecimal(svPick.odds, 3),
              ev: toPrismaDecimal(svPick.ev, 4),
              qualityScore: toPrismaDecimal(svPick.qualityScore, 4),
              stakePct: toPrismaDecimal(DEFAULT_STAKE_PCT, 4),
              isSafeValue: true,
            },
          });
        }

        logger.info(
          {
            fixtureId,
            competitionCode,
            market: svPick.market,
            pick: svPick.pick,
            probability: svPick.probability.toNumber(),
            ev: svPick.ev.toNumber(),
            odds: svPick.odds.toNumber(),
          },
          'Safe value pick saved',
        );
      }
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

      const existingBet2 = await this.prisma.client.bet.findFirst({
        where: { fixtureId, pickKey, userId: null },
        select: { id: true },
      });
      if (existingBet2) {
        await this.prisma.client.bet.update({
          where: { id: existingBet2.id },
          data: {
            modelRunId: modelRun.id,
            probEstimated: toPrismaDecimal(valueBet.probability, 4),
            oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
            ev: toPrismaDecimal(valueBet.ev, 4),
            qualityScore: toPrismaDecimal(valueBet.qualityScore, 4),
            stakePct: toPrismaDecimal(stakePct, 4),
            status: BetStatus.PENDING,
          },
        });
      } else {
        await this.prisma.client.bet.create({
          data: {
            modelRunId: modelRun.id,
            fixtureId,
            market: valueBet.market,
            pick: valueBet.pick,
            pickKey,
            comboMarket: valueBet.comboMarket ?? null,
            comboPick: valueBet.comboPick ?? null,
            probEstimated: toPrismaDecimal(valueBet.probability, 4),
            oddsSnapshot: toPrismaDecimal(valueBet.odds, 3),
            ev: toPrismaDecimal(valueBet.ev, 4),
            qualityScore: toPrismaDecimal(valueBet.qualityScore, 4),
            stakePct: toPrismaDecimal(stakePct, 4),
          },
        });
      }
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

  async analyzeByDate(date: string): Promise<{
    date: string;
    analyzed: number;
    skipped: number;
  }> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
        status: FixtureStatus.SCHEDULED,
      },
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

    return { date, analyzed, skipped };
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

  /**
   * Fetch the most recent TeamStats for a team from any season other than the
   * specified one, before a given date. Used to supplement European stats with
   * the team's domestic form when the European sample is absent or thin.
   */
  private async findCrossCompStats(
    teamId: string,
    beforeDate: Date,
    excludeSeasonId: string,
  ): Promise<TeamStatsInput | null> {
    return this.prisma.client.teamStats.findFirst({
      where: {
        teamId,
        afterFixture: {
          scheduledAt: { lt: beforeDate },
          seasonId: { not: excludeSeasonId },
        },
      },
      orderBy: { afterFixture: { scheduledAt: 'desc' } },
    });
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
    const [
      ouBookmaker,
      bttsBookmaker,
      htftBookmaker,
      ouHtBookmaker,
      fhwBookmaker,
    ] = await Promise.all([
      this.findBestBookmakerForMarket(fixtureId, Market.OVER_UNDER, _cutoff),
      this.findBestBookmakerForMarket(fixtureId, Market.BTTS, _cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.HALF_TIME_FULL_TIME,
        _cutoff,
      ),
      this.findBestBookmakerForMarket(fixtureId, Market.OVER_UNDER_HT, _cutoff),
      this.findBestBookmakerForMarket(
        fixtureId,
        Market.FIRST_HALF_WINNER,
        _cutoff,
      ),
    ]);

    const [ouRows, bttsYesRow, bttsNoRow, htftRows, ouHtRows, fhwRows] =
      await Promise.all([
        ouBookmaker
          ? this.prisma.client.oddsSnapshot.findMany({
              where: {
                fixtureId,
                bookmaker: ouBookmaker,
                market: Market.OVER_UNDER,
              },
              select: { pick: true, odds: true },
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
        ouHtBookmaker
          ? this.prisma.client.oddsSnapshot.findMany({
              where: {
                fixtureId,
                bookmaker: ouHtBookmaker,
                market: Market.OVER_UNDER_HT,
              },
              select: { pick: true, odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
        fhwBookmaker
          ? this.prisma.client.oddsSnapshot.findMany({
              where: {
                fixtureId,
                bookmaker: fhwBookmaker,
                market: Market.FIRST_HALF_WINNER,
              },
              select: { pick: true, odds: true },
              orderBy: { snapshotAt: 'desc' },
            })
          : null,
      ]);

    const htftOdds = {} as Partial<Record<HalfTimeFullTimePick, Decimal>>;
    const overUnderOdds = {} as FullOddsSnapshot['overUnderOdds'];
    const ouHtOdds = {} as FullOddsSnapshot['ouHtOdds'];
    let firstHalfWinnerOdds: FullOddsSnapshot['firstHalfWinnerOdds'] = null;

    for (const row of ouRows ?? []) {
      if (!row.pick || !row.odds) continue;
      if (
        !(row.pick in overUnderOdds) &&
        (row.pick === 'OVER_1_5' ||
          row.pick === 'UNDER_1_5' ||
          row.pick === 'OVER' ||
          row.pick === 'UNDER' ||
          row.pick === 'OVER_3_5' ||
          row.pick === 'UNDER_3_5')
      ) {
        overUnderOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    for (const row of htftRows) {
      if (!row.pick || !row.odds) continue;
      if (!(row.pick in htftOdds) && isHalfTimeFullTimePick(row.pick)) {
        htftOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    for (const row of ouHtRows ?? []) {
      if (!row.pick || !row.odds) continue;
      if (
        !(row.pick in ouHtOdds) &&
        (row.pick === 'OVER_0_5' ||
          row.pick === 'UNDER_0_5' ||
          row.pick === 'OVER_1_5' ||
          row.pick === 'UNDER_1_5')
      ) {
        ouHtOdds[row.pick] = new Decimal(row.odds.toString());
      }
    }
    if (fhwRows !== null) {
      const homeRow = fhwRows.find((r) => r.pick === 'HOME');
      const drawRow = fhwRows.find((r) => r.pick === 'DRAW');
      const awayRow = fhwRows.find((r) => r.pick === 'AWAY');
      if (homeRow?.odds && drawRow?.odds && awayRow?.odds) {
        firstHalfWinnerOdds = {
          home: new Decimal(homeRow.odds.toString()),
          draw: new Decimal(drawRow.odds.toString()),
          away: new Decimal(awayRow.odds.toString()),
        };
      }
    }

    return {
      bookmaker: best.bookmaker,
      snapshotAt: best.snapshotAt,
      homeOdds: new Decimal(best.homeOdds.toString()),
      drawOdds: new Decimal(best.drawOdds.toString()),
      awayOdds: new Decimal(best.awayOdds.toString()),
      overUnderOdds,
      bttsYesOdds: bttsYesRow?.odds
        ? new Decimal(bttsYesRow.odds.toString())
        : null,
      bttsNoOdds: bttsNoRow?.odds
        ? new Decimal(bttsNoRow.odds.toString())
        : null,
      htftOdds,
      ouHtOdds,
      firstHalfWinnerOdds,
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
      overUnderOdds: {},
      bttsYesOdds: null,
      bttsNoOdds: null,
      htftOdds: {},
      ouHtOdds: {},
      firstHalfWinnerOdds: null,
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
        snapshotAt: latestRows[0].snapshotAt,
        homeOdds: new Decimal(bestHome.homeOdds!.toString()),
        drawOdds: new Decimal(bestDraw.drawOdds!.toString()),
        awayOdds: new Decimal(bestAway.awayOdds!.toString()),
        overUnderOdds: {},
        bttsYesOdds: null,
        bttsNoOdds: null,
        htftOdds: {},
        ouHtOdds: {},
        firstHalfWinnerOdds: null,
      },
      offeredBy: {
        home: bestHome.bookmaker,
        draw: bestDraw.bookmaker,
        away: bestAway.bookmaker,
      },
    };
  }

  // Select the best safe-value pick from a pre-computed list of evaluated picks.
  //
  // Safe value criteria (distinct from EV criteria):
  //   - Single-market pick only (no combos)
  //   - Allowed markets: ONE_X_TWO, OVER_UNDER, BTTS, OVER_UNDER_HT
  //   - Probability ≥ SAFE_VALUE_MIN_PROBABILITY (0.68)
  //   - EV in [SAFE_VALUE_MIN_EV (0.00), EV_HARD_CAP]
  //   - Odds in [SAFE_VALUE_MIN_ODDS (1.15), SAFE_VALUE_MAX_ODDS (2.20)]
  //   - Market not suspended
  //   - Not already the EV pick (excludedPickKey)
  //
  // Returns the candidate with the highest probability (then highest EV as tiebreak).
  private selectSafeValuePick(
    evaluatedPicks: EvaluatedPick[],
    suspendedMarkets: Set<Market>,
    excludedPickKey: string | null,
  ): ViablePick | null {
    const safeValueMarkets = new Set<Market>([
      Market.ONE_X_TWO,
      Market.OVER_UNDER,
      Market.BTTS,
      Market.OVER_UNDER_HT,
    ]);

    const candidates = evaluatedPicks.filter((pick) => {
      if (pick.isCombo) return false;
      if (!safeValueMarkets.has(pick.market)) return false;
      if (pick.probability.lessThan(SAFE_VALUE_MIN_PROBABILITY)) return false;
      if (pick.ev.lessThan(SAFE_VALUE_MIN_EV)) return false;
      if (pick.ev.greaterThan(EV_HARD_CAP)) return false;
      if (pick.odds.lessThan(SAFE_VALUE_MIN_ODDS)) return false;
      if (pick.odds.greaterThan(SAFE_VALUE_MAX_ODDS)) return false;
      if (suspendedMarkets.has(pick.market)) return false;
      const pickKey = buildBetPickKey({
        market: pick.market,
        pick: pick.pick,
        comboMarket: pick.comboMarket ?? null,
        comboPick: pick.comboPick ?? null,
      });
      if (excludedPickKey !== null && pickKey === excludedPickKey) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // Best by probability DESC, then EV DESC
    return candidates.reduce((best, c) => {
      const cmpProb = c.probability.comparedTo(best.probability);
      if (cmpProb > 0) return c;
      if (cmpProb < 0) return best;
      return c.ev.comparedTo(best.ev) > 0 ? c : best;
    });
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

  // eslint-disable-next-line max-params
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
    const overUnderCandidates: Array<{
      pick: string;
      probability: Decimal;
      odds: Decimal | null | undefined;
    }> = [
      {
        pick: 'OVER_1_5',
        probability: probabilities.over15,
        odds: odds.overUnderOdds['OVER_1_5'],
      },
      {
        pick: 'UNDER_1_5',
        probability: probabilities.under15,
        odds: odds.overUnderOdds['UNDER_1_5'],
      },
      {
        pick: 'OVER',
        probability: probabilities.over25,
        odds: odds.overUnderOdds['OVER'],
      },
      {
        pick: 'UNDER',
        probability: probabilities.under25,
        odds: odds.overUnderOdds['UNDER'],
      },
      {
        pick: 'OVER_3_5',
        probability: probabilities.over35,
        odds: odds.overUnderOdds['OVER_3_5'],
      },
      {
        pick: 'UNDER_3_5',
        probability: probabilities.under35,
        odds: odds.overUnderOdds['UNDER_3_5'],
      },
    ];

    for (const candidate of overUnderCandidates) {
      if (candidate.odds === null || candidate.odds === undefined) continue;
      const ev = calcEV(candidate.probability, candidate.odds);
      candidates.push({
        market: Market.OVER_UNDER,
        pick: candidate.pick,
        probability: candidate.probability,
        odds: candidate.odds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.OVER_UNDER,
          candidate.pick,
          candidate.odds,
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

    // Singles OVER_UNDER_HT
    const ouHtCandidates: Array<{
      pick: 'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5';
      probability: Decimal;
    }> = [
      {
        pick: 'OVER_0_5',
        probability: probabilities.ouHT['OVER_0_5'] ?? new Decimal(0),
      },
      {
        pick: 'UNDER_0_5',
        probability: probabilities.ouHT['UNDER_0_5'] ?? new Decimal(0),
      },
      {
        pick: 'OVER_1_5',
        probability: probabilities.ouHT['OVER_1_5'] ?? new Decimal(0),
      },
      {
        pick: 'UNDER_1_5',
        probability: probabilities.ouHT['UNDER_1_5'] ?? new Decimal(0),
      },
    ];
    for (const candidate of ouHtCandidates) {
      const pickOdds = odds.ouHtOdds[candidate.pick];
      if (!pickOdds) continue;
      const ev = calcEV(candidate.probability, pickOdds);
      candidates.push({
        market: Market.OVER_UNDER_HT,
        pick: candidate.pick,
        probability: candidate.probability,
        odds: pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.OVER_UNDER_HT,
          candidate.pick,
          pickOdds,
        ),
        isCombo: false,
      });
    }

    // Singles FIRST_HALF_WINNER
    if (odds.firstHalfWinnerOdds !== null) {
      const fhwCandidates: Array<{
        pick: string;
        probability: Decimal;
        pickOdds: Decimal;
      }> = [
        {
          pick: 'HOME',
          probability: probabilities.firstHalfWinner.home,
          pickOdds: odds.firstHalfWinnerOdds.home,
        },
        {
          pick: 'DRAW',
          probability: probabilities.firstHalfWinner.draw,
          pickOdds: odds.firstHalfWinnerOdds.draw,
        },
        {
          pick: 'AWAY',
          probability: probabilities.firstHalfWinner.away,
          pickOdds: odds.firstHalfWinnerOdds.away,
        },
      ];
      for (const candidate of fhwCandidates) {
        const ev = calcEV(candidate.probability, candidate.pickOdds);
        candidates.push({
          market: Market.FIRST_HALF_WINNER,
          pick: candidate.pick,
          probability: candidate.probability,
          odds: candidate.pickOdds,
          ev,
          qualityScore: buildQualityScore(
            ev,
            deterministicScore,
            Market.FIRST_HALF_WINNER,
            candidate.pick,
            candidate.pickOdds,
          ),
          isCombo: false,
        });
      }
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
    over15: probabilities.over15.toNumber(),
    under15: probabilities.under15.toNumber(),
    over25: probabilities.over25.toNumber(),
    under25: probabilities.under25.toNumber(),
    over35: probabilities.over35.toNumber(),
    under35: probabilities.under35.toNumber(),
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
    ouHT: Object.fromEntries(
      Object.entries(probabilities.ouHT).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    firstHalfWinner: {
      home: probabilities.firstHalfWinner.home.toNumber(),
      draw: probabilities.firstHalfWinner.draw.toNumber(),
      away: probabilities.firstHalfWinner.away.toNumber(),
    },
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

  const [homeAdvFactor, awayDisadvFactor] =
    getLeagueHomeAwayFactors(competitionCode);
  return {
    home: clamp(rawHome * homeAdvFactor, 0.05, 5),
    away: clamp(rawAway * awayDisadvFactor, 0.05, 5),
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

type BlendTeamStatsInput = {
  primary: TeamStatsInput;
  secondary: TeamStatsInput;
  formWeight: number;
  xgWeight: number;
};

/**
 * Blend European stats (primary) with domestic/cross-competition stats (secondary).
 * European recentForm weighted at `formWeight`; domestic xg at `1 - xgWeight`.
 * Win/draw rates taken from domestic (larger sample); leagueVolatility from European.
 */
export function blendTeamStats({
  primary,
  secondary,
  formWeight,
  xgWeight,
}: BlendTeamStatsInput): TeamStatsInput {
  const fw1 = 1 - formWeight;
  const xw1 = 1 - xgWeight;
  return {
    recentForm:
      asNumber(primary.recentForm) * formWeight +
      asNumber(secondary.recentForm) * fw1,
    xgFor: asNumber(primary.xgFor) * xgWeight + asNumber(secondary.xgFor) * xw1,
    xgAgainst:
      asNumber(primary.xgAgainst) * xgWeight +
      asNumber(secondary.xgAgainst) * xw1,
    homeWinRate: secondary.homeWinRate,
    awayWinRate: secondary.awayWinRate,
    drawRate: secondary.drawRate,
    leagueVolatility: primary.leagueVolatility,
  };
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
    over15: zero,
    under15: zero,
    over25: zero,
    under25: zero,
    over35: zero,
    under35: zero,
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
    ouHT: { OVER_0_5: zero, UNDER_0_5: zero, OVER_1_5: zero, UNDER_1_5: zero },
    firstHalfWinner: { home: zero, draw: zero, away: zero },
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
    over15: zero,
    under15: zero,
    over25: zero,
    under25: zero,
    over35: zero,
    under35: zero,
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
    ouHT: { OVER_0_5: zero, UNDER_0_5: zero, OVER_1_5: zero, UNDER_1_5: zero },
    firstHalfWinner: { home: zero, draw: zero, away: zero },
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
    return odds.overUnderOdds[pick as keyof typeof odds.overUnderOdds] ?? null;
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
  if (market === Market.OVER_UNDER_HT) {
    return odds.ouHtOdds[pick as keyof typeof odds.ouHtOdds] ?? null;
  }
  if (
    market === Market.FIRST_HALF_WINNER &&
    odds.firstHalfWinnerOdds !== null
  ) {
    if (pick === 'HOME') return odds.firstHalfWinnerOdds.home;
    if (pick === 'DRAW') return odds.firstHalfWinnerOdds.draw;
    if (pick === 'AWAY') return odds.firstHalfWinnerOdds.away;
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
    if (pick === 'OVER_1_5') return probabilities.over15;
    if (pick === 'UNDER_1_5') return probabilities.under15;
    if (pick === 'OVER') return probabilities.over25;
    if (pick === 'UNDER') return probabilities.under25;
    if (pick === 'OVER_3_5') return probabilities.over35;
    if (pick === 'UNDER_3_5') return probabilities.under35;
  }
  if (market === Market.BTTS) {
    if (pick === 'YES') return probabilities.bttsYes;
    if (pick === 'NO') return probabilities.bttsNo;
  }
  if (market === Market.HALF_TIME_FULL_TIME && isHalfTimeFullTimePick(pick)) {
    return probabilities.htft[pick];
  }
  if (market === Market.OVER_UNDER_HT) {
    return probabilities.ouHT[pick as keyof typeof probabilities.ouHT] ?? null;
  }
  if (market === Market.FIRST_HALF_WINNER) {
    if (pick === 'HOME') return probabilities.firstHalfWinner.home;
    if (pick === 'DRAW') return probabilities.firstHalfWinner.draw;
    if (pick === 'AWAY') return probabilities.firstHalfWinner.away;
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
  const minDirectionProbability = getPickDirectionProbabilityThreshold(
    competitionCode,
    pick.market,
    pick.pick,
  );

  if (pick.ev.greaterThan(EV_HARD_CAP)) {
    return 'ev_above_hard_cap';
  }

  if (pick.market === Market.ONE_X_TWO) {
    if (
      pick.pick === 'HOME' &&
      probabilities.home.lessThan(minDirectionProbability)
    ) {
      return 'probability_too_low';
    }
    if (
      pick.pick === 'AWAY' &&
      probabilities.away.lessThan(minDirectionProbability)
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

  if (
    pick.ev.lessThan(
      getPickEvFloor(competitionCode, pick.market, pick.pick, minEv),
    )
  ) {
    return 'ev_below_threshold';
  }

  const evSoftCap = getPickEvSoftCap(competitionCode, pick.market, pick.pick);
  if (pick.ev.greaterThan(evSoftCap)) {
    return 'ev_above_soft_cap';
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

  // Per-pick odds ceiling — when defined, it REPLACES the global MAX_SELECTION_ODDS
  // cap. This allows both tighter windows (e.g. SP2 HOME < 1.95) and wider ones
  // (e.g. PL DRAW up to 5.50) without touching the global default.
  const maxSelectionOdds = getPickMaxSelectionOdds(
    competitionCode,
    pick.market,
    pick.pick,
  );
  if (maxSelectionOdds !== null) {
    if (pick.odds.greaterThan(maxSelectionOdds)) {
      return 'odds_above_cap';
    }
  } else if (!pick.isCombo && pick.odds.greaterThan(MAX_SELECTION_ODDS)) {
    // For combos, individual leg odds are already filtered upstream — only apply
    // the cap to single picks where the pick odds IS the leg odds.
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
