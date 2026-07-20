/// <reference types="node" />
/**
 * Grid-search de recalibration de HOME_ADVANTAGE_LAMBDA_FACTOR /
 * AWAY_DISADVANTAGE_LAMBDA_FACTOR (apps/backend/.../ev.constants.ts).
 *
 * Motivation : le backtest de calibration des nouveaux marchés
 * (docs/new-markets-calibration-backtest.md) a mis en évidence un biais
 * systématique HOME sous-estimé / AWAY sur-estimé sur les 10 nouveaux
 * marchés, confirmé aussi sur ONE_X_TWO en prod (picks SELECTED : AWAY
 * prédit 63.1% / réel 51.1%). Ce script cherche la paire
 * (homeAdvFactor, awayDisadvFactor) qui minimise le Brier score 3-way
 * (home/draw/away) sur tout l'historique, en réimplémentant la partie
 * "raw lambda" de deriveLambdas() une seule fois par fixture (pré-facteur),
 * puis en appliquant chaque candidat par simple multiplication — évite de
 * rappeler tout le pipeline Decimal/Poisson complet 200+ fois par fixture.
 *
 * Simplifications documentées (mêmes réserves que
 * backtest-new-markets-calibration.ts) :
 * - meanLambda = 1.4 (LEAGUE_MEAN_LAMBDA_DEFAULT) pour toutes les ligues,
 *   pas de config par ligue.
 * - lambdaScale = 1 pour toutes les ligues.
 * - Recherche sur le facteur GLOBAL par défaut uniquement (celui qui
 *   s'applique à la grande majorité des ligues actives) — pas de
 *   recalibration par ligue dans ce premier passage.
 * - maxGoals=8 pendant la recherche (vitesse), maxGoals=10 (défaut prod)
 *   pour la validation finale du meilleur candidat via computePoissonMarkets.
 *
 * Run: pnpm --filter @evcore/db db:backtest:home-advantage
 * Output: packages/db/reports/backtest-home-advantage-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computePoissonMarkets,
  calibrationError,
  type CalibrationPoint,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const MEAN_LAMBDA = 1.4; // LEAGUE_MEAN_LAMBDA_DEFAULT
const SHRINKAGE_FACTOR = 0.7; // LAMBDA_SHRINKAGE_FACTOR (analysis-core + ev.constants.ts, identiques aujourd'hui)
const CURRENT_HOME_FACTOR = 1.05;
const CURRENT_AWAY_FACTOR = 0.95;

type FixtureRow = {
  scheduledAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

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

const FACTORIALS: number[] = [1];
for (let i = 1; i <= 12; i++) FACTORIALS.push(FACTORIALS[i - 1]! * i);

function poissonPmf(lambda: number, k: number): number {
  return (Math.exp(-lambda) * lambda ** k) / FACTORIALS[k]!;
}

function threeWay(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number,
): { home: number; draw: number; away: number } {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= maxGoals; h++) {
    const ph = poissonPmf(lambdaHome, h);
    for (let a = 0; a <= maxGoals; a++) {
      const p = ph * poissonPmf(lambdaAway, a);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  return { home, draw, away };
}

type Raw = { rawHome: number; rawAway: number; outcome: 0 | 1 | 2 }; // 0=home,1=draw,2=away

type Candidate = {
  homeFactor: number;
  awayFactor: number;
  brier: number;
  avgHomeProb: number;
  homeHitRate: number;
  avgAwayProb: number;
  awayHitRate: number;
};

function runGridSearch(
  raws: Raw[],
  homeFactors: number[],
  awayFactors: number[],
  maxGoals: number,
): { best: Candidate; all: Candidate[] } {
  let best: Candidate | null = null;
  const all: Candidate[] = [];
  for (const homeFactor of homeFactors) {
    for (const awayFactor of awayFactors) {
      let brierSum = 0;
      let homeProbSum = 0;
      let homeHitSum = 0;
      let awayProbSum = 0;
      let awayHitSum = 0;
      for (const r of raws) {
        const lambdaHome = clamp(r.rawHome * homeFactor, 0.05, 5);
        const lambdaAway = clamp(r.rawAway * awayFactor, 0.05, 5);
        const { home, draw, away } = threeWay(lambdaHome, lambdaAway, maxGoals);
        const actualHome = r.outcome === 0 ? 1 : 0;
        const actualDraw = r.outcome === 1 ? 1 : 0;
        const actualAway = r.outcome === 2 ? 1 : 0;
        brierSum +=
          (home - actualHome) ** 2 +
          (draw - actualDraw) ** 2 +
          (away - actualAway) ** 2;
        homeProbSum += home;
        homeHitSum += actualHome;
        awayProbSum += away;
        awayHitSum += actualAway;
      }
      const n = raws.length;
      const candidate: Candidate = {
        homeFactor,
        awayFactor,
        brier: brierSum / n,
        avgHomeProb: homeProbSum / n,
        homeHitRate: homeHitSum / n,
        avgAwayProb: awayProbSum / n,
        awayHitRate: awayHitSum / n,
      };
      all.push(candidate);
      if (best === null || candidate.brier < best.brier) best = candidate;
    }
  }
  all.sort((a, b) => a.brier - b.brier);
  return { best: best!, all };
}

function validateFull(
  raws: Raw[],
  homeFactor: number,
  awayFactor: number,
): { brier: number; homeEce: number; awayEce: number } {
  const homePoints: CalibrationPoint[] = [];
  const awayPoints: CalibrationPoint[] = [];
  let brierSum = 0;
  for (const r of raws) {
    const lambdaHome = clamp(r.rawHome * homeFactor, 0.05, 5);
    const lambdaAway = clamp(r.rawAway * awayFactor, 0.05, 5);
    const markets = computePoissonMarkets(lambdaHome, lambdaAway);
    const home = markets.home.toNumber();
    const draw = markets.draw.toNumber();
    const away = markets.away.toNumber();
    const actualHome = r.outcome === 0 ? 1 : 0;
    const actualDraw = r.outcome === 1 ? 1 : 0;
    const actualAway = r.outcome === 2 ? 1 : 0;
    brierSum +=
      (home - actualHome) ** 2 +
      (draw - actualDraw) ** 2 +
      (away - actualAway) ** 2;
    homePoints.push({ prob: home, actual: actualHome });
    awayPoints.push({ prob: away, actual: actualAway });
  }
  return {
    brier: brierSum / raws.length,
    homeEce: calibrationError(homePoints),
    awayEce: calibrationError(awayPoints),
  };
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

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-home-advantage-calibration-${dateLabel}.txt`,
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
    },
    orderBy: { scheduledAt: "asc" },
  });
  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
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

  out("Calcul des lambdas bruts (pré-facteur) par fixture...");
  const raws: Raw[] = [];
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
    const { rawHome, rawAway } = rawLambdas(home.stats, away.stats);
    const outcome: 0 | 1 | 2 =
      fixture.homeScore > fixture.awayScore
        ? 0
        : fixture.awayScore > fixture.homeScore
          ? 2
          : 1;
    raws.push({ rawHome, rawAway, outcome });
  }
  out(
    `  ${raws.length} fixtures utilisables, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats).`,
  );

  out("Grid-search homeAdvFactor × awayDisadvFactor (Brier 3-way)...");
  const SEARCH_MAX_GOALS = 8;
  const homeFactors: number[] = [];
  for (let v = 0.95; v <= 1.301; v += 0.025)
    homeFactors.push(Math.round(v * 1000) / 1000);
  const awayFactors: number[] = [];
  for (let v = 0.65; v <= 1.001; v += 0.025)
    awayFactors.push(Math.round(v * 1000) / 1000);

  const { best, all: allCandidates } = runGridSearch(
    raws,
    homeFactors,
    awayFactors,
    SEARCH_MAX_GOALS,
  );

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Recalibration homeAdvFactor / awayDisadvFactor");
  out(`  ${dateLabel} — grid-search Brier 3-way sur ${raws.length} fixtures`);
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `Grille : ${homeFactors.length} × ${awayFactors.length} = ${homeFactors.length * awayFactors.length} candidats.`,
  );
  out();

  // Valeur actuelle pour comparaison directe.
  const currentCandidate = allCandidates.find(
    (c) =>
      c.homeFactor === CURRENT_HOME_FACTOR &&
      c.awayFactor === CURRENT_AWAY_FACTOR,
  );
  out(
    `Config actuelle (ev.constants.ts) : homeAdvFactor=${CURRENT_HOME_FACTOR}, awayDisadvFactor=${CURRENT_AWAY_FACTOR}`,
  );
  if (currentCandidate) {
    out(
      `  Brier=${currentCandidate.brier.toFixed(4)}  HOME proba moy=${(100 * currentCandidate.avgHomeProb).toFixed(1)}% / réel=${(100 * currentCandidate.homeHitRate).toFixed(1)}%  AWAY proba moy=${(100 * currentCandidate.avgAwayProb).toFixed(1)}% / réel=${(100 * currentCandidate.awayHitRate).toFixed(1)}%`,
    );
  } else {
    out(
      "  (hors grille exacte — voir top 10 ci-dessous pour les valeurs proches)",
    );
  }
  out();

  out("Top 10 candidats (Brier 3-way croissant) :");
  for (const c of allCandidates.slice(0, 10)) {
    out(
      `  home=${c.homeFactor.toFixed(3)} away=${c.awayFactor.toFixed(3)}  Brier=${c.brier.toFixed(4)}  HOME proba moy=${(100 * c.avgHomeProb).toFixed(1)}%/réel=${(100 * c.homeHitRate).toFixed(1)}%  AWAY proba moy=${(100 * c.avgAwayProb).toFixed(1)}%/réel=${(100 * c.awayHitRate).toFixed(1)}%`,
    );
  }
  out();

  if (best !== null) {
    out(
      `Meilleur candidat : homeAdvFactor=${best.homeFactor}, awayDisadvFactor=${best.awayFactor} (Brier=${best.brier.toFixed(4)})`,
    );
    out();
    out(
      "Validation avec le pipeline complet (computePoissonMarkets, maxGoals=10 par défaut)...",
    );

    const beforeValidation = validateFull(
      raws,
      CURRENT_HOME_FACTOR,
      CURRENT_AWAY_FACTOR,
    );
    const afterValidation = validateFull(
      raws,
      best.homeFactor,
      best.awayFactor,
    );

    out();
    out("Avant (config actuelle 1.05 / 0.95) :");
    out(
      `  Brier 3-way=${beforeValidation.brier.toFixed(4)}  ECE HOME=${beforeValidation.homeEce.toFixed(4)}  ECE AWAY=${beforeValidation.awayEce.toFixed(4)}`,
    );
    out(`Après (candidat retenu ${best.homeFactor} / ${best.awayFactor}) :`);
    out(
      `  Brier 3-way=${afterValidation.brier.toFixed(4)}  ECE HOME=${afterValidation.homeEce.toFixed(4)}  ECE AWAY=${afterValidation.awayEce.toFixed(4)}`,
    );

    out();
    out("═══════════════════════════════════════════════════════");
    out("  Validation chronologique (anti-overfit)");
    out("═══════════════════════════════════════════════════════");
    out();
    out(
      "Entraînement du grid-search sur les 70% premiers matchs (chronologique),",
    );
    out(
      "validation sur les 30% derniers (jamais vus par la recherche) — si le",
    );
    out("candidat retenu ne bat plus la config actuelle en hors-échantillon,");
    out("c'est un signe d'overfit plutôt qu'un vrai biais structurel.");
    out();

    const splitIdx = Math.floor(raws.length * 0.7);
    const trainRaws = raws.slice(0, splitIdx);
    const testRaws = raws.slice(splitIdx);
    out(
      `  Train : ${trainRaws.length} fixtures (les plus anciennes) — Test : ${testRaws.length} fixtures (les plus récentes)`,
    );
    out();

    const { best: bestTrain } = runGridSearch(
      trainRaws,
      homeFactors,
      awayFactors,
      SEARCH_MAX_GOALS,
    );
    out(
      `  Meilleur candidat sur le train seul : homeAdvFactor=${bestTrain.homeFactor}, awayDisadvFactor=${bestTrain.awayFactor} (Brier train=${bestTrain.brier.toFixed(4)})`,
    );
    out();

    const currentOnTest = validateFull(
      testRaws,
      CURRENT_HOME_FACTOR,
      CURRENT_AWAY_FACTOR,
    );
    const trainedOnTest = validateFull(
      testRaws,
      bestTrain.homeFactor,
      bestTrain.awayFactor,
    );
    const fullOnTest = validateFull(testRaws, best.homeFactor, best.awayFactor);

    out(
      "Sur le jeu de test (30% les plus récents, jamais vus par le grid-search train) :",
    );
    out(
      `  Config actuelle (1.05 / 0.95)              : Brier=${currentOnTest.brier.toFixed(4)}  ECE HOME=${currentOnTest.homeEce.toFixed(4)}  ECE AWAY=${currentOnTest.awayEce.toFixed(4)}`,
    );
    out(
      `  Candidat entraîné sur train (${bestTrain.homeFactor} / ${bestTrain.awayFactor})       : Brier=${trainedOnTest.brier.toFixed(4)}  ECE HOME=${trainedOnTest.homeEce.toFixed(4)}  ECE AWAY=${trainedOnTest.awayEce.toFixed(4)}`,
    );
    out(
      `  Candidat entraîné sur tout l'historique (${best.homeFactor} / ${best.awayFactor}) : Brier=${fullOnTest.brier.toFixed(4)}  ECE HOME=${fullOnTest.homeEce.toFixed(4)}  ECE AWAY=${fullOnTest.awayEce.toFixed(4)}`,
    );
    out();
    if (trainedOnTest.brier < currentOnTest.brier) {
      out(
        "  → Le candidat entraîné sur le train seul bat toujours la config actuelle en hors-échantillon : signal robuste, pas un simple overfit.",
      );
    } else {
      out(
        "  → Le candidat entraîné sur le train seul NE bat PAS la config actuelle en hors-échantillon : signe d'overfit, ne pas appliquer tel quel.",
      );
    }
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
