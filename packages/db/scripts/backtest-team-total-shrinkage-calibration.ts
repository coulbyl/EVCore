/// <reference types="node" />
/**
 * Calibration walk-forward de TEAM_TOTAL_HOME/AWAY — même protocole que
 * OU_SHRINKAGE_CONFIG pour l'O/U plein temps (docs/data-poor-leagues-calibration.md) :
 * régresser la probabilité Poisson brute sur l'issue réelle par ligue+ligne,
 * valider hors échantillon (train = toutes saisons sauf la plus récente ;
 * test = la plus récente), ne livrer un bloc que si le Brier tenu-à-l'écart
 * s'améliore d'au moins 0.001 vs l'identité (factor=1).
 *
 * Contexte : audit 2026-08-13 a confirmé en DB que TEAM_TOTAL_AWAY UNDER_1_5
 * est structurellement surconfiant (ROI réel +0.75% malgré EV affiché
 * +22.4%) — même motif que l'O/U avant shrinkage. Le mécanisme de shrinkage
 * a été câblé le 2026-08-15 (ou-shrinkage.ts, teamTotalHome/teamTotalAway)
 * sans aucun facteur — ce script produit les facteurs/base rates mesurés à
 * coller dans OU_SHRINKAGE_CONFIG.
 *
 * Réutilise la même infrastructure de replay que
 * backtest-new-markets-calibration.ts (TeamStats point-in-time, pipeline
 * réel deriveLambdas -> computePoissonMarkets), simplifications identiques
 * documentées là-bas (LambdaConfig par défaut, pas de blend 1X2 — sans
 * incidence ici, TEAM_TOTAL ne dépend que du marginal Poisson par équipe).
 *
 * Run: pnpm --filter @evcore/db db:backtest:team-total-shrinkage-calibration
 * Output: packages/db/reports/backtest-team-total-shrinkage-calibration-YYYY-MM-DD.txt
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

// Ship a block only if it clears both: (a) minimum train+test volume to
// trust the regression, (b) held-out Brier improvement.
const MIN_TRAIN_VOLUME = 60;
const MIN_TEST_VOLUME = 20;
const MIN_BRIER_IMPROVEMENT = 0.001;

const LINES = ["0_5", "1_5", "2_5", "3_5", "4_5"] as const;
type Line = (typeof LINES)[number];
type Side = "HOME" | "AWAY";

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
  side: Side;
  line: Line;
  prob: number; // raw Poisson P(over line)
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

// Calibration slope: OLS slope of actual (0/1) on predicted probability.
// Same definition as OU_SHRINKAGE_CONFIG's per-league factor — a slope of
// 1 means the model's probability moves 1:1 with reality (well calibrated);
// a slope of 0.25 means only a quarter of a probability swing is real.
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
    `backtest-team-total-shrinkage-calibration-${dateLabel}.txt`,
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
      season: { select: { name: true, competition: { select: { code: true } } } },
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

  out("Replay du pipeline Poisson (marginal par équipe) par fixture...");
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

    for (const line of LINES) {
      const lineValue = Number(line.replace("_", "."));
      const homeOver = markets.teamTotalHome[`OVER_${line}`];
      if (homeOver !== undefined) {
        points.push({
          competitionCode: fixture.competitionCode,
          seasonName: fixture.seasonName,
          scheduledAt: fixture.scheduledAt,
          side: "HOME",
          line,
          prob: homeOver.toNumber(),
          actualOver: fixture.homeScore > lineValue ? 1 : 0,
        });
      }
      const awayOver = markets.teamTotalAway[`OVER_${line}`];
      if (awayOver !== undefined) {
        points.push({
          competitionCode: fixture.competitionCode,
          seasonName: fixture.seasonName,
          scheduledAt: fixture.scheduledAt,
          side: "AWAY",
          line,
          prob: awayOver.toNumber(),
          actualOver: fixture.awayScore > lineValue ? 1 : 0,
        });
      }
    }
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats).`,
  );

  // Group by (competition, side, line).
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${p.competitionCode}::${p.side}::${p.line}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  type ShippedRow = {
    competitionCode: string;
    side: Side;
    line: Line;
    trainN: number;
    testN: number;
    trainSlope: number;
    testBrierIdentity: number;
    testBrierShrunk: number;
    brierImprovement: number;
    fullFactor: number;
    recentBase: number;
  };
  const shipped: ShippedRow[] = [];
  const rejected: { key: string; reason: string }[] = [];

  for (const [key, pts] of groups) {
    const [competitionCode, side, line] = key.split("::") as [
      string,
      Side,
      Line,
    ];

    // Chronological season order for this (competition) via first-seen scheduledAt.
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
    const trainBase = train.reduce((s, p) => s + p.actualOver, 0) / train.length;

    const testIdentity = test.map((p) => ({
      prob: p.prob,
      actual: p.actualOver,
    }));
    const testShrunk = test.map((p) => ({
      prob: shrink(p.prob, trainBase, trainSlope),
      actual: p.actualOver,
    }));

    const testBrierIdentity = brier(testIdentity);
    const testBrierShrunk = brier(testShrunk);
    const brierImprovement = testBrierIdentity - testBrierShrunk; // positive = shrink is better

    if (brierImprovement < MIN_BRIER_IMPROVEMENT) {
      rejected.push({
        key,
        reason: `ΔBrier insuffisant (${brierImprovement >= 0 ? "+" : ""}${brierImprovement.toFixed(4)})`,
      });
      continue;
    }

    // Re-fit on the full sample for the production factor; base rate from
    // the 2 most recent seasons of the full sample (or all if only 2 total).
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
      side,
      line,
      trainN: train.length,
      testN: test.length,
      trainSlope,
      testBrierIdentity,
      testBrierShrunk,
      brierImprovement,
      fullFactor: Math.min(1, Math.max(0, fullFactor)),
      recentBase,
    });
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration walk-forward TEAM_TOTAL_HOME/AWAY");
  out(`  ${dateLabel} — train=toutes saisons sauf la + récente, test=la + récente`);
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `${shipped.length} bloc(s) livré(s) sur ${groups.size} combinaisons (compétition×côté×ligne) observées ` +
      `(${rejected.length} rejetés : volume insuffisant ou pas d'amélioration Brier).`,
  );
  out();

  shipped.sort(
    (a, b) =>
      a.competitionCode.localeCompare(b.competitionCode) ||
      a.side.localeCompare(b.side) ||
      a.line.localeCompare(b.line),
  );

  for (const r of shipped) {
    out(
      `${r.competitionCode.padEnd(6)} ${r.side.padEnd(5)} ${r.line.padEnd(4)}  ` +
        `train n=${String(r.trainN).padEnd(5)} test n=${String(r.testN).padEnd(4)}  ` +
        `slope(train)=${r.trainSlope.toFixed(2)}  ΔBrier(test)=${r.brierImprovement >= 0 ? "-" : "+"}${Math.abs(r.brierImprovement).toFixed(4)}  ` +
        `→ factor(full)=${r.fullFactor.toFixed(2)} base(recent)=${r.recentBase.toFixed(2)}`,
    );
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
  for (const [code, rows] of Array.from(byCompetition.entries()).sort(
    (a, b) => a[0].localeCompare(b[0]),
  )) {
    const homeLines = rows.filter((r) => r.side === "HOME");
    const awayLines = rows.filter((r) => r.side === "AWAY");
    out(`// ${code}:`);
    if (homeLines.length > 0) {
      out(`//   teamTotalHome: {`);
      for (const r of homeLines) {
        out(
          `//     "${r.line.replace("_", "")}": { factor: ${r.fullFactor.toFixed(2)}, base: ${r.recentBase.toFixed(2)} },`,
        );
      }
      out(`//   },`);
    }
    if (awayLines.length > 0) {
      out(`//   teamTotalAway: {`);
      for (const r of awayLines) {
        out(
          `//     "${r.line.replace("_", "")}": { factor: ${r.fullFactor.toFixed(2)}, base: ${r.recentBase.toFixed(2)} },`,
        );
      }
      out(`//   },`);
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
