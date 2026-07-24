/// <reference types="node" />
/**
 * docs/h2h-service-v2-plan.md §3.2 (v2.1) — teste si sur-pondérer les manches
 * H2H où la même équipe jouait déjà à domicile que dans la fixture cible
 * (VENUE_WEIGHTED) capte plus de signal que le score v2.0 actuel
 * (IMPROVED : seuil n>=3, decay=0.8, nul=0.5, implémenté dans h2h.service.ts)
 * — AVANT tout code définitif, comme demandé par le plan.
 *
 * Méthode, alignée sur backtest-h2h-signal-value.ts (favori = home/away
 * avec la plus haute proba modèle recalibré, corrélation avec le résidu
 * réel-modelProb) :
 * - poids d'une manche H2H = decay^i * (venueMultiplier si le favori jouait
 *   au même domicile/extérieur dans cette manche que dans la fixture cible,
 *   sinon 1) ;
 * - venueMultiplier appris par grille sur le train (objectif : |corrélation
 *   de Pearson| avec le résidu), évalué une seule fois sur la validation ;
 * - IMPROVED = cas particulier venueMultiplier=1 (aucune pondération venue).
 *
 * Décision (plan) : n'activer VENUE_WEIGHTED que si le gain de corrélation
 * hors échantillon est net — sinon la complexité n'est pas gratuite.
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-venue-weighting
 * Output: packages/db/reports/backtest-h2h-venue-weighting-YYYY-MM-DD.txt
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
const MEAN_LAMBDA = 1.4;
const SHRINKAGE_FACTOR = 0.7;
const HOME_FACTOR = 1.0;
const AWAY_FACTOR = 0.75;
const H2H_LIMIT = 5;
const H2H_MIN_SAMPLE = 3;
const H2H_DECAY = 0.8;
const TRAIN_FRACTION = 0.7;
const VENUE_MULTIPLIER_GRID = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
const MIN_VALIDATION_SAMPLE = 200;

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

type Point = {
  legs: H2HLeg[];
  favoriteTeamId: string;
  favoriteIsHome: boolean;
  modelProb: number;
  actual: 0 | 1;
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

function h2hScore(
  point: Pick<Point, "legs" | "favoriteTeamId" | "favoriteIsHome">,
  venueMultiplier: number,
): number | null {
  const { legs, favoriteTeamId, favoriteIsHome } = point;
  if (legs.length < H2H_MIN_SAMPLE) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const decayWeight = H2H_DECAY ** i;
    const favoriteWasHomeInLeg = leg.homeTeamId === favoriteTeamId;
    const venueBoost =
      favoriteWasHomeInLeg === favoriteIsHome ? venueMultiplier : 1;
    const weight = decayWeight * venueBoost;
    const winnerTeamId =
      leg.homeScore > leg.awayScore
        ? leg.homeTeamId
        : leg.awayScore > leg.homeScore
          ? leg.awayTeamId
          : null;
    const indicator =
      winnerTeamId === null ? 0.5 : winnerTeamId === favoriteTeamId ? 1 : 0;
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

function correlationAt(points: Point[], venueMultiplier: number): number {
  const h2hValues: number[] = [];
  const residuals: number[] = [];
  for (const p of points) {
    const score = h2hScore(p, venueMultiplier);
    if (score === null) continue;
    h2hValues.push(score);
    residuals.push(p.actual - p.modelProb);
  }
  if (h2hValues.length < 2) return 0;
  return pearson(h2hValues, residuals);
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-h2h-venue-weighting-${dateLabel}.txt`,
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

  out("Calcul modelProb(favori) + manches H2H par fixture...");
  const points: Point[] = [];
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

    const favoriteIsHome = probHome >= probAway;
    const favoriteTeamId = favoriteIsHome
      ? fixture.homeTeamId
      : fixture.awayTeamId;
    const modelProb = favoriteIsHome ? probHome : probAway;

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

    points.push({ legs, favoriteTeamId, favoriteIsHome, modelProb, actual });
    processed++;
  }

  out(
    `  ${processed} fixtures avec modelProb valide, ${skippedColdStart} exclues (cold-start).`,
  );

  const splitIdx = Math.floor(points.length * TRAIN_FRACTION);
  const train = points.slice(0, splitIdx);
  const validation = points.slice(splitIdx);

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — v2.1 : pondération domicile/extérieur du H2H");
  out(
    `  ${dateLabel} — split chronologique train ${(TRAIN_FRACTION * 100).toFixed(0)}% / validation ${((1 - TRAIN_FRACTION) * 100).toFixed(0)}%`,
  );
  out("═══════════════════════════════════════════════════════");
  out(`  train n=${train.length}, validation n=${validation.length}`);

  out();
  out(
    "--- Recherche du venueMultiplier optimal sur le train (objectif : |corrélation| avec le résidu) ---",
  );
  const baselineTrainCorr = correlationAt(train, 1);
  let bestMultiplier = 1;
  let bestAbsCorr = Math.abs(baselineTrainCorr);
  for (const m of VENUE_MULTIPLIER_GRID) {
    const r = correlationAt(train, m);
    if (Math.abs(r) > bestAbsCorr) {
      bestAbsCorr = Math.abs(r);
      bestMultiplier = m;
    }
  }
  out(
    `  IMPROVED (venueMultiplier=1, train)   : r=${baselineTrainCorr.toFixed(4)}`,
  );
  out(
    `  Meilleur venueMultiplier (train)      : ${bestMultiplier}  →  r=${correlationAt(train, bestMultiplier).toFixed(4)}`,
  );

  out();
  out("--- Grille complète (référence, train) ---");
  out("  venueMultiplier | r (train)");
  for (const m of [1, ...VENUE_MULTIPLIER_GRID]) {
    out(`  ${String(m).padStart(15)} | ${correlationAt(train, m).toFixed(4)}`);
  }

  out();
  out(`--- Évaluation sur la validation (une seule fois) ---`);
  const improvedValCorr = correlationAt(validation, 1);
  const venueValCorr = correlationAt(validation, bestMultiplier);
  out(
    `  IMPROVED (venueMultiplier=1)          : r=${improvedValCorr.toFixed(4)}`,
  );
  out(
    `  VENUE_WEIGHTED (venueMultiplier=${bestMultiplier})     : r=${venueValCorr.toFixed(4)}`,
  );

  if (validation.length < MIN_VALIDATION_SAMPLE) {
    out();
    out(
      `  Validation n=${validation.length} < seuil minimal ${MIN_VALIDATION_SAMPLE} — résultat exploratoire.`,
    );
  }

  out();
  out("--- Verdict ---");
  const netGain = Math.abs(venueValCorr) - Math.abs(improvedValCorr);
  if (bestMultiplier === 1 || netGain <= 0) {
    out(
      "  Pas de gain net de corrélation hors échantillon avec la pondération domicile/extérieur " +
        `(IMPROVED |r|=${Math.abs(improvedValCorr).toFixed(4)} vs VENUE_WEIGHTED |r|=${Math.abs(venueValCorr).toFixed(4)}) — ` +
        "ne pas l'ajouter (complexité non gratuite, cf. plan §3.2).",
    );
  } else {
    out(
      `  Gain net de corrélation hors échantillon avec venueMultiplier=${bestMultiplier} ` +
        `(IMPROVED |r|=${Math.abs(improvedValCorr).toFixed(4)} vs VENUE_WEIGHTED |r|=${Math.abs(venueValCorr).toFixed(4)}) — ` +
        "candidat à une implémentation définitive.",
    );
  }

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
