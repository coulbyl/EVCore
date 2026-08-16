/// <reference types="node" />
/**
 * Calibration walk-forward de OVER_UNDER_HT (over/under buts 1ère mi-temps) —
 * même protocole que TEAM_TOTAL/RESULT_TOTAL_GOALS
 * (docs/data-poor-leagues-calibration.md) : régresser la probabilité Poisson
 * brute sur l'issue HT réelle par ligue+ligne, valider hors échantillon
 * (train = toutes saisons sauf la plus récente ; test = la plus récente),
 * ne livrer un bloc que si le Brier tenu-à-l'écart s'améliore d'au moins
 * 0.001 vs l'identité (factor=1).
 *
 * Contexte (2026-08-16) : `OverUnderHtStrategy` gate désormais sur
 * `SelectionConfig.htftCalibrated` (7 ligues : BL1/CH/L1/LL/PL/SA/EL1) —
 * aucune de ces 7 ligues n'a de bloc `ouHt` dans `OU_SHRINKAGE_CONFIG`
 * (audit fait en creusant pourquoi un rejeu historique produisait 0
 * sélection OVER_UNDER_HT malgré 2+ ans de cotes réelles depuis 2023) — le
 * canal ne peut donc jamais sélectionner quoi que ce soit dans les seules
 * ligues où il est autorisé à tourner. Ce script mesure si ces 7 ligues (et
 * les autres, au passage — pas de filtre a priori) clarent le seuil de
 * calibration walk-forward comme les autres l'ont déjà fait.
 *
 * Pas de dimension "side" ici (contrairement à TEAM_TOTAL) : OVER_UNDER_HT
 * est le total de buts du match à la mi-temps, pas par équipe — seulement
 * 2 lignes (0.5, 1.5), mêmes lignes que `getOverUnderHtLineConfigs`.
 *
 * Réutilise la même infrastructure de replay que
 * backtest-team-total-shrinkage-calibration.ts (TeamStats point-in-time,
 * pipeline réel deriveLambdas -> computePoissonMarkets, mêmes
 * simplifications documentées là-bas).
 *
 * Run: pnpm --filter @evcore/db db:backtest:over-under-ht-shrinkage-calibration
 * Output: packages/db/reports/backtest-over-under-ht-shrinkage-calibration-YYYY-MM-DD.txt
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

const LINES = ["0_5", "1_5"] as const;
type Line = (typeof LINES)[number];

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  seasonName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeHtScore: number;
  awayHtScore: number;
  competitionCode: string;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

type Point = {
  competitionCode: string;
  seasonName: string;
  scheduledAt: Date;
  line: Line;
  prob: number; // raw Poisson P(HT total over line)
  actualOver: 0 | 1;
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
    `backtest-over-under-ht-shrinkage-calibration-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("Chargement des fixtures terminées (score HT connu)...");
  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeHtScore: { not: null },
      awayHtScore: { not: null },
    },
    select: {
      id: true,
      scheduledAt: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeHtScore: true,
      awayHtScore: true,
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
    homeHtScore: f.homeHtScore!,
    awayHtScore: f.awayHtScore!,
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

  out("Replay du pipeline Poisson (total HT) par fixture...");
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

    const htTotal = fixture.homeHtScore + fixture.awayHtScore;
    for (const line of LINES) {
      const lineValue = Number(line.replace("_", "."));
      const over = markets.ouHT[`OVER_${line}`];
      if (over === undefined) continue;
      points.push({
        competitionCode: fixture.competitionCode,
        seasonName: fixture.seasonName,
        scheduledAt: fixture.scheduledAt,
        line,
        prob: over.toNumber(),
        actualOver: htTotal > lineValue ? 1 : 0,
      });
    }
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats).`,
  );

  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${p.competitionCode}::${p.line}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  type ShippedRow = {
    competitionCode: string;
    line: Line;
    trainN: number;
    testN: number;
    trainSlope: number;
    brierImprovement: number;
    fullFactor: number;
    recentBase: number;
  };
  const shipped: ShippedRow[] = [];
  const rejected: { key: string; reason: string }[] = [];

  for (const [key, pts] of groups) {
    const [competitionCode, line] = key.split("::") as [string, Line];

    const seasonOrder = Array.from(
      new Set(
        pts
          .slice()
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          .map((p) => p.seasonName),
      ),
    );
    if (seasonOrder.length < 2) {
      rejected.push({ key, reason: `1 seule saison (${pts.length} picks)` });
      continue;
    }

    const latestSeason = seasonOrder[seasonOrder.length - 1]!;
    const train = pts.filter((p) => p.seasonName !== latestSeason);
    const test = pts.filter((p) => p.seasonName === latestSeason);

    if (train.length < MIN_TRAIN_VOLUME || test.length < MIN_TEST_VOLUME) {
      rejected.push({
        key,
        reason: `volume insuffisant (train=${train.length}, test=${test.length})`,
      });
      continue;
    }

    const trainSlope = olsSlope(
      train.map((p) => p.prob),
      train.map((p) => p.actualOver),
    );
    const trainBase =
      train.reduce((s, p) => s + p.actualOver, 0) / train.length;

    const testIdentity = test.map((p) => ({ prob: p.prob, actual: p.actualOver }));
    const testShrunk = test.map((p) => ({
      prob: shrink(p.prob, trainBase, trainSlope),
      actual: p.actualOver,
    }));

    const testBrierIdentity = brier(testIdentity);
    const testBrierShrunk = brier(testShrunk);
    const brierImprovement = testBrierIdentity - testBrierShrunk;

    if (brierImprovement < MIN_BRIER_IMPROVEMENT) {
      rejected.push({
        key,
        reason: `ΔBrier insuffisant (${brierImprovement >= 0 ? "+" : ""}${brierImprovement.toFixed(4)})`,
      });
      continue;
    }

    const fullFactor = olsSlope(
      pts.map((p) => p.prob),
      pts.map((p) => p.actualOver),
    );
    const recentSeasons = new Set(seasonOrder.slice(-2));
    const recentPts = pts.filter((p) => recentSeasons.has(p.seasonName));
    const recentBase =
      recentPts.reduce((s, p) => s + p.actualOver, 0) / recentPts.length;

    shipped.push({
      competitionCode,
      line,
      trainN: train.length,
      testN: test.length,
      trainSlope,
      brierImprovement,
      fullFactor: Math.min(1, Math.max(0, fullFactor)),
      recentBase,
    });
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration walk-forward OVER_UNDER_HT");
  out(
    `  ${dateLabel} — train=toutes saisons sauf la + récente, test=la + récente`,
  );
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `${shipped.length} bloc(s) livré(s) sur ${groups.size} combinaisons (compétition×ligne) observées ` +
      `(${rejected.length} rejetés : volume insuffisant ou pas d'amélioration Brier).`,
  );
  out();

  const HTFT_CALIBRATED_LEAGUES = new Set([
    "BL1",
    "CH",
    "L1",
    "LL",
    "PL",
    "SA",
    "EL1",
  ]);

  shipped.sort(
    (a, b) =>
      a.competitionCode.localeCompare(b.competitionCode) ||
      a.line.localeCompare(b.line),
  );

  for (const r of shipped) {
    const flag = HTFT_CALIBRATED_LEAGUES.has(r.competitionCode) ? " *" : "";
    out(
      `${r.competitionCode.padEnd(6)} ${r.line.padEnd(4)}  ` +
        `train n=${String(r.trainN).padEnd(5)} test n=${String(r.testN).padEnd(4)}  ` +
        `slope(train)=${r.trainSlope.toFixed(2)}  ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
        `→ factor(full)=${r.fullFactor.toFixed(2)} base(recent)=${r.recentBase.toFixed(2)}${flag}`,
    );
  }
  out();
  out(
    "  (* = une des 7 ligues htftCalibrated — BL1/CH/L1/LL/PL/SA/EL1 — celles où",
  );
  out(
    "     OverUnderHtStrategy/FirstHalfWinnerStrategy/HalfTimeFullTimeStrategy",
    );
  out("     ont le droit de tourner.)");

  out();
  out("--- Config générée (à coller/fusionner dans OU_SHRINKAGE_CONFIG) ---");
  out();
  const byCompetition = new Map<string, ShippedRow[]>();
  for (const r of shipped) {
    const arr = byCompetition.get(r.competitionCode) ?? [];
    arr.push(r);
    byCompetition.set(r.competitionCode, arr);
  }
  for (const [code, rows] of Array.from(byCompetition.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const r05 = rows.find((r) => r.line === "0_5");
    const r15 = rows.find((r) => r.line === "1_5");
    out(`// ${code}:`);
    out(
      `//   ouHt: { ${r05 ? `factor05: ${r05.fullFactor.toFixed(2)}, base05: ${r05.recentBase.toFixed(2)}` : "/* 0_5 non concluant */"}, ` +
        `${r15 ? `factor15: ${r15.fullFactor.toFixed(2)}, base15: ${r15.recentBase.toFixed(2)}` : "/* 1_5 non concluant */"} },`,
    );
    out();
  }

  out("--- Rejetés (diagnostic) ---");
  for (const r of rejected.sort((a, b) => a.key.localeCompare(b.key))) {
    out(`  ${r.key}: ${r.reason}`);
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
