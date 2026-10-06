/// <reference types="node" />
/**
 * Re-fit par ligue de LAMBDA_SCALE_MAP et des blocs plein-temps de
 * OU_SHRINKAGE_CONFIG (facteur + taux de base) et BTTS, après le re-fit des
 * facteurs globaux de λ du 2026-10-06.
 *
 * POURQUOI. Les corrections par ligue (lambdaScale 06-30 / 07-28, blocs de
 * shrinkage 07-03 / 08-15) ont été fittées quand le global retirait ~12 % des
 * buts attendus (1,00 / 0,75). Elles ont absorbé ce biais là où elles
 * existaient. Avec le global re-fitté (1,10 / 0,85), cinq ligues se sont
 * dégradées sur la validation (ARG1, SWE2, F2, AUT1, EL1) : ce sont celles
 * qui sur-annonçaient déjà les buts via ces corrections.
 *
 * CE QUI EST REJOUÉ. La chaîne de production : deriveLambdas (facteurs
 * globaux actuels, meanLambda par ligue, lambdaScale candidat) →
 * computePoissonMarkets → rebalanceThreeWayProbabilities (poids empirique par
 * ligue) → shrinkage plein-temps et BTTS candidat. Les autres sous-blocs
 * (totaux par équipe, mi-temps, clean sheet, win-to-nil, DNB, …) ne sont pas
 * touchés : ils ont leurs propres scripts et viendront ensuite.
 *
 * PROTOCOLE. Par ligue, grille figée : lambdaScale × facteur O/U × facteur
 * BTTS, taux de base = fréquences empiriques des 730 derniers jours de la
 * fenêtre de sélection. Choix sur la fenêtre de sélection (< SPLIT_DATE)
 * seule, critère figé = Brier 1X2 + Over 2.5 + BTTS. Mesure unique sur la
 * validation. Règle d'expédition, même esprit que le 08-15 : une ligue ne
 * change que si la configuration retenue bat la configuration actuelle
 * d'au moins SHIP_MIN_GAIN sur la validation ; sinon elle garde l'actuelle.
 *
 * Run: pnpm --filter @evcore/db db:backtest:ou-shrinkage-refit
 * Output: packages/db/reports/backtest-ou-shrinkage-refit-YYYY-MM-DD.{txt,json}
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
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const FROM_DATE = new Date("2023-07-01T00:00:00.000Z");
const SPLIT_DATE = new Date("2026-01-01T00:00:00.000Z");
const BASE_RATE_WINDOW_DAYS = 730;
const MIN_SELECTION_FIXTURES = 400;
const MIN_VALIDATION_FIXTURES = 100;
const SHIP_MIN_GAIN = 0.001;

const SCALE_GRID = [0.9, 0.95, 1.0, 1.05, 1.1] as const;
const FACTOR_GRID = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

type Sample = {
  scheduledAt: Date;
  competitionCode: string;
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  homeWon: 0 | 1;
  draw: 0 | 1;
  awayWon: 0 | 1;
  over15: 0 | 1;
  over25: 0 | 1;
  over35: 0 | 1;
  over45: 0 | 1;
  btts: 0 | 1;
};

/** Sortie de la chaîne avant shrinkage, pour un lambdaScale donné. */
type Rebalanced = {
  home: number;
  draw: number;
  away: number;
  over25: number;
  bttsYes: number;
};

type BaseRates = {
  over15: number;
  over25: number;
  over35: number;
  over45: number;
  bttsYes: number;
};

type Candidate = { lambdaScale: number; factor: number; bttsFactor: number };

type Summary = {
  n: number;
  brier3: number;
  brierOver: number;
  brierBtts: number;
  sum: number;
  pOver: number;
  over: number;
  pBtts: number;
  btts: number;
};

type LeagueResult = {
  code: string;
  nSelection: number;
  nValidation: number;
  baseRates: BaseRates;
  current: { candidate: Candidate; selection: Summary; validation: Summary };
  chosen: { candidate: Candidate; selection: Summary; validation: Summary };
  shipped: boolean;
  configurationsCompared: number;
};

function shrink(p: number, base: number, factor: number): number {
  return Math.min(Math.max(base + factor * (p - base), 0), 1);
}

function summarize(input: {
  samples: readonly Sample[];
  rebalanced: readonly Rebalanced[];
  indices: readonly number[];
  candidate: Candidate;
  baseRates: BaseRates;
}): Summary {
  const { samples, rebalanced, indices, candidate, baseRates } = input;
  let brier3 = 0;
  let brierOver = 0;
  let brierBtts = 0;
  let pOver = 0;
  let over = 0;
  let pBtts = 0;
  let btts = 0;
  for (const i of indices) {
    const s = samples[i]!;
    const r = rebalanced[i]!;
    const o = shrink(r.over25, baseRates.over25, candidate.factor);
    const b = shrink(r.bttsYes, baseRates.bttsYes, candidate.bttsFactor);
    brier3 +=
      (r.home - s.homeWon) ** 2 +
      (r.draw - s.draw) ** 2 +
      (r.away - s.awayWon) ** 2;
    brierOver += (o - s.over25) ** 2;
    brierBtts += (b - s.btts) ** 2;
    pOver += o;
    over += s.over25;
    pBtts += b;
    btts += s.btts;
  }
  const n = Math.max(indices.length, 1);
  const summary: Summary = {
    n: indices.length,
    brier3: brier3 / n,
    brierOver: brierOver / n,
    brierBtts: brierBtts / n,
    sum: 0,
    pOver: pOver / n,
    over: over / n,
    pBtts: pBtts / n,
    btts: btts / n,
  };
  summary.sum = summary.brier3 + summary.brierOver + summary.brierBtts;
  return summary;
}

function rebalanceAll(
  samples: readonly Sample[],
  lambdaScale: number,
): Rebalanced[] {
  return samples.map((sample) => {
    const [homeAdvFactor, awayDisadvFactor] = getLeagueHomeAwayFactors(
      sample.competitionCode,
    );
    const lambda = deriveLambdas(sample.homeStats, sample.awayStats, {
      meanLambda: getLeagueMeanLambda(sample.competitionCode),
      homeAdvFactor,
      awayDisadvFactor,
      lambdaScale,
    });
    const rebalanced = rebalanceThreeWayProbabilities({
      probabilities: computePoissonMarkets(lambda.home, lambda.away),
      homeStats: sample.homeStats,
      awayStats: sample.awayStats,
      blendWeight: getLeagueThreeWayEmpiricalBlendWeight(
        sample.competitionCode,
      ),
    });
    return {
      home: rebalanced.home.toNumber(),
      draw: rebalanced.draw.toNumber(),
      away: rebalanced.away.toNumber(),
      over25: rebalanced.over25.toNumber(),
      bttsYes: rebalanced.bttsYes.toNumber(),
    };
  });
}

function empiricalBaseRates(samples: readonly Sample[]): BaseRates {
  const since = SPLIT_DATE.getTime() - BASE_RATE_WINDOW_DAYS * 86_400_000;
  const recent = samples.filter(
    (s) =>
      s.scheduledAt.getTime() >= since &&
      s.scheduledAt.getTime() < SPLIT_DATE.getTime(),
  );
  const pool = recent.length >= 100 ? recent : samples;
  const mean = (pick: (s: Sample) => number) =>
    Math.round(
      (pool.reduce((acc, s) => acc + pick(s), 0) / pool.length) * 100,
    ) / 100;
  return {
    over15: mean((s) => s.over15),
    over25: mean((s) => s.over25),
    over35: mean((s) => s.over35),
    over45: mean((s) => s.over45),
    bttsYes: mean((s) => s.btts),
  };
}

/** Configuration de production d'une ligue, exprimée dans la grille. */
function currentCandidate(code: string): {
  candidate: Candidate;
  baseRates: BaseRates | null;
} {
  const config = getOverUnderShrinkageConfig(code);
  const hasOu = config?.factor !== undefined && config.baseRates !== undefined;
  return {
    candidate: {
      lambdaScale: getLeagueLambdaScale(code),
      factor: hasOu ? config!.factor! : 1,
      bttsFactor: config?.btts ? config.btts.factor : 1,
    },
    baseRates: hasOu
      ? {
          ...config!.baseRates!,
          bttsYes: config!.btts?.baseYes ?? 0.5,
        }
      : null,
  };
}

function fit(code: string, samples: readonly Sample[]): LeagueResult | null {
  const selection: number[] = [];
  const validation: number[] = [];
  samples.forEach((s, i) => {
    (s.scheduledAt.getTime() < SPLIT_DATE.getTime()
      ? selection
      : validation
    ).push(i);
  });
  if (
    selection.length < MIN_SELECTION_FIXTURES ||
    validation.length < MIN_VALIDATION_FIXTURES
  ) {
    return null;
  }

  const baseRates = empiricalBaseRates(samples);
  const current = currentCandidate(code);
  // L'actuelle est scorée avec SES taux de base (ceux de la config), la
  // grille avec les taux empiriques récents : c'est la configuration entière
  // qui est comparée, pas seulement le facteur.
  const currentBaseRates = current.baseRates ?? baseRates;

  const rebalancedByScale = new Map<number, Rebalanced[]>();
  const scales = new Set<number>([
    ...SCALE_GRID,
    current.candidate.lambdaScale,
  ]);
  for (const scale of scales) {
    rebalancedByScale.set(scale, rebalanceAll(samples, scale));
  }

  const score = (candidate: Candidate, rates: BaseRates) => ({
    selection: summarize({
      samples,
      rebalanced: rebalancedByScale.get(candidate.lambdaScale)!,
      indices: selection,
      candidate,
      baseRates: rates,
    }),
    validation: summarize({
      samples,
      rebalanced: rebalancedByScale.get(candidate.lambdaScale)!,
      indices: validation,
      candidate,
      baseRates: rates,
    }),
  });

  const currentScored = score(current.candidate, currentBaseRates);

  let best: {
    candidate: Candidate;
    selection: Summary;
    validation: Summary;
  } | null = null;
  let compared = 0;
  for (const lambdaScale of SCALE_GRID) {
    for (const factor of FACTOR_GRID) {
      for (const bttsFactor of FACTOR_GRID) {
        const candidate = { lambdaScale, factor, bttsFactor };
        const scored = score(candidate, baseRates);
        compared += 1;
        if (best === null || scored.selection.sum < best.selection.sum) {
          best = { candidate, ...scored };
        }
      }
    }
  }
  if (best === null) return null;

  const shipped =
    best.validation.sum <= currentScored.validation.sum - SHIP_MIN_GAIN;
  return {
    code,
    nSelection: selection.length,
    nValidation: validation.length,
    baseRates,
    current: { candidate: current.candidate, ...currentScored },
    chosen: best,
    shipped,
    configurationsCompared: compared,
  };
}

async function loadSamples(out: (line?: string) => void): Promise<Sample[]> {
  out("Chargement des fixtures terminées (compétitions de backtest)...");
  const fixtures = await prisma.fixture.findMany({
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
  const statsByTeamSeason = new Map<
    string,
    { scheduledAt: Date; stats: TeamStatsInput }[]
  >();
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

  const prior = (teamId: string, seasonId: string, before: Date) => {
    const arr = statsByTeamSeason.get(`${teamId}:${seasonId}`) ?? [];
    let lastIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]!.scheduledAt.getTime() < before.getTime()) lastIdx = i;
      else break;
    }
    return lastIdx === -1
      ? null
      : { stats: arr[lastIdx]!.stats, priorCount: lastIdx + 1 };
  };

  const samples: Sample[] = [];
  for (const f of fixtures) {
    const home = prior(f.homeTeamId, f.seasonId, f.scheduledAt);
    const away = prior(f.awayTeamId, f.seasonId, f.scheduledAt);
    if (
      !home ||
      !away ||
      home.priorCount < MIN_PRIOR_TEAM_STATS ||
      away.priorCount < MIN_PRIOR_TEAM_STATS ||
      home.stats.xgFor === null ||
      away.stats.xgFor === null
    ) {
      continue;
    }
    const hs = f.homeScore!;
    const as = f.awayScore!;
    const total = hs + as;
    samples.push({
      scheduledAt: f.scheduledAt,
      competitionCode: f.season.competition.code,
      homeStats: home.stats,
      awayStats: away.stats,
      homeWon: hs > as ? 1 : 0,
      draw: hs === as ? 1 : 0,
      awayWon: hs < as ? 1 : 0,
      over15: total > 1 ? 1 : 0,
      over25: total > 2 ? 1 : 0,
      over35: total > 3 ? 1 : 0,
      over45: total > 4 ? 1 : 0,
      btts: hs > 0 && as > 0 ? 1 : 0,
    });
  }
  out(`  ${samples.length} échantillons retenus.`);
  return samples;
}

const f5 = (v: number) => v.toFixed(5);
const f3 = (v: number) => v.toFixed(3);

function candidateLabel(c: Candidate): string {
  return `scale=${c.lambdaScale.toFixed(2)} f=${c.factor.toFixed(1)} fb=${c.bttsFactor.toFixed(1)}`;
}

function summaryLabel(s: Summary): string {
  return `brier3=${f5(s.brier3)} over25=${f5(s.brierOver)} btts=${f5(s.brierBtts)} sum=${f5(s.sum)} | P(over) ${f3(s.pOver)} vs ${f3(s.over)} | P(btts) ${f3(s.pBtts)} vs ${f3(s.btts)}`;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const basePath = join(reportsDir, `backtest-ou-shrinkage-refit-${dateLabel}`);
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out(
    `Re-fit par ligue de lambdaScale + shrinkage O/U + BTTS — ${generatedAt.toISOString()}`,
  );
  out(
    `Facteurs globaux : ${getLeagueHomeAwayFactors("__none__").join(" / ")}. Sélection < ${SPLIT_DATE.toISOString().slice(0, 10)}, validation ensuite. Taux de base : ${BASE_RATE_WINDOW_DAYS} derniers jours de la sélection.`,
  );
  out(
    `Grille par ligue : ${SCALE_GRID.length} lambdaScale × ${FACTOR_GRID.length} facteurs O/U × ${FACTOR_GRID.length} facteurs BTTS = ${SCALE_GRID.length * FACTOR_GRID.length ** 2} configurations ; expédition si la validation gagne ≥ ${SHIP_MIN_GAIN}.`,
  );
  out();

  const samples = await loadSamples(out);
  const byLeague = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = byLeague.get(s.competitionCode) ?? [];
    arr.push(s);
    byLeague.set(s.competitionCode, arr);
  }

  const results: LeagueResult[] = [];
  const skipped: string[] = [];
  const codes = [...byLeague.keys()].sort();
  const startedAt = Date.now();
  for (const [index, code] of codes.entries()) {
    const result = fit(code, byLeague.get(code)!);
    if (result === null) {
      skipped.push(code);
    } else {
      results.push(result);
    }
    console.log(
      `[${index + 1}/${codes.length}] ${code} ${result ? (result.shipped ? "EXPÉDIÉ" : "conservé") : "ignoré"} (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`,
    );
  }

  out();
  out("== PAR LIGUE (validation, mesurée une fois) ==");
  out(
    "code  nSel  nVal | actuelle                     sum      | retenue                      sum      | Δsum     | décision",
  );
  const sorted = [...results].sort(
    (a, b) =>
      a.chosen.validation.sum -
      a.current.validation.sum -
      (b.chosen.validation.sum - b.current.validation.sum),
  );
  for (const r of sorted) {
    const delta = r.chosen.validation.sum - r.current.validation.sum;
    out(
      `${r.code.padEnd(5)} ${String(r.nSelection).padStart(5)} ${String(r.nValidation).padStart(5)} | ${candidateLabel(r.current.candidate).padEnd(28)} ${f5(r.current.validation.sum)} | ${candidateLabel(r.chosen.candidate).padEnd(28)} ${f5(r.chosen.validation.sum)} | ${delta >= 0 ? "+" : ""}${f5(delta)} | ${r.shipped ? "EXPÉDIÉ" : "conservé"}`,
    );
  }
  out();
  out(
    `Ligues ignorées (volume insuffisant) : ${skipped.join(", ") || "aucune"}.`,
  );
  out(
    `Faux positifs attendus par ligue, à 95 %, par le seul balayage : ${(SCALE_GRID.length * FACTOR_GRID.length ** 2 * 0.025).toFixed(1)}. La règle d'expédition exige un gain de validation, pas seulement de sélection.`,
  );
  out();

  out("== DÉTAIL des ligues expédiées ==");
  for (const r of sorted.filter((r) => r.shipped)) {
    out(
      `${r.code} (sélection n=${r.nSelection}, validation n=${r.nValidation})`,
    );
    out(`  actuelle   ${candidateLabel(r.current.candidate)}`);
    out(`    sélection  ${summaryLabel(r.current.selection)}`);
    out(`    validation ${summaryLabel(r.current.validation)}`);
    out(`  retenue    ${candidateLabel(r.chosen.candidate)}`);
    out(`    sélection  ${summaryLabel(r.chosen.selection)}`);
    out(`    validation ${summaryLabel(r.chosen.validation)}`);
    out(`  taux de base ${JSON.stringify(r.baseRates)}`);
  }
  out();

  const aggregate = (pick: (r: LeagueResult) => Summary) => {
    const n = results.reduce((acc, r) => acc + pick(r).n, 0);
    const w = (f: (s: Summary) => number) =>
      results.reduce((acc, r) => acc + f(pick(r)) * pick(r).n, 0) / n;
    return {
      n,
      sum: w((s) => s.sum),
      brier3: w((s) => s.brier3),
      over: w((s) => s.brierOver),
      btts: w((s) => s.brierBtts),
    };
  };
  const effective = (r: LeagueResult) => (r.shipped ? r.chosen : r.current);
  const before = aggregate((r) => r.current.validation);
  const after = aggregate((r) => effective(r).validation);
  out("== AGRÉGAT validation, ligues évaluées, pondéré par n ==");
  out(
    `avant (config actuelle)        n=${before.n} sum=${f5(before.sum)} brier3=${f5(before.brier3)} over25=${f5(before.over)} btts=${f5(before.btts)}`,
  );
  out(
    `après (expédiées appliquées)   n=${after.n} sum=${f5(after.sum)} brier3=${f5(after.brier3)} over25=${f5(after.over)} btts=${f5(after.btts)}`,
  );
  out(
    `écart ${f5(after.sum - before.sum)} (négatif = mieux), ${results.filter((r) => r.shipped).length} ligues expédiées sur ${results.length}`,
  );
  out();

  out("== ENTRÉES À APPLIQUER ==");
  const shippedLeagues = sorted.filter((r) => r.shipped);
  out("LAMBDA_SCALE_MAP :");
  for (const r of shippedLeagues) {
    if (r.chosen.candidate.lambdaScale !== r.current.candidate.lambdaScale) {
      out(
        `  ${r.code}: ${r.chosen.candidate.lambdaScale}, // ${r.current.candidate.lambdaScale} → ${r.chosen.candidate.lambdaScale} (re-fit 2026-10-06)`,
      );
    }
  }
  out("Blocs O/U + BTTS :");
  for (const r of shippedLeagues) {
    const b = r.baseRates;
    out(
      `  ${r.code}: { factor: ${r.chosen.candidate.factor}, baseRates: { over15: ${b.over15}, over25: ${b.over25}, over35: ${b.over35}, over45: ${b.over45} }, btts: { factor: ${r.chosen.candidate.bttsFactor}, baseYes: ${b.bttsYes} } },`,
    );
  }

  writeFileSync(`${basePath}.txt`, lines.join("\n") + "\n");
  writeFileSync(
    `${basePath}.json`,
    JSON.stringify(
      shippedLeagues.map((r) => ({
        code: r.code,
        lambdaScale: r.chosen.candidate.lambdaScale,
        previousLambdaScale: r.current.candidate.lambdaScale,
        factor: r.chosen.candidate.factor,
        bttsFactor: r.chosen.candidate.bttsFactor,
        baseRates: r.baseRates,
        validationGain: r.chosen.validation.sum - r.current.validation.sum,
        nValidation: r.nValidation,
      })),
      null,
      2,
    ),
  );
  console.log(`\nRapport écrit : ${basePath}.txt / .json`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
