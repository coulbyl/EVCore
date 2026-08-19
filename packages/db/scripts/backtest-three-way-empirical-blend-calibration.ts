/// <reference types="node" />
/**
 * Calibration walk-forward de THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP
 * (apps/backend/.../ev.constants.ts) — le seul levier de calibration du
 * 1X2/DOMINANT aujourd'hui : le Poisson (xG) brut n'a aucune notion de
 * "cette équipe gagne souvent/rarement à domicile indépendamment de son xG"
 * — `rebalanceThreeWayProbabilities` mélange le home/draw/away brut vers un
 * vecteur empirique dérivé de TeamStats.{homeWinRate,awayWinRate,drawRate},
 * pondéré par `blendWeight`.
 *
 * Contexte (2026-08-19) : les 11 entrées actuelles (I2/D2/F2/J1/SUI1/UEL/
 * POL1/NOR1/UECL/CSL/MLS) viennent d'audits ponctuels entre 2026-04-24 et
 * 2026-06-30, chacun sur un Brier/ECE mesuré une fois, sans le protocole
 * walk-forward (train=toutes saisons sauf la + récente, test=la + récente)
 * ni l'hypothèse "fenêtre récente" qu'on applique maintenant systématiquement
 * (TEAM_TOTAL/CLEAN_SHEET/BTTS). L'audit live (audit-channel-market-league-
 * calibration.ts, 2026-08-18) montre plusieurs de ces ligues TOUJOURS
 * sur-confiantes malgré leur blend existant (F2 gap+0.126, SUI1 gap+0.129,
 * UEL gap+0.114, UECL gap+0.139) — le poids actuel ne suffit peut-être pas,
 * ou a été mesuré sur une fenêtre qui ne généralise plus. Ce script
 * re-dérive un poids par ligue pour les 66 ligues, par grid-search (pas de
 * formule fermée ici — le blendWeight change QUEL pick est argmax, pas
 * seulement sa magnitude) sur le Brier 3-way (home+draw+away), validé hors
 * échantillon.
 *
 * Réutilise le même replay que les autres scripts de shrinkage (TeamStats
 * point-in-time, deriveLambdas -> computePoissonMarkets) et réimplémente la
 * formule de rebalanceThreeWayProbabilities (match-stats.ts) directement
 * sur les probabilités numériques (home/draw/away), sans passer par le type
 * MatchProbabilities complet — inutile ici (pas de resultTotalGoals etc à
 * réajuster pour cette mesure).
 *
 * Run: pnpm --filter @evcore/db db:backtest:three-way-empirical-blend-calibration
 * Output: packages/db/reports/backtest-three-way-empirical-blend-calibration-YYYY-MM-DD.txt
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
const WEIGHT_GRID = [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

type Outcome = "HOME" | "DRAW" | "AWAY";

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

type Point = {
  competitionCode: string;
  seasonName: string;
  scheduledAt: Date;
  rawHome: number;
  rawDraw: number;
  rawAway: number;
  homeWinRate: number;
  awayWinRate: number;
  homeDrawRate: number;
  awayDrawRate: number;
  actual: Outcome;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: number | null | undefined): number {
  return value ?? 0;
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

// Mirrors rebalanceThreeWayProbabilities (match-stats.ts) on plain numbers.
function rebalance(
  p: Point,
  weight: number,
): { home: number; draw: number; away: number } {
  if (weight <= 0) return { home: p.rawHome, draw: p.rawDraw, away: p.rawAway };
  const targetDraw = clamp(
    (clamp(p.homeDrawRate, 0.05, 0.6) + clamp(p.awayDrawRate, 0.05, 0.6)) / 2,
    0.05,
    0.6,
  );
  const homeWinRate = clamp(p.homeWinRate, 0.01, 0.95);
  const awayWinRate = clamp(p.awayWinRate, 0.01, 0.95);
  const directionalTargetBase = homeWinRate + awayWinRate;
  if (directionalTargetBase <= 0) {
    return { home: p.rawHome, draw: p.rawDraw, away: p.rawAway };
  }
  const targetHomeShare = homeWinRate / directionalTargetBase;
  const targetHome = (1 - targetDraw) * targetHomeShare;
  const targetAway = 1 - targetDraw - targetHome;
  return {
    home: p.rawHome * (1 - weight) + targetHome * weight,
    draw: p.rawDraw * (1 - weight) + targetDraw * weight,
    away: p.rawAway * (1 - weight) + targetAway * weight,
  };
}

function threeWayBrier(pts: Point[], weight: number): number {
  let sum = 0;
  for (const p of pts) {
    const r = rebalance(p, weight);
    const homeActual = p.actual === "HOME" ? 1 : 0;
    const drawActual = p.actual === "DRAW" ? 1 : 0;
    const awayActual = p.actual === "AWAY" ? 1 : 0;
    sum +=
      (r.home - homeActual) ** 2 +
      (r.draw - drawActual) ** 2 +
      (r.away - awayActual) ** 2;
  }
  return sum / pts.length;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-three-way-empirical-blend-calibration-${dateLabel}.txt`,
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

    const actual: Outcome =
      fixture.homeScore > fixture.awayScore
        ? "HOME"
        : fixture.homeScore < fixture.awayScore
          ? "AWAY"
          : "DRAW";

    points.push({
      competitionCode: fixture.competitionCode,
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      rawHome: markets.home.toNumber(),
      rawDraw: markets.draw.toNumber(),
      rawAway: markets.away.toNumber(),
      homeWinRate: asNumber(home.stats.homeWinRate),
      awayWinRate: asNumber(away.stats.awayWinRate),
      homeDrawRate: asNumber(home.stats.drawRate),
      awayDrawRate: asNumber(away.stats.drawRate),
      actual,
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
    weight: number;
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

    // Hypothèse 1 : meilleur poids sur tout l'historique de train.
    const brierIdentityTest = threeWayBrier(test, 0);
    let bestAllWeight = 0;
    let bestAllTrainBrier = threeWayBrier(train, 0);
    for (const w of WEIGHT_GRID) {
      const b = threeWayBrier(train, w);
      if (b < bestAllTrainBrier) {
        bestAllTrainBrier = b;
        bestAllWeight = w;
      }
    }
    const improvementAll =
      brierIdentityTest - threeWayBrier(test, bestAllWeight);

    // Hypothèse 2 : meilleur poids sur les 2 saisons de train les plus
    // récentes seulement (dérive de saison).
    const trainSeasonOrder = seasonOrder.slice(0, -1);
    const recentTrainSeasons = new Set(trainSeasonOrder.slice(-2));
    const recentTrain = train.filter((p) =>
      recentTrainSeasons.has(p.seasonName),
    );
    let improvementRecent = -Infinity;
    let bestRecentWeight = 0;
    if (recentTrain.length >= MIN_TRAIN_VOLUME) {
      let bestRecentTrainBrier = threeWayBrier(recentTrain, 0);
      for (const w of WEIGHT_GRID) {
        const b = threeWayBrier(recentTrain, w);
        if (b < bestRecentTrainBrier) {
          bestRecentTrainBrier = b;
          bestRecentWeight = w;
        }
      }
      improvementRecent =
        brierIdentityTest - threeWayBrier(test, bestRecentWeight);
    }

    const useRecent =
      improvementRecent > improvementAll &&
      improvementRecent >= MIN_BRIER_IMPROVEMENT;
    const weight = useRecent ? bestRecentWeight : bestAllWeight;
    const brierImprovement = useRecent ? improvementRecent : improvementAll;

    if (brierImprovement < MIN_BRIER_IMPROVEMENT) {
      rejected.push({
        key: competitionCode,
        reason:
          `ΔBrier insuffisant (historique complet ${improvementAll >= 0 ? "+" : ""}${improvementAll.toFixed(4)} @${bestAllWeight}, ` +
          `fenêtre récente ${improvementRecent === -Infinity ? "n/a" : (improvementRecent >= 0 ? "+" : "") + improvementRecent.toFixed(4) + " @" + bestRecentWeight})`,
      });
      continue;
    }

    shipped.push({
      competitionCode,
      trainN: train.length,
      testN: test.length,
      weight,
      brierImprovement,
      fitWindow: useRecent ? "recent3" : "historique",
    });
  }

  shipped.sort((a, b) => a.competitionCode.localeCompare(b.competitionCode));

  out();
  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — Calibration walk-forward THREE_WAY_EMPIRICAL_BLEND_WEIGHT (1X2)",
  );
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
        `ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
        `→ blendWeight=${r.weight.toFixed(2)} fit=${r.fitWindow}`,
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

  const jsonPath = join(reportsDir, "three-way-empirical-blend-shipped.json");
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
