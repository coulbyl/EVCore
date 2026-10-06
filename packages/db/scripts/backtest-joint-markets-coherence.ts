/// <reference types="node" />
/**
 * Mesure de la propagation du blend 1X2 aux marchés joints (2026-10-06).
 *
 * POURQUOI. `rebalanceThreeWayProbabilities` ne propageait le blend
 * empirique 1X2 qu'au 1X2, à la double chance, au DNB et au côté OVER de
 * RESULT_TOTAL_GOALS. HT/FT, RESULT_BTTS, le côté UNDER de RESULT_TOTAL_GOALS
 * et WIN_TO_NIL restaient sur le 1X2 brut : sur un fort favori à domicile
 * P(HOME ∧ UNDER 4.5) dépassait P(HOME) et HT/FT sommait à l'ancien P(HOME).
 * La correction scale chaque marché contenu dans une issue par
 * side'/side, ce qui est exactement ce que donnerait une repondération de la
 * matrice de scores pour ces événements.
 *
 * CE QUI EST MESURÉ. Aucun paramètre n'est choisi : c'est une correction de
 * logique. Le script rejoue la chaîne de production et compare, sur chaque
 * match, l'ancienne dérivation (marchés joints bruts) à la nouvelle (scalés)
 * par le Brier multi-classes de HT/FT (9 cases), de RESULT_BTTS (6 cases), le
 * Brier binaire de chaque pick RESULT_TOTAL_GOALS et de WIN_TO_NIL. Les deux
 * fenêtres (< 2026-01-01 et 2026) sont rapportées séparément pour montrer que
 * l'effet ne dépend pas de la période.
 *
 * Run: pnpm --filter @evcore/db db:backtest:joint-markets-coherence
 * Output: packages/db/reports/backtest-joint-markets-coherence-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import Decimal from "decimal.js";
import {
  computePoissonMarkets,
  deriveLambdas,
  getLeagueHomeAwayFactors,
  getLeagueLambdaScale,
  getLeagueMeanLambda,
  getLeagueThreeWayEmpiricalBlendWeight,
  rebalanceThreeWayProbabilities,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const FROM_DATE = new Date("2023-07-01T00:00:00.000Z");
const SPLIT_DATE = new Date("2026-01-01T00:00:00.000Z");

type Side = "HOME" | "DRAW" | "AWAY";
const SIDES: readonly Side[] = ["HOME", "DRAW", "AWAY"];
const LINES = ["1_5", "2_5", "3_5", "4_5"] as const;

type Sample = {
  scheduledAt: Date;
  competitionCode: string;
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  hs: number;
  as: number;
  hht: number | null;
  aht: number | null;
};

type Acc = {
  n: number;
  nHt: number;
  htftOld: number;
  htftNew: number;
  rbOld: number;
  rbNew: number;
  rtgOld: number;
  rtgNew: number;
  rtgIncoherentOld: number;
  rtgIncoherentNew: number;
  wtnOld: number;
  wtnNew: number;
  blended: number;
};

function emptyAcc(): Acc {
  return {
    n: 0,
    nHt: 0,
    htftOld: 0,
    htftNew: 0,
    rbOld: 0,
    rbNew: 0,
    rtgOld: 0,
    rtgNew: 0,
    rtgIncoherentOld: 0,
    rtgIncoherentNew: 0,
    wtnOld: 0,
    wtnNew: 0,
    blended: 0,
  };
}

function outcome(h: number, a: number): Side {
  return h > a ? "HOME" : h < a ? "AWAY" : "DRAW";
}

const num = (d: Decimal | undefined) => (d === undefined ? 0 : d.toNumber());

/** L'ancienne dérivation : marchés joints bruts, OVER = side' − UNDER brut. */
function oldJoint(
  raw: ReturnType<typeof computePoissonMarkets>,
  blended: ReturnType<typeof computePoissonMarkets>,
) {
  const side = { HOME: blended.home, DRAW: blended.draw, AWAY: blended.away };
  const rtg: Record<string, number> = {};
  for (const s of SIDES) {
    for (const line of LINES) {
      const under = num(raw.resultTotalGoals[`${s}_UNDER_${line}`]);
      rtg[`${s}_UNDER_${line}`] = under;
      rtg[`${s}_OVER_${line}`] = Math.max(0, side[s].toNumber() - under);
    }
  }
  return {
    htft: Object.fromEntries(
      Object.entries(raw.htft).map(([k, v]) => [k, v.toNumber()]),
    ),
    resultBtts: Object.fromEntries(
      Object.entries(raw.resultBtts).map(([k, v]) => [k, num(v)]),
    ),
    rtg,
    winToNilHome: raw.winToNilHome.toNumber(),
    winToNilAway: raw.winToNilAway.toNumber(),
  };
}

function newJoint(blended: ReturnType<typeof computePoissonMarkets>) {
  const rtg: Record<string, number> = {};
  for (const s of SIDES) {
    for (const line of LINES) {
      rtg[`${s}_UNDER_${line}`] = num(
        blended.resultTotalGoals[`${s}_UNDER_${line}`],
      );
      rtg[`${s}_OVER_${line}`] = num(
        blended.resultTotalGoals[`${s}_OVER_${line}`],
      );
    }
  }
  return {
    htft: Object.fromEntries(
      Object.entries(blended.htft).map(([k, v]) => [k, v.toNumber()]),
    ),
    resultBtts: Object.fromEntries(
      Object.entries(blended.resultBtts).map(([k, v]) => [k, num(v)]),
    ),
    rtg,
    winToNilHome: blended.winToNilHome.toNumber(),
    winToNilAway: blended.winToNilAway.toNumber(),
  };
}

type Joint = ReturnType<typeof newJoint>;

function score(
  acc: Acc,
  sample: Sample,
  old: Joint,
  next: Joint,
  blended: boolean,
) {
  const ft = outcome(sample.hs, sample.as);
  const total = sample.hs + sample.as;
  const btts = sample.hs > 0 && sample.as > 0;
  acc.n += 1;
  if (blended) acc.blended += 1;

  // RESULT_BTTS, 6 cases
  for (const s of SIDES) {
    for (const yn of ["YES", "NO"] as const) {
      const y = ft === s && btts === (yn === "YES") ? 1 : 0;
      acc.rbOld += (old.resultBtts[`${s}_${yn}`]! - y) ** 2;
      acc.rbNew += (next.resultBtts[`${s}_${yn}`]! - y) ** 2;
    }
  }
  // RESULT_TOTAL_GOALS, un Brier binaire par pick, moyenne sur les 24 picks
  let rtgOld = 0;
  let rtgNew = 0;
  for (const s of SIDES) {
    for (const line of LINES) {
      const threshold = Number(line.replace("_", "."));
      const yUnder = ft === s && total < threshold ? 1 : 0;
      const yOver = ft === s && total > threshold ? 1 : 0;
      rtgOld += (old.rtg[`${s}_UNDER_${line}`]! - yUnder) ** 2;
      rtgOld += (old.rtg[`${s}_OVER_${line}`]! - yOver) ** 2;
      rtgNew += (next.rtg[`${s}_UNDER_${line}`]! - yUnder) ** 2;
      rtgNew += (next.rtg[`${s}_OVER_${line}`]! - yOver) ** 2;
    }
  }
  acc.rtgOld += rtgOld / 24;
  acc.rtgNew += rtgNew / 24;
  // WIN_TO_NIL, 2 picks
  const wtnH = ft === "HOME" && sample.as === 0 ? 1 : 0;
  const wtnA = ft === "AWAY" && sample.hs === 0 ? 1 : 0;
  acc.wtnOld +=
    ((old.winToNilHome - wtnH) ** 2 + (old.winToNilAway - wtnA) ** 2) / 2;
  acc.wtnNew +=
    ((next.winToNilHome - wtnH) ** 2 + (next.winToNilAway - wtnA) ** 2) / 2;
  // HT/FT, 9 cases, seulement avec score de mi-temps
  if (sample.hht !== null && sample.aht !== null) {
    acc.nHt += 1;
    const ht = outcome(sample.hht, sample.aht);
    for (const h of SIDES) {
      for (const f of SIDES) {
        const y = ht === h && ft === f ? 1 : 0;
        acc.htftOld += (old.htft[`${h}_${f}`]! - y) ** 2;
        acc.htftNew += (next.htft[`${h}_${f}`]! - y) ** 2;
      }
    }
  }
}

function incoherent(
  joint: Joint,
  blended: ReturnType<typeof computePoissonMarkets>,
): number {
  const side = { HOME: blended.home, DRAW: blended.draw, AWAY: blended.away };
  let count = 0;
  for (const s of SIDES) {
    for (const line of LINES) {
      if (joint.rtg[`${s}_UNDER_${line}`]! > side[s].toNumber() + 1e-9) {
        count += 1;
      }
    }
  }
  return count;
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
      homeHtScore: true,
      awayHtScore: true,
      season: { select: { competition: { select: { code: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });
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
  const byTeamSeason = new Map<
    string,
    { scheduledAt: Date; stats: TeamStatsInput }[]
  >();
  for (const row of statsRaw) {
    const key = `${row.teamId}:${row.afterFixture.seasonId}`;
    const arr = byTeamSeason.get(key) ?? [];
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
    byTeamSeason.set(key, arr);
  }
  const prior = (teamId: string, seasonId: string, before: Date) => {
    const arr = byTeamSeason.get(`${teamId}:${seasonId}`) ?? [];
    let idx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]!.scheduledAt.getTime() < before.getTime()) idx = i;
      else break;
    }
    return idx === -1 ? null : { stats: arr[idx]!.stats, priorCount: idx + 1 };
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
    samples.push({
      scheduledAt: f.scheduledAt,
      competitionCode: f.season.competition.code,
      homeStats: home.stats,
      awayStats: away.stats,
      hs: f.homeScore!,
      as: f.awayScore!,
      hht: f.homeHtScore,
      aht: f.awayHtScore,
    });
  }
  out(`  ${samples.length} échantillons.`);
  return samples;
}

const f5 = (v: number) => v.toFixed(5);

function report(label: string, acc: Acc, out: (l?: string) => void) {
  const n = Math.max(acc.n, 1);
  const nHt = Math.max(acc.nHt, 1);
  out(
    `${label} — n=${acc.n} (dont ${acc.blended} avec blend actif), HT/FT n=${acc.nHt}`,
  );
  out(
    `  HT/FT 9 cases       ancien ${f5(acc.htftOld / nHt)}  nouveau ${f5(acc.htftNew / nHt)}  Δ ${f5((acc.htftNew - acc.htftOld) / nHt)}`,
  );
  out(
    `  RESULT_BTTS 6 cases ancien ${f5(acc.rbOld / n)}  nouveau ${f5(acc.rbNew / n)}  Δ ${f5((acc.rbNew - acc.rbOld) / n)}`,
  );
  out(
    `  RESULT_TOTAL_GOALS  ancien ${f5(acc.rtgOld / n)}  nouveau ${f5(acc.rtgNew / n)}  Δ ${f5((acc.rtgNew - acc.rtgOld) / n)}  | picks UNDER > P(side) : ${acc.rtgIncoherentOld} → ${acc.rtgIncoherentNew}`,
  );
  out(
    `  WIN_TO_NIL          ancien ${f5(acc.wtnOld / n)}  nouveau ${f5(acc.wtnNew / n)}  Δ ${f5((acc.wtnNew - acc.wtnOld) / n)}`,
  );
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-joint-markets-coherence-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  out(
    `Cohérence des marchés joints après blend 1X2 — ${generatedAt.toISOString()}`,
  );
  out(
    "Ancien = marchés joints bruts (OVER = side' − UNDER brut) ; nouveau = scalés par side'/side.",
  );
  out();

  const samples = await loadSamples(out);
  const selection = emptyAcc();
  const validation = emptyAcc();
  const byLeague = new Map<string, Acc>();

  for (const sample of samples) {
    const code = sample.competitionCode;
    const [homeAdvFactor, awayDisadvFactor] = getLeagueHomeAwayFactors(code);
    const lambda = deriveLambdas(sample.homeStats, sample.awayStats, {
      meanLambda: getLeagueMeanLambda(code),
      homeAdvFactor,
      awayDisadvFactor,
      lambdaScale: getLeagueLambdaScale(code),
    });
    const raw = computePoissonMarkets(lambda.home, lambda.away);
    const blendWeight = getLeagueThreeWayEmpiricalBlendWeight(code);
    const blended = rebalanceThreeWayProbabilities({
      probabilities: raw,
      homeStats: sample.homeStats,
      awayStats: sample.awayStats,
      blendWeight,
    });
    const old = oldJoint(raw, blended);
    const next = newJoint(blended);
    const isBlended = blendWeight.gt(0);
    const acc =
      sample.scheduledAt.getTime() < SPLIT_DATE.getTime()
        ? selection
        : validation;
    score(acc, sample, old, next, isBlended);
    acc.rtgIncoherentOld += incoherent(old, blended);
    acc.rtgIncoherentNew += incoherent(next, blended);
    const league = byLeague.get(code) ?? emptyAcc();
    score(league, sample, old, next, isBlended);
    league.rtgIncoherentOld += incoherent(old, blended);
    league.rtgIncoherentNew += incoherent(next, blended);
    byLeague.set(code, league);
  }

  report("SÉLECTION (< 2026-01-01)", selection, out);
  out();
  report("VALIDATION (2026)", validation, out);
  out();
  out("== LIGUES À BLEND ACTIF (tout l'historique) ==");
  for (const [code, acc] of [...byLeague.entries()].sort()) {
    if (acc.blended === 0) continue;
    report(code, acc, out);
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
