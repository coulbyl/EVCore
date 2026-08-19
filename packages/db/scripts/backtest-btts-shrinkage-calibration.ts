/// <reference types="node" />
/**
 * Calibration walk-forward de BTTS (P(les deux équipes marquent)) — même
 * protocole que backtest-team-total-shrinkage-calibration.ts et
 * backtest-clean-sheet-win-either-half-shrinkage-calibration.ts : régresser
 * la probabilité Poisson brute sur l'issue réelle par ligue, valider hors
 * échantillon (train = toutes saisons sauf la plus récente ; test = la plus
 * récente), tester deux hypothèses avant de conclure "rien à faire" — slope
 * fitté sur tout l'historique de train, ou seulement sur les 2 saisons de
 * train les plus récentes (une dérive de saison peut faire échouer la
 * première même quand un biais réel existe, cf. mémoire
 * lambda-scale-fin1-bl1 et le rescue observé sur TEAM_TOTAL/CLEAN_SHEET le
 * 2026-08-19) — et ne livrer un bloc que si l'une des deux améliore le Brier
 * tenu-à-l'écart d'au moins 0.001 vs l'identité (factor=1).
 *
 * Contexte (2026-08-19) : BTTS vient d'être unifié — bttsYes et bttsNo sont
 * désormais évalués contre le MÊME seuil par ligue (argmax), donc un
 * bttsYes mal calibré déséquilibre les deux côtés symétriquement (bttsNo =
 * 1 − bttsYes, une seule probabilité à corriger, pas deux comme
 * TEAM_TOTAL/CLEAN_SHEET). L'entrée `btts: { factor, baseYes }` de
 * OU_SHRINKAGE_CONFIG existe déjà pour ~32/60 ligues, mais dérivée en même
 * temps que le shrinkage O/U plein-temps (2026-07-03) — jamais réévaluée
 * indépendamment, et absente pour les ligues qui n'ont pas eu besoin de
 * shrinkage O/U (BTTS peut être mal calibré dans une ligue même si les
 * lignes O/U le sont bien). Ce script couvre les 60 ligues indépendamment.
 *
 * Réutilise la même infrastructure de replay (TeamStats point-in-time,
 * pipeline réel deriveLambdas -> computePoissonMarkets).
 *
 * Run: pnpm --filter @evcore/db db:backtest:btts-shrinkage-calibration
 * Output: packages/db/reports/backtest-btts-shrinkage-calibration-YYYY-MM-DD.txt
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

const MIN_TRAIN_VOLUME = 60;
const MIN_TEST_VOLUME = 20;
const MIN_BRIER_IMPROVEMENT = 0.001;

type FixtureRow = {
  id: string;
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

type Point = {
  competitionCode: string;
  seasonName: string;
  scheduledAt: Date;
  prob: number; // raw Poisson P(BTTS yes)
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

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-btts-shrinkage-calibration-${dateLabel}.txt`,
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
      season: {
        select: { name: true, competition: { select: { code: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    id: f.id,
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

    points.push({
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      prob: markets.bttsYes.toNumber(),
      actual: fixture.homeScore > 0 && fixture.awayScore > 0 ? 1 : 0,
    });
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
    trainN: number;
    testN: number;
    trainSlope: number;
    brierImprovement: number;
    fullFactor: number;
    recentBase: number;
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
        reason: `1 seule saison (${pts.length} picks)`,
      });
      continue;
    }

    const latestSeason = seasonOrder[seasonOrder.length - 1]!;
    const train = pts.filter((p) => p.seasonName !== latestSeason);
    const test = pts.filter((p) => p.seasonName === latestSeason);

    if (train.length < MIN_TRAIN_VOLUME || test.length < MIN_TEST_VOLUME) {
      rejected.push({
        key: competitionCode,
        reason: `volume insuffisant (train=${train.length}, test=${test.length})`,
      });
      continue;
    }

    const allSlope = olsSlope(
      train.map((p) => p.prob),
      train.map((p) => p.actual),
    );
    const allBase = train.reduce((s, p) => s + p.actual, 0) / train.length;
    const testIdentity = test.map((p) => ({ prob: p.prob, actual: p.actual }));
    const brierIdentity = brier(testIdentity);
    const improvementAll =
      brierIdentity -
      brier(
        test.map((p) => ({
          prob: shrink(p.prob, allBase, allSlope),
          actual: p.actual,
        })),
      );

    const trainSeasonOrder = seasonOrder.slice(0, -1);
    const recentTrainSeasons = new Set(trainSeasonOrder.slice(-2));
    const recentTrain = train.filter((p) =>
      recentTrainSeasons.has(p.seasonName),
    );
    let improvementRecent = -Infinity;
    let recentSlope = 1;
    let recentTrainBase = allBase;
    if (recentTrain.length >= MIN_TRAIN_VOLUME) {
      recentSlope = olsSlope(
        recentTrain.map((p) => p.prob),
        recentTrain.map((p) => p.actual),
      );
      recentTrainBase =
        recentTrain.reduce((s, p) => s + p.actual, 0) / recentTrain.length;
      improvementRecent =
        brierIdentity -
        brier(
          test.map((p) => ({
            prob: shrink(p.prob, recentTrainBase, recentSlope),
            actual: p.actual,
          })),
        );
    }

    const useRecent =
      improvementRecent > improvementAll &&
      improvementRecent >= MIN_BRIER_IMPROVEMENT;
    const trainSlope = useRecent ? recentSlope : allSlope;
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

    const fullFactor = olsSlope(
      pts.map((p) => p.prob),
      pts.map((p) => p.actual),
    );
    const recentSeasons = new Set(seasonOrder.slice(useRecent ? -3 : -2));
    const recentPts = pts.filter((p) => recentSeasons.has(p.seasonName));
    const recentBase =
      recentPts.reduce((s, p) => s + p.actual, 0) / recentPts.length;
    const recentWindowSlope = useRecent
      ? olsSlope(
          recentPts.map((p) => p.prob),
          recentPts.map((p) => p.actual),
        )
      : fullFactor;

    shipped.push({
      competitionCode,
      trainN: train.length,
      testN: test.length,
      trainSlope,
      brierImprovement,
      fullFactor: Math.min(
        1,
        Math.max(0, useRecent ? recentWindowSlope : fullFactor),
      ),
      recentBase,
      fitWindow: useRecent ? "recent3" : "historique",
    });
  }

  shipped.sort((a, b) => a.competitionCode.localeCompare(b.competitionCode));

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration walk-forward BTTS");
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
      `${r.competitionCode.padEnd(6)} train n=${String(r.trainN).padEnd(5)} test n=${String(r.testN).padEnd(4)}  ` +
        `slope(train)=${r.trainSlope.toFixed(2)}  ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
        `→ factor(full)=${r.fullFactor.toFixed(2)} base(recent)=${r.recentBase.toFixed(2)} fit=${r.fitWindow}`,
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

  const jsonPath = join(reportsDir, "btts-shrinkage-shipped.json");
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
