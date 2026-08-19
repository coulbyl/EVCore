/// <reference types="node" />
/**
 * Calibration walk-forward de l'O/U plein-temps (GOALS — lignes 1.5/2.5/
 * 3.5/4.5) — même protocole double-hypothèse que TEAM_TOTAL/CLEAN_SHEET/
 * BTTS/1X2 : régresser la probabilité Poisson brute sur l'issue réelle par
 * ligue, valider hors échantillon (train = toutes saisons sauf la plus
 * récente ; test = la plus récente), tester une fenêtre "3 saisons
 * récentes" en plus de tout l'historique avant de conclure "rien à faire".
 *
 * Contexte (2026-08-19) : `OU_SHRINKAGE_CONFIG.factor`/`baseRates` (les 4
 * lignes O/U) datent du tout premier passage de calibration (2026-07-03,
 * docs/data-poor-leagues-calibration.md) — jamais réévalué avec le
 * protocole à deux hypothèses affiné cette session pour TEAM_TOTAL/
 * CLEAN_SHEET/BTTS. Contrairement à TEAM_TOTAL (un facteur par ligne),
 * shrinkOverUnderProbabilities applique UN SEUL facteur aux 4 lignes d'une
 * même ligue (ou-shrinkage.ts) — donc ce script fitte une pente unique par
 * régression groupée sur les 4 lignes en même temps (pas 4 régressions
 * séparées), pour rester fidèle au mécanisme de prod ; les taux de base
 * restent mesurés ligne par ligne (comme en prod).
 *
 * Réutilise la même infrastructure de replay que les autres scripts de
 * shrinkage (TeamStats point-in-time, pipeline réel deriveLambdas ->
 * computePoissonMarkets).
 *
 * Run: pnpm --filter @evcore/db db:backtest:goals-shrinkage-calibration
 * Output: packages/db/reports/backtest-goals-shrinkage-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deriveLambdas,
  computePoissonMarkets,
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

const MIN_TRAIN_VOLUME = 60; // per fixture, so ~4x rows once pooled across lines
const MIN_TEST_VOLUME = 20;
const MIN_BRIER_IMPROVEMENT = 0.001;

const LINES = ["15", "25", "35", "45"] as const;
type Line = (typeof LINES)[number];

type FixtureRow = {
  scheduledAt: Date;
  seasonId: string;
  seasonName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  competitionCode: string;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

// One row per (fixture, line) — pooled across lines for the shared-factor fit.
type Point = {
  competitionCode: string;
  seasonName: string;
  scheduledAt: Date;
  line: Line;
  prob: number;
  actual: 0 | 1;
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

function olsSlope(predicted: number[], actual: number[]): number {
  const n = predicted.length;
  const meanX = predicted.reduce((a, b) => a + b, 0) / n;
  const meanY = actual.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = predicted[i]! - meanX;
    num += dx * (actual[i]! - meanY);
    den += dx * dx;
  }
  return den === 0 ? 1 : num / den;
}

function brier(points: { prob: number; actual: 0 | 1 }[]): number {
  return (
    points.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0) / points.length
  );
}

function shrink(prob: number, base: number, factor: number): number {
  const f = Math.min(1, Math.max(0, factor));
  const shrunk = base + f * (prob - base);
  return Math.max(0, Math.min(1, shrunk));
}

// Shrink each point toward ITS OWN line's base rate, using one shared factor
// — mirrors shrinkOverUnderProbabilities (ou-shrinkage.ts): one factor per
// league, applied per-line against that line's own baseRates entry.
function brierWithSharedFactor(
  pts: Point[],
  baseByLine: Record<Line, number>,
  factor: number,
): number {
  let sum = 0;
  for (const p of pts) {
    const s = shrink(p.prob, baseByLine[p.line], factor);
    sum += (s - p.actual) ** 2;
  }
  return sum / pts.length;
}

function baseRatesFor(pts: Point[]): Record<Line, number> {
  const out: Record<Line, number> = {
    "15": 0.5,
    "25": 0.5,
    "35": 0.5,
    "45": 0.5,
  };
  for (const line of LINES) {
    const linePts = pts.filter((p) => p.line === line);
    if (linePts.length === 0) continue;
    out[line] = linePts.reduce((s, p) => s + p.actual, 0) / linePts.length;
  }
  return out;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-goals-shrinkage-calibration-${dateLabel}.txt`,
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
      scheduledAt: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      season: {
        select: { name: true, competition: { select: { code: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    seasonName: f.season.name,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
    competitionCode: f.season.competition.code,
  }));
  out(`  ${fixtures.length} fixtures terminées trouvées.`);

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

  out("Replay du pipeline Poisson par fixture...");
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
    const markets = computePoissonMarkets(lambda.home, lambda.away);
    processed++;

    const totalGoals = fixture.homeScore + fixture.awayScore;
    const probByLine: Record<Line, number> = {
      "15": markets.over15.toNumber(),
      "25": markets.over25.toNumber(),
      "35": markets.over35.toNumber(),
      "45": markets.over45.toNumber(),
    };
    const lineThreshold: Record<Line, number> = {
      "15": 1.5,
      "25": 2.5,
      "35": 3.5,
      "45": 4.5,
    };

    for (const line of LINES) {
      points.push({
        competitionCode: fixture.competitionCode,
        seasonName: fixture.seasonName,
        scheduledAt: fixture.scheduledAt,
        line,
        prob: probByLine[line],
        actual: totalGoals > lineThreshold[line] ? 1 : 0,
      });
    }
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats).`,
  );

  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const arr = groups.get(p.competitionCode) ?? [];
    arr.push(p);
    groups.set(p.competitionCode, arr);
  }

  type ShippedRow = {
    competitionCode: string;
    trainFixtures: number;
    testFixtures: number;
    factor: number;
    baseRates: Record<Line, number>;
    brierImprovement: number;
    fitWindow: "historique" | "recent3";
  };
  const shipped: ShippedRow[] = [];
  const rejected: { key: string; reason: string }[] = [];

  for (const [competitionCode, pts] of groups) {
    const seasonOrder = Array.from(
      new Set(
        pts
          .slice()
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          .map((p) => p.seasonName),
      ),
    );
    if (seasonOrder.length < 2) {
      rejected.push({
        key: competitionCode,
        reason: `1 seule saison (${pts.length / 4} fixtures)`,
      });
      continue;
    }

    const latestSeason = seasonOrder[seasonOrder.length - 1]!;
    const train = pts.filter((p) => p.seasonName !== latestSeason);
    const test = pts.filter((p) => p.seasonName === latestSeason);
    const trainFixtures = train.length / 4;
    const testFixtures = test.length / 4;

    if (trainFixtures < MIN_TRAIN_VOLUME || testFixtures < MIN_TEST_VOLUME) {
      rejected.push({
        key: competitionCode,
        reason: `volume insuffisant (train=${trainFixtures}, test=${testFixtures})`,
      });
      continue;
    }

    const trainBase = baseRatesFor(train);
    const allSlope = olsSlope(
      train.map((p) => p.prob),
      train.map((p) => p.actual),
    );
    const brierIdentityTest = brier(test);
    const improvementAll =
      brierIdentityTest - brierWithSharedFactor(test, trainBase, allSlope);

    const trainSeasonOrder = seasonOrder.slice(0, -1);
    const recentTrainSeasons = new Set(trainSeasonOrder.slice(-2));
    const recentTrain = train.filter((p) =>
      recentTrainSeasons.has(p.seasonName),
    );
    let improvementRecent = -Infinity;
    let recentSlope = 1;
    let recentTrainBase = trainBase;
    if (recentTrain.length / 4 >= MIN_TRAIN_VOLUME) {
      recentTrainBase = baseRatesFor(recentTrain);
      recentSlope = olsSlope(
        recentTrain.map((p) => p.prob),
        recentTrain.map((p) => p.actual),
      );
      improvementRecent =
        brierIdentityTest -
        brierWithSharedFactor(test, recentTrainBase, recentSlope);
    }

    const useRecent =
      improvementRecent > improvementAll &&
      improvementRecent >= MIN_BRIER_IMPROVEMENT;
    const brierImprovement = useRecent ? improvementRecent : improvementAll;

    if (brierImprovement < MIN_BRIER_IMPROVEMENT) {
      rejected.push({
        key: competitionCode,
        reason:
          `ΔBrier insuffisant (historique complet ${improvementAll >= 0 ? "+" : ""}${improvementAll.toFixed(4)}, ` +
          `fenêtre récente ${improvementRecent === -Infinity ? "n/a" : (improvementRecent >= 0 ? "+" : "") + improvementRecent.toFixed(4)})`,
      });
      continue;
    }

    // Production numbers: re-fit slope on the full sample; base rates from
    // the 2 (or 3 if recent window) most recent seasons of the full sample.
    const fullSlope = olsSlope(
      pts.map((p) => p.prob),
      pts.map((p) => p.actual),
    );
    const recentSeasons = new Set(seasonOrder.slice(useRecent ? -3 : -2));
    const recentPts = pts.filter((p) => recentSeasons.has(p.seasonName));
    const recentBase = baseRatesFor(recentPts);
    const recentWindowSlope = useRecent
      ? olsSlope(
          recentPts.map((p) => p.prob),
          recentPts.map((p) => p.actual),
        )
      : fullSlope;

    shipped.push({
      competitionCode,
      trainFixtures,
      testFixtures,
      factor: Math.min(
        1,
        Math.max(0, useRecent ? recentWindowSlope : fullSlope),
      ),
      baseRates: recentBase,
      brierImprovement,
      fitWindow: useRecent ? "recent3" : "historique",
    });
  }

  shipped.sort((a, b) => a.competitionCode.localeCompare(b.competitionCode));

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration walk-forward GOALS (O/U plein-temps)");
  out(
    `  ${dateLabel} — train=toutes saisons sauf la + récente, test=la + récente`,
  );
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `${shipped.length} bloc(s) livré(s) sur ${groups.size} ligues observées ` +
      `(${rejected.length} rejetées : volume insuffisant ou pas d'amélioration Brier).`,
  );
  out();
  for (const r of shipped) {
    out(
      `${r.competitionCode.padEnd(6)} train n=${String(r.trainFixtures).padEnd(5)} test n=${String(r.testFixtures).padEnd(4)}  ` +
        `ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
        `→ factor=${r.factor.toFixed(2)} base(o15/o25/o35/o45)=${r.baseRates["15"].toFixed(2)}/${r.baseRates["25"].toFixed(2)}/${r.baseRates["35"].toFixed(2)}/${r.baseRates["45"].toFixed(2)} fit=${r.fitWindow}`,
    );
  }

  out();
  out("--- Rejetées (diagnostic) ---");
  for (const r of rejected.sort((a, b) => a.key.localeCompare(b.key))) {
    out(`  ${r.key}: ${r.reason}`);
  }

  const report = lines.join("\n");
  writeFileSync(outputPath, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${outputPath.split("/").pop()}`);

  const jsonPath = join(reportsDir, "goals-shrinkage-shipped.json");
  writeFileSync(jsonPath, JSON.stringify(shipped, null, 2), "utf8");
  console.log(
    `Données structurées écrites : reports/${jsonPath.split("/").pop()}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
