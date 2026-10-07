/// <reference types="node" />
/**
 * Re-fit du décalage de congestion sur la chaîne de production actuelle :
 * delta × centrage.
 *
 * POURQUOI. `applyCongestionSignalCorrection` applique
 * `delta × (score − 0,5)` sur over25 et bttsYes avec delta = −0,05. Le score
 * de congestion vaut 0 pour la majorité des matchs (calendriers domestiques
 * hebdomadaires), donc le décalage vaut +0,025 logit (+0,6 point) sur
 * presque tous les matchs : un intercept global déguisé en signal, re-fitté
 * le 2026-08-19 sur une chaîne qui retirait 12 % des buts attendus (facteur
 * extérieur 0,75). Le global a été re-fitté le 2026-10-06 ; l'intercept est
 * désormais de trop ou de travers.
 *
 * CE QUI EST REJOUÉ. Chaîne de production jusqu'aux signaux H2H inclus
 * (team_stats point-in-time, ajustement H2H de λ, blend 1X2, shrinkage,
 * signaux H2H par marché), puis la correction de congestion candidate :
 * p' = sigmoid(logit(p) + delta × (score − centre)). Grille figée : delta ∈
 * DELTA_GRID × centre ∈ CENTER_GRID. Critère figé : Brier over25 + BTTS.
 * Choix sur la sélection (< SPLIT_DATE), mesure unique sur la validation.
 *
 * Run: pnpm --filter @evcore/backtest-core backtest:congestion-centering
 * Output: packages/backtest-core/reports/backtest-congestion-centering-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@evcore/db";
import {
  applyH2HMarketSignalCorrection,
  computePoissonMarkets,
  CONGESTION_SIGNAL_DELTA,
  deriveLambdas,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  getLeagueThreeWayEmpiricalBlendWeight,
  getOverUnderShrinkageConfig,
  rebalanceThreeWayProbabilities,
  shrinkOverUnderProbabilities,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { PointInTimeLoader } from "../src";

const FROM_DATE = new Date("2024-07-01T00:00:00.000Z");
const SPLIT_DATE = new Date("2026-01-01T00:00:00.000Z");
const DECISION_LEAD_MS = 60 * 60 * 1000;
const H2H_GAMMA = 0.2;
const H2H_NEUTRAL = 0.5;
const MIN_WINDOW = 3_000;

const DELTA_GRID = [-0.15, -0.1, -0.05, -0.025, 0] as const;
const CENTER_GRID = [0.5, 0.25, 0] as const;
const CURRENT = { delta: CONGESTION_SIGNAL_DELTA, center: 0.5 } as const;

type Config = { delta: number; center: number };
type Point = {
  window: "sélection" | "validation";
  score: number;
  over25: number;
  bttsYes: number;
  yOver: 0 | 1;
  yBtts: 0 | 1;
};
type Summary = {
  n: number;
  brierOver: number;
  brierBtts: number;
  sum: number;
  pOver: number;
  over: number;
  pBtts: number;
  btts: number;
};

function logit(p: number): number {
  const c = Math.min(Math.max(p, 0.001), 0.999);
  return Math.log(c / (1 - c));
}
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
function shifted(p: number, score: number, config: Config): number {
  return sigmoid(logit(p) + config.delta * (score - config.center));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function adjustLambdaForH2H(input: {
  lambda: { home: number; away: number };
  favoriteIsHome: boolean;
  h2hScore: number;
}): { home: number; away: number } {
  const signal = input.h2hScore - H2H_NEUTRAL;
  const favorFactor = 1 + H2H_GAMMA * signal;
  const underdogFactor = 1 - H2H_GAMMA * signal;
  return {
    home: clamp(
      input.favoriteIsHome
        ? input.lambda.home * favorFactor
        : input.lambda.home * underdogFactor,
      0.05,
      5,
    ),
    away: clamp(
      input.favoriteIsHome
        ? input.lambda.away * underdogFactor
        : input.lambda.away * favorFactor,
      0.05,
      5,
    ),
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

function summarize(points: readonly Point[], config: Config): Summary {
  let brierOver = 0;
  let brierBtts = 0;
  let pOver = 0;
  let over = 0;
  let pBtts = 0;
  let btts = 0;
  for (const point of points) {
    const o = shifted(point.over25, point.score, config);
    const b = shifted(point.bttsYes, point.score, config);
    brierOver += (o - point.yOver) ** 2;
    brierBtts += (b - point.yBtts) ** 2;
    pOver += o;
    over += point.yOver;
    pBtts += b;
    btts += point.yBtts;
  }
  const n = Math.max(points.length, 1);
  const summary: Summary = {
    n: points.length,
    brierOver: brierOver / n,
    brierBtts: brierBtts / n,
    sum: 0,
    pOver: pOver / n,
    over: over / n,
    pBtts: pBtts / n,
    btts: btts / n,
  };
  summary.sum = summary.brierOver + summary.brierBtts;
  return summary;
}

const f5 = (v: number) => v.toFixed(5);
const f3 = (v: number) => v.toFixed(3);
const label = (c: Config) =>
  `delta=${c.delta.toFixed(3)} centre=${c.center.toFixed(2)}`;
const fmt = (s: Summary) =>
  `n=${s.n} | over25=${f5(s.brierOver)} btts=${f5(s.brierBtts)} sum=${f5(s.sum)} | P(over) ${f3(s.pOver)} vs ${f3(s.over)} | P(btts) ${f3(s.pBtts)} vs ${f3(s.btts)}`;

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-congestion-centering-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  out(
    `Re-fit du décalage de congestion, delta × centrage — ${generatedAt.toISOString()}`,
  );
  out(
    `Sélection [${FROM_DATE.toISOString().slice(0, 10)} ; ${SPLIT_DATE.toISOString().slice(0, 10)}[, validation ensuite. Décision à coup d'envoi − 1 h. Actuel : ${label(CURRENT)}.`,
  );
  out();

  const loader = new PointInTimeLoader();
  const fixtures = await loader.listFixtures({
    from: FROM_DATE,
    to: new Date(),
  });
  out(`${fixtures.length} matchs terminés dans les compétitions de backtest.`);

  const points: Point[] = [];
  const scoreBuckets = new Map<string, number>();
  const startedAt = Date.now();
  for (const [index, fixture] of fixtures.entries()) {
    const asOf = new Date(fixture.scheduledAt.getTime() - DECISION_LEAD_MS);
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
    if (!homeStats || !awayStats) continue;
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
    const probabilities = applyH2HMarketSignalCorrection(
      preSignals,
      h2hSignals,
    );
    const total = fixture.homeScore + fixture.awayScore;
    points.push({
      window: fixture.scheduledAt < SPLIT_DATE ? "sélection" : "validation",
      score: congestion,
      over25: probabilities.over25.toNumber(),
      bttsYes: probabilities.bttsYes.toNumber(),
      yOver: total > 2 ? 1 : 0,
      yBtts: fixture.homeScore > 0 && fixture.awayScore > 0 ? 1 : 0,
    });
    const bucket =
      congestion === 0
        ? "0"
        : congestion < 0.25
          ? "]0;0.25["
          : congestion < 0.5
            ? "[0.25;0.5["
            : "≥0.5";
    scoreBuckets.set(bucket, (scoreBuckets.get(bucket) ?? 0) + 1);
    if ((index + 1) % 2000 === 0) {
      console.log(
        `[${index + 1}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
      );
    }
  }
  const selection = points.filter((p) => p.window === "sélection");
  const validation = points.filter((p) => p.window === "validation");
  out(
    `${points.length} matchs rejoués (sélection ${selection.length}, validation ${validation.length}).`,
  );
  out(
    `Distribution du score de congestion : ${[...scoreBuckets.entries()].map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
  );
  out();

  const grid: Config[] = DELTA_GRID.flatMap((delta) =>
    CENTER_GRID.map((center) => ({ delta, center })),
  );
  const scored = grid.map((config) => ({
    config,
    selection: summarize(selection, config),
  }));
  const eligible = scored.filter(
    (s) => s.selection.n >= MIN_WINDOW && validation.length >= MIN_WINDOW,
  );
  const ranked = [...eligible].sort(
    (a, b) => a.selection.sum - b.selection.sum,
  );
  const chosen = ranked[0] ?? null;

  out("== SÉLECTION (classement sur la fenêtre de sélection seule) ==");
  for (const [i, s] of ranked.entries()) {
    out(
      `${String(i + 1).padStart(3)}. ${label(s.config).padEnd(28)} ${fmt(s.selection)}`,
    );
  }
  out(
    `Configurations comparées : ${eligible.length} ; faux positifs attendus à 95 % par le balayage : ${(eligible.length * 0.025).toFixed(1)}.`,
  );
  out();

  out("== VALIDATION (mesurée une fois) ==");
  const currentValidation = summarize(validation, CURRENT);
  const noneValidation = summarize(validation, { delta: 0, center: 0.5 });
  out(`actuelle  ${label(CURRENT).padEnd(28)} ${fmt(currentValidation)}`);
  out(
    `sans      ${label({ delta: 0, center: 0.5 }).padEnd(28)} ${fmt(noneValidation)}`,
  );
  if (chosen) {
    const chosenValidation = summarize(validation, chosen.config);
    out(
      `retenue   ${label(chosen.config).padEnd(28)} ${fmt(chosenValidation)}`,
    );
    out(
      `écart retenue − actuelle sur validation : ${f5(chosenValidation.sum - currentValidation.sum)} (négatif = mieux) ; sur sélection : ${f5(chosen.selection.sum - summarize(selection, CURRENT).sum)}`,
    );
    out(
      `écart sans − actuelle sur validation : ${f5(noneValidation.sum - currentValidation.sum)}`,
    );
  }
  out();
  out("== VALIDATION de toutes les configurations (diagnostic) ==");
  for (const s of ranked) {
    out(
      `${label(s.config).padEnd(28)} ${fmt(summarize(validation, s.config))}`,
    );
  }

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`\nRapport écrit : ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
