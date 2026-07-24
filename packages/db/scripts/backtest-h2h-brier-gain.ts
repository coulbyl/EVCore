/// <reference types="node" />
/**
 * docs/h2h-service-v2-plan.md §5, item 2 — backtest-h2h-signal-value.ts a
 * montré que le score H2H v2.0 (seuil n>=3, decay=0.8, nul=0.5, désormais
 * implémenté dans h2h.service.ts) corrèle avec le résidu (actual-modelProb)
 * du modèle 1X2 (r=0.0785). Une corrélation isolée ne suffit pas à décider
 * d'une activation (docs/h2h-integration-evaluation.md, "Test d'apport
 * incremental") : ce script mesure le gain réel de Brier score sur une
 * correction calibrée du modèle complet, avec séparation chronologique
 * train/validation stricte (le coefficient est appris sur le train, jamais
 * ajusté après observation de la validation).
 *
 * Méthode :
 * - même pipeline modelProb(favori) que backtest-h2h-signal-value.ts
 *   (Poisson + homeAdv/awayDisadv recalibrés 2026-07-19) ;
 * - correction logit(P_corrigee) = logit(P_baseline) + beta * (h2h - 0.5),
 *   signal centré sur 0.5 (score neutre = aucune info directionnelle) pour
 *   que beta ne fasse porter à toutes les fixtures un biais systématique ;
 * - beta appris par recherche en grille sur le train (minimise le Brier
 *   score), puis évalué une seule fois sur la validation ;
 * - split chronologique 70/30 (pas aléatoire, cf. docs/h2h-integration-
 *   evaluation.md "Séparation chronologique").
 *
 * Simplification assumée : un seul beta global, pas de beta par ligue/
 * marché (hors scope de ce premier passage — voir v2.2 du plan pour les
 * signaux par marché).
 *
 * Run: pnpm --filter @evcore/db db:backtest:h2h-brier-gain
 * Output: packages/db/reports/backtest-h2h-brier-gain-YYYY-MM-DD.txt
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
const HOME_FACTOR = 1.0; // recalibré 2026-07-19 (ev.constants.ts)
const AWAY_FACTOR = 0.75;
const H2H_LIMIT = 5; // même défaut que h2h.service.ts
const H2H_MIN_SAMPLE = 3;
const H2H_DECAY = 0.8; // même convention que recentForm
const H2H_NEUTRAL = 0.5;
const PROB_EPSILON = 0.001; // clamp avant logit pour éviter les infinis
const TRAIN_FRACTION = 0.7;
const BETA_GRID: number[] = Array.from(
  { length: 25 },
  (_, i) => Math.round((-0.6 + i * 0.05) * 100) / 100,
); // -0.60 .. 0.60 pas 0.05
const MIN_VALIDATION_SAMPLE = 200; // docs/h2h-integration-evaluation.md — "Evaluation initiale"
const MIN_GROUP_SAMPLE = 100; // seuil "Exploration" (doc) — sous ce volume, groupe reporté mais non concluant

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
  modelProb: number;
  actual: 0 | 1;
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
  return arr.slice(start, lastIdx + 1).reverse(); // most recent first
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

function correctedProb(point: Point, beta: number): number {
  return sigmoid(logit(point.modelProb) + beta * (point.h2h - H2H_NEUTRAL));
}

function brierScore(points: Point[], probFn: (p: Point) => number): number {
  const sum = points.reduce((s, p) => s + (probFn(p) - p.actual) ** 2, 0);
  return sum / points.length;
}

function logLoss(points: Point[], probFn: (p: Point) => number): number {
  const sum = points.reduce((s, p) => {
    const prob = clamp(probFn(p), PROB_EPSILON, 1 - PROB_EPSILON);
    return s + (p.actual === 1 ? -Math.log(prob) : -Math.log(1 - prob));
  }, 0);
  return sum / points.length;
}

function reportGroups(
  out: (line?: string) => void,
  points: Point[],
  beta: number,
  keyFn: (p: Point) => string,
  topN?: number,
): void {
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = keyFn(p);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  let rows = Array.from(groups.entries())
    .map(([name, groupPoints]) => {
      const baseline = brierScore(groupPoints, (p) => p.modelProb);
      const corrected = brierScore(groupPoints, (p) => correctedProb(p, beta));
      return { name, n: groupPoints.length, baseline, corrected };
    })
    .sort((a, b) => b.n - a.n);

  if (topN !== undefined) rows = rows.slice(0, topN);

  out(
    "  groupe                                   | n     | Brier base | Brier corr | delta   | verdict",
  );
  for (const row of rows) {
    const delta = row.corrected - row.baseline;
    const verdict =
      row.n < MIN_GROUP_SAMPLE
        ? "n<seuil, non concluant"
        : delta < 0
          ? "amélioration"
          : "dégradation";
    out(
      `  ${row.name.padEnd(41)} | ${String(row.n).padEnd(5)} | ${row.baseline.toFixed(6)}   | ${row.corrected.toFixed(6)}   | ${delta >= 0 ? "+" : ""}${delta.toFixed(6)} | ${verdict}`,
    );
  }

  const conclusive = rows.filter((r) => r.n >= MIN_GROUP_SAMPLE);
  const improvedCount = conclusive.filter(
    (r) => r.corrected < r.baseline,
  ).length;
  out(
    `  → ${improvedCount}/${conclusive.length} groupes concluants (n>=${MIN_GROUP_SAMPLE}) améliorés.`,
  );
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-h2h-brier-gain-${dateLabel}.txt`,
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

  out("Calcul modelProb(favori) + score H2H v2.0 par fixture...");
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

    const favoriteTeamId =
      probHome >= probAway ? fixture.homeTeamId : fixture.awayTeamId;
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
    const h2h = h2hScoreV2(legs, favoriteTeamId);
    if (h2h !== null) {
      points.push({
        h2h,
        modelProb,
        actual,
        scheduledAt: fixture.scheduledAt,
        seasonName: fixture.seasonName,
        competitionName: fixture.competitionName,
      });
    }

    processed++;
  }

  out(
    `  ${processed} fixtures avec modelProb valide, ${skippedColdStart} exclues (cold-start).`,
  );
  out(
    `  ${points.length} fixtures avec un score H2H v2.0 défini (n>=${H2H_MIN_SAMPLE}).`,
  );

  // Points déjà en ordre chronologique croissant (fixtures triées scheduledAt asc).
  const splitIdx = Math.floor(points.length * TRAIN_FRACTION);
  const train = points.slice(0, splitIdx);
  const validation = points.slice(splitIdx);

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Gain de Brier score, correction H2H v2.0");
  out(
    `  ${dateLabel} — split chronologique train ${(TRAIN_FRACTION * 100).toFixed(0)}% / validation ${((1 - TRAIN_FRACTION) * 100).toFixed(0)}%`,
  );
  out("═══════════════════════════════════════════════════════");
  out(`  train n=${train.length}, validation n=${validation.length}`);

  if (validation.length < MIN_VALIDATION_SAMPLE) {
    out();
    out(
      `  Validation n=${validation.length} < seuil minimal ${MIN_VALIDATION_SAMPLE} ` +
        "(docs/h2h-integration-evaluation.md, 'Evaluation initiale') — " +
        "résultat à traiter comme exploratoire, pas comme décision d'activation.",
    );
  }

  out();
  out(
    "--- Recherche du beta optimal sur le train (grille -0.60..0.60, pas 0.05) ---",
  );
  const baselineTrainBrier = brierScore(train, (p) => p.modelProb);
  let bestBeta = 0;
  let bestTrainBrier = baselineTrainBrier;
  for (const beta of BETA_GRID) {
    const b = brierScore(train, (p) => correctedProb(p, beta));
    if (b < bestTrainBrier) {
      bestTrainBrier = b;
      bestBeta = beta;
    }
  }
  out(`  Brier baseline (train, beta=0) : ${baselineTrainBrier.toFixed(6)}`);
  out(
    `  Meilleur beta (train)          : ${bestBeta.toFixed(2)}  →  Brier ${bestTrainBrier.toFixed(6)}`,
  );

  out();
  out("--- Évaluation du beta retenu sur la validation (une seule fois) ---");
  const baselineValBrier = brierScore(validation, (p) => p.modelProb);
  const correctedValBrier = brierScore(validation, (p) =>
    correctedProb(p, bestBeta),
  );
  const baselineValLogLoss = logLoss(validation, (p) => p.modelProb);
  const correctedValLogLoss = logLoss(validation, (p) =>
    correctedProb(p, bestBeta),
  );
  out(`  Brier baseline (validation)   : ${baselineValBrier.toFixed(6)}`);
  out(
    `  Brier corrigé, beta=${bestBeta.toFixed(2)} (validation) : ${correctedValBrier.toFixed(6)}`,
  );
  out(
    `  Delta Brier (négatif = amélioration) : ${(correctedValBrier - baselineValBrier).toFixed(6)}`,
  );
  out(`  LogLoss baseline (validation)  : ${baselineValLogLoss.toFixed(6)}`);
  out(`  LogLoss corrigé (validation)   : ${correctedValLogLoss.toFixed(6)}`);
  out(
    `  Delta LogLoss (négatif = amélioration) : ${(correctedValLogLoss - baselineValLogLoss).toFixed(6)}`,
  );

  out();
  out(
    "--- Grille complète (référence — beta appris sur train, Brier reporté sur train ET validation) ---",
  );
  out("  beta   | Brier train | Brier validation");
  const gridWithBaseline = Array.from(new Set([0, ...BETA_GRID])).sort(
    (a, b) => a - b,
  );
  for (const beta of gridWithBaseline) {
    const trainB = brierScore(train, (p) => correctedProb(p, beta));
    const valB = brierScore(validation, (p) => correctedProb(p, beta));
    const marker = beta === bestBeta ? "  <- retenu (min train)" : "";
    out(
      `  ${beta.toFixed(2).padStart(6)} | ${trainB.toFixed(6)}    | ${valB.toFixed(6)}${marker}`,
    );
  }

  out();
  out(
    `--- Stabilité par saison (beta=${bestBeta.toFixed(2)} appliqué tel quel, appris sur le train chronologique ci-dessus) ---`,
  );
  out(
    "  Diagnostic, pas un nouveau fit : même beta partout, sur l'ensemble des points " +
      "(train+validation) — vérifie que la correction ne doit pas sa valeur à une seule période.",
  );
  reportGroups(out, points, bestBeta, (p) => p.seasonName);

  out();
  out(
    `--- Stabilité par compétition (beta=${bestBeta.toFixed(2)}, top 20 par volume, min n=${MIN_GROUP_SAMPLE}) ---`,
  );
  reportGroups(out, points, bestBeta, (p) => p.competitionName, 20);

  out();
  out("--- Verdict ---");
  const improved = correctedValBrier < baselineValBrier;
  out(
    improved
      ? `  Amélioration hors échantillon confirmée avec beta=${bestBeta.toFixed(2)} ` +
          `(Brier ${baselineValBrier.toFixed(6)} -> ${correctedValBrier.toFixed(6)}).`
      : `  Pas d'amélioration hors échantillon avec le beta optimal du train ` +
          `(beta=${bestBeta.toFixed(2)}, Brier ${baselineValBrier.toFixed(6)} -> ${correctedValBrier.toFixed(6)}).`,
  );
  out(
    "  Rappel (docs/h2h-integration-evaluation.md, 'Critères d'activation') : " +
      "une amélioration de Brier seule ne suffit pas — vérifier aussi la stabilité " +
      "sur plusieurs périodes/compétitions et le volume minimal par marché avant toute activation.",
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
