import Decimal from "decimal.js";
import {
  applyCongestionSignalCorrection,
  applyH2HMarketSignalCorrection,
  computePoissonMarkets,
  deriveLambdas,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  getLeagueThreeWayEmpiricalBlendWeight,
  getOverUnderShrinkageConfig,
  Market,
  MODEL_RUN_PHASE,
  rebalanceThreeWayProbabilities,
  shrinkOverUnderProbabilities,
  SPORT_TYPE,
  type FullOddsSnapshot,
  type StrategyContext,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import type { PointInTimeLoader, ReplayFixture } from "../src";

/**
 * La chaîne de production du moteur, rejouée à un instant donné : team_stats
 * point-in-time (repli cross-saison inclus), deriveLambdas → ajustement H2H
 * de λ → computePoissonMarkets → blend 1X2 → shrinkage → signaux H2H par
 * marché → congestion, puis le contexte que reçoivent les fonctions de
 * décision pures. Sortie de backtest-strategy-ranking.ts (2026-10-06) pour
 * servir aussi au rejeu de TEAM_TOTAL (2026-11-03).
 */

const H2H_GAMMA = 0.2; // apps/backend ev.constants.ts, 2026-07-23
const H2H_NEUTRAL = 0.5;
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5;
// apps/backend ev.constants.ts HTFT_CALIBRATED_LEAGUES — mirrored here, the
// pure core receives it through SelectionConfig.
const HTFT_CALIBRATED = new Set(["BL1", "CH", "L1", "LL", "PL", "SA", "EL1"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** apps/backend/src/modules/betting-engine/h2h.utils.ts, copied verbatim. */
function adjustLambdaForH2H(input: {
  lambda: { home: number; away: number };
  favoriteIsHome: boolean;
  h2hScore: number;
}): { home: number; away: number } {
  const signal = input.h2hScore - H2H_NEUTRAL;
  const favorFactor = 1 + H2H_GAMMA * signal;
  const underdogFactor = 1 - H2H_GAMMA * signal;
  const home = input.favoriteIsHome
    ? input.lambda.home * favorFactor
    : input.lambda.home * underdogFactor;
  const away = input.favoriteIsHome
    ? input.lambda.away * underdogFactor
    : input.lambda.away * favorFactor;
  return {
    home: clamp(home, LAMBDA_MIN, LAMBDA_MAX),
    away: clamp(away, LAMBDA_MIN, LAMBDA_MAX),
  };
}

function probabilitiesFromLambda(input: {
  lambda: { home: number; away: number };
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  competitionCode: string;
}) {
  return shrinkOverUnderProbabilities(
    rebalanceThreeWayProbabilities({
      probabilities: computePoissonMarkets(
        input.lambda.home,
        input.lambda.away,
      ),
      homeStats: input.homeStats,
      awayStats: input.awayStats,
      blendWeight: getLeagueThreeWayEmpiricalBlendWeight(input.competitionCode),
    }),
    getOverUnderShrinkageConfig(input.competitionCode),
  );
}

function buildContext(input: {
  fixture: ReplayFixture;
  probabilities: StrategyContext["probabilities"];
  lambda: { home: number; away: number };
  odds: FullOddsSnapshot | null;
  h2h: number | null;
  congestion: number;
}): StrategyContext {
  const { fixture, probabilities, lambda, odds, h2h, congestion } = input;
  const zero = new Decimal(0);
  return {
    fixture: {
      id: fixture.id,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      scheduledAt: fixture.scheduledAt,
    },
    competitionCode: fixture.competitionCode,
    sport: SPORT_TYPE.FOOTBALL,
    phase: MODEL_RUN_PHASE.PRE_KICKOFF,
    deterministicScore: new Decimal(0.5),
    probabilities,
    lambdaHome: lambda.home,
    lambdaAway: lambda.away,
    evaluatedMarkets: [],
    odds,
    signals: {
      suspendedMarkets: new Set<Market>(),
      lambdaFloorHit: false,
      lambdaTotal: lambda.home + lambda.away,
      lineMovement: null,
      h2h,
      congestion,
    },
    previousDecisions: new Map(),
    // Only htftCalibrated is read by the multi-line channels replayed with
    // this context; the other fields are VALUE/SAFE-specific and never
    // consulted.
    selectionConfig: {
      leagueEvThreshold: new Decimal(0.08),
      svMinProbability: zero,
      svMinOdds: zero,
      htftCalibrated: HTFT_CALIBRATED.has(fixture.competitionCode),
      pickDirectionProbabilityThreshold: () => zero,
      pickEvFloor: () => zero,
      pickEvSoftCap: () => new Decimal(1),
      pickMinSelectionOdds: () => zero,
      pickMaxSelectionOdds: () => null,
    },
    modelScoreThreshold: zero,
  };
}

/**
 * Le contexte de décision du moteur pour ce match à `asOf`, ou null si une
 * équipe n'a pas de team_stats à cet instant.
 */
export async function replayContext(input: {
  loader: PointInTimeLoader;
  fixture: ReplayFixture;
  odds: FullOddsSnapshot | null;
  asOf: Date;
}): Promise<StrategyContext | null> {
  const { loader, fixture, odds, asOf } = input;
  const [homeStats, awayStats] = await Promise.all([
    loader.loadTeamStats({
      teamId: fixture.homeTeamId,
      seasonId: fixture.seasonId,
      competitionCode: fixture.competitionCode,
      asOf,
    }),
    loader.loadTeamStats({
      teamId: fixture.awayTeamId,
      seasonId: fixture.seasonId,
      competitionCode: fixture.competitionCode,
      asOf,
    }),
  ]);
  if (!homeStats || !awayStats) return null;
  const code = fixture.competitionCode;
  const [homeAdvFactor, awayDisadvFactor] = getLeagueHomeAwayFactors(code);
  const baselineLambda = deriveLambdas(homeStats, awayStats, {
    meanLambda: getLeagueMeanLambda(code),
    homeAdvFactor,
    awayDisadvFactor,
    lambdaScale: getLeagueLambdaScale(code),
  });
  const baseline = probabilitiesFromLambda({
    lambda: baselineLambda,
    homeStats,
    awayStats,
    competitionCode: code,
  });
  const favoriteIsHome = baseline.home.gte(baseline.away);
  const [h2hScore, h2hSignals, congestion] = await Promise.all([
    loader.loadH2HScore({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      favoriteTeamId: favoriteIsHome ? fixture.homeTeamId : fixture.awayTeamId,
      asOf,
    }),
    loader.loadH2HMarketSignals({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      asOf,
    }),
    loader.loadCongestionScore({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      asOf,
    }),
  ]);
  const lambda =
    h2hScore === null
      ? baselineLambda
      : adjustLambdaForH2H({
          lambda: baselineLambda,
          favoriteIsHome,
          h2hScore,
        });
  const preSignals =
    h2hScore === null
      ? baseline
      : probabilitiesFromLambda({
          lambda,
          homeStats,
          awayStats,
          competitionCode: code,
        });
  const probabilities = applyCongestionSignalCorrection(
    applyH2HMarketSignalCorrection(preSignals, h2hSignals),
    congestion,
  );
  return buildContext({
    fixture,
    probabilities,
    lambda,
    odds,
    h2h: h2hScore,
    congestion,
  });
}
