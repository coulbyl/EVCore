/// <reference types="node" />
/**
 * Re-fit des facteurs domicile / extérieur des lambdas, scoré sur le 1X2 ET
 * les marchés « buts », dans la chaîne de production complète.
 *
 * POURQUOI. `AWAY_DISADVANTAGE_LAMBDA_FACTOR = 0,75` a été ajusté le
 * 2026-07-19 (backtest-home-advantage-calibration.ts) en minimisant le Brier
 * 3-way SEUL, avec meanLambda 1,4 et lambdaScale 1 pour toutes les ligues. Le
 * produit 1,00 × 0,75 retire ~12 % des buts attendus et n'a jamais été scoré
 * sur Over/Under ni BTTS. Mesuré en production le 2026-10-05 (runs
 * pré-coup d'envoi depuis le 20 juillet, n = 4 387) : Over 2.5 annoncé 0,478
 * contre 0,534 réalisé, BTTS 0,502 contre 0,549, λ total 2,53 contre 2,81.
 * Les blocs `OU_SHRINKAGE_CONFIG` re-fittés le 2026-08-15 ont absorbé une
 * partie du biais ligue par ligue ; ce script les laisse en place et mesure
 * aussi la chaîne SANS eux pour voir ce qu'ils compensent.
 *
 * CE QUI EST REJOUÉ. Exactement la chaîne de BettingEngineService :
 * deriveLambdas(config par ligue) → computePoissonMarkets →
 * rebalanceThreeWayProbabilities(poids empirique par ligue) →
 * shrinkOverUnderProbabilities(bloc par ligue). Seule la paire (homeAdv,
 * awayDisadv) varie. Les xG sont point-in-time : dernière ligne team_stats de
 * la saison avant le coup d'envoi, ≥ MIN_PRIOR_TEAM_STATS lignes.
 *
 * PROTOCOLE (même séquence que runValidationProtocol de backtest-core, non
 * importé pour éviter un cycle de dépendances db ↔ backtest-core) : grille et
 * critère figés ci-dessous ; le choix se fait sur la fenêtre de sélection
 * (< SPLIT_DATE) et sur elle seule ; la configuration retenue est mesurée UNE
 * fois sur la fenêtre de validation. Le critère est la somme des Brier 1X2 +
 * Over 2.5 + BTTS de la chaîne de production (shrinkage inclus).
 *
 * Run: pnpm --filter @evcore/db db:backtest:lambda-factors
 * Output: packages/db/reports/backtest-lambda-factors-goal-conservation-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computePoissonMarkets,
  deriveLambdas,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  getLeagueThreeWayEmpiricalBlendWeight,
  getOverUnderShrinkageConfig,
  rebalanceThreeWayProbabilities,
  shrinkOverUnderProbabilities,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const FROM_DATE = new Date("2023-07-01T00:00:00.000Z");
/** Sélection < SPLIT_DATE ≤ validation. */
const SPLIT_DATE = new Date("2026-01-01T00:00:00.000Z");
const MIN_WINDOW_FIXTURES = 5_000;

const CURRENT_PAIR = { homeAdv: 1.0, awayDisadv: 0.75 } as const;
const HOME_GRID = [1.0, 1.05, 1.1, 1.15] as const;
const AWAY_GRID = [0.75, 0.8, 0.85, 0.9, 0.95] as const;

type OverrideMode = "keep" | "drop";
type Config = {
  homeAdv: number;
  awayDisadv: number;
  /** keep: les overrides LEAGUE_HOME_ADVANTAGE_MAP (D2, I2, UCL, UEL, UECL)
   *  gardent leur paire ; drop: la paire de la grille s'applique partout. */
  overrides: OverrideMode;
};

const GRID: Config[] = (["keep", "drop"] as const).flatMap((overrides) =>
  HOME_GRID.flatMap((homeAdv) =>
    AWAY_GRID.map((awayDisadv) => ({ homeAdv, awayDisadv, overrides })),
  ),
);

type FixtureRow = {
  scheduledAt: Date;
  seasonId: string;
  competitionCode: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

type Sample = {
  scheduledAt: Date;
  competitionCode: string;
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  homeWon: 0 | 1;
  draw: 0 | 1;
  awayWon: 0 | 1;
  over25: 0 | 1;
  btts: 0 | 1;
  goals: number;
};

type Accumulator = {
  n: number;
  brier3: number;
  brierOver: number;
  brierBtts: number;
  brierOverRaw: number;
  brierBttsRaw: number;
  lambdaTotal: number;
  goals: number;
  pOver: number;
  over: number;
  pBtts: number;
  btts: number;
  pHome: number;
  home: number;
  pAway: number;
  away: number;
};

type Summary = Accumulator & { sum: number };

function emptyAccumulator(): Accumulator {
  return {
    n: 0,
    brier3: 0,
    brierOver: 0,
    brierBtts: 0,
    brierOverRaw: 0,
    brierBttsRaw: 0,
    lambdaTotal: 0,
    goals: 0,
    pOver: 0,
    over: 0,
    pBtts: 0,
    btts: 0,
    pHome: 0,
    home: 0,
    pAway: 0,
    away: 0,
  };
}

function finish(acc: Accumulator): Summary {
  const n = Math.max(acc.n, 1);
  const mean = (v: number) => v / n;
  const summary: Summary = {
    n: acc.n,
    brier3: mean(acc.brier3),
    brierOver: mean(acc.brierOver),
    brierBtts: mean(acc.brierBtts),
    brierOverRaw: mean(acc.brierOverRaw),
    brierBttsRaw: mean(acc.brierBttsRaw),
    lambdaTotal: mean(acc.lambdaTotal),
    goals: mean(acc.goals),
    pOver: mean(acc.pOver),
    over: mean(acc.over),
    pBtts: mean(acc.pBtts),
    btts: mean(acc.btts),
    pHome: mean(acc.pHome),
    home: mean(acc.home),
    pAway: mean(acc.pAway),
    away: mean(acc.away),
    sum: 0,
  };
  summary.sum = summary.brier3 + summary.brierOver + summary.brierBtts;
  return summary;
}

/** Critère figé : plus grand est meilleur. */
function criterion(summary: Summary): number {
  return -summary.sum;
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

function factorsFor(config: Config, competitionCode: string): [number, number] {
  if (config.overrides === "keep") {
    const [h, a] = getLeagueHomeAwayFactors(competitionCode);
    // Les ligues sans override reçoivent le global ; getLeagueHomeAwayFactors
    // renvoie le global courant (1,00 / 0,75) pour elles — on le remplace par
    // la paire de la grille, et on garde la paire propre des ligues listées.
    const isOverride =
      h !== CURRENT_PAIR.homeAdv || a !== CURRENT_PAIR.awayDisadv;
    return isOverride ? [h, a] : [config.homeAdv, config.awayDisadv];
  }
  return [config.homeAdv, config.awayDisadv];
}

/** Une passe sur tous les échantillons, ventilée par fenêtre. */
function evaluate(
  config: Config,
  samples: readonly Sample[],
): { selection: Summary; validation: Summary } {
  const selection = emptyAccumulator();
  const validation = emptyAccumulator();

  for (const sample of samples) {
    const [homeAdvFactor, awayDisadvFactor] = factorsFor(
      config,
      sample.competitionCode,
    );
    const lambda = deriveLambdas(sample.homeStats, sample.awayStats, {
      meanLambda: getLeagueMeanLambda(sample.competitionCode),
      homeAdvFactor,
      awayDisadvFactor,
      lambdaScale: getLeagueLambdaScale(sample.competitionCode),
    });
    const raw = computePoissonMarkets(lambda.home, lambda.away);
    const rebalanced = rebalanceThreeWayProbabilities({
      probabilities: raw,
      homeStats: sample.homeStats,
      awayStats: sample.awayStats,
      blendWeight: getLeagueThreeWayEmpiricalBlendWeight(
        sample.competitionCode,
      ),
    });
    const shrunk = shrinkOverUnderProbabilities(
      rebalanced,
      getOverUnderShrinkageConfig(sample.competitionCode),
    );

    const pHome = shrunk.home.toNumber();
    const pDraw = shrunk.draw.toNumber();
    const pAway = shrunk.away.toNumber();
    const pOver = shrunk.over25.toNumber();
    const pBtts = shrunk.bttsYes.toNumber();
    const pOverRaw = rebalanced.over25.toNumber();
    const pBttsRaw = rebalanced.bttsYes.toNumber();

    const acc =
      sample.scheduledAt.getTime() < SPLIT_DATE.getTime()
        ? selection
        : validation;
    acc.n += 1;
    acc.brier3 +=
      (pHome - sample.homeWon) ** 2 +
      (pDraw - sample.draw) ** 2 +
      (pAway - sample.awayWon) ** 2;
    acc.brierOver += (pOver - sample.over25) ** 2;
    acc.brierBtts += (pBtts - sample.btts) ** 2;
    acc.brierOverRaw += (pOverRaw - sample.over25) ** 2;
    acc.brierBttsRaw += (pBttsRaw - sample.btts) ** 2;
    acc.lambdaTotal += lambda.home + lambda.away;
    acc.goals += sample.goals;
    acc.pOver += pOver;
    acc.over += sample.over25;
    acc.pBtts += pBtts;
    acc.btts += sample.btts;
    acc.pHome += pHome;
    acc.home += sample.homeWon;
    acc.pAway += pAway;
    acc.away += sample.awayWon;
  }

  return { selection: finish(selection), validation: finish(validation) };
}

function configLabel(config: Config): string {
  return `h=${config.homeAdv.toFixed(3)} a=${config.awayDisadv.toFixed(3)} overrides=${config.overrides}`;
}

function formatSummary(s: Summary): string {
  const f = (v: number, d = 5) => v.toFixed(d);
  return (
    `n=${s.n} | brier3=${f(s.brier3)} over25=${f(s.brierOver)} btts=${f(s.brierBtts)} sum=${f(s.sum)}` +
    ` | sans shrink: over25=${f(s.brierOverRaw)} btts=${f(s.brierBttsRaw)}` +
    ` | λtot=${f(s.lambdaTotal, 3)} buts=${f(s.goals, 3)}` +
    ` | P(over) ${f(s.pOver, 3)} vs ${f(s.over, 3)} | P(btts) ${f(s.pBtts, 3)} vs ${f(s.btts, 3)}` +
    ` | P(home) ${f(s.pHome, 3)} vs ${f(s.home, 3)} | P(away) ${f(s.pAway, 3)} vs ${f(s.away, 3)}`
  );
}

async function loadSamples(out: (line?: string) => void): Promise<Sample[]> {
  out("Chargement des fixtures terminées (compétitions de backtest)...");
  const fixturesRaw = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      scheduledAt: { gte: FROM_DATE, lt: new Date() },
      season: { competition: { includeInBacktest: true } },
    },
    select: {
      scheduledAt: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      season: { select: { competition: { select: { code: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const fixtures: FixtureRow[] = fixturesRaw.map((f) => ({
    scheduledAt: f.scheduledAt,
    seasonId: f.seasonId,
    competitionCode: f.season.competition.code,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
  }));
  out(`  ${fixtures.length} fixtures.`);

  out("Chargement des team_stats point-in-time...");
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
  out(`  ${statsRaw.length} lignes team_stats, ${teamIds.length} équipes.`);

  const samples: Sample[] = [];
  let skipped = 0;
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
      away.priorCount < MIN_PRIOR_TEAM_STATS ||
      home.stats.xgFor === null ||
      away.stats.xgFor === null
    ) {
      skipped += 1;
      continue;
    }
    const { homeScore, awayScore } = fixture;
    samples.push({
      scheduledAt: fixture.scheduledAt,
      competitionCode: fixture.competitionCode,
      homeStats: home.stats,
      awayStats: away.stats,
      homeWon: homeScore > awayScore ? 1 : 0,
      draw: homeScore === awayScore ? 1 : 0,
      awayWon: homeScore < awayScore ? 1 : 0,
      over25: homeScore + awayScore > 2 ? 1 : 0,
      btts: homeScore > 0 && awayScore > 0 ? 1 : 0,
      goals: homeScore + awayScore,
    });
  }
  out(
    `  ${samples.length} échantillons retenus, ${skipped} écartés (moins de ${MIN_PRIOR_TEAM_STATS} lignes de saison ou xG absent).`,
  );
  return samples;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-lambda-factors-goal-conservation-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out(`Re-fit des facteurs de λ — ${generatedAt.toISOString()}`);
  out(
    `Fenêtres : sélection [${FROM_DATE.toISOString().slice(0, 10)} ; ${SPLIT_DATE.toISOString().slice(0, 10)}[, validation [${SPLIT_DATE.toISOString().slice(0, 10)} ; aujourd'hui[`,
  );
  out(
    `Grille figée : ${GRID.length} configurations (${HOME_GRID.length} × ${AWAY_GRID.length} paires × overrides keep/drop). Critère : −(brier3 + over25 + btts) de la chaîne de production.`,
  );
  out();

  const samples = await loadSamples(out);
  out();

  const current: Config = { ...CURRENT_PAIR, overrides: "keep" };
  const configs: Config[] = [
    current,
    ...GRID.filter((c) => configLabel(c) !== configLabel(current)),
  ];

  const results: Array<{
    config: Config;
    selection: Summary;
    validation: Summary;
  }> = [];
  const startedAt = Date.now();
  for (const [index, config] of configs.entries()) {
    const evaluated = evaluate(config, samples);
    results.push({ config, ...evaluated });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(
      `[${index + 1}/${configs.length}] ${configLabel(config)} — sélection sum=${evaluated.selection.sum.toFixed(5)} (${elapsed}s)`,
    );
  }

  const eligible = results.filter(
    (r) =>
      r.selection.n >= MIN_WINDOW_FIXTURES &&
      r.validation.n >= MIN_WINDOW_FIXTURES,
  );
  const ranked = [...eligible].sort(
    (a, b) => criterion(b.selection) - criterion(a.selection),
  );
  const chosen = ranked[0] ?? null;
  const currentResult = results.find(
    (r) => configLabel(r.config) === configLabel(current),
  )!;
  const falsePositivesExpected = eligible.length * 0.025;

  out("== SÉLECTION (classement sur la fenêtre de sélection seule) ==");
  for (const [rank, r] of ranked.entries()) {
    out(
      `${String(rank + 1).padStart(3)}. ${configLabel(r.config)} | ${formatSummary(r.selection)}`,
    );
  }
  out();
  out(
    `Configurations comparées : ${eligible.length} ; faux positifs attendus à 95 % par le seul balayage : ${falsePositivesExpected.toFixed(1)}.`,
  );
  out();

  out("== VALIDATION (fenêtre intouchée, mesurée une fois) ==");
  out(`actuelle  ${configLabel(current)}`);
  out(`          ${formatSummary(currentResult.validation)}`);
  if (chosen) {
    out(`retenue   ${configLabel(chosen.config)}`);
    out(`          ${formatSummary(chosen.validation)}`);
    const dSum = chosen.validation.sum - currentResult.validation.sum;
    const d3 = chosen.validation.brier3 - currentResult.validation.brier3;
    const dOver =
      chosen.validation.brierOver - currentResult.validation.brierOver;
    const dBtts =
      chosen.validation.brierBtts - currentResult.validation.brierBtts;
    out(
      `écart retenue − actuelle sur validation : sum ${dSum.toFixed(5)} | brier3 ${d3.toFixed(5)} | over25 ${dOver.toFixed(5)} | btts ${dBtts.toFixed(5)} (négatif = mieux)`,
    );
    out(
      `écart sur sélection, pour comparaison : sum ${(chosen.selection.sum - currentResult.selection.sum).toFixed(5)}`,
    );
  }
  out();

  out(
    "== VALIDATION de toutes les configurations éligibles (diagnostic, pas sélection) ==",
  );
  for (const r of ranked) {
    out(`${configLabel(r.config)} | ${formatSummary(r.validation)}`);
  }
  out();

  out("== PAR COMPÉTITION, configuration retenue vs actuelle, validation ==");
  if (chosen) {
    const byComp = new Map<string, Sample[]>();
    for (const s of samples) {
      if (s.scheduledAt.getTime() < SPLIT_DATE.getTime()) continue;
      const arr = byComp.get(s.competitionCode) ?? [];
      arr.push(s);
      byComp.set(s.competitionCode, arr);
    }
    const rows = [...byComp.entries()]
      .filter(([, arr]) => arr.length >= 100)
      .map(([code, arr]) => {
        const cur = evaluate(current, arr).validation;
        const cho = evaluate(chosen.config, arr).validation;
        return { code, n: arr.length, cur, cho };
      })
      .sort((a, b) => a.cho.sum - a.cur.sum - (b.cho.sum - b.cur.sum));
    out(
      "code  n     Δsum      Δover25   Δbtts     Δbrier3   | actuelle P(over) vs réel → retenue P(over)",
    );
    for (const r of rows) {
      out(
        `${r.code.padEnd(5)} ${String(r.n).padStart(5)} ${(r.cho.sum - r.cur.sum).toFixed(5).padStart(9)} ${(r.cho.brierOver - r.cur.brierOver).toFixed(5).padStart(9)} ${(r.cho.brierBtts - r.cur.brierBtts).toFixed(5).padStart(9)} ${(r.cho.brier3 - r.cur.brier3).toFixed(5).padStart(9)} | ${r.cur.pOver.toFixed(3)} vs ${r.cur.over.toFixed(3)} → ${r.cho.pOver.toFixed(3)}`,
      );
    }
  }

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`\nRapport écrit : ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
