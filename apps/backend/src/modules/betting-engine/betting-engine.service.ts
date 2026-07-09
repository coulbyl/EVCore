import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdjustmentStatus,
  BetStatus,
  FixtureStatus,
  Market,
  ModelRunPhase,
  Prisma,
} from '@evcore/db';
import Decimal from 'decimal.js';
import {
  asNumber,
  buildBetPickKey,
  buildPoissonDistributions,
  computePoissonMarkets,
  calculateDeterministicScore,
  calculateEV as calcEV,
  calculateKellyStakePct,
  type DeterministicFeatures,
  type FeatureWeights,
} from './betting-engine.utils';
import { PrismaService } from '@/prisma.service';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { createLogger } from '@utils/logger';
import {
  assessMarketCoherence,
  type CalibrationAlert,
} from './market-coherence';
import {
  ShadowPredictionsService,
  hasDirectionalConflict,
  type ShadowPrediction,
} from './shadow-predictions.service';
import {
  CALIBRATION_GATE,
  DEFAULT_STAKE_PCT,
  EV_MAX_SOFT_ALERT,
  FEATURE_WEIGHTS,
  getModelScoreThreshold,
  KELLY_FRACTION,
  KELLY_MAX_STAKE_PCT,
  isEuropeanCompetition,
  EUROPEAN_CROSS_COMP_FORM_WEIGHT,
  EUROPEAN_CROSS_COMP_XG_WEIGHT,
  isNationalTeamCompetition,
  NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT,
  NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT,
} from './ev.constants';
import { FEATURE_FLAGS } from '@config/feature-flags.constants';
import { LINE_MOVEMENT_THRESHOLD } from './ev.constants';
import { BankrollService } from '@modules/bankroll/bankroll.service';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchComputation,
  MatchProbabilities,
  PredictionSource,
  TeamStatsInput,
  ViablePick,
} from './betting-engine.types';
import { FriModelService } from './fri-model/fri-model.service';
import { MlInferenceService } from '@modules/ml/ml.inference.service';
import {
  ML_SHADOW_CHANNELS,
  type ShadowMlByChannel,
} from '@modules/ml/ml.constants';
import { ChannelDecisionService } from './channel-decision.service';
import { OddsSnapshotLoader } from './pricing/odds-snapshot.loader';
import { BetSettlementService } from './settlement/bet-settlement.service';
import {
  blendTeamStats,
  buildLambdaConfig,
  buildMatchupFeatures,
  deriveLambdas,
  mapProbabilitiesToNumber,
  rebalanceThreeWayProbabilities,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
} from './math/probability';
import { getLeagueThreeWayEmpiricalBlendWeight } from './ev.constants';
import { getPickOdds } from './pricing/odds-mapping';
import {
  summarizeEvaluatedPicks,
  summarizePick,
  summarizePicks,
} from './selection/pick-validation';
import { buildMlShadowFeatures } from './ml-shadow-features';
import {
  listEvaluatedOneXTwoPicks,
  listEvaluatedPicks,
  selectBestViablePick,
  selectSafeValuePick,
} from './selection/pick-evaluation';
import { buildSelectionConfig } from './selection/selection-config';
import type { PersistedChannelDecision } from './channel-decision.repository';
import { buildStrategyContext } from './strategies/strategy-context.builder';
import {
  STRATEGY_CHANNEL,
  type ContextSignals,
  type StrategyChannel,
} from './channel-strategy.types';
import { formatDateUtc } from '@utils/date.utils';

const logger = createLogger('betting-engine-service');
const MIN_LAMBDA = 0.05;

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
  private readonly friModelService: FriModelService;
  private readonly oddsLoader: OddsSnapshotLoader;
  private readonly betSettlement: BetSettlementService;

  // eslint-disable-next-line max-params -- Explicit service injection keeps scoring dependencies transparent.
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly h2hService: H2HService,
    private readonly congestionService: CongestionService,
    private readonly mlInference: MlInferenceService,
    private readonly bankroll?: BankrollService,
    friModelService?: FriModelService,
    // Injected by Nest in production (BettingEngineModule provides it); omitted
    // in unit/e2e test modules that don't, where channel persistence is a no-op.
    @Optional()
    private readonly channelDecisionService?: ChannelDecisionService,
    // Injected in production; unit tests omit it and fall back to a loader built
    // on the same (mocked) Prisma client. Kept last to preserve positional args.
    @Optional()
    oddsLoader?: OddsSnapshotLoader,
    @Optional()
    betSettlement?: BetSettlementService,
    // Shadow-only /predictions cross-check; unit tests omit it → shadow null.
    @Optional()
    private readonly shadowPredictionsService?: ShadowPredictionsService,
  ) {
    this.kellyEnabled = config.get<string>('KELLY_ENABLED', 'false') === 'true';
    this.friModelService = friModelService ?? new FriModelService(this.prisma);
    this.oddsLoader = oddsLoader ?? new OddsSnapshotLoader(this.prisma);
    this.betSettlement =
      betSettlement ??
      new BetSettlementService(
        this.prisma,
        this.channelDecisionService,
        this.bankroll,
      );
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
    const lambda = deriveLambdas(
      homeStats,
      awayStats,
      buildLambdaConfig(competitionCode),
    );
    // 1X2: empirical blend toward team win/draw rates. O/U: shrinkage toward
    // the league base rate for data-poor leagues where the measured
    // calibration slope is near zero (see probability/ou-shrinkage.ts).
    const rawProbabilities = this.computeProbabilities(
      lambda.home,
      lambda.away,
    );
    const probabilities = shrinkOverUnderProbabilities(
      rebalanceThreeWayProbabilities({
        probabilities: rawProbabilities,
        homeStats,
        awayStats,
        blendWeight: getLeagueThreeWayEmpiricalBlendWeight(competitionCode),
      }),
      getOverUnderShrinkageConfig(competitionCode),
    );

    return {
      deterministicScore,
      probabilities,
      rawProbabilities,
      lambda,
      features,
    };
  }

  selectBestViablePickForBacktest(input: {
    probabilities: MatchProbabilities;
    odds: FullOddsSnapshot;
    deterministicScore: Decimal;
    distHome: number[];
    distAway: number[];
    lambdaFloorHit: boolean;
    competitionCode?: string | null;
    minEv?: Decimal;
  }): ViablePick | null {
    return selectBestViablePick(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      input.distHome,
      input.distAway,
      input.lambdaFloorHit,
      new Set<Market>(),
      buildSelectionConfig(input.competitionCode ?? null),
      input.minEv,
    );
  }

  selectBestOneXTwoPickForBacktest(input: {
    probabilities: MatchProbabilities;
    odds: FullOddsSnapshot;
    deterministicScore: Decimal;
    competitionCode?: string | null;
  }): ViablePick | null {
    const evaluated = listEvaluatedOneXTwoPicks(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      new Set<Market>(),
      buildSelectionConfig(input.competitionCode ?? null),
    );

    return (
      evaluated.find(
        (pick): pick is ViablePick => pick.rejectionReason === undefined,
      ) ?? null
    );
  }

  listEvaluatedOneXTwoPicksForBacktest(input: {
    probabilities: MatchProbabilities;
    odds: FullOddsSnapshot;
    deterministicScore: Decimal;
    competitionCode?: string | null;
  }): EvaluatedPick[] {
    return listEvaluatedOneXTwoPicks(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      new Set<Market>(),
      buildSelectionConfig(input.competitionCode ?? null),
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
    minEv?: Decimal;
  }): EvaluatedPick[] {
    return listEvaluatedPicks(
      input.probabilities,
      input.odds,
      input.deterministicScore,
      input.distHome,
      input.distAway,
      input.lambdaFloorHit,
      new Set<Market>(),
      buildSelectionConfig(input.competitionCode ?? null),
      input.minEv,
    );
  }

  selectSafeValuePickForBacktest(input: {
    evaluatedPicks: EvaluatedPick[];
    evPickKey: string | null;
    lambdaTotal?: number;
    competitionCode?: string | null;
  }): ViablePick | null {
    return selectSafeValuePick(
      input.evaluatedPicks,
      new Set<Market>(),
      input.evPickKey,
      input.lambdaTotal ?? 0,
      buildSelectionConfig(input.competitionCode ?? null),
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

  // Settle bets whose outcome is irrevocably known from in-progress scores
  // (BTTS YES/NO, OVER/UNDER thresholds, HT markets). 1X2 and HTFT wait for FINISHED.
  settleEarlyBets(fixtureId: string): Promise<{ settled: number }> {
    return this.betSettlement.settleEarlyBets(fixtureId);
  }

  settleOpenBets(fixtureId: string): Promise<{ settled: number }> {
    return this.betSettlement.settleOpenBets(fixtureId);
  }

  async analyzeFixture(fixtureId: string): Promise<AnalyzeFixtureResult> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        id: true,
        externalId: true,
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

    const scheduledAt = fixture.scheduledAt.toISOString();

    if (
      fixture.status === FixtureStatus.POSTPONED ||
      fixture.status === FixtureStatus.CANCELLED ||
      fixture.status === FixtureStatus.IN_PROGRESS
    ) {
      logger.info(
        {
          fixtureId,
          scheduledAt,
          status: fixture.status,
          reason: 'fixture_not_playable',
        },
        'Fixture skipped',
      );
      return { status: 'skipped', fixtureId, reason: 'fixture_not_playable' };
    }

    if (getFixtureCompetitionCode(fixture) === 'FRI') {
      return this.analyzeFriFixture(fixture);
    }

    const competitionCode = getFixtureCompetitionCode(fixture);
    const modelRunPhase = deriveModelRunPhase({
      fixtureStatus: fixture.status,
      scheduledAt: fixture.scheduledAt,
    });

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

    // For national team competitions (WC, WCQE, UNL, …) supplement or replace
    // in-tournament stats with qualifying / Nations League form. At tournament
    // start there are no in-tournament stats at all, so the fallback is mandatory.
    if (isNationalTeamCompetition(competitionCode)) {
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
              formWeight: NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT,
              xgWeight: NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT,
            })
          : homeCross;
      }
      if (awayCross) {
        effectiveAwayStats = awayStats
          ? blendTeamStats({
              primary: awayStats,
              secondary: awayCross,
              formWeight: NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT,
              xgWeight: NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT,
            })
          : awayCross;
      }
    }

    if (!effectiveHomeStats || !effectiveAwayStats) {
      logger.info(
        {
          fixtureId,
          scheduledAt,
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
    const {
      features,
      deterministicScore,
      lambda,
      probabilities,
      rawProbabilities,
    } = this.computeFromTeamStats(
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
          scheduledAt,
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
      ? 'BET'
      : 'NO_BET';

    const { distHome, distAway } = buildPoissonDistributions(
      lambda.home,
      lambda.away,
    );
    const lambdaTotal =
      distHome.reduce((sum, p, k) => sum + k * p, 0) +
      distAway.reduce((sum, p, k) => sum + k * p, 0);

    const [latestOdds, activeSuspensions] = await Promise.all([
      this.oddsLoader.findLatestOddsSnapshot(fixtureId, fixture.scheduledAt),
      this.prisma.client.marketSuspension.findMany({
        where: { active: true },
        select: { market: true },
      }),
    ]);

    const suspendedMarkets = new Set(activeSuspensions.map((s) => s.market));

    const selectionConfig = buildSelectionConfig(competitionCode);
    const evaluatedPicks: EvaluatedPick[] = latestOdds
      ? listEvaluatedPicks(
          probabilities,
          latestOdds,
          deterministicScore,
          distHome,
          distAway,
          lambdaFloorHit,
          suspendedMarkets,
          selectionConfig,
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
      const earliestOdds = await this.oddsLoader.findLatestOddsSnapshot(
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

    // Model↔market coherence gate: compare the model's 1X2 probabilities to
    // the median implied probability across priority bookmakers. A triggered
    // alert is stored in features.calibration_alert (surfaced on the analysis
    // sheet, enforced at staking) — the analytical decisions are kept intact.
    let calibrationAlert: CalibrationAlert | null = null;
    if (CALIBRATION_GATE.ENABLED) {
      const oneXTwoBooks =
        await this.oddsLoader.findLatestOneXTwoOddsPerBookmaker(fixtureId);
      calibrationAlert = assessMarketCoherence({
        modelProbabilities: {
          home: probabilities.home,
          draw: probabilities.draw,
          away: probabilities.away,
        },
        books: oneXTwoBooks,
      });
      if (calibrationAlert !== null) {
        logger.warn(
          {
            fixtureId,
            scheduledAt,
            competitionCode: getFixtureCompetitionCode(fixture),
            homeTeam: getFixtureHomeTeamName(fixture),
            awayTeam: getFixtureAwayTeamName(fixture),
            calibrationAlert,
          },
          'Calibration alert: model↔market coherence gate triggered — fixture will be excluded from the staking pool',
        );
      }
    }

    // Shadow /predictions cross-check — independent second model (API-Football).
    // Stored + logged only; a directional conflict with our λ is the strongest
    // corrupted-input tell but never changes a decision by itself.
    let shadowPredictions: (ShadowPrediction & { conflict: boolean }) | null =
      null;
    if (
      FEATURE_FLAGS.SCORING.SHADOW_PREDICTIONS &&
      this.shadowPredictionsService &&
      fixture.externalId !== null
    ) {
      const prediction =
        await this.shadowPredictionsService.fetchShadowPrediction(
          fixture.externalId,
        );
      if (prediction !== null) {
        const conflict = hasDirectionalConflict(prediction, lambda);
        shadowPredictions = { ...prediction, conflict };
        if (conflict) {
          logger.warn(
            {
              fixtureId,
              competitionCode: getFixtureCompetitionCode(fixture),
              homeTeam: getFixtureHomeTeamName(fixture),
              awayTeam: getFixtureAwayTeamName(fixture),
              lambdaHome: lambda.home,
              lambdaAway: lambda.away,
              shadowPredictions,
            },
            'Shadow predictions conflict: API-Football Poisson favors the opposite side — check input data',
          );
        }
      }
    }

    if (valueBet !== null && valueBet.ev.greaterThan(EV_MAX_SOFT_ALERT)) {
      logger.warn(
        {
          fixtureId,
          scheduledAt,
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

    const hasEvBet = deterministicDecision === 'BET' && valueBet !== null;

    logger.info(
      {
        fixtureId,
        scheduledAt,
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
        hasEvBet,
      },
      'Fixture analysis complete',
    );

    // Mutable reference: filled in with per-channel shadow ML results once
    // the channel decisions exist (they need modelRun.id), then written back
    // via a single modelRun.update. Never read by decision logic.
    const modelRunFeatures: Record<string, unknown> = {
      predictionSource,
      recentForm: features.recentForm.toNumber(),
      xg: features.xg.toNumber(),
      performanceDomExt: features.domExtPerf.toNumber(),
      volatiliteLigue: features.leagueVolat.toNumber(),
      lambdaHome: lambda.home,
      lambdaAway: lambda.away,
      probabilities: mapProbabilitiesToNumber(probabilities),
      // Unadjusted Poisson output, before the 1X2 blend + O/U shrinkage —
      // lets the analysis sheet expose an adjustmentDelta per market so the
      // adjustment layer is auditable pick by pick (rapport-dev 2026-07-09).
      rawPoissonProbability: mapProbabilitiesToNumber(rawProbabilities),
      lambdaFloorHit,
      shadow_lineMovement: shadowLineMovement,
      calibration_alert: calibrationAlert,
      shadow_predictions: shadowPredictions,
      shadow_h2h: shadowH2h,
      shadow_congestion: shadowCongestion,
      shadow_lineups: null,
      shadow_injuries: null,
      shadow_ml_corrected_p: null,
      shadow_ml_edge_delta: null,
      shadow_ml_by_channel: null,
      homeDrawRate: effectiveHomeStats
        ? Number(effectiveHomeStats.drawRate)
        : null,
      awayDrawRate: effectiveAwayStats
        ? Number(effectiveAwayStats.drawRate)
        : null,
      candidatePicks: summarizePicks(candidatePicks.slice(0, 5)),
      evaluatedPicks: summarizeEvaluatedPicks(evaluatedPicks),
    };

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        phase: modelRunPhase,
        deterministicScore: toPrismaDecimal(deterministicScore, 4),
        llmDelta: null,
        finalScore: toPrismaDecimal(deterministicScore, 4),
        features: modelRunFeatures as Prisma.InputJsonValue,
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    // Per-channel decisions (doc §5). Runs every strategy over the same
    // computed context before materialising financial Bets where needed.
    const channelSignals: ContextSignals = {
      suspendedMarkets,
      lambdaFloorHit,
      lambdaTotal,
      lineMovement: shadowLineMovement,
      h2h: shadowH2h,
      congestion: shadowCongestion,
    };
    const persistedChannelDecisions =
      (await this.channelDecisionService?.recordRunDecisions(
        modelRun.id,
        buildStrategyContext({
          fixture: {
            id: fixture.id,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            scheduledAt: fixture.scheduledAt,
          },
          competitionCode,
          deterministicScore,
          probabilities,
          lambdaHome: lambda.home,
          lambdaAway: lambda.away,
          evaluatedPicks,
          odds: latestOdds,
          signals: channelSignals,
          phase: modelRunPhase,
        }),
      )) ?? [];

    // EV soft alert across ALL stakeable channels (the VALUE-only alert above
    // predates the channel refactor and missed e.g. the Argentina SAFE pick at
    // EV +0.46). CORRECT_SCORE is observation-only → excluded.
    for (const decision of persistedChannelDecisions) {
      if (decision.channel === STRATEGY_CHANNEL.CORRECT_SCORE) continue;
      for (const sel of decision.selections) {
        if (sel.ev != null && sel.ev.greaterThan(EV_MAX_SOFT_ALERT)) {
          logger.warn(
            {
              fixtureId,
              channel: decision.channel,
              market: sel.market,
              pick: sel.pick,
              ev: sel.ev.toNumber(),
              evSoftAlertThreshold: EV_MAX_SOFT_ALERT.toNumber(),
            },
            'EV soft alert: high channel-selection EV may indicate calibration anomaly',
          );
        }
      }
    }

    // Shadow ML correction — per channel, logged only; never changes a decision.
    if (FEATURE_FLAGS.SCORING.ML_CORRECTION) {
      const shadowMlByChannel = await this.computeShadowMlByChannel({
        decisions: persistedChannelDecisions,
        deterministicScore,
        probabilities,
        features,
        competitionCode,
      });
      if (shadowMlByChannel !== null) {
        modelRunFeatures.shadow_ml_by_channel = shadowMlByChannel;
        const valueResult = shadowMlByChannel[STRATEGY_CHANNEL.VALUE] ?? null;
        modelRunFeatures.shadow_ml_corrected_p =
          valueResult?.correctedP ?? null;
        modelRunFeatures.shadow_ml_edge_delta = valueResult?.edgeDelta ?? null;
        await this.prisma.client.modelRun.update({
          where: { id: modelRun.id },
          data: { features: modelRunFeatures as Prisma.InputJsonValue },
        });
      }
    }

    let betCandidate: BetCandidate | null = null;
    let evPickKey: string | null = null;

    if (hasEvBet && valueBet !== null) {
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

      const channelSelectionId = findChannelSelectionId(
        persistedChannelDecisions,
        STRATEGY_CHANNEL.VALUE,
        {
          market: valueBet.market,
          pick: valueBet.pick,
          comboMarket: valueBet.comboMarket ?? null,
          comboPick: valueBet.comboPick ?? null,
        },
      );

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
            channelSelectionId,
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
            channelSelectionId,
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
    if (deterministicDecision === 'BET' && latestOdds !== null) {
      const svPick = selectSafeValuePick(
        evaluatedPicks,
        suspendedMarkets,
        evPickKey,
        lambdaTotal,
        selectionConfig,
      );

      if (svPick !== null) {
        const svPickKey = `sv:${buildBetPickKey({
          market: svPick.market,
          pick: svPick.pick,
          comboMarket: null,
          comboPick: null,
        })}`;

        const channelSelectionId = findChannelSelectionId(
          persistedChannelDecisions,
          STRATEGY_CHANNEL.SAFE,
          {
            market: svPick.market,
            pick: svPick.pick,
            comboMarket: null,
            comboPick: null,
          },
        );

        const existingSvBet = await this.prisma.client.bet.findFirst({
          where: { fixtureId, pickKey: svPickKey, userId: null },
          select: { id: true },
        });
        if (existingSvBet) {
          await this.prisma.client.bet.update({
            where: { id: existingSvBet.id },
            data: {
              modelRunId: modelRun.id,
              channelSelectionId,
              probEstimated: toPrismaDecimal(svPick.probability, 4),
              oddsSnapshot: toPrismaDecimal(svPick.odds, 3),
              ev: toPrismaDecimal(svPick.ev, 4),
              qualityScore: toPrismaDecimal(svPick.qualityScore, 4),
              stakePct: toPrismaDecimal(DEFAULT_STAKE_PCT, 4),
              status: BetStatus.PENDING,
            },
          });
        } else {
          await this.prisma.client.bet.create({
            data: {
              modelRunId: modelRun.id,
              fixtureId,
              channelSelectionId,
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
            },
          });
        }

        logger.info(
          {
            fixtureId,
            scheduledAt,
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
      deterministicScore: deterministicScore.toNumber(),
      probabilities: mapProbabilitiesToNumber(probabilities),
      valueBet: betCandidate,
    };
  }

  private async analyzeFriFixture(fixture: {
    id: string;
    scheduledAt: Date;
    homeTeamId: string;
    awayTeamId: string;
    status: FixtureStatus;
    season?: { competition?: { code?: string } };
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
  }): Promise<AnalyzeFixtureResult> {
    const fixtureId = fixture.id;
    const competitionCode = getFixtureCompetitionCode(fixture);
    const modelRunPhase = deriveModelRunPhase({
      fixtureStatus: fixture.status,
      scheduledAt: fixture.scheduledAt,
    });
    const [marketOdds, pinnacleOdds, activeSuspensions] = await Promise.all([
      this.oddsLoader.findLatestBestOneXTwoOddsSnapshot(
        fixtureId,
        fixture.scheduledAt,
      ),
      this.oddsLoader.findLatestOneXTwoOddsSnapshotByBookmaker(
        fixtureId,
        fixture.scheduledAt,
        'Pinnacle',
      ),
      this.prisma.client.marketSuspension.findMany({
        where: { active: true },
        select: { market: true },
      }),
    ]);

    const suspendedMarkets = new Set(activeSuspensions.map((s) => s.market));
    const homeTeamName = getFixtureHomeTeamName(fixture);
    const awayTeamName = getFixtureAwayTeamName(fixture);
    const friComputation = await this.friModelService.analyzeLiveFixture({
      fixtureId,
      scheduledAt: fixture.scheduledAt,
      competitionCode,
      homeTeamName,
      awayTeamName,
      hasMarketOdds: marketOdds !== null,
      pinnacleOdds,
    });
    const {
      predictionSource,
      probabilities,
      deterministicScore,
      lambda,
      distHome,
      distAway,
      metadata: {
        isSenior,
        eloHome,
        eloAway,
        fallbackReason,
        snapshotAt: eloSnapshotAt,
      },
    } = friComputation;
    const friSelectionConfig = buildSelectionConfig(competitionCode);
    const evaluatedPicks =
      marketOdds !== null && probabilities !== null
        ? lambda !== null
          ? listEvaluatedPicks(
              probabilities,
              marketOdds.snapshot,
              deterministicScore,
              distHome,
              distAway,
              lambda.home <= MIN_LAMBDA + Number.EPSILON ||
                lambda.away <= MIN_LAMBDA + Number.EPSILON,
              suspendedMarkets,
              friSelectionConfig,
            )
          : listEvaluatedOneXTwoPicks(
              probabilities,
              marketOdds.snapshot,
              deterministicScore,
              suspendedMarkets,
              friSelectionConfig,
            )
        : [];
    const candidatePicks = evaluatedPicks.filter(
      (pick): pick is ViablePick => pick.rejectionReason === undefined,
    );
    const valueBet = candidatePicks[0] ?? null;
    const hasEvBet =
      marketOdds !== null &&
      deterministicScore.greaterThanOrEqualTo(
        getModelScoreThreshold(competitionCode),
      ) &&
      valueBet !== null;

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
          eloSnapshotAt: eloSnapshotAt?.toISOString() ?? null,
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
        hasEvBet,
      },
      'FRI fixture analysis complete',
    );

    const modelRun = await this.prisma.client.modelRun.create({
      data: {
        fixtureId,
        phase: modelRunPhase,
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
          eloSnapshotAt: eloSnapshotAt?.toISOString() ?? null,
          lambdaHome: lambda?.home ?? null,
          lambdaAway: lambda?.away ?? null,
          probabilities:
            probabilities !== null
              ? mapProbabilitiesToNumber(probabilities)
              : null,
          lambdaFloorHit:
            lambda !== null
              ? lambda.home <= MIN_LAMBDA + Number.EPSILON ||
                lambda.away <= MIN_LAMBDA + Number.EPSILON
              : false,
          shadow_lineMovement: null,
          shadow_h2h: null,
          shadow_congestion: null,
          shadow_lineups: null,
          shadow_injuries: null,
          candidatePicks: summarizePicks(candidatePicks.slice(0, 5)),
          evaluatedPicks: summarizeEvaluatedPicks(evaluatedPicks),
        },
        openclawRaw: Prisma.JsonNull,
        validatedByBackend: true,
      },
      select: { id: true },
    });

    // Per-channel decisions (doc §5). Skipped when no probabilities were
    // derived (no Elo and no odds) — the strategy context requires them.
    let persistedChannelDecisions: PersistedChannelDecision[] = [];
    if (probabilities !== null) {
      const friLambdaTotal =
        distHome.reduce((sum, p, k) => sum + k * p, 0) +
        distAway.reduce((sum, p, k) => sum + k * p, 0);
      const channelSignals: ContextSignals = {
        suspendedMarkets,
        lambdaFloorHit:
          lambda !== null
            ? lambda.home <= MIN_LAMBDA + Number.EPSILON ||
              lambda.away <= MIN_LAMBDA + Number.EPSILON
            : false,
        lambdaTotal: friLambdaTotal,
        lineMovement: null,
        h2h: null,
        congestion: null,
      };
      persistedChannelDecisions =
        (await this.channelDecisionService?.recordRunDecisions(
          modelRun.id,
          buildStrategyContext({
            fixture: {
              id: fixture.id,
              homeTeamId: fixture.homeTeamId,
              awayTeamId: fixture.awayTeamId,
              scheduledAt: fixture.scheduledAt,
            },
            competitionCode,
            deterministicScore,
            probabilities,
            lambdaHome: lambda?.home,
            lambdaAway: lambda?.away,
            evaluatedPicks,
            odds: marketOdds?.snapshot ?? null,
            signals: channelSignals,
            phase: modelRunPhase,
          }),
        )) ?? [];
    }

    let betCandidate: BetCandidate | null = null;
    if (hasEvBet && valueBet !== null) {
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

      const channelSelectionId = findChannelSelectionId(
        persistedChannelDecisions,
        STRATEGY_CHANNEL.VALUE,
        {
          market: valueBet.market,
          pick: valueBet.pick,
          comboMarket: valueBet.comboMarket ?? null,
          comboPick: valueBet.comboPick ?? null,
        },
      );

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
            channelSelectionId,
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
            channelSelectionId,
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
      deterministicScore: deterministicScore.toNumber(),
      probabilities:
        probabilities !== null ? mapProbabilitiesToNumber(probabilities) : {},
      valueBet: betCandidate,
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
  // Public read accessor for the consolidated odds view of a fixture as of a
  // cutoff (e.g. dev backfill scripts reuse the engine's exact bookmaker/market
  // resolution instead of duplicating it). Delegates to OddsSnapshotLoader.
  loadFullOddsSnapshot(
    fixtureId: string,
    cutoff: Date,
  ): Promise<FullOddsSnapshot | null> {
    return this.oddsLoader.findLatestOddsSnapshot(fixtureId, cutoff);
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

  // Shadow ML correction, per channel. Calls /infer for each channel's
  // rank-1 SELECTED selection (when it carries odds+ev) and logs the
  // corrected probability — never fed back into any decision. Channels not
  // in ML_SHADOW_CHANNELS (e.g. CORRECT_SCORE) are trained but not called
  // here yet: see docs/ml-worker-sync.md for the volume rationale.
  private async computeShadowMlByChannel(opts: {
    decisions: readonly PersistedChannelDecision[];
    deterministicScore: Decimal;
    probabilities: MatchProbabilities;
    features: DeterministicFeatures;
    competitionCode: string | null;
  }): Promise<ShadowMlByChannel | null> {
    const {
      decisions,
      deterministicScore,
      probabilities,
      features,
      competitionCode,
    } = opts;

    const results: ShadowMlByChannel = {};
    for (const channel of ML_SHADOW_CHANNELS) {
      const decision = decisions.find(
        (d) => d.channel === channel && d.status === 'SELECTED',
      );
      const selection = decision?.selections.find((s) => s.rank === 1);
      if (
        selection === undefined ||
        selection.odds === undefined ||
        selection.ev === undefined
      ) {
        continue;
      }

      const mlFeatures = buildMlShadowFeatures({
        pick: {
          market: selection.market,
          probability: selection.probability,
          ev: selection.ev,
          odds: selection.odds,
        },
        channel,
        deterministicScore,
        probabilities,
        features,
        competitionCode,
      });
      const mlResult = await this.mlInference.predictShadowCorrection(
        `${channel}:${selection.market}`,
        mlFeatures,
      );
      if (mlResult !== null && mlResult.corrected_probability !== null) {
        results[channel] = {
          correctedP: mlResult.corrected_probability,
          edgeDelta:
            mlResult.corrected_probability - selection.probability.toNumber(),
        };
      }
    }

    return Object.keys(results).length > 0 ? results : null;
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

// Resolves the persisted ChannelSelection id whose pick matches a materialised
// Bet, so Bet.channelSelectionId can point at the exact analytical selection.
// Returns null when the channel did not select, or the live engine pick diverges
// from the strategy pick (a known live/backtest edge case — see TODO Étape 5).
// Exported for unit testing.
export function findChannelSelectionId(
  decisions: readonly PersistedChannelDecision[],
  channel: StrategyChannel,
  pick: {
    market: Market;
    pick: string;
    comboMarket: Market | null;
    comboPick: string | null;
  },
): string | null {
  const decision = decisions.find((d) => d.channel === channel);
  if (!decision) return null;
  const key = buildBetPickKey(pick);
  const match = decision.selections.find(
    (sel) =>
      buildBetPickKey({
        market: sel.market,
        pick: sel.pick,
        comboMarket: sel.comboMarket ?? null,
        comboPick: sel.comboPick ?? null,
      }) === key,
  );
  return match?.id ?? null;
}

export function deriveModelRunPhase(opts: {
  fixtureStatus: FixtureStatus;
  scheduledAt: Date;
  now?: Date;
}): ModelRunPhase {
  if (opts.fixtureStatus === FixtureStatus.IN_PROGRESS) {
    return ModelRunPhase.LIVE;
  }

  const now = opts.now ?? new Date();
  return formatDateUtc(opts.scheduledAt) === formatDateUtc(now)
    ? ModelRunPhase.PRE_KICKOFF
    : ModelRunPhase.ADVANCE;
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
