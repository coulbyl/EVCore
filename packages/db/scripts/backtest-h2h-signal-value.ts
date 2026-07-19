/// <reference types="node" />
/**
 * Est-ce que le score H2H (packages/db... non, apps/backend/.../h2h.service.ts)
 * apporte une info que le modèle (recentForm/xG/lambda/home-adv) ne capte pas
 * déjà ? H2HService est aujourd'hui purement "shadow" (loggé, jamais lu par
 * la décision) — avant d'investir dans sa correction (seuil d'échantillon,
 * pondération récence), on vérifie empiriquement s'il y a un signal résiduel.
 *
 * Méthode : pour chaque fixture, on définit le "favori" comme le fait déjà
 * h2h.service.ts (home si probabilities.home >= probabilities.away, sinon
 * away), on calcule modelProb = proba du modèle que ce favori gagne (avec
 * les facteurs homeAdv/awayDisadv recalibrés le 2026-07-19), puis on compare
 * au résidu (résultat réel − modelProb). Si un score H2H corrèle avec ce
 * résidu, il capte un vrai signal additionnel. Si non, il est redondant
 * avec ce que le modèle sait déjà.
 *
 * Deux versions du score H2H testées :
 * - RAW  : formule actuelle de h2h.service.ts (ratio de victoires du favori
 *   sur les 5 derniers H2H, nul = 0, aucun seuil d'échantillon).
 * - IMPROVED : seuil n>=3, pondération par décroissance (decay=0.8, même
 *   convention que recentForm), nul = 0.5 au lieu de 0.
 * Simplification assumée : pas d'ajustement domicile/extérieur par manche
 * H2H (nécessiterait de recalculer les TeamStats point-in-time de chaque
 * manche historique, hors scope de ce premier passage).
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-signal-value
 * Output: packages/db/reports/backtest-h2h-signal-value-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { computePoissonMarkets, type TeamStatsInput } from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const MEAN_LAMBDA = 1.4;
const SHRINKAGE_FACTOR = 0.7;
const HOME_FACTOR = 1.0; // recalibré 2026-07-19 (ev.constants.ts)
const AWAY_FACTOR = 0.75;
const H2H_LIMIT = 5; // même défaut que h2h.service.ts
const H2H_MIN_SAMPLE = 3;
const H2H_DECAY = 0.8; // même convention que recentForm

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
  return arr.slice(start, lastIdx + 1).reverse(); // most recent first
}

function rawH2HScore(legs: H2HLeg[], favoriteTeamId: string): number | null {
  if (legs.length === 0) return null;
  let favoriteWins = 0;
  for (const leg of legs) {
    const winnerTeamId =
      leg.homeScore > leg.awayScore
        ? leg.homeTeamId
        : leg.awayScore > leg.homeScore
          ? leg.awayTeamId
          : null;
    if (winnerTeamId === favoriteTeamId) favoriteWins++;
  }
  return favoriteWins / legs.length;
}

function improvedH2HScore(legs: H2HLeg[], favoriteTeamId: string): number | null {
  if (legs.length < H2H_MIN_SAMPLE) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY ** i;
    const winnerTeamId =
      leg.homeScore > leg.awayScore
        ? leg.homeTeamId
        : leg.awayScore > leg.homeScore
          ? leg.awayTeamId
          : null;
    const indicator = winnerTeamId === null ? 0.5 : winnerTeamId === favoriteTeamId ? 1 : 0;
    weightedSum += weight * indicator;
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? 0 : num / denom;
}

function olsSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    num += dx * (ys[i]! - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(reportsDir, `backtest-h2h-signal-value-${dateLabel}.txt`);
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

  out("Calcul modelProb(favori) + score H2H (raw/improved) par fixture...");
  type Point = { h2h: number; modelProb: number; actual: 0 | 1 };
  const rawPoints: Point[] = [];
  const improvedPoints: Point[] = [];
  let skippedColdStart = 0;
  let processed = 0;

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

    const { rawHome, rawAway } = rawLambdas(home.stats, away.stats);
    const lambdaHome = clamp(rawHome * HOME_FACTOR, 0.05, 5);
    const lambdaAway = clamp(rawAway * AWAY_FACTOR, 0.05, 5);
    const markets = computePoissonMarkets(lambdaHome, lambdaAway);
    const probHome = markets.home.toNumber();
    const probAway = markets.away.toNumber();

    const favoriteTeamId = probHome >= probAway ? fixture.homeTeamId : fixture.awayTeamId;
    const modelProb = probHome >= probAway ? probHome : probAway;

    const winnerTeamId =
      fixture.homeScore > fixture.awayScore
        ? fixture.homeTeamId
        : fixture.awayScore > fixture.homeScore
          ? fixture.awayTeamId
          : null;
    const actual: 0 | 1 = winnerTeamId === favoriteTeamId ? 1 : 0;

    const legs = findPriorH2HLegs(
      h2hByPair,
      fixture.homeTeamId,
      fixture.awayTeamId,
      fixture.scheduledAt,
      H2H_LIMIT,
    );

    const raw = rawH2HScore(legs, favoriteTeamId);
    if (raw !== null) rawPoints.push({ h2h: raw, modelProb, actual });

    const improved = improvedH2HScore(legs, favoriteTeamId);
    if (improved !== null) improvedPoints.push({ h2h: improved, modelProb, actual });

    processed++;
  }

  out(
    `  ${processed} fixtures avec modelProb valide, ${skippedColdStart} exclues (cold-start).`,
  );
  out(`  ${rawPoints.length} avec >=1 H2H (RAW), ${improvedPoints.length} avec >=${H2H_MIN_SAMPLE} H2H (IMPROVED).`);

  function report(label: string, points: Point[]) {
    out();
    out(`=== ${label} (n=${points.length}) ===`);
    if (points.length < 30) {
      out("  Échantillon trop faible pour conclure.");
      return;
    }
    const residuals = points.map((p) => p.actual - p.modelProb);
    const h2hValues = points.map((p) => p.h2h);
    const r = pearson(h2hValues, residuals);
    const slope = olsSlope(h2hValues, residuals);
    out(
      `  Corrélation (score H2H, résidu actual-modelProb) : r=${r.toFixed(4)}  pente OLS=${slope.toFixed(4)}`,
    );
    out(
      "  (r proche de 0 = pas de signal additionnel ; r>0 = H2H favorable au favori corrèle avec une sous-estimation du modèle)",
    );

    const bins: [number, number][] = [
      [0, 0.2],
      [0.2, 0.4],
      [0.4, 0.6],
      [0.6, 0.8],
      [0.8, 1.001],
    ];
    out();
    out("  Bucket H2H | n     | modelProb moy | taux réel | gap (réel-modelProb)");
    for (const [lo, hi] of bins) {
      const bucket = points.filter((p) => p.h2h >= lo && p.h2h < hi);
      if (bucket.length === 0) {
        out(`  [${lo.toFixed(1)}-${hi === 1.001 ? "1.0" : hi.toFixed(1)}) | 0     | -             | -         | -`);
        continue;
      }
      const avgModelProb =
        bucket.reduce((s, p) => s + p.modelProb, 0) / bucket.length;
      const actualRate = bucket.reduce((s, p) => s + p.actual, 0) / bucket.length;
      out(
        `  [${lo.toFixed(1)}-${hi === 1.001 ? "1.0" : hi.toFixed(1)}) | ${String(bucket.length).padEnd(5)} | ${(100 * avgModelProb).toFixed(1)}%        | ${(100 * actualRate).toFixed(1)}%     | ${(100 * (actualRate - avgModelProb)).toFixed(1)}pp`,
      );
    }
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Valeur incrémentale du signal H2H");
  out(`  ${dateLabel} — favori = home/away avec la plus haute proba modèle`);
  out("═══════════════════════════════════════════════════════");

  report("RAW (formule actuelle h2h.service.ts, pas de seuil, nul=0)", rawPoints);
  report(`IMPROVED (n>=${H2H_MIN_SAMPLE}, decay=${H2H_DECAY}, nul=0.5)`, improvedPoints);

  const report_ = lines.join("\n");
  writeFileSync(outputPath, `${report_}\n`, "utf8");
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
