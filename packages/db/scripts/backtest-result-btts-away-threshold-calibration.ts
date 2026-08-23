/// <reference types="node" />
/**
 * Calibration walk-forward du SEUIL DE SÉLECTION RESULT_BTTS AWAY (pas la
 * proba) pour UCL/UEL/UECL (pooled — même famille structurelle).
 *
 * Contexte (2026-08-19) : l'audit du replay complet a trouvé RESULT_BTTS
 * AWAY_YES/AWAY_NO à 0/34 sur les picks réellement sélectionnés par VALUE
 * dans ces 3 coupes. `db:backtest:result-btts-shrinkage-calibration` (pooled)
 * a confirmé que ce n'est PAS un problème de proba Poisson brute (aucune
 * amélioration Brier hors échantillon) — le hit rate reste mauvais (6-33%)
 * même aux tranches d'edge les plus basses parmi tout le pool Phase 1
 * (n=1074), donc pas non plus un winner's curse sur l'edge.
 *
 * `result-btts.config.ts` documente sa propre limite : threshold = base ×
 * 0.85, "Not itself ROI-backtested — pure OBSERVATION launch" (même
 * situation que TEAM_TOTAL/RESULT_TOTAL_GOALS/OVER_UNDER_HT à leur lancement
 * — tous trois ont depuis reçu un vrai calibrage ROI ; RESULT_BTTS jamais).
 * Ce script visait ce calibrage pour AWAY spécifiquement, mais les cotes
 * réelles RESULT_BTTS n'existent que depuis ~2026-07-19 (marché trop
 * récent) — un split walk-forward train/test par saison tombe entièrement
 * avant cette date, donc AUCUN pick n'a de cote en train (vérifié : le
 * premier essai ROI donnait n=0 partout). Retombé sur un critère de
 * CALIBRATION pure (écart proba annoncée / hit réel, Brier — dispo sur tout
 * l'historique, pas besoin de cotes) : grid-search sur le ratio (au lieu de
 * 0.85 fixe), walk-forward (train = saisons anciennes poolées UCL/UEL/UECL,
 * test = la plus récente avec assez de volume — même correction de
 * sélection de saison que le script shrinkage), tie-break par probabilité
 * (pas EV — pas de cotes fiables) entre AWAY_YES/AWAY_NO. Ne répond donc
 * qu'à "la sélection est-elle honnête", pas encore "est-elle profitable" —
 * il faudra plus d'historique de cotes réelles pour trancher ça.
 *
 * Run: pnpm --filter @evcore/db db:backtest:result-btts-away-threshold-calibration
 * Output: packages/db/reports/backtest-result-btts-away-threshold-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deriveLambdas,
  computePoissonMarkets,
  getOverUnderShrinkageConfig,
  shrinkOverUnderProbabilities,
  type LambdaConfig,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";
import { Market } from "../src/generated/prisma/client";

const MIN_PRIOR_TEAM_STATS = 5;
const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  meanLambda: 1.4,
  homeAdvFactor: 1.05,
  awayDisadvFactor: 0.95,
  lambdaScale: 1,
};

const POOLED_COMPETITIONS = ["UCL", "UEL", "UECL"];
const CURRENT_RATIO = 0.85;
const RATIO_GRID = [
  0.7,
  0.8,
  0.85,
  0.9,
  1.0,
  1.1,
  1.2,
  1.3,
  1.4,
  1.5,
  Infinity,
];
const MIN_TRAIN_VOLUME = 30;
const MIN_TEST_VOLUME = 15;
const MIN_BRIER_IMPROVEMENT = 0.005; // le point de départ (0/34) est si mauvais qu'on veut une vraie marge, pas 0.001

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

type Candidate = {
  seasonName: string;
  scheduledAt: Date;
  pick: "AWAY_YES" | "AWAY_NO";
  probability: number; // post-shrinkage
  odds: number | null;
  ev: number | null;
  won: boolean;
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

async function main(): Promise<void> {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("Chargement des fixtures terminées UCL/UEL/UECL...");
  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      season: { competition: { code: { in: POOLED_COMPETITIONS } } },
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
        select: { name: true, competition: { select: { code: true } } },
      },
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
  out(`  ${fixtures.length} fixtures.`);
  const fixtureIds = new Set(fixtures.map((f) => f.id));

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
  out(`  ${statsRaw.length} lignes TeamStats (${teamIds.length} équipes).`);

  out("Chargement des cotes réelles RESULT_BTTS (AWAY_YES/AWAY_NO)...");
  const oddsRaw = await prisma.oddsSnapshot.findMany({
    where: {
      market: Market.RESULT_BTTS,
      pick: { in: ["AWAY_YES", "AWAY_NO"] },
      odds: { not: null },
    },
    select: { fixtureId: true, pick: true, odds: true, snapshotAt: true },
  });
  const bestOdds = new Map<string, { odds: number; snapshotAt: Date }>();
  for (const row of oddsRaw) {
    if (!fixtureIds.has(row.fixtureId) || row.pick === null) continue;
    const key = `${row.fixtureId}::${row.pick}`;
    const current = bestOdds.get(key);
    if (!current || row.snapshotAt.getTime() > current.snapshotAt.getTime()) {
      bestOdds.set(key, { odds: Number(row.odds), snapshotAt: row.snapshotAt });
    }
  }
  out(`  ${bestOdds.size} paires (fixture, pick) résolues.`);

  out("Replay du pipeline (Poisson + shrinkage courant) par fixture...");
  const points: {
    seasonName: string;
    scheduledAt: Date;
    away_yes: { probability: number; odds: number | null; won: boolean };
    away_no: { probability: number; odds: number | null; won: boolean };
  }[] = [];
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
    const raw = computePoissonMarkets(lambda.home, lambda.away);
    const config = getOverUnderShrinkageConfig(fixture.competitionCode);
    const shrunk = shrinkOverUnderProbabilities(raw, config);
    processed++;

    const actualAway = fixture.awayScore > fixture.homeScore;
    const actualBtts = fixture.homeScore > 0 && fixture.awayScore > 0;
    const yesOdds = bestOdds.get(`${fixture.id}::AWAY_YES`)?.odds ?? null;
    const noOdds = bestOdds.get(`${fixture.id}::AWAY_NO`)?.odds ?? null;

    points.push({
      seasonName: fixture.seasonName,
      scheduledAt: fixture.scheduledAt,
      away_yes: {
        probability: (shrunk.resultBtts.AWAY_YES ??
          raw.resultBtts.AWAY_YES)!.toNumber(),
        odds: yesOdds,
        won: actualAway && actualBtts,
      },
      away_no: {
        probability: (shrunk.resultBtts.AWAY_NO ??
          raw.resultBtts.AWAY_NO)!.toNumber(),
        odds: noOdds,
        won: actualAway && !actualBtts,
      },
    });
  }
  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start).`,
  );

  const seasonOrder = Array.from(
    new Set(
      points
        .slice()
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
        .map((p) => p.seasonName),
    ),
  );

  let latestSeason: string | undefined;
  for (let i = seasonOrder.length - 1; i >= 1; i--) {
    const candidate = seasonOrder[i]!;
    const n = points.filter((p) => p.seasonName === candidate).length;
    if (n >= MIN_TEST_VOLUME) {
      latestSeason = candidate;
      break;
    }
  }
  if (latestSeason === undefined) {
    out("❌ Aucune saison récente n'atteint MIN_TEST_VOLUME — abandon.");
    writeFileSync(
      join(
        reportsDir,
        `backtest-result-btts-away-threshold-calibration-${dateLabel}.txt`,
      ),
      `${lines.join("\n")}\n`,
    );
    return;
  }
  const trainCutoff = seasonOrder.indexOf(latestSeason);
  const train = points.filter(
    (p) => seasonOrder.indexOf(p.seasonName) < trainCutoff,
  );
  const test = points.filter((p) => p.seasonName === latestSeason);
  out(
    `Train: ${train.length} fixtures. Test (${latestSeason}): ${test.length} fixtures.`,
  );

  function baseRates(pool: typeof points): { yes: number; no: number } {
    return {
      yes: pool.reduce((s, p) => s + (p.away_yes.won ? 1 : 0), 0) / pool.length,
      no: pool.reduce((s, p) => s + (p.away_no.won ? 1 : 0), 0) / pool.length,
    };
  }

  // Simulates decideResultBtts's AWAY-only qualification + tie-break — no
  // real odds coverage before ~2026-07-19 (see console warning above), so
  // EV can't drive the tie-break or the metric here the way production
  // does. Falls back to probability (matches compareResultBttsCandidates'
  // own fallback when a candidate has no priced EV) and measures
  // CALIBRATION of the selected subset (avg predicted prob vs actual hit
  // rate, and Brier) instead of ROI — the question this answers is "does
  // raising the bar make the selected picks honest", not yet "profitable"
  // (that needs more odds history to accumulate before it can be validated
  // the way the other ratio/edge calibrations in this session were).
  function simulate(
    pool: typeof points,
    ratio: number,
    base: { yes: number; no: number },
  ): { n: number; avgProb: number; hitRate: number; brier: number } {
    const picks: Candidate[] = [];
    for (const p of pool) {
      const yesQualifies =
        ratio !== Infinity && p.away_yes.probability >= ratio * base.yes;
      const noQualifies =
        ratio !== Infinity && p.away_no.probability >= ratio * base.no;
      if (!yesQualifies && !noQualifies) continue;
      const useYes =
        !noQualifies ||
        (yesQualifies && p.away_yes.probability >= p.away_no.probability);
      const chosen = useYes ? p.away_yes : p.away_no;
      picks.push({
        seasonName: p.seasonName,
        scheduledAt: p.scheduledAt,
        pick: useYes ? "AWAY_YES" : "AWAY_NO",
        probability: chosen.probability,
        odds: chosen.odds,
        ev: null,
        won: chosen.won,
      });
    }
    const n = picks.length;
    if (n === 0) return { n: 0, avgProb: 0, hitRate: 0, brier: 0 };
    const avgProb = picks.reduce((s, p) => s + p.probability, 0) / n;
    const hitRate = picks.filter((p) => p.won).length / n;
    const brier =
      picks.reduce((s, p) => s + (p.probability - (p.won ? 1 : 0)) ** 2, 0) / n;
    return { n, avgProb, hitRate, brier };
  }

  const trainBase = baseRates(train);
  out();
  out(
    `Base rates (train) : AWAY_YES=${(trainBase.yes * 100).toFixed(1)}% AWAY_NO=${(trainBase.no * 100).toFixed(1)}%`,
  );
  out(
    "⚠️ Pas de cotes réelles avant ~2026-07-19 (marché trop récent) — critère de choix : calibration (écart proba/hit, Brier), pas ROI.",
  );
  out();
  out("ratio\tn(train)\tproba annoncée\thit réel\técart\tbrier");
  let bestRatio: number | null = null;
  let bestGap = Infinity;
  const currentTrain = simulate(train, CURRENT_RATIO, trainBase);
  for (const ratio of RATIO_GRID) {
    const m = simulate(train, ratio, trainBase);
    const gap = m.n > 0 ? m.avgProb - m.hitRate : Infinity;
    out(
      `${ratio === Infinity ? "none" : ratio}\t${m.n}\t${(m.avgProb * 100).toFixed(1)}%\t\t${(m.hitRate * 100).toFixed(1)}%\t${(gap * 100).toFixed(1)}pp\t${m.brier.toFixed(4)}`,
    );
    if (
      ratio !== CURRENT_RATIO &&
      m.n >= MIN_TRAIN_VOLUME &&
      Math.abs(gap) < Math.abs(bestGap) &&
      currentTrain.brier - m.brier >= MIN_BRIER_IMPROVEMENT
    ) {
      bestGap = gap;
      bestRatio = ratio;
    }
  }
  out();
  out(
    `Baseline (ratio actuel ${CURRENT_RATIO}) TRAIN: n=${currentTrain.n} écart=${((currentTrain.avgProb - currentTrain.hitRate) * 100).toFixed(1)}pp brier=${currentTrain.brier.toFixed(4)}`,
  );

  if (bestRatio === null) {
    out();
    out(
      `❌ Aucun ratio ne réduit l'écart de calibration de façon notable sur le train (n≥${MIN_TRAIN_VOLUME}) — pas assez de signal pour recommander un changement de seuil avec ces données.`,
    );
  } else {
    const testCurrent = simulate(test, CURRENT_RATIO, trainBase);
    const testBest = simulate(test, bestRatio, trainBase);
    const gapCurrent = testCurrent.avgProb - testCurrent.hitRate;
    const gapBest = testBest.avgProb - testBest.hitRate;
    out();
    out(
      `--- Validation hors échantillon (TEST, ${latestSeason}) — ratio retenu: ${bestRatio} ---`,
    );
    out(
      `Ratio actuel (${CURRENT_RATIO}) : n=${testCurrent.n} proba=${(testCurrent.avgProb * 100).toFixed(1)}% hit=${(testCurrent.hitRate * 100).toFixed(1)}% écart=${(gapCurrent * 100).toFixed(1)}pp brier=${testCurrent.brier.toFixed(4)}`,
    );
    out(
      `Ratio proposé (${bestRatio})   : n=${testBest.n} proba=${(testBest.avgProb * 100).toFixed(1)}% hit=${(testBest.hitRate * 100).toFixed(1)}% écart=${(gapBest * 100).toFixed(1)}pp brier=${testBest.brier.toFixed(4)}`,
    );
    out();
    if (testBest.n >= MIN_TEST_VOLUME && testBest.brier < testCurrent.brier) {
      out(
        `✅ Le ratio ${bestRatio} généralise (Brier test ${testBest.brier.toFixed(4)} < actuel ${testCurrent.brier.toFixed(4)}, n=${testBest.n}) — MAIS ceci valide la calibration, pas la profitabilité (pas assez de cotes réelles pour ça encore). À traiter comme un premier pas, pas une solution complète.`,
      );
      out();
      out(
        "--- Config générée (result-btts.config.ts, threshold = ratio × base) ---",
      );
      for (const code of POOLED_COMPETITIONS) {
        out(
          `// ${code} AWAY_YES: threshold ${bestRatio === Infinity ? "n/a (désactivé)" : (bestRatio * trainBase.yes).toFixed(4)} (base ${trainBase.yes.toFixed(4)})`,
        );
        out(
          `// ${code} AWAY_NO:  threshold ${bestRatio === Infinity ? "n/a (désactivé)" : (bestRatio * trainBase.no).toFixed(4)} (base ${trainBase.no.toFixed(4)})`,
        );
      }
    } else {
      out(
        `❌ Le ratio ${bestRatio} ne généralise PAS (Brier test ${testBest.brier.toFixed(4)} vs actuel ${testCurrent.brier.toFixed(4)}, n=${testBest.n}) — le gain train était probablement du bruit.`,
      );
    }
  }

  const report = lines.join("\n");
  const path = join(
    reportsDir,
    `backtest-result-btts-away-threshold-calibration-${dateLabel}.txt`,
  );
  writeFileSync(path, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${path.split("/").pop()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
