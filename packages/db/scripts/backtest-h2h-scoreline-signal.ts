/// <reference types="node" />
/**
 * memory project-correct-score-immature (2026-07-28) — after recalibration,
 * new features, an anti-draw penalty and propagating the existing 1X2
 * empirical rebalance all failed to move CORRECT_SCORE's exact-score hit
 * rate, the one lead that showed a (marginal, not-yet-significant) lift was
 * H2H scoreline history: when the Poisson argmax pick agrees with the
 * decay-weighted most frequent H2H scoreline between the two teams, hit
 * rate was 12.4% vs 11.3% when it disagrees (p=0.06-0.08 on a 39.5k-fixture
 * backtest — same order of magnitude across raw/decay-weighted/high-
 * confidence variants, not proven but not noise either).
 *
 * `H2HService.computeH2HScorelineSignal` now logs this signal on every
 * ModelRun (apps/backend .../h2h.service.ts, shadow only, never read by
 * decision logic). This script re-derives the same backtest from raw
 * fixture history (same pattern as backtest-h2h-market-signals.ts) so it
 * can be rerun anytime — now, or months from now once live CORRECT_SCORE
 * volume has grown — without waiting on shadow accumulation.
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-scoreline-signal
 * Output: packages/db/reports/backtest-h2h-scoreline-signal-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computeCorrectScoreMatrix,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const MEAN_LAMBDA = 1.4;
const SHRINKAGE_FACTOR = 0.7;
const HOME_FACTOR = 1.0;
const AWAY_FACTOR = 0.75;
const MAX_GOALS = 6;
const H2H_LIMIT = 5;
const H2H_MIN_SAMPLE = 3;
const H2H_DECAY = 0.8;
const MIN_SAMPLE = 200;

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };
type H2HLeg = {
  scheduledAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

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
): { rawHome: number; rawAway: number } {
  const hFor = toNum(homeStats.xgFor);
  const aFor = toNum(awayStats.xgFor);
  const hAgainst = toNum(homeStats.xgAgainst);
  const aAgainst = toNum(awayStats.xgAgainst);
  const leagueAvg = Math.max(0.5, (hFor + aFor + hAgainst + aAgainst) / 4);
  const rawHome =
    SHRINKAGE_FACTOR * ((hFor * aAgainst) / leagueAvg) +
    (1 - SHRINKAGE_FACTOR) * MEAN_LAMBDA;
  const rawAway =
    SHRINKAGE_FACTOR * ((aFor * hAgainst) / leagueAvg) +
    (1 - SHRINKAGE_FACTOR) * MEAN_LAMBDA;
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

function pairKey(teamA: string, teamB: string): string {
  return [teamA, teamB].sort().join("|");
}

function findPriorH2HLegs(
  h2hByPair: Map<string, H2HLeg[]>,
  homeTeamId: string,
  awayTeamId: string,
  before: Date,
  limit: number,
): H2HLeg[] {
  const arr = h2hByPair.get(pairKey(homeTeamId, awayTeamId));
  if (!arr || arr.length === 0) return [];
  let lastIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]!.scheduledAt.getTime() < before.getTime()) lastIdx = i;
    else break;
  }
  if (lastIdx === -1) return [];
  const start = Math.max(0, lastIdx - limit + 1);
  return arr.slice(start, lastIdx + 1).reverse();
}

// Same orientation + decay-weighting as H2HService.computeH2HScorelineSignal.
function weightedTopScoreline(
  legs: H2HLeg[],
  currentHomeTeamId: string,
): { scoreline: string; confidence: number } | null {
  if (legs.length < H2H_MIN_SAMPLE) return null;
  const weights = new Map<string, number>();
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY ** i;
    const [orientedHome, orientedAway] =
      leg.homeTeamId === currentHomeTeamId
        ? [leg.homeScore, leg.awayScore]
        : [leg.awayScore, leg.homeScore];
    const key = `${orientedHome}:${orientedAway}`;
    weights.set(key, (weights.get(key) ?? 0) + weight);
    weightTotal += weight;
  });
  let topScoreline = "";
  let topWeight = -1;
  for (const [scoreline, weight] of weights) {
    if (weight > topWeight) {
      topScoreline = scoreline;
      topWeight = weight;
    }
  }
  return { scoreline: topScoreline, confidence: topWeight / weightTotal };
}

function argmaxScoreline(lambdaHome: number, lambdaAway: number): string {
  const matrix = computeCorrectScoreMatrix(lambdaHome, lambdaAway, MAX_GOALS);
  let best = "";
  let bestP = -1;
  for (const [scoreline, p] of Object.entries(matrix)) {
    const value = p.toNumber();
    if (value > bestP) {
      best = scoreline;
      bestP = value;
    }
  }
  return best;
}

// Two-proportion z-test, one-sided (agreeRate > disagreeRate).
function zTestGreater(
  agreeHits: number,
  agreeN: number,
  disagreeHits: number,
  disagreeN: number,
): number {
  const p1 = agreeHits / agreeN;
  const p2 = disagreeHits / disagreeN;
  const pooled = (agreeHits + disagreeHits) / (agreeN + disagreeN);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / agreeN + 1 / disagreeN));
  if (se === 0) return 1;
  const z = (p1 - p2) / se;
  // one-sided p-value from the standard normal survival function
  const p = 0.5 * erfc(z / Math.SQRT2);
  return p;
}

function erfc(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation — good enough for a report,
  // not a statistics package dependency.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 1 - sign * y;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-h2h-scoreline-signal-${dateLabel}.txt`,
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
  }));
  out(`  ${fixtures.length} fixtures terminées trouvées.`);

  out("Construction de l'historique H2H par paire d'équipes...");
  const h2hByPair = new Map<string, H2HLeg[]>();
  for (const f of fixtures) {
    const key = pairKey(f.homeTeamId, f.awayTeamId);
    const arr = h2hByPair.get(key) ?? [];
    arr.push({
      scheduledAt: f.scheduledAt,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
    });
    h2hByPair.set(key, arr);
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

  out("Calcul de l'argmax Poisson + top scoreline H2H par fixture...");
  let processed = 0;
  let skippedColdStart = 0;
  let agreeHits = 0;
  let agreeN = 0;
  let disagreeHits = 0;
  let disagreeN = 0;
  let highConfHits = 0;
  let highConfN = 0;

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

    const legs = findPriorH2HLegs(
      h2hByPair,
      fixture.homeTeamId,
      fixture.awayTeamId,
      fixture.scheduledAt,
      H2H_LIMIT,
    );
    const h2hTop = weightedTopScoreline(legs, fixture.homeTeamId);
    if (h2hTop === null) continue;

    const { rawHome, rawAway } = rawLambdas(home.stats, away.stats);
    const lambdaHome = clamp(rawHome * HOME_FACTOR, 0.05, 5);
    const lambdaAway = clamp(rawAway * AWAY_FACTOR, 0.05, 5);
    const argmax = argmaxScoreline(lambdaHome, lambdaAway);
    const actual = `${fixture.homeScore}:${fixture.awayScore}`;
    const hit = argmax === actual ? 1 : 0;

    processed++;
    if (argmax === h2hTop.scoreline) {
      agreeN++;
      agreeHits += hit;
      if (h2hTop.confidence > 0.4) {
        highConfN++;
        highConfHits += hit;
      }
    } else {
      disagreeN++;
      disagreeHits += hit;
    }
  }

  out(
    `  ${processed} fixtures avec >=3 manches H2H et TeamStats valides, ${skippedColdStart} exclues (cold-start).`,
  );

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — signal H2H scoreline pour CORRECT_SCORE");
  out(`  ${dateLabel}`);
  out("═══════════════════════════════════════════════════════");

  if (agreeN < MIN_SAMPLE || disagreeN < MIN_SAMPLE) {
    out(
      `  n insuffisant (agree=${agreeN}, disagree=${disagreeN}, seuil ${MIN_SAMPLE}) — signal non concluant.`,
    );
  } else {
    const agreeRate = agreeHits / agreeN;
    const disagreeRate = disagreeHits / disagreeN;
    const pValue = zTestGreater(agreeHits, agreeN, disagreeHits, disagreeN);
    out(
      `  Argmax == top H2H scoreline : n=${agreeN}, hit rate=${(100 * agreeRate).toFixed(2)}%`,
    );
    out(
      `  Argmax != top H2H scoreline : n=${disagreeN}, hit rate=${(100 * disagreeRate).toFixed(2)}%`,
    );
    out(
      `  Écart : ${((agreeRate - disagreeRate) * 100).toFixed(2)}pp, test z unilatéral p=${pValue.toFixed(4)}`,
    );
    if (highConfN > 0) {
      const highConfRate = highConfHits / highConfN;
      const pHighConf = zTestGreater(
        highConfHits,
        highConfN,
        disagreeHits,
        disagreeN,
      );
      out(
        `  Sous-groupe confiance H2H > 40% : n=${highConfN}, hit rate=${(100 * highConfRate).toFixed(2)}%, p=${pHighConf.toFixed(4)}`,
      );
    }
    const verdict =
      pValue < 0.05
        ? "significatif au seuil 0.05 — candidat à investigation d'activation"
        : "pas encore significatif — rester en shadow, recalculer avec plus de volume";
    out(`  Verdict : ${verdict}`);
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
