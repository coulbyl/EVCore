/// <reference types="node" />
/**
 * Audit et calibration légère du goal model FRI.
 *
 * - Charge les fixtures FRI senior terminées
 * - Récupère les snapshots Elo historiques avant chaque fixture
 * - Grid-search simple sur les paramètres du goal model
 * - Score sur BTTS / OVER 2.5 / total goals MAE
 *
 * Run: pnpm --filter @evcore/db db:audit:fri-goals
 * Écrit packages/db/reports/fri-goal-model-audit-YYYY-MM-DD.txt.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const HOME_ADV = 50;
const DRAW_RATE = 0.22;

const YOUTH_PATTERN = /\bU\d{2}\b/i;
const CLUB_PATTERN =
  /\b(FC|SC|AC|CF|FK|SK|NK|BK|IF|PSG|Rangers|Lights|Galaxy|Crew|Sounders|Timbers|Dynamo|Dinamo|Lokomotiv|Spartak|Rapid|Wanderers|Benfica|Sporting|Atletico|Athletic)\b/i;
const CLUB_EXACT_NAMES = new Set(["Las Vegas Lights", "FC Urartu"]);

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
};

type GoalModelParams = {
  base: number;
  sensitivity: number;
  shareMin: number;
  shareMax: number;
  totalMin: number;
  totalMax: number;
};

type ScoredFixture = {
  fixture: FixtureRow;
  eloHome: number;
  eloAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  eloMode: "historical" | "latest_snapshot";
};

function isClubTeam(name: string): boolean {
  return CLUB_EXACT_NAMES.has(name) || CLUB_PATTERN.test(name);
}

function isSeniorTeam(name: string): boolean {
  return !YOUTH_PATTERN.test(name) && !isClubTeam(name);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function eloExpectedScore(homeElo: number, awayElo: number): number {
  return 1 / (10 ** (-(homeElo - awayElo + HOME_ADV) / 400) + 1);
}

function eloProbabilities(
  homeElo: number,
  awayElo: number,
): { pHome: number; pDraw: number; pAway: number } {
  const expectation = eloExpectedScore(homeElo, awayElo);
  const pDraw = DRAW_RATE * (1 - Math.abs(2 * expectation - 1));
  return {
    pHome: expectation * (1 - pDraw),
    pDraw,
    pAway: (1 - expectation) * (1 - pDraw),
  };
}

function estimateGoalTotal(
  pDraw: number,
  params: GoalModelParams,
): number {
  const adjusted = params.base - (pDraw - DRAW_RATE) * params.sensitivity;
  return clamp(adjusted, params.totalMin, params.totalMax);
}

function estimateGoalShare(
  pHome: number,
  pAway: number,
  params: GoalModelParams,
): number {
  const nonDrawMass = pHome + pAway;
  if (nonDrawMass <= Number.EPSILON) {
    return 0.5;
  }
  return clamp(pHome / nonDrawMass, params.shareMin, params.shareMax);
}

function poissonProbability(lambda: number, goals: number): number {
  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
}

function factorial(n: number): number {
  let value = 1;
  for (let i = 2; i <= n; i++) value *= i;
  return value;
}

function bttsYesProbability(home: number, away: number): number {
  return (1 - Math.exp(-home)) * (1 - Math.exp(-away));
}

function over25Probability(home: number, away: number): number {
  const total = home + away;
  return 1 - (poissonProbability(total, 0) + poissonProbability(total, 1) + poissonProbability(total, 2));
}

function scoreFixtures(
  fixtures: ScoredFixture[],
  params: GoalModelParams,
): {
  bttsBrier: number;
  over25Brier: number;
  totalGoalsMae: number;
  composite: number;
} {
  let bttsBrier = 0;
  let over25Brier = 0;
  let totalGoalsMae = 0;

  for (const row of fixtures) {
    const goalTotal = estimateGoalTotal(row.pDraw, params);
    const homeShare = estimateGoalShare(row.pHome, row.pAway, params);
    const lambdaHome = goalTotal * homeShare;
    const lambdaAway = Math.max(goalTotal - lambdaHome, 0.05);
    const actualTotal = row.fixture.homeScore + row.fixture.awayScore;
    const actualBtts = row.fixture.homeScore > 0 && row.fixture.awayScore > 0 ? 1 : 0;
    const actualOver25 = actualTotal > 2 ? 1 : 0;

    const pBtts = bttsYesProbability(lambdaHome, lambdaAway);
    const pOver25 = over25Probability(lambdaHome, lambdaAway);

    bttsBrier += (pBtts - actualBtts) ** 2;
    over25Brier += (pOver25 - actualOver25) ** 2;
    totalGoalsMae += Math.abs(goalTotal - actualTotal);
  }

  const n = fixtures.length;
  const scored = {
    bttsBrier: bttsBrier / n,
    over25Brier: over25Brier / n,
    totalGoalsMae: totalGoalsMae / n,
    composite: bttsBrier / n + over25Brier / n + totalGoalsMae / n / 10,
  };
  return scored;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(reportsDir, `fri-goal-model-audit-${dateLabel}.txt`);
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      season: { competition: { code: "FRI" } },
    },
    select: {
      id: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const seniorFixtures = fixturesRaw
    .filter(
      (fixture): fixture is FixtureRow =>
        fixture.homeScore !== null &&
        fixture.awayScore !== null &&
        fixture.homeTeam !== null &&
        fixture.awayTeam !== null &&
        isSeniorTeam(fixture.homeTeam.name) &&
        isSeniorTeam(fixture.awayTeam.name),
    )
    .map((fixture) => ({
      ...fixture,
      homeScore: fixture.homeScore!,
      awayScore: fixture.awayScore!,
    }));

  if (seniorFixtures.length === 0) {
    throw new Error("No senior FRI fixtures found.");
  }

  const latestDate = seniorFixtures[seniorFixtures.length - 1].scheduledAt;
  const teamNames = Array.from(
    new Set(
      seniorFixtures.flatMap((fixture) => [
        fixture.homeTeam!.name,
        fixture.awayTeam!.name,
      ]),
    ),
  );

  const eloRows = await prisma.nationalTeamEloRating.findMany({
    where: {
      teamName: { in: teamNames },
      snapshotAt: { lte: latestDate },
    },
    select: { teamName: true, rating: true, snapshotAt: true },
    orderBy: [{ teamName: "asc" }, { snapshotAt: "desc" }],
  });

  const latestSnapshot = await prisma.nationalTeamEloRating.findFirst({
    select: { snapshotAt: true },
    orderBy: [{ snapshotAt: "desc" }, { teamName: "asc" }],
  });
  const latestSnapshotRows =
    latestSnapshot === null
      ? []
      : await prisma.nationalTeamEloRating.findMany({
          where: { snapshotAt: latestSnapshot.snapshotAt },
          select: { teamName: true, rating: true, snapshotAt: true },
          orderBy: { teamName: "asc" },
        });
  const latestSnapshotMap = new Map(
    latestSnapshotRows.map((row) => [row.teamName, row.rating]),
  );

  const eloByTeam = new Map<
    string,
    { rating: number; snapshotAt: Date }[]
  >();
  for (const row of eloRows) {
    const bucket = eloByTeam.get(row.teamName) ?? [];
    bucket.push({ rating: row.rating, snapshotAt: row.snapshotAt });
    eloByTeam.set(row.teamName, bucket);
  }

  const scoredFixtures: ScoredFixture[] = [];
  let historicalCount = 0;
  let latestSnapshotFallbackCount = 0;
  for (const fixture of seniorFixtures) {
    const homeHistory = eloByTeam.get(fixture.homeTeam!.name) ?? [];
    const awayHistory = eloByTeam.get(fixture.awayTeam!.name) ?? [];
    const homeElo = homeHistory.find(
      (entry) => entry.snapshotAt.getTime() <= fixture.scheduledAt.getTime(),
    )?.rating;
    const awayElo = awayHistory.find(
      (entry) => entry.snapshotAt.getTime() <= fixture.scheduledAt.getTime(),
    )?.rating;

    const fallbackHomeElo = latestSnapshotMap.get(fixture.homeTeam!.name);
    const fallbackAwayElo = latestSnapshotMap.get(fixture.awayTeam!.name);
    const resolvedHomeElo = homeElo ?? fallbackHomeElo;
    const resolvedAwayElo = awayElo ?? fallbackAwayElo;

    if (resolvedHomeElo === undefined || resolvedAwayElo === undefined) {
      continue;
    }

    const eloMode =
      homeElo !== undefined && awayElo !== undefined
        ? "historical"
        : "latest_snapshot";
    if (eloMode === "historical") {
      historicalCount++;
    } else {
      latestSnapshotFallbackCount++;
    }

    scoredFixtures.push({
      fixture,
      eloHome: resolvedHomeElo,
      eloAway: resolvedAwayElo,
      ...eloProbabilities(resolvedHomeElo, resolvedAwayElo),
      eloMode,
    });
  }

  if (scoredFixtures.length === 0) {
    throw new Error("No senior FRI fixtures with usable Elo ratings found.");
  }

  const totalGoals = scoredFixtures.map(
    (row) => row.fixture.homeScore + row.fixture.awayScore,
  );
  const avgGoals =
    totalGoals.reduce((sum, value) => sum + value, 0) / totalGoals.length;

  const candidates: GoalModelParams[] = [];
  for (const base of [2.2, 2.3, 2.4, 2.5, 2.6, 2.7]) {
    for (const sensitivity of [1.5, 2, 2.5, 3, 3.5]) {
      for (const shareMin of [0.15, 0.18, 0.2, 0.22, 0.25]) {
        for (const shareMax of [0.75, 0.78, 0.8, 0.82, 0.85]) {
          candidates.push({
            base,
            sensitivity,
            shareMin,
            shareMax,
            totalMin: 1.85,
            totalMax: 3.15,
          });
        }
      }
    }
  }

  const ranked = candidates
    .map((params) => ({ params, score: scoreFixtures(scoredFixtures, params) }))
    .sort((a, b) => a.score.composite - b.score.composite);

  const best = ranked[0];

  out("═══════════════════════════════════════════════════════");
  out(`  EVCore — FRI Goal Model Audit — ${dateLabel}`);
  out("═══════════════════════════════════════════════════════");
  out();
  out(`Senior FRI fixtures: ${seniorFixtures.length}`);
  out(`With usable Elo: ${scoredFixtures.length}`);
  out(`  historical snapshots: ${historicalCount}`);
  out(`  latest-snapshot fallback: ${latestSnapshotFallbackCount}`);
  if (latestSnapshot !== null) {
    out(`Latest snapshot date: ${latestSnapshot.snapshotAt.toISOString()}`);
  }
  out(`Average total goals: ${avgGoals.toFixed(3)}`);
  out();
  out("Best parameters:");
  out(`  base        = ${best.params.base.toFixed(2)}`);
  out(`  sensitivity = ${best.params.sensitivity.toFixed(2)}`);
  out(`  shareMin    = ${best.params.shareMin.toFixed(2)}`);
  out(`  shareMax    = ${best.params.shareMax.toFixed(2)}`);
  out(`  totalMin    = ${best.params.totalMin.toFixed(2)}`);
  out(`  totalMax    = ${best.params.totalMax.toFixed(2)}`);
  out();
  out("Best score:");
  out(`  BTTS Brier  = ${best.score.bttsBrier.toFixed(4)}`);
  out(`  O2.5 Brier  = ${best.score.over25Brier.toFixed(4)}`);
  out(`  Goals MAE   = ${best.score.totalGoalsMae.toFixed(4)}`);
  out(`  Composite   = ${best.score.composite.toFixed(4)}`);
  out();
  out("Top 5 candidates:");
  for (const entry of ranked.slice(0, 5)) {
    out(
      `  base=${entry.params.base.toFixed(2)} sens=${entry.params.sensitivity.toFixed(2)} ` +
        `share=[${entry.params.shareMin.toFixed(2)}, ${entry.params.shareMax.toFixed(2)}] ` +
        `score=${entry.score.composite.toFixed(4)} ` +
        `(BTTS ${entry.score.bttsBrier.toFixed(4)}, O2.5 ${entry.score.over25Brier.toFixed(4)}, MAE ${entry.score.totalGoalsMae.toFixed(4)})`,
    );
  }

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  out();
  out(`Report written to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
