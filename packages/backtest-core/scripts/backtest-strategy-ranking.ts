/// <reference types="node" />
/**
 * Rejeu des six canaux multi-lignes avec deux règles de classement.
 *
 * POURQUOI. GOALS, DOUBLE_CHANCE, OVER_UNDER_HT, TEAM_TOTAL, RESULT_TOTAL_GOALS
 * et RESULT_BTTS évaluent plusieurs lignes au-dessus d'un seuil de
 * probabilité et retiennent celle à l'EV maximale. L'audit du 2026-08-22 a
 * mesuré l'edge annoncé comme anti-prédictif : à cote égale, maximiser
 * p × cote − 1 retient la ligne où le modèle s'écarte le plus du prix. La
 * règle de remplacement candidate (`probability_in_band`, strategies/
 * ranking.ts) ne garde que les lignes pricées dans la bande 1,20–1,80 et
 * prend la plus probable. Classer par probabilité sans bande choisirait
 * toujours UNDER 4.5 à 1,05.
 *
 * CE QUI EST REJOUÉ. Pour chaque match terminé, à asOf = coup d'envoi − 1 h :
 * team_stats point-in-time (PointInTimeLoader, repli cross-saison inclus),
 * chaîne de production (deriveLambdas → ajustement H2H de λ →
 * computePoissonMarkets → blend 1X2 → shrinkage → signaux H2H par marché →
 * congestion), cotes assemblées à asOf (loadOddsBatch), puis les six
 * fonctions de décision pures avec chaque règle, réglées contre le score.
 *
 * PROTOCOLE. Aucun paramètre n'est choisi : les deux règles sont figées. Les
 * deux fenêtres (< SPLIT_DATE, ≥ SPLIT_DATE) sont rapportées pour montrer
 * que l'écart ne dépend pas de la période. La mesure qui tranche est le
 * ratio réalisé/annoncé par canal (la calibration), pas le ROI.
 *
 * Run: pnpm --filter @evcore/backtest-core backtest:strategy-ranking
 * Output: packages/backtest-core/reports/backtest-strategy-ranking-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { prisma } from "@evcore/db";
import {
  applyCongestionSignalCorrection,
  applyH2HMarketSignalCorrection,
  computePoissonMarkets,
  decideDoubleChance,
  decideGoals,
  decideOverUnderHt,
  decideResultBtts,
  decideResultTotalGoals,
  decideTeamTotal,
  deriveLambdas,
  getGoalsLineConfigs,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  getLeagueThreeWayEmpiricalBlendWeight,
  getOverUnderHtLineConfigs,
  getOverUnderShrinkageConfig,
  getResultBttsPickConfigs,
  getResultTotalGoalsLineConfigs,
  getTeamTotalLineConfigs,
  Market,
  MODEL_RUN_PHASE,
  rebalanceThreeWayProbabilities,
  resolveFirstHalfBetStatus,
  resolvePickBetStatus,
  shrinkOverUnderProbabilities,
  SPORT_TYPE,
  type FullOddsSnapshot,
  type RankingOptions,
  type StrategyContext,
  type StrategyDecision,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { PointInTimeLoader, type ReplayFixture } from "../src";

const FROM_DATE = new Date("2025-01-01T00:00:00.000Z");
const SPLIT_DATE = new Date("2026-01-01T00:00:00.000Z");
const DECISION_LEAD_MS = 60 * 60 * 1000;
const H2H_GAMMA = 0.2; // apps/backend ev.constants.ts, 2026-07-23
const H2H_NEUTRAL = 0.5;
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5;
// apps/backend ev.constants.ts HTFT_CALIBRATED_LEAGUES — mirrored here, the
// pure core receives it through SelectionConfig.
const HTFT_CALIBRATED = new Set(["BL1", "CH", "L1", "LL", "PL", "SA", "EL1"]);

const RANKINGS: ReadonlyArray<{ label: string; options: RankingOptions }> = [
  { label: "ev (prod)", options: { ranking: "ev" } },
  { label: "proba in 1.20-1.80", options: { ranking: "probability_in_band" } },
];

type Channel =
  | "GOALS"
  | "DOUBLE_CHANCE"
  | "OVER_UNDER_HT"
  | "TEAM_TOTAL"
  | "RESULT_TOTAL_GOALS"
  | "RESULT_BTTS";
const CHANNELS: readonly Channel[] = [
  "GOALS",
  "DOUBLE_CHANCE",
  "OVER_UNDER_HT",
  "TEAM_TOTAL",
  "RESULT_TOTAL_GOALS",
  "RESULT_BTTS",
];

type Acc = {
  fixtures: number;
  selected: number;
  priced: number;
  announced: number;
  won: number;
  brier: number;
  oddsSum: number;
  profit: number;
};
const emptyAcc = (): Acc => ({
  fixtures: 0,
  selected: 0,
  priced: 0,
  announced: 0,
  won: 0,
  brier: 0,
  oddsSum: 0,
  profit: 0,
});

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
    // Only htftCalibrated is read by the six channels replayed here; the
    // other fields are VALUE/SAFE-specific and never consulted.
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

function decide(
  channel: Channel,
  context: StrategyContext,
  options: RankingOptions,
): StrategyDecision {
  const code = context.competitionCode;
  switch (channel) {
    case "GOALS":
      return decideGoals(context, getGoalsLineConfigs(code), options);
    case "DOUBLE_CHANCE":
      return decideDoubleChance(context, options);
    case "OVER_UNDER_HT":
      return decideOverUnderHt(
        context,
        getOverUnderHtLineConfigs(code),
        options,
      );
    case "TEAM_TOTAL":
      return decideTeamTotal(context, getTeamTotalLineConfigs(code), options);
    case "RESULT_TOTAL_GOALS":
      return decideResultTotalGoals(
        context,
        getResultTotalGoalsLineConfigs(code),
        options,
      );
    case "RESULT_BTTS":
      return decideResultBtts(context, getResultBttsPickConfigs(code), options);
  }
}

function settle(
  fixture: ReplayFixture,
  market: Market,
  pick: string,
): "WON" | "LOST" | "VOID" {
  const status =
    market === Market.OVER_UNDER_HT
      ? resolveFirstHalfBetStatus(
          pick,
          fixture.homeHtScore,
          fixture.awayHtScore,
        )
      : resolvePickBetStatus(
          market,
          pick,
          fixture.homeScore,
          fixture.awayScore,
        );
  return status === "WON" ? "WON" : status === "LOST" ? "LOST" : "VOID";
}

function record(acc: Acc, fixture: ReplayFixture, decision: StrategyDecision) {
  acc.fixtures += 1;
  if (decision.status !== "SELECTED") return;
  const selection = decision.selections[0];
  if (!selection) return;
  acc.selected += 1;
  if (selection.odds === undefined) return;
  const outcome = settle(fixture, selection.market, selection.pick);
  if (outcome === "VOID") return;
  const p = selection.probability.toNumber();
  const odds = selection.odds.toNumber();
  const y = outcome === "WON" ? 1 : 0;
  acc.priced += 1;
  acc.announced += p;
  acc.won += y;
  acc.brier += (p - y) ** 2;
  acc.oddsSum += odds;
  acc.profit += y ? odds - 1 : -1;
}

function formatAcc(acc: Acc): string {
  const n = Math.max(acc.priced, 1);
  const ann = acc.announced / n;
  const real = acc.won / n;
  return (
    `sélections ${String(acc.selected).padStart(5)} (réglées ${String(acc.priced).padStart(5)} / ${acc.fixtures} matchs) | ` +
    `annoncé ${ann.toFixed(3)} réalisé ${real.toFixed(3)} ratio ${(ann > 0 ? real / ann : 0).toFixed(3)} | ` +
    `brier ${(acc.brier / n).toFixed(4)} | cote moy ${(acc.oddsSum / n).toFixed(2)} | ROI ${((acc.profit / n) * 100).toFixed(1)} %`
  );
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-strategy-ranking-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  out(
    `Rejeu des six canaux multi-lignes, deux règles de classement — ${generatedAt.toISOString()}`,
  );
  out(
    `Fenêtres : sélection [${FROM_DATE.toISOString().slice(0, 10)} ; ${SPLIT_DATE.toISOString().slice(0, 10)}[, validation ensuite. Décision à coup d'envoi − 1 h.`,
  );
  out();

  const loader = new PointInTimeLoader();
  const fixtures = await loader.listFixtures({
    from: FROM_DATE,
    to: new Date(),
  });
  out(`${fixtures.length} matchs terminés dans les compétitions de backtest.`);

  // key: window|channel|ranking
  const accs = new Map<string, Acc>();
  const accFor = (window: string, channel: Channel, ranking: string): Acc => {
    const key = `${window}|${channel}|${ranking}`;
    let acc = accs.get(key);
    if (!acc) {
      acc = emptyAcc();
      accs.set(key, acc);
    }
    return acc;
  };

  const startedAt = Date.now();
  let processed = 0;
  let skipped = 0;
  const BATCH = 200;
  for (let offset = 0; offset < fixtures.length; offset += BATCH) {
    const batch = fixtures.slice(offset, offset + BATCH);
    const oddsByFixture = await loader.loadOddsBatch(
      batch.map((f) => ({
        fixtureId: f.id,
        asOf: new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
      })),
    );
    for (const fixture of batch) {
      const asOf = new Date(fixture.scheduledAt.getTime() - DECISION_LEAD_MS);
      const odds = oddsByFixture.get(fixture.id) ?? null;
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
      if (!homeStats || !awayStats || odds === null) {
        skipped += 1;
        continue;
      }
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
          favoriteTeamId: favoriteIsHome
            ? fixture.homeTeamId
            : fixture.awayTeamId,
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
      const context = buildContext({
        fixture,
        probabilities,
        lambda,
        odds,
        h2h: h2hScore,
        congestion,
      });
      const window =
        fixture.scheduledAt < SPLIT_DATE ? "sélection" : "validation";
      for (const channel of CHANNELS) {
        for (const ranking of RANKINGS) {
          record(
            accFor(window, channel, ranking.label),
            fixture,
            decide(channel, context, ranking.options),
          );
        }
      }
      processed += 1;
    }
    console.log(
      `[${Math.min(offset + BATCH, fixtures.length)}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
    );
  }
  out(
    `${processed} matchs rejoués, ${skipped} ignorés (team_stats ou cotes absents à asOf).`,
  );
  out();

  for (const window of ["sélection", "validation"]) {
    out(`== ${window.toUpperCase()} ==`);
    for (const channel of CHANNELS) {
      out(channel);
      for (const ranking of RANKINGS) {
        out(
          `  ${ranking.label.padEnd(20)} ${formatAcc(accFor(window, channel, ranking.label))}`,
        );
      }
    }
    out();
  }

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`Rapport écrit : ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
