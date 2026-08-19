/// <reference types="node" />
/**
 * Explore la valeur prédictive du signal de congestion (fatigue/enchaînement
 * de matchs) — FEATURE_FLAGS.SCORING.CONGESTION reste à `false`, le calcul
 * pur existe déjà (packages/analysis-core/src/probability/congestion.ts,
 * extrait 2026-08-18) mais n'a jamais été backtesté pour une vraie valeur
 * additionnelle. Même protocole logit-shift + grid search train/validation
 * que backtest-h2h-market-signals-combined.ts : le baseline est la
 * probabilité DÉJÀ recalibrée cette session (OU_SHRINKAGE_CONFIG appliqué),
 * pour mesurer un gain au-dessus de ce qui existe déjà, pas au-dessus du
 * Poisson brut.
 *
 * ATTENTION point-in-time : CongestionService (prod) compte les fixtures
 * `SCHEDULED` à venir — correct en live, mais faux en rejouant l'historique
 * (tout est `FINISHED` aujourd'hui, donc ce filtre renverrait toujours 0).
 * Ce script compte les fixtures à venir SANS filtrer par statut, uniquement
 * par fenêtre de date, pour rester fidèle à ce que le modèle savait à
 * l'époque (le calendrier était bien publié, seul le résultat ne l'était
 * pas).
 *
 * Hypothèse testée : plus la fatigue combinée (domicile+extérieur) est
 * élevée, moins il y a de buts — testé sur OVER_2.5 et BTTS (mêmes marchés
 * déjà remaniés par le signal H2H, pour comparer les deux sur un pied
 * d'égalité).
 *
 * Run: pnpm --filter @evcore/db db:backtest:congestion-signal-value
 * Output: packages/db/reports/backtest-congestion-signal-value-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deriveLambdas,
  computePoissonMarkets,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
  computeCongestionScoreFromTeams,
  type LambdaConfig,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  meanLambda: 1.4,
  homeAdvFactor: 1.05,
  awayDisadvFactor: 0.95,
  lambdaScale: 1,
};

const TRAIN_FRACTION = 0.7;
const PROB_EPSILON = 0.001;
const DELTA_GRID: number[] = Array.from(
  { length: 25 },
  (_, i) => Math.round((-0.6 + i * 0.05) * 100) / 100,
);
const UPCOMING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
function logit(p: number): number {
  const c = clamp(p, PROB_EPSILON, 1 - PROB_EPSILON);
  return Math.log(c / (1 - c));
}
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
// signal in [0,1], 0.5 = neutral (no shift)
function correctedProb(
  baselineProb: number,
  signal: number,
  delta: number,
): number {
  return sigmoid(logit(baselineProb) + delta * (signal - 0.5));
}
function brierOf(points: { prob: number; actual: 0 | 1 }[]): number {
  return (
    points.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0) / points.length
  );
}

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  competitionCode: string;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

type Point = {
  baselineOver25: number;
  baselineBttsYes: number;
  congestion: number;
  actualOver25: 0 | 1;
  actualBttsYes: 0 | 1;
};

function findPriorStats(
  statsByTeamSeason: Map<string, StatsPoint[]>,
  teamId: string,
  seasonId: string,
  before: Date,
): { stats: TeamStatsInput; priorCount: number } | null {
  const arr = statsByTeamSeason.get(`${teamId}:${seasonId}`);
  if (!arr || arr.length === 0) return null;
  let lastIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]!.scheduledAt.getTime() < before.getTime()) lastIdx = i;
    else break;
  }
  if (lastIdx === -1) return null;
  return { stats: arr[lastIdx]!.stats, priorCount: lastIdx + 1 };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-congestion-signal-value-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("Chargement des fixtures terminées...");
  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      scheduledAt: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      season: { select: { competition: { select: { code: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    id: f.id,
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
    competitionCode: f.season.competition.code,
  }));
  out(`  ${fixtures.length} fixtures terminées trouvées.`);

  // All (team, scheduledAt) rows, sorted, to derive last-played-before and
  // upcoming-within-window WITHOUT filtering by current status (see header).
  out("Construction du calendrier par équipe (indépendant du statut)...");
  const byTeam = new Map<string, Date[]>();
  for (const f of fixtures) {
    for (const teamId of [f.homeTeamId, f.awayTeamId]) {
      const arr = byTeam.get(teamId) ?? [];
      arr.push(f.scheduledAt);
      byTeam.set(teamId, arr);
    }
  }
  for (const arr of byTeam.values())
    arr.sort((a, b) => a.getTime() - b.getTime());

  function lastPlayedBefore(teamId: string, at: Date): Date | null {
    const arr = byTeam.get(teamId);
    if (!arr) return null;
    let lastIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]!.getTime() < at.getTime()) lastIdx = i;
      else break;
    }
    return lastIdx === -1 ? null : arr[lastIdx]!;
  }
  function upcomingCountAfter(teamId: string, at: Date): number {
    const arr = byTeam.get(teamId);
    if (!arr) return 0;
    const windowEnd = at.getTime() + UPCOMING_WINDOW_MS;
    let count = 0;
    for (const d of arr) {
      const t = d.getTime();
      if (t > at.getTime() && t <= windowEnd) count++;
    }
    return count;
  }

  out("Chargement des TeamStats point-in-time...");
  const teamIds = Array.from(
    new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])),
  );
  const statsRaw = await prisma.teamStats.findMany({
    where: { teamId: { in: teamIds } },
    select: {
      teamId: true,
      recentForm: true,
      xgFor: true,
      xgAgainst: true,
      homeWinRate: true,
      awayWinRate: true,
      drawRate: true,
      leagueVolatility: true,
      afterFixture: { select: { seasonId: true, scheduledAt: true } },
    },
    orderBy: { afterFixture: { scheduledAt: "asc" } },
  });
  const statsByTeamSeason = new Map<string, StatsPoint[]>();
  for (const row of statsRaw) {
    const key = `${row.teamId}:${row.afterFixture.seasonId}`;
    const arr = statsByTeamSeason.get(key) ?? [];
    arr.push({
      scheduledAt: row.afterFixture.scheduledAt,
      stats: {
        recentForm: row.recentForm,
        xgFor: row.xgFor,
        xgAgainst: row.xgAgainst,
        homeWinRate: row.homeWinRate,
        awayWinRate: row.awayWinRate,
        drawRate: row.drawRate,
        leagueVolatility: row.leagueVolatility,
      },
    });
    statsByTeamSeason.set(key, arr);
  }
  out(
    `  ${statsRaw.length} lignes TeamStats chargées (${teamIds.length} équipes).`,
  );

  out("Replay du pipeline (Poisson + shrinkage déjà en place) par fixture...");
  const points: Point[] = [];
  let processed = 0;
  let skippedColdStart = 0;

  for (const fixture of fixtures) {
    const home = findPriorStats(
      statsByTeamSeason,
      fixture.homeTeamId,
      fixture.seasonId,
      fixture.scheduledAt,
    );
    const away = findPriorStats(
      statsByTeamSeason,
      fixture.awayTeamId,
      fixture.seasonId,
      fixture.scheduledAt,
    );
    if (
      !home ||
      !away ||
      home.priorCount < MIN_PRIOR_TEAM_STATS ||
      away.priorCount < MIN_PRIOR_TEAM_STATS
    ) {
      skippedColdStart++;
      continue;
    }

    const lambda = deriveLambdas(home.stats, away.stats, DEFAULT_LAMBDA_CONFIG);
    const rawMarkets = computePoissonMarkets(lambda.home, lambda.away);
    const shrinkConfig = getOverUnderShrinkageConfig(fixture.competitionCode);
    const shrunk = shrinkOverUnderProbabilities(rawMarkets, shrinkConfig);
    processed++;

    const homeLastPlayed = lastPlayedBefore(
      fixture.homeTeamId,
      fixture.scheduledAt,
    );
    const awayLastPlayed = lastPlayedBefore(
      fixture.awayTeamId,
      fixture.scheduledAt,
    );
    const congestion = computeCongestionScoreFromTeams(
      {
        lastPlayedAt: homeLastPlayed,
        upcomingFixtureCount: upcomingCountAfter(
          fixture.homeTeamId,
          fixture.scheduledAt,
        ),
        fixtureDate: fixture.scheduledAt,
      },
      {
        lastPlayedAt: awayLastPlayed,
        upcomingFixtureCount: upcomingCountAfter(
          fixture.awayTeamId,
          fixture.scheduledAt,
        ),
        fixtureDate: fixture.scheduledAt,
      },
    );

    const totalGoals = fixture.homeScore + fixture.awayScore;
    points.push({
      baselineOver25: shrunk.over25.toNumber(),
      baselineBttsYes: shrunk.bttsYes.toNumber(),
      congestion,
      actualOver25: totalGoals > 2.5 ? 1 : 0,
      actualBttsYes: fixture.homeScore > 0 && fixture.awayScore > 0 ? 1 : 0,
    });
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats).`,
  );

  out(
    `Distribution du score de congestion : ` +
      `min=${Math.min(...points.map((p) => p.congestion)).toFixed(2)} ` +
      `p50=${points
        .map((p) => p.congestion)
        .sort((a, b) => a - b)
        [Math.floor(points.length / 2)]!.toFixed(2)} ` +
      `max=${Math.max(...points.map((p) => p.congestion)).toFixed(2)}`,
  );

  // Chronological 70/30 split, same protocol as the H2H combined script.
  const shuffled = points; // already chronological
  const splitIdx = Math.floor(shuffled.length * TRAIN_FRACTION);
  const train = shuffled.slice(0, splitIdx);
  const validation = shuffled.slice(splitIdx);
  out(`train n=${train.length}, validation n=${validation.length}`);

  function evalMarket(
    label: string,
    getBaseline: (p: Point) => number,
    getActual: (p: Point) => 0 | 1,
  ) {
    const trainPts = train.map((p) => ({
      baseline: getBaseline(p),
      signal: p.congestion,
      actual: getActual(p),
    }));
    const valPts = validation.map((p) => ({
      baseline: getBaseline(p),
      signal: p.congestion,
      actual: getActual(p),
    }));

    const baselineTrainBrier = brierOf(
      trainPts.map((p) => ({ prob: p.baseline, actual: p.actual })),
    );
    let bestDelta = 0;
    let bestTrainBrier = baselineTrainBrier;
    for (const delta of DELTA_GRID) {
      const b = brierOf(
        trainPts.map((p) => ({
          prob: correctedProb(p.baseline, p.signal, delta),
          actual: p.actual,
        })),
      );
      if (b < bestTrainBrier) {
        bestTrainBrier = b;
        bestDelta = delta;
      }
    }

    const baselineValBrier = brierOf(
      valPts.map((p) => ({ prob: p.baseline, actual: p.actual })),
    );
    const correctedValBrier = brierOf(
      valPts.map((p) => ({
        prob: correctedProb(p.baseline, p.signal, bestDelta),
        actual: p.actual,
      })),
    );
    const delta = correctedValBrier - baselineValBrier;

    out();
    out(`--- ${label} ---`);
    out(`  train n=${trainPts.length}, validation n=${valPts.length}`);
    out(
      `  Brier baseline (train, delta=0)      : ${baselineTrainBrier.toFixed(6)}`,
    );
    out(
      `  Meilleur delta additionnel (train)   : ${bestDelta.toFixed(2)}  →  Brier ${bestTrainBrier.toFixed(6)}`,
    );
    out(
      `  Brier baseline (validation)          : ${baselineValBrier.toFixed(6)}`,
    );
    out(
      `  Brier corrigé (validation, + signal) : ${correctedValBrier.toFixed(6)}`,
    );
    out(
      `  Delta Brier (négatif=gain réel)      : ${delta >= 0 ? "+" : ""}${delta.toFixed(6)}`,
    );
    const verdict =
      bestDelta === 0 || delta >= 0
        ? "pas de gain additionnel confirmé — rester en shadow"
        : "gain additionnel confirmé — candidat réel à activation";
    out(`  Verdict : ${verdict}`);
    return { label, n: valPts.length, bestDelta, delta, verdict };
  }

  const results = [
    evalMarket(
      "OVER 2.5",
      (p) => p.baselineOver25,
      (p) => p.actualOver25,
    ),
    evalMarket(
      "BTTS",
      (p) => p.baselineBttsYes,
      (p) => p.actualBttsYes,
    ),
  ];

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Résumé");
  out("═══════════════════════════════════════════════════════");
  out("  marché    | n validation | best delta | delta Brier | verdict");
  for (const r of results) {
    out(
      `  ${r.label.padEnd(10)} | ${String(r.n).padEnd(12)} | ${r.bestDelta.toFixed(2).padEnd(10)} | ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(6)} | ${r.verdict}`,
    );
  }

  const report = lines.join("\n");
  writeFileSync(outputPath, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${outputPath.split("/").pop()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
