/// <reference types="node" />
/**
 * docs/h2h-service-v2-plan.md §3.3 (v2.2) — le point le plus structurant du
 * plan : un H2H "complet" doit couvrir les marchés qu'EVCore trade
 * réellement (BTTS, OVER 2.5, CLEAN SHEET, WIN TO NIL), pas seulement le
 * résultat 1X2 (déjà activé en prod via l'ajustement lambda, v2.0/§4).
 *
 * Sur le MÊME pool de manches H2H point-in-time (même decay=0.8, même seuil
 * n>=3), on calcule un taux par marché :
 *   - h2hBttsRate / h2hOver25Rate : symétriques, pas d'orientation domicile/
 *     extérieur.
 *   - h2hCleanSheetRate / h2hWinToNilRate (home/away) : orientés par le côté
 *     domicile/extérieur de la fixture CIBLE (pas par "favori" — une équipe
 *     qui joue à domicile aujourd'hui est jugée sur son historique de cage
 *     inviolée face à cet adversaire, quel que soit son côté dans chaque
 *     manche passée).
 *
 * Chaque signal est testé INDÉPENDAMMENT (plan §3.3 : "à activer marché par
 * marché selon le résultat, pas en bloc") avec le même protocole que le 1X2
 * (backtest-h2h-brier-gain.ts) : correction logit(P_marché) += delta *
 * (signal - 0.5), delta appris par grille sur train, évalué une fois sur
 * validation. La probabilité baseline du marché N'INCLUT PAS l'ajustement
 * lambda H2H déjà activé (isolation : on teste la valeur ADDITIONNELLE du
 * signal par marché au-dessus du modèle pré-H2H, même méthodologie que le
 * test 1X2 original).
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-market-signals
 * Output: packages/db/reports/backtest-h2h-market-signals-YYYY-MM-DD.txt
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
const PROB_EPSILON = 0.001;
const TRAIN_FRACTION = 0.7;
const DELTA_GRID: number[] = Array.from(
  { length: 25 },
  (_, i) => Math.round((-0.6 + i * 0.05) * 100) / 100,
);
const MIN_MARKET_SAMPLE = 200; // docs/h2h-integration-evaluation.md — "Evaluation initiale"

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
  currentHomeTeamId: string;
  currentAwayTeamId: string;
  baseline: {
    btts: number;
    over25: number;
    cleanSheetHome: number;
    cleanSheetAway: number;
    winToNilHome: number;
    winToNilAway: number;
  };
  actual: {
    btts: 0 | 1;
    over25: 0 | 1;
    cleanSheetHome: 0 | 1;
    cleanSheetAway: 0 | 1;
    winToNilHome: 0 | 1;
    winToNilAway: 0 | 1;
  };
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function logit(p: number): number {
  const clamped = clamp(p, PROB_EPSILON, 1 - PROB_EPSILON);
  return Math.log(clamped / (1 - clamped));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
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

function weightedRate(
  legs: H2HLeg[],
  indicator: (leg: H2HLeg) => number,
): number | null {
  if (legs.length < H2H_MIN_SAMPLE) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const weight = H2H_DECAY ** i;
    weightedSum += weight * indicator(leg);
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

function teamCleanSheetInLeg(leg: H2HLeg, teamId: string): number {
  if (leg.homeTeamId === teamId) return leg.awayScore === 0 ? 1 : 0;
  return leg.homeScore === 0 ? 1 : 0; // teamId === leg.awayTeamId
}

function teamWinToNilInLeg(leg: H2HLeg, teamId: string): number {
  if (leg.homeTeamId === teamId) {
    return leg.homeScore > leg.awayScore && leg.awayScore === 0 ? 1 : 0;
  }
  return leg.awayScore > leg.homeScore && leg.homeScore === 0 ? 1 : 0;
}

type MarketKey =
  | "btts"
  | "over25"
  | "cleanSheetHome"
  | "cleanSheetAway"
  | "winToNilHome"
  | "winToNilAway";

const MARKET_LABELS: Record<MarketKey, string> = {
  btts: "BTTS",
  over25: "OVER 2.5",
  cleanSheetHome: "CLEAN SHEET home",
  cleanSheetAway: "CLEAN SHEET away",
  winToNilHome: "WIN TO NIL home",
  winToNilAway: "WIN TO NIL away",
};

function signalFor(
  key: MarketKey,
  legs: H2HLeg[],
  currentHomeTeamId: string,
  currentAwayTeamId: string,
): number | null {
  switch (key) {
    case "btts":
      return weightedRate(legs, (leg) =>
        leg.homeScore > 0 && leg.awayScore > 0 ? 1 : 0,
      );
    case "over25":
      return weightedRate(legs, (leg) =>
        leg.homeScore + leg.awayScore >= 3 ? 1 : 0,
      );
    case "cleanSheetHome":
      return weightedRate(legs, (leg) =>
        teamCleanSheetInLeg(leg, currentHomeTeamId),
      );
    case "cleanSheetAway":
      return weightedRate(legs, (leg) =>
        teamCleanSheetInLeg(leg, currentAwayTeamId),
      );
    case "winToNilHome":
      return weightedRate(legs, (leg) =>
        teamWinToNilInLeg(leg, currentHomeTeamId),
      );
    case "winToNilAway":
      return weightedRate(legs, (leg) =>
        teamWinToNilInLeg(leg, currentAwayTeamId),
      );
  }
}

function correctedProb(
  baselineProb: number,
  signal: number,
  delta: number,
): number {
  return sigmoid(logit(baselineProb) + delta * (signal - 0.5));
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
    `backtest-h2h-market-signals-${dateLabel}.txt`,
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

  out(
    "Calcul des marchés baseline (sans ajustement H2H) + manches H2H par fixture...",
  );
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

    const legs = findPriorH2HLegs(
      h2hByPair,
      fixture.homeTeamId,
      fixture.awayTeamId,
      fixture.scheduledAt,
      H2H_LIMIT,
    );

    const { homeScore, awayScore } = fixture;
    points.push({
      legs,
      currentHomeTeamId: fixture.homeTeamId,
      currentAwayTeamId: fixture.awayTeamId,
      baseline: {
        btts: markets.bttsYes.toNumber(),
        over25: markets.over25.toNumber(),
        cleanSheetHome: markets.cleanSheetHome.toNumber(),
        cleanSheetAway: markets.cleanSheetAway.toNumber(),
        winToNilHome: markets.winToNilHome.toNumber(),
        winToNilAway: markets.winToNilAway.toNumber(),
      },
      actual: {
        btts: homeScore > 0 && awayScore > 0 ? 1 : 0,
        over25: homeScore + awayScore >= 3 ? 1 : 0,
        cleanSheetHome: awayScore === 0 ? 1 : 0,
        cleanSheetAway: homeScore === 0 ? 1 : 0,
        winToNilHome: homeScore > awayScore && awayScore === 0 ? 1 : 0,
        winToNilAway: awayScore > homeScore && homeScore === 0 ? 1 : 0,
      },
    });

    processed++;
  }

  out(
    `  ${processed} fixtures avec marchés baseline valides, ${skippedColdStart} exclues (cold-start).`,
  );

  const splitIdx = Math.floor(points.length * TRAIN_FRACTION);
  const train = points.slice(0, splitIdx);
  const validation = points.slice(splitIdx);

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — v2.2 : signaux H2H par marché");
  out(
    `  ${dateLabel} — split chronologique train ${(TRAIN_FRACTION * 100).toFixed(0)}% / validation ${((1 - TRAIN_FRACTION) * 100).toFixed(0)}%`,
  );
  out("═══════════════════════════════════════════════════════");
  out(`  train n=${train.length}, validation n=${validation.length}`);

  const marketKeys: MarketKey[] = [
    "btts",
    "over25",
    "cleanSheetHome",
    "cleanSheetAway",
    "winToNilHome",
    "winToNilAway",
  ];

  const summary: {
    market: string;
    n: number;
    delta: number;
    baselineBrier: number;
    correctedBrier: number;
    verdict: string;
  }[] = [];

  for (const key of marketKeys) {
    out();
    out(`--- ${MARKET_LABELS[key]} ---`);

    const trainPairs = train
      .map((p) => ({
        signal: signalFor(
          key,
          p.legs,
          p.currentHomeTeamId,
          p.currentAwayTeamId,
        ),
        baselineProb: p.baseline[key],
        actual: p.actual[key],
      }))
      .filter(
        (p): p is { signal: number; baselineProb: number; actual: 0 | 1 } =>
          p.signal !== null,
      );
    const validationPairs = validation
      .map((p) => ({
        signal: signalFor(
          key,
          p.legs,
          p.currentHomeTeamId,
          p.currentAwayTeamId,
        ),
        baselineProb: p.baseline[key],
        actual: p.actual[key],
      }))
      .filter(
        (p): p is { signal: number; baselineProb: number; actual: 0 | 1 } =>
          p.signal !== null,
      );

    out(
      `  train n=${trainPairs.length}, validation n=${validationPairs.length}`,
    );

    if (validationPairs.length < MIN_MARKET_SAMPLE) {
      out(
        `  Validation n=${validationPairs.length} < seuil minimal ${MIN_MARKET_SAMPLE} — signal non concluant, pas d'activation.`,
      );
      summary.push({
        market: MARKET_LABELS[key],
        n: validationPairs.length,
        delta: 0,
        baselineBrier: NaN,
        correctedBrier: NaN,
        verdict: "n<seuil, non concluant",
      });
      continue;
    }

    const baselineTrainBrier = brier(
      trainPairs.map((p) => ({ actual: p.actual, prob: p.baselineProb })),
    );
    let bestDelta = 0;
    let bestTrainBrier = baselineTrainBrier;
    for (const delta of DELTA_GRID) {
      const b = brier(
        trainPairs.map((p) => ({
          actual: p.actual,
          prob: correctedProb(p.baselineProb, p.signal, delta),
        })),
      );
      if (b < bestTrainBrier) {
        bestTrainBrier = b;
        bestDelta = delta;
      }
    }
    out(`  Brier baseline (train, delta=0) : ${baselineTrainBrier.toFixed(6)}`);
    out(
      `  Meilleur delta (train)          : ${bestDelta.toFixed(2)}  →  Brier ${bestTrainBrier.toFixed(6)}`,
    );

    const baselineValBrier = brier(
      validationPairs.map((p) => ({ actual: p.actual, prob: p.baselineProb })),
    );
    const correctedValBrier = brier(
      validationPairs.map((p) => ({
        actual: p.actual,
        prob: correctedProb(p.baselineProb, p.signal, bestDelta),
      })),
    );
    const delta = correctedValBrier - baselineValBrier;
    out(`  Brier baseline (validation)     : ${baselineValBrier.toFixed(6)}`);
    out(`  Brier corrigé (validation)      : ${correctedValBrier.toFixed(6)}`);
    out(
      `  Delta Brier (négatif=amélioration) : ${delta >= 0 ? "+" : ""}${delta.toFixed(6)}`,
    );

    const verdict =
      bestDelta === 0 || delta >= 0
        ? "pas de gain hors échantillon — ne pas activer"
        : "gain hors échantillon confirmé — candidat à activation";
    out(`  Verdict : ${verdict}`);

    summary.push({
      market: MARKET_LABELS[key],
      n: validationPairs.length,
      delta,
      baselineBrier: baselineValBrier,
      correctedBrier: correctedValBrier,
      verdict,
    });
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Résumé");
  out("═══════════════════════════════════════════════════════");
  out("  marché             | n validation | delta Brier | verdict");
  for (const row of summary) {
    out(
      `  ${row.market.padEnd(18)} | ${String(row.n).padEnd(12)} | ${Number.isNaN(row.delta) ? "n/a" : (row.delta >= 0 ? "+" : "") + row.delta.toFixed(6)} | ${row.verdict}`,
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
