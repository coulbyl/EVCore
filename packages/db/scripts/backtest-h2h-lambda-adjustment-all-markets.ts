/// <reference types="node" />
/**
 * docs/h2h-service-v2-plan.md §4 — le choix produit (2026-07-23) est un scope
 * "large" pour la correction H2H : au lieu de ne corriger que l'EV du pick
 * 1X2 favori (backtest-h2h-brier-gain.ts), on ajuste lambdaHome/lambdaAway
 * eux-mêmes avant `computePoissonMarkets`. Comme TOUS les marchés dérivés
 * (1X2, BTTS, Over/Under, clean sheet, win-to-nil, correct score, ...) sont
 * des marginales de la même distribution de Poisson jointe, ajuster lambda
 * les corrige tous de façon cohérente en une seule fois — pas de risque de
 * désynchronisation entre `probabilities` et les marchés dérivés.
 *
 * Le risque du scope large, explicitement demandé à valider avant tout code
 * définitif : le gain mesuré (backtest-h2h-brier-gain.ts) ne portait QUE sur
 * P(favori gagne le 1X2). Ce script vérifie qu'ajuster lambda avec le même
 * signal H2H n'améliore pas le 1X2 aux dépens du calibrage BTTS/Over-Under/
 * clean sheet/win-to-nil.
 *
 * Formule d'ajustement :
 *   signal = h2h - 0.5                          (0 = neutre)
 *   lambdaFavori'  = lambdaFavori  * (1 + gamma * signal)
 *   lambdaOutsider' = lambdaOutsider * (1 - gamma * signal)
 *   (clampées [0.05, 5], même plancher que le reste du moteur)
 * "Favori" = équipe avec la plus haute proba 1X2 modèle AVANT ajustement H2H
 * (même définition que h2h.service.ts — pas de circularité).
 *
 * gamma appris par grille sur le train (objectif : Brier du 1X2 favori
 * uniquement, même protocole que backtest-h2h-brier-gain.ts, pour rester
 * comparable), puis évalué UNE fois sur la validation, marché par marché.
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-lambda-all-markets
 * Output: packages/db/reports/backtest-h2h-lambda-adjustment-all-markets-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computePoissonMarkets,
  poissonProba,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const MEAN_LAMBDA = 1.4;
const SHRINKAGE_FACTOR = 0.7;
const HOME_FACTOR = 1.0; // recalibré 2026-07-19 (ev.constants.ts)
const AWAY_FACTOR = 0.75;
const H2H_LIMIT = 5;
const H2H_MIN_SAMPLE = 3;
const H2H_DECAY = 0.8;
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5;
const PROB_EPSILON = 0.001;
const TRAIN_FRACTION = 0.7;
const GAMMA_GRID: number[] = Array.from(
  { length: 25 },
  (_, i) => Math.round((-0.6 + i * 0.05) * 100) / 100,
); // -0.60 .. 0.60 pas 0.05
const MIN_VALIDATION_SAMPLE = 200;

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  seasonName: string;
  competitionName: string;
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
  h2h: number;
  favoriteIsHome: boolean;
  lambdaHome: number;
  lambdaAway: number;
  homeScore: number;
  awayScore: number;
  scheduledAt: Date;
  seasonName: string;
  competitionName: string;
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

function h2hScoreV2(legs: H2HLeg[], favoriteTeamId: string): number | null {
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
    const indicator =
      winnerTeamId === null ? 0.5 : winnerTeamId === favoriteTeamId ? 1 : 0;
    weightedSum += weight * indicator;
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

function adjustedLambdas(
  point: Point,
  gamma: number,
): { lambdaHome: number; lambdaAway: number } {
  const signal = point.h2h - 0.5;
  const favorFactor = 1 + gamma * signal;
  const underdogFactor = 1 - gamma * signal;
  const lambdaHome = point.favoriteIsHome
    ? point.lambdaHome * favorFactor
    : point.lambdaHome * underdogFactor;
  const lambdaAway = point.favoriteIsHome
    ? point.lambdaAway * underdogFactor
    : point.lambdaAway * favorFactor;
  return {
    lambdaHome: clamp(lambdaHome, LAMBDA_MIN, LAMBDA_MAX),
    lambdaAway: clamp(lambdaAway, LAMBDA_MIN, LAMBDA_MAX),
  };
}

function favoriteWinActual(point: Point): 0 | 1 {
  const winnerIsHome = point.homeScore > point.awayScore;
  const winnerIsAway = point.awayScore > point.homeScore;
  if (point.favoriteIsHome) return winnerIsHome ? 1 : 0;
  return winnerIsAway ? 1 : 0;
}

function favoriteWinProbAt(point: Point, gamma: number): number {
  const { lambdaHome, lambdaAway } = adjustedLambdas(point, gamma);
  const { home, away } = poissonProba(lambdaHome, lambdaAway);
  return point.favoriteIsHome ? home.toNumber() : away.toNumber();
}

function brier(pairs: { actual: 0 | 1; prob: number }[]): number {
  const sum = pairs.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0);
  return sum / pairs.length;
}

function logLossOf(pairs: { actual: 0 | 1; prob: number }[]): number {
  const sum = pairs.reduce((s, p) => {
    const prob = clamp(p.prob, PROB_EPSILON, 1 - PROB_EPSILON);
    return s + (p.actual === 1 ? -Math.log(prob) : -Math.log(1 - prob));
  }, 0);
  return sum / pairs.length;
}

type MarketActuals = {
  btts: 0 | 1;
  over25: 0 | 1;
  cleanSheetHome: 0 | 1;
  cleanSheetAway: 0 | 1;
  winToNilHome: 0 | 1;
  winToNilAway: 0 | 1;
};

function marketActualsOf(point: Point): MarketActuals {
  const { homeScore, awayScore } = point;
  return {
    btts: homeScore > 0 && awayScore > 0 ? 1 : 0,
    over25: homeScore + awayScore >= 3 ? 1 : 0,
    cleanSheetHome: awayScore === 0 ? 1 : 0,
    cleanSheetAway: homeScore === 0 ? 1 : 0,
    winToNilHome: homeScore > awayScore && awayScore === 0 ? 1 : 0,
    winToNilAway: awayScore > homeScore && homeScore === 0 ? 1 : 0,
  };
}

type MarketRow = { market: string; baseline: number; corrected: number };

function evaluateAllMarkets(
  points: Point[],
  gamma: number,
): { brierRows: MarketRow[]; logLossRows: MarketRow[] } {
  const favBrierBaseline: { actual: 0 | 1; prob: number }[] = [];
  const favBrierCorrected: { actual: 0 | 1; prob: number }[] = [];
  const bttsBaseline: { actual: 0 | 1; prob: number }[] = [];
  const bttsCorrected: { actual: 0 | 1; prob: number }[] = [];
  const over25Baseline: { actual: 0 | 1; prob: number }[] = [];
  const over25Corrected: { actual: 0 | 1; prob: number }[] = [];
  const csHomeBaseline: { actual: 0 | 1; prob: number }[] = [];
  const csHomeCorrected: { actual: 0 | 1; prob: number }[] = [];
  const csAwayBaseline: { actual: 0 | 1; prob: number }[] = [];
  const csAwayCorrected: { actual: 0 | 1; prob: number }[] = [];
  const wtnHomeBaseline: { actual: 0 | 1; prob: number }[] = [];
  const wtnHomeCorrected: { actual: 0 | 1; prob: number }[] = [];
  const wtnAwayBaseline: { actual: 0 | 1; prob: number }[] = [];
  const wtnAwayCorrected: { actual: 0 | 1; prob: number }[] = [];

  for (const point of points) {
    const actuals = marketActualsOf(point);
    const favActual = favoriteWinActual(point);

    const baselineMarkets = computePoissonMarkets(
      point.lambdaHome,
      point.lambdaAway,
    );
    const { lambdaHome, lambdaAway } = adjustedLambdas(point, gamma);
    const correctedMarkets = computePoissonMarkets(lambdaHome, lambdaAway);

    const favBaselineProb = point.favoriteIsHome
      ? baselineMarkets.home.toNumber()
      : baselineMarkets.away.toNumber();
    const favCorrectedProb = point.favoriteIsHome
      ? correctedMarkets.home.toNumber()
      : correctedMarkets.away.toNumber();
    favBrierBaseline.push({ actual: favActual, prob: favBaselineProb });
    favBrierCorrected.push({ actual: favActual, prob: favCorrectedProb });

    bttsBaseline.push({
      actual: actuals.btts,
      prob: baselineMarkets.bttsYes.toNumber(),
    });
    bttsCorrected.push({
      actual: actuals.btts,
      prob: correctedMarkets.bttsYes.toNumber(),
    });

    over25Baseline.push({
      actual: actuals.over25,
      prob: baselineMarkets.over25.toNumber(),
    });
    over25Corrected.push({
      actual: actuals.over25,
      prob: correctedMarkets.over25.toNumber(),
    });

    csHomeBaseline.push({
      actual: actuals.cleanSheetHome,
      prob: baselineMarkets.cleanSheetHome.toNumber(),
    });
    csHomeCorrected.push({
      actual: actuals.cleanSheetHome,
      prob: correctedMarkets.cleanSheetHome.toNumber(),
    });

    csAwayBaseline.push({
      actual: actuals.cleanSheetAway,
      prob: baselineMarkets.cleanSheetAway.toNumber(),
    });
    csAwayCorrected.push({
      actual: actuals.cleanSheetAway,
      prob: correctedMarkets.cleanSheetAway.toNumber(),
    });

    wtnHomeBaseline.push({
      actual: actuals.winToNilHome,
      prob: baselineMarkets.winToNilHome.toNumber(),
    });
    wtnHomeCorrected.push({
      actual: actuals.winToNilHome,
      prob: correctedMarkets.winToNilHome.toNumber(),
    });

    wtnAwayBaseline.push({
      actual: actuals.winToNilAway,
      prob: baselineMarkets.winToNilAway.toNumber(),
    });
    wtnAwayCorrected.push({
      actual: actuals.winToNilAway,
      prob: correctedMarkets.winToNilAway.toNumber(),
    });
  }

  const marketPairs: [
    string,
    typeof favBrierBaseline,
    typeof favBrierCorrected,
  ][] = [
    ["1X2 favori", favBrierBaseline, favBrierCorrected],
    ["BTTS", bttsBaseline, bttsCorrected],
    ["OVER 2.5", over25Baseline, over25Corrected],
    ["CLEAN SHEET home", csHomeBaseline, csHomeCorrected],
    ["CLEAN SHEET away", csAwayBaseline, csAwayCorrected],
    ["WIN TO NIL home", wtnHomeBaseline, wtnHomeCorrected],
    ["WIN TO NIL away", wtnAwayBaseline, wtnAwayCorrected],
  ];

  const brierRows: MarketRow[] = marketPairs.map(([market, base, corr]) => ({
    market,
    baseline: brier(base),
    corrected: brier(corr),
  }));
  const logLossRows: MarketRow[] = marketPairs.map(([market, base, corr]) => ({
    market,
    baseline: logLossOf(base),
    corrected: logLossOf(corr),
  }));

  return { brierRows, logLossRows };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-h2h-lambda-adjustment-all-markets-${dateLabel}.txt`,
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
      season: {
        select: { name: true, competition: { select: { name: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    id: f.id,
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    seasonName: f.season.name,
    competitionName: f.season.competition.name,
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

  out("Calcul lambda baseline + favori + score H2H v2.0 par fixture...");
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
    const lambdaHome = clamp(rawHome * HOME_FACTOR, LAMBDA_MIN, LAMBDA_MAX);
    const lambdaAway = clamp(rawAway * AWAY_FACTOR, LAMBDA_MIN, LAMBDA_MAX);
    const { home: probHome, away: probAway } = poissonProba(
      lambdaHome,
      lambdaAway,
    );
    const favoriteIsHome = probHome.greaterThanOrEqualTo(probAway);
    const favoriteTeamId = favoriteIsHome
      ? fixture.homeTeamId
      : fixture.awayTeamId;

    const legs = findPriorH2HLegs(
      h2hByPair,
      fixture.homeTeamId,
      fixture.awayTeamId,
      fixture.scheduledAt,
      H2H_LIMIT,
    );
    const h2h = h2hScoreV2(legs, favoriteTeamId);
    if (h2h !== null) {
      points.push({
        h2h,
        favoriteIsHome,
        lambdaHome,
        lambdaAway,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        scheduledAt: fixture.scheduledAt,
        seasonName: fixture.seasonName,
        competitionName: fixture.competitionName,
      });
    }

    processed++;
  }

  out(
    `  ${processed} fixtures avec lambda valide, ${skippedColdStart} exclues (cold-start).`,
  );
  out(
    `  ${points.length} fixtures avec un score H2H v2.0 défini (n>=${H2H_MIN_SAMPLE}).`,
  );

  const splitIdx = Math.floor(points.length * TRAIN_FRACTION);
  const train = points.slice(0, splitIdx);
  const validation = points.slice(splitIdx);

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Ajustement lambda H2H, impact sur TOUS les marchés");
  out(
    `  ${dateLabel} — split chronologique train ${(TRAIN_FRACTION * 100).toFixed(0)}% / validation ${((1 - TRAIN_FRACTION) * 100).toFixed(0)}%`,
  );
  out("═══════════════════════════════════════════════════════");
  out(`  train n=${train.length}, validation n=${validation.length}`);

  if (validation.length < MIN_VALIDATION_SAMPLE) {
    out();
    out(
      `  Validation n=${validation.length} < seuil minimal ${MIN_VALIDATION_SAMPLE} — résultat exploratoire.`,
    );
  }

  out();
  out(
    "--- Recherche du gamma optimal sur le train (objectif : Brier du 1X2 favori uniquement) ---",
  );
  const baselineTrainBrier = brier(
    train.map((p) => ({
      actual: favoriteWinActual(p),
      prob: favoriteWinProbAt(p, 0),
    })),
  );
  let bestGamma = 0;
  let bestTrainBrier = baselineTrainBrier;
  for (const gamma of GAMMA_GRID) {
    const b = brier(
      train.map((p) => ({
        actual: favoriteWinActual(p),
        prob: favoriteWinProbAt(p, gamma),
      })),
    );
    if (b < bestTrainBrier) {
      bestTrainBrier = b;
      bestGamma = gamma;
    }
  }
  out(`  Brier baseline (train, gamma=0) : ${baselineTrainBrier.toFixed(6)}`);
  out(
    `  Meilleur gamma (train)          : ${bestGamma.toFixed(2)}  →  Brier ${bestTrainBrier.toFixed(6)}`,
  );

  out();
  out(
    `--- Impact sur TOUS les marchés, validation uniquement, gamma=${bestGamma.toFixed(2)} (une seule évaluation) ---`,
  );
  const { brierRows, logLossRows } = evaluateAllMarkets(validation, bestGamma);

  out();
  out("  Brier score :");
  out("  marché             | baseline   | corrigé    | delta      | verdict");
  for (const row of brierRows) {
    const delta = row.corrected - row.baseline;
    const verdict = delta < 0 ? "amélioration" : "dégradation";
    out(
      `  ${row.market.padEnd(18)} | ${row.baseline.toFixed(6)} | ${row.corrected.toFixed(6)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(6)} | ${verdict}`,
    );
  }

  out();
  out("  LogLoss :");
  out("  marché             | baseline   | corrigé    | delta      | verdict");
  for (const row of logLossRows) {
    const delta = row.corrected - row.baseline;
    const verdict = delta < 0 ? "amélioration" : "dégradation";
    out(
      `  ${row.market.padEnd(18)} | ${row.baseline.toFixed(6)} | ${row.corrected.toFixed(6)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(6)} | ${verdict}`,
    );
  }

  out();
  out("--- Verdict ---");
  const degraded = brierRows.filter(
    (r) => r.market !== "1X2 favori" && r.corrected > r.baseline,
  );
  const fav1x2 = brierRows.find((r) => r.market === "1X2 favori")!;
  const fav1x2Improved = fav1x2.corrected < fav1x2.baseline;
  out(
    fav1x2Improved
      ? `  1X2 favori amélioré (${fav1x2.baseline.toFixed(6)} -> ${fav1x2.corrected.toFixed(6)}) avec gamma=${bestGamma.toFixed(2)}.`
      : `  1X2 favori PAS amélioré avec gamma=${bestGamma.toFixed(2)} sur cette validation.`,
  );
  if (degraded.length === 0) {
    out(
      "  Aucun marché dérivé (BTTS/OVER/CLEAN SHEET/WIN TO NIL) dégradé — l'ajustement lambda " +
        "propage le signal H2H sans effet de bord négatif détecté sur cette validation.",
    );
  } else {
    out(
      `  ${degraded.length} marché(s) dérivé(s) dégradé(s) : ${degraded.map((r) => r.market).join(", ")} — ` +
        "l'ajustement lambda scope large a un coût sur ces marchés, à peser contre le gain 1X2 avant activation.",
    );
  }
  out(
    "  Rappel : gamma appris pour optimiser le 1X2 uniquement (même signal déjà validé) — " +
      "ce script ne re-fitte pas un gamma par marché, il mesure l'effet de bord du choix scope large.",
  );

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
