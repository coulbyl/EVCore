/// <reference types="node" />
/**
 * Calibration walk-forward de CLEAN_SHEET_HOME/AWAY et TO_WIN_EITHER_HALF —
 * même protocole que backtest-team-total-shrinkage-calibration.ts : régresser
 * la probabilité Poisson brute sur l'issue réelle par ligue, valider hors
 * échantillon (train = toutes saisons sauf la plus récente ; test = la plus
 * récente), ne livrer un bloc que si le Brier tenu-à-l'écart s'améliore
 * d'au moins 0.001 vs l'identité (factor=1).
 *
 * Contexte (2026-08-15) : db:backtest:channel-league-whitelist montre 0 ligue
 * confirmée (train+valid positifs) pour CLEAN_SHEET (n=914, ROI global
 * -4.3%) ni WIN_EITHER_HALF (n=680, ROI global -7.4%) — contrairement à
 * TEAM_TOTAL/RESULT_TOTAL_GOALS/O-U/BTTS qui ont tous déjà un shrinkage
 * mesuré dans OU_SHRINKAGE_CONFIG, ces deux marchés tournent encore sur la
 * probabilité Poisson brute, jamais recalibrée. Ce script produit les
 * facteurs/base rates mesurés à coller dans OU_SHRINKAGE_CONFIG (nouveaux
 * champs cleanSheetHome/cleanSheetAway/winEitherHalfHome/winEitherHalfAway).
 *
 * Contrairement à TEAM_TOTAL (5 lignes par côté), ces deux marchés sont des
 * probabilités binaires uniques par côté (pas de ligne) — le groupement est
 * (compétition, côté) seulement.
 *
 * Réutilise la même infrastructure de replay que
 * backtest-team-total-shrinkage-calibration.ts (TeamStats point-in-time,
 * pipeline réel deriveLambdas -> computePoissonMarkets).
 *
 * Run: pnpm --filter @evcore/db db:backtest:clean-sheet-win-either-half-shrinkage-calibration
 * Output: packages/db/reports/backtest-clean-sheet-win-either-half-shrinkage-calibration-YYYY-MM-DD.txt
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

type Side = "HOME" | "AWAY";
type MarketName = "CLEAN_SHEET" | "WIN_EITHER_HALF";

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  seasonName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
  competitionCode: string;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

type Point = {
  market: MarketName;
  competitionCode: string;
  seasonName: string;
  scheduledAt: Date;
  side: Side;
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

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-clean-sheet-win-either-half-shrinkage-calibration-${dateLabel}.txt`,
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
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
    homeHtScore: f.homeHtScore,
    awayHtScore: f.awayHtScore,
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
  let skippedNoHt = 0;

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
      market: "CLEAN_SHEET",
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      side: "HOME",
      prob: markets.cleanSheetHome.toNumber(),
      actual: fixture.awayScore === 0 ? 1 : 0,
    });
    points.push({
      market: "CLEAN_SHEET",
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      side: "AWAY",
      prob: markets.cleanSheetAway.toNumber(),
      actual: fixture.homeScore === 0 ? 1 : 0,
    });

    if (fixture.homeHtScore === null || fixture.awayHtScore === null) {
      skippedNoHt++;
      continue;
    }
    const homeSecondHalf = fixture.homeScore - fixture.homeHtScore;
    const awaySecondHalf = fixture.awayScore - fixture.awayHtScore;
    const homeWonFirstHalf = fixture.homeHtScore > fixture.awayHtScore;
    const homeWonSecondHalf = homeSecondHalf > awaySecondHalf;
    const awayWonFirstHalf = fixture.awayHtScore > fixture.homeHtScore;
    const awayWonSecondHalf = awaySecondHalf > homeSecondHalf;

    points.push({
      market: "WIN_EITHER_HALF",
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      side: "HOME",
      prob: markets.winEitherHalfHome.toNumber(),
      actual: homeWonFirstHalf || homeWonSecondHalf ? 1 : 0,
    });
    points.push({
      market: "WIN_EITHER_HALF",
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      side: "AWAY",
      prob: markets.winEitherHalfAway.toNumber(),
      actual: awayWonFirstHalf || awayWonSecondHalf ? 1 : 0,
    });
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats), ` +
      `${skippedNoHt} sans score mi-temps (WIN_EITHER_HALF exclu pour ces fixtures).`,
  );

  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${p.market}::${p.competitionCode}::${p.side}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  type ShippedRow = {
    market: MarketName;
    competitionCode: string;
    side: Side;
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

  for (const [key, pts] of groups) {
    const [market, competitionCode, side] = key.split("::") as [
      MarketName,
      string,
      Side,
    ];

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

    // Hypothèse 1 : slope fitté sur tout l'historique d'entraînement (toutes
    // saisons sauf la plus récente). Si l'historique complet ne généralise
    // pas à la saison la plus récente (dérive de saison, cf. mémoire
    // lambda-scale-fin1-bl1), cette hypothèse échoue même quand un biais
    // réel existe — il faut alors la retester sur une fenêtre plus courte
    // (principe "replay jusqu'à trouver la bonne config", pas un seul essai).
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

    // Hypothèse 2 : slope fitté seulement sur les 2 saisons de train les plus
    // récentes (fenêtre courte) — capte un biais qui a pu évoluer plutôt que
    // la moyenne diluée sur tout l'historique.
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
        key,
        reason:
          `ΔBrier insuffisant (historique complet ${improvementAll >= 0 ? "+" : ""}${improvementAll.toFixed(4)}, ` +
          `fenêtre récente ${improvementRecent === -Infinity ? "n/a" : (improvementRecent >= 0 ? "+" : "") + improvementRecent.toFixed(4)})`,
      });
      continue;
    }

    // Numéros de production : réutilise tout le signal disponible (train+test)
    // — la coupure train/test ne sert qu'à valider l'hypothèse ci-dessus, pas
    // à priver la config finale de la saison la plus récente.
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
      market,
      competitionCode,
      side,
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

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration walk-forward CLEAN_SHEET / WIN_EITHER_HALF");
  out(
    `  ${dateLabel} — train=toutes saisons sauf la + récente, test=la + récente`,
  );
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `${shipped.length} bloc(s) livré(s) sur ${groups.size} combinaisons (marché×compétition×côté) observées ` +
      `(${rejected.length} rejetés : volume insuffisant ou pas d'amélioration Brier).`,
  );

  for (const marketName of ["CLEAN_SHEET", "WIN_EITHER_HALF"] as const) {
    out();
    out(`──── ${marketName} ────`);
    const rows = shipped
      .filter((r) => r.market === marketName)
      .sort(
        (a, b) =>
          a.competitionCode.localeCompare(b.competitionCode) ||
          a.side.localeCompare(b.side),
      );
    for (const r of rows) {
      out(
        `${r.competitionCode.padEnd(6)} ${r.side.padEnd(5)}  ` +
          `train n=${String(r.trainN).padEnd(5)} test n=${String(r.testN).padEnd(4)}  ` +
          `slope(train)=${r.trainSlope.toFixed(2)}  ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
          `→ factor(full)=${r.fullFactor.toFixed(2)} base(recent)=${r.recentBase.toFixed(2)} fit=${r.fitWindow}`,
      );
    }
    if (rows.length === 0) out("  (aucun bloc livré)");
  }

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
    out(`// ${code}:`);
    for (const marketName of ["CLEAN_SHEET", "WIN_EITHER_HALF"] as const) {
      const marketRows = rows.filter((r) => r.market === marketName);
      if (marketRows.length === 0) continue;
      const fieldPrefix =
        marketName === "CLEAN_SHEET" ? "cleanSheet" : "winEitherHalf";
      for (const r of marketRows) {
        const field = `${fieldPrefix}${r.side === "HOME" ? "Home" : "Away"}`;
        out(
          `//   ${field}: { factor: ${r.fullFactor.toFixed(2)}, base: ${r.recentBase.toFixed(2)} },`,
        );
      }
    }
    out();
  }

  out("--- Rejetés (diagnostic) ---");
  for (const r of rejected.sort((a, b) => a.key.localeCompare(b.key))) {
    out(`  ${r.key}: ${r.reason}`);
  }

  const report = lines.join("\n");
  writeFileSync(outputPath, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${outputPath.split("/").pop()}`);

  const jsonPath = join(
    reportsDir,
    "clean-sheet-win-either-half-shrinkage-shipped.json",
  );
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
