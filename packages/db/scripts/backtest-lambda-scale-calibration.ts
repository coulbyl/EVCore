/// <reference types="node" />
/**
 * Grid-search de `LAMBDA_SCALE_MAP` (apps/backend/.../ev.constants.ts) pour
 * les ligues repérées cette session avec un biais de sous-comptage de buts
 * STABLE sur plusieurs saisons complètes (pas juste un écart moyen — le
 * signe du gap doit être constant saison par saison, même critère que les
 * entrées existantes du projet, cf. commentaire "direction is stable across
 * 3-4 seasons" dans ev.constants.ts) :
 *
 *   - FIN1 (Veikkausliiga) : gap +5.4% / +0.2% / +7.5% / +38.4% (saison en
 *     cours, n=50) — stable, jamais négatif, en accélération. Aucune
 *     correction lambda existante (ni LEAGUE_MEAN_LAMBDA_MAP ni
 *     LAMBDA_SCALE_MAP) — seul un facteur OU_SHRINKAGE_CONFIG=1 (no-op sur
 *     les lignes plein temps) est en place.
 *   - BL1 (Bundesliga) : gap +0.042/+0.071/+0.112 but/match (2023-24 →
 *     2025-26) — stable et croissant, MALGRÉ l'ancre meanLambda déjà relevée
 *     à 1.7 (LEAGUE_MEAN_LAMBDA_MAP.BL1) : l'ancre existante ne suffit plus.
 *
 * Méthodologie identique à `LAMBDA_SCALE_MAP` existant : minimiser le Brier
 * combiné OVER 2.5 + BTTS sur train (split chronologique 70/30), valider une
 * fois sur validation — pas de re-fit sur validation.
 *
 * Run: pnpm --filter @evcore/db db:backtest:lambda-scale-calibration
 * Output: packages/db/reports/backtest-lambda-scale-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computePoissonMarkets,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const SHRINKAGE_FACTOR = 0.7; // LAMBDA_SHRINKAGE_FACTOR
const HOME_FACTOR = 1.0; // HOME_ADVANTAGE_LAMBDA_FACTOR
const AWAY_FACTOR = 0.75; // AWAY_DISADVANTAGE_LAMBDA_FACTOR
const LEAGUE_MEAN_LAMBDA_DEFAULT = 1.4;
// Mirrors ev.constants.ts LEAGUE_MEAN_LAMBDA_MAP for the two target leagues
// only — BL1 already has an anchor correction (1.7); FIN1 has none (1.4
// default). Kept in sync manually; if ev.constants.ts changes these values,
// update here too.
const LEAGUE_MEAN_LAMBDA: Record<string, number> = {
  BL1: 1.7,
};
const TRAIN_FRACTION = 0.7;
const SCALE_GRID: number[] = Array.from(
  { length: 21 },
  (_, i) => Math.round((0.9 + i * 0.02) * 100) / 100,
);
const TARGET_LEAGUES = ["FIN1", "BL1"];

type FixtureRow = {
  scheduledAt: Date;
  seasonId: string;
  competitionCode: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rawLambdas(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
  meanLambda: number,
): { rawHome: number; rawAway: number } {
  const hFor = toNum(homeStats.xgFor);
  const aFor = toNum(awayStats.xgFor);
  const hAgainst = toNum(homeStats.xgAgainst);
  const aAgainst = toNum(awayStats.xgAgainst);
  const leagueAvg = Math.max(0.5, (hFor + aFor + hAgainst + aAgainst) / 4);
  const rawHome =
    SHRINKAGE_FACTOR * ((hFor * aAgainst) / leagueAvg) +
    (1 - SHRINKAGE_FACTOR) * meanLambda;
  const rawAway =
    SHRINKAGE_FACTOR * ((aFor * hAgainst) / leagueAvg) +
    (1 - SHRINKAGE_FACTOR) * meanLambda;
  return { rawHome, rawAway };
}

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

function brier(pairs: { actual: 0 | 1; prob: number }[]): number {
  const sum = pairs.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0);
  return sum / pairs.length;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-lambda-scale-calibration-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out(`Chargement des fixtures terminées pour ${TARGET_LEAGUES.join(", ")}...`);
  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      season: { competition: { code: { in: TARGET_LEAGUES } } },
    },
    select: {
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
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    competitionCode: f.season.competition.code,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
  }));
  out(`  ${fixtures.length} fixtures trouvées.`);

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

  type Point = {
    lambdaHome: number;
    lambdaAway: number;
    over25Actual: 0 | 1;
    bttsActual: 0 | 1;
  };
  const pointsByLeague = new Map<string, Point[]>();

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
      continue;
    }
    const meanLambda =
      LEAGUE_MEAN_LAMBDA[fixture.competitionCode] ?? LEAGUE_MEAN_LAMBDA_DEFAULT;
    const { rawHome, rawAway } = rawLambdas(home.stats, away.stats, meanLambda);
    const lambdaHome = clamp(rawHome * HOME_FACTOR, 0.05, 5);
    const lambdaAway = clamp(rawAway * AWAY_FACTOR, 0.05, 5);

    const arr = pointsByLeague.get(fixture.competitionCode) ?? [];
    arr.push({
      lambdaHome,
      lambdaAway,
      over25Actual: fixture.homeScore + fixture.awayScore >= 3 ? 1 : 0,
      bttsActual: fixture.homeScore > 0 && fixture.awayScore > 0 ? 1 : 0,
    });
    pointsByLeague.set(fixture.competitionCode, arr);
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — calibration LAMBDA_SCALE_MAP (OVER 2.5 + BTTS Brier combiné)",
  );
  out(`  ${dateLabel}`);
  out("═══════════════════════════════════════════════════════");

  for (const league of TARGET_LEAGUES) {
    const points = pointsByLeague.get(league) ?? [];
    out();
    out(
      `--- ${league} (meanLambda anchor=${LEAGUE_MEAN_LAMBDA[league] ?? LEAGUE_MEAN_LAMBDA_DEFAULT}) ---`,
    );
    out(`  n=${points.length}`);
    if (points.length < 100) {
      out(`  Échantillon insuffisant (<100), non concluant.`);
      continue;
    }

    const splitIdx = Math.floor(points.length * TRAIN_FRACTION);
    const train = points.slice(0, splitIdx);
    const validation = points.slice(splitIdx);

    const briefFor = (pts: Point[], scale: number) => {
      const pairs: { actual: 0 | 1; prob: number }[] = [];
      for (const p of pts) {
        const markets = computePoissonMarkets(
          p.lambdaHome * scale,
          p.lambdaAway * scale,
        );
        pairs.push({ actual: p.over25Actual, prob: markets.over25.toNumber() });
        pairs.push({ actual: p.bttsActual, prob: markets.bttsYes.toNumber() });
      }
      return brier(pairs);
    };

    const baselineTrainBrier = briefFor(train, 1);
    let bestScale = 1;
    let bestTrainBrier = baselineTrainBrier;
    for (const scale of SCALE_GRID) {
      const b = briefFor(train, scale);
      if (b < bestTrainBrier) {
        bestTrainBrier = b;
        bestScale = scale;
      }
    }
    out(
      `  Brier baseline (train, scale=1)   : ${baselineTrainBrier.toFixed(6)}`,
    );
    out(
      `  Meilleur scale (train)            : ${bestScale.toFixed(2)}  →  Brier ${bestTrainBrier.toFixed(6)}`,
    );

    const baselineValBrier = briefFor(validation, 1);
    const correctedValBrier = briefFor(validation, bestScale);
    const delta = correctedValBrier - baselineValBrier;
    out(
      `  Brier baseline (validation, scale=1)     : ${baselineValBrier.toFixed(6)}`,
    );
    out(
      `  Brier corrigé (validation, scale=${bestScale.toFixed(2)})   : ${correctedValBrier.toFixed(6)}`,
    );
    out(
      `  Delta Brier (négatif=gain réel)   : ${delta >= 0 ? "+" : ""}${delta.toFixed(6)}`,
    );

    const verdict =
      bestScale === 1 || delta >= 0
        ? "pas de gain hors échantillon — ne pas activer"
        : "gain hors échantillon confirmé — candidat à activation";
    out(`  Verdict : ${verdict}`);

    // Convention du projet (LAMBDA_SCALE_MAP) : magnitudes plafonnées à
    // ±0.10 (cf. ISL1, fitté 1.20 mais capé à 1.10). Toujours reporter le
    // gain au plafond, même si l'optimum brut le dépasse.
    if (Math.abs(bestScale - 1) > 0.1) {
      const cappedScale = bestScale > 1 ? 1.1 : 0.9;
      const cappedValBrier = briefFor(validation, cappedScale);
      const cappedDelta = cappedValBrier - baselineValBrier;
      out(
        `  [plafond convention ±0.10] scale=${cappedScale.toFixed(2)} → Brier validation ${cappedValBrier.toFixed(6)} (delta ${cappedDelta >= 0 ? "+" : ""}${cappedDelta.toFixed(6)})`,
      );
    }
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
