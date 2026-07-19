/// <reference types="node" />
/**
 * Backtest de calibration historique des 10 nouveaux marchés — sans cotes.
 *
 * Rejoue chaque fixture terminée avec les TeamStats point-in-time
 * (afterFixture.scheduledAt < fixture.scheduledAt, même saison), calcule les
 * probabilités des marchés via le vrai pipeline de prod (deriveLambdas ->
 * computePoissonMarkets -> shrinkOverUnderProbabilities), puis compare à
 * l'issue réelle (score FT/HT déjà en base). Aucune cote nécessaire.
 *
 * Voir docs/new-markets-calibration-backtest.md pour le plan complet.
 *
 * Simplifications documentées (cf. §6 du plan) :
 * - LambdaConfig utilise les valeurs par défaut de prod (meanLambda=1.4,
 *   homeAdvFactor=1.05, awayDisadvFactor=0.95, lambdaScale=1), pas le
 *   réglage par ligue (getLeagueMeanLambda/getLeagueHomeAwayFactors/
 *   getLeagueLambdaScale vivent dans apps/backend, inaccessibles depuis
 *   packages/db sans dupliquer des maps app-owned — risque de dérive écarté
 *   volontairement). Seules ~13-14 ligues sur des dizaines ont un override,
 *   donc le défaut domine largement.
 * - rebalanceThreeWayProbabilities (blend empirique 3-way) n'est PAS
 *   appliqué : nécessite getLeagueThreeWayEmpiricalBlendWeight (même
 *   contrainte app-side). Impact : DNB et les picks _OVER_ de
 *   RESULT_TOTAL_GOALS peuvent afficher un léger écart de calibration sur
 *   les ~14 ligues qui ont un blendWeight non nul en prod.
 * - shrinkOverUnderProbabilities EST appliqué (pur, dans analysis-core,
 *   ne nécessite que competitionCode) mais ne touche aucun des 10 marchés
 *   cibles — inclus pour rester fidèle au pipeline sans risque ajouté.
 * - Agrégation globale par (marché × pick), pas par ligue — un passage
 *   par ligue est un suivi possible si un marché ressort limite ici.
 *
 * Run: pnpm --filter @evcore/db db:backtest:new-markets-calibration
 * Output: packages/db/reports/backtest-new-markets-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deriveLambdas,
  computePoissonMarkets,
  shrinkOverUnderProbabilities,
  getOverUnderShrinkageConfig,
  calibrationError,
  type CalibrationPoint,
  type LambdaConfig,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { prisma } from "../src/client";

// cf. apps/backend/src/modules/backtest/backtest.constants.ts —
// MIN_PRIOR_TEAM_STATS = 5 (constante actuellement non câblée côté prod,
// mais c'est le seuil documenté pour éviter le cold-start).
const MIN_PRIOR_TEAM_STATS = 5;

const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  meanLambda: 1.4,
  homeAdvFactor: 1.05,
  awayDisadvFactor: 0.95,
  lambdaScale: 1,
};

const MIN_VOLUME = 30;

type FixtureRow = {
  id: string;
  scheduledAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
  competitionCode: string;
};

type StatsPoint = { scheduledAt: Date; stats: TeamStatsInput };

type PickPoint = { market: string; pick: string; prob: number; actual: 0 | 1 };

type Outcome = "HOME" | "DRAW" | "AWAY";

function parseLine(token: string): number {
  return Number(token.replace("_", "."));
}

function evalOverUnderKey(key: string, goals: number): 0 | 1 {
  const match = /^(OVER|UNDER)_(\d+_\d+)$/.exec(key);
  if (!match) throw new Error(`Unexpected team-total key: ${key}`);
  const side = match[1]!;
  const line = parseLine(match[2]!);
  return side === "OVER" ? (goals > line ? 1 : 0) : goals < line ? 1 : 0;
}

function evalResultTotalGoalsKey(
  key: string,
  outcome: Outcome,
  totalGoals: number,
): 0 | 1 {
  const match = /^(HOME|DRAW|AWAY)_(OVER|UNDER)_(\d_\d)$/.exec(key);
  if (!match) throw new Error(`Unexpected result/total-goals key: ${key}`);
  const side = match[1]! as Outcome;
  if (side !== outcome) return 0;
  const ouSide = match[2]!;
  const line = parseLine(match[3]!);
  return ouSide === "OVER" ? (totalGoals > line ? 1 : 0) : totalGoals < line ? 1 : 0;
}

function evalResultBttsKey(key: string, outcome: Outcome, btts: boolean): 0 | 1 {
  const match = /^(HOME|DRAW|AWAY)_(YES|NO)$/.exec(key);
  if (!match) throw new Error(`Unexpected result/btts key: ${key}`);
  const side = match[1]! as Outcome;
  if (side !== outcome) return 0;
  const yes = match[2]! === "YES";
  return yes === btts ? 1 : 0;
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
    `backtest-new-markets-calibration-${dateLabel}.txt`,
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
      homeHtScore: true,
      awayHtScore: true,
      season: { select: { competition: { select: { code: true } } } },
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
    homeHtScore: f.homeHtScore,
    awayHtScore: f.awayHtScore,
    competitionCode: f.season.competition.code,
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
  out(`  ${statsRaw.length} lignes TeamStats chargées (${teamIds.length} équipes).`);

  out("Replay du pipeline Poisson par fixture...");
  const points: PickPoint[] = [];
  let processed = 0;
  let skippedColdStart = 0;
  let skippedHtMissing = 0;

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
    const markets = shrinkOverUnderProbabilities(
      raw,
      getOverUnderShrinkageConfig(fixture.competitionCode),
    );
    processed++;

    const homeWin = fixture.homeScore > fixture.awayScore;
    const awayWin = fixture.awayScore > fixture.homeScore;
    const isDraw = fixture.homeScore === fixture.awayScore;
    const btts = fixture.homeScore > 0 && fixture.awayScore > 0;
    const outcome: Outcome = homeWin ? "HOME" : awayWin ? "AWAY" : "DRAW";
    const totalGoals = fixture.homeScore + fixture.awayScore;

    if (!isDraw) {
      points.push({
        market: "DRAW_NO_BET",
        pick: "HOME",
        prob: markets.dnbHome.toNumber(),
        actual: homeWin ? 1 : 0,
      });
      points.push({
        market: "DRAW_NO_BET",
        pick: "AWAY",
        prob: markets.dnbAway.toNumber(),
        actual: awayWin ? 1 : 0,
      });
    }

    for (const [key, prob] of Object.entries(markets.teamTotalHome)) {
      if (prob === undefined) continue;
      points.push({
        market: "TEAM_TOTAL_HOME",
        pick: key,
        prob: prob.toNumber(),
        actual: evalOverUnderKey(key, fixture.homeScore),
      });
    }
    for (const [key, prob] of Object.entries(markets.teamTotalAway)) {
      if (prob === undefined) continue;
      points.push({
        market: "TEAM_TOTAL_AWAY",
        pick: key,
        prob: prob.toNumber(),
        actual: evalOverUnderKey(key, fixture.awayScore),
      });
    }

    points.push({
      market: "CLEAN_SHEET_HOME",
      pick: "YES",
      prob: markets.cleanSheetHome.toNumber(),
      actual: fixture.awayScore === 0 ? 1 : 0,
    });
    points.push({
      market: "CLEAN_SHEET_AWAY",
      pick: "YES",
      prob: markets.cleanSheetAway.toNumber(),
      actual: fixture.homeScore === 0 ? 1 : 0,
    });

    points.push({
      market: "WIN_TO_NIL_HOME",
      pick: "YES",
      prob: markets.winToNilHome.toNumber(),
      actual: homeWin && fixture.awayScore === 0 ? 1 : 0,
    });
    points.push({
      market: "WIN_TO_NIL_AWAY",
      pick: "YES",
      prob: markets.winToNilAway.toNumber(),
      actual: awayWin && fixture.homeScore === 0 ? 1 : 0,
    });

    if (fixture.homeHtScore !== null && fixture.awayHtScore !== null) {
      const homeSecondHalf = fixture.homeScore - fixture.homeHtScore;
      const awaySecondHalf = fixture.awayScore - fixture.awayHtScore;
      const homeWonEitherHalf =
        fixture.homeHtScore > fixture.awayHtScore || homeSecondHalf > awaySecondHalf;
      const awayWonEitherHalf =
        fixture.awayHtScore > fixture.homeHtScore || awaySecondHalf > homeSecondHalf;
      points.push({
        market: "TO_WIN_EITHER_HALF",
        pick: "HOME",
        prob: markets.winEitherHalfHome.toNumber(),
        actual: homeWonEitherHalf ? 1 : 0,
      });
      points.push({
        market: "TO_WIN_EITHER_HALF",
        pick: "AWAY",
        prob: markets.winEitherHalfAway.toNumber(),
        actual: awayWonEitherHalf ? 1 : 0,
      });
    } else {
      skippedHtMissing++;
    }

    for (const [key, prob] of Object.entries(markets.resultTotalGoals)) {
      if (prob === undefined) continue;
      points.push({
        market: "RESULT_TOTAL_GOALS",
        pick: key,
        prob: prob.toNumber(),
        actual: evalResultTotalGoalsKey(key, outcome, totalGoals),
      });
    }

    for (const [key, prob] of Object.entries(markets.resultBtts)) {
      if (prob === undefined) continue;
      points.push({
        market: "RESULT_BTTS",
        pick: key,
        prob: prob.toNumber(),
        actual: evalResultBttsKey(key, outcome, btts),
      });
    }
  }

  out(
    `  ${processed} fixtures traitées, ${skippedColdStart} exclues (cold-start < ${MIN_PRIOR_TEAM_STATS} TeamStats), ${skippedHtMissing} sans score mi-temps (TO_WIN_EITHER_HALF exclu pour ces fixtures uniquement).`,
  );

  const groups = new Map<string, PickPoint[]>();
  for (const p of points) {
    const key = `${p.market}::${p.pick}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  type Row = {
    market: string;
    pick: string;
    n: number;
    avgProb: number;
    hitRate: number;
    brier: number;
    ece: number;
  };
  const rows: Row[] = [];
  for (const [key, pts] of groups) {
    if (pts.length < MIN_VOLUME) continue;
    const [market, pick] = key.split("::") as [string, string];
    const n = pts.length;
    const avgProb = pts.reduce((s, p) => s + p.prob, 0) / n;
    const hitRate = pts.reduce((s, p) => s + p.actual, 0) / n;
    const brier = pts.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0) / n;
    const calibrationPoints: CalibrationPoint[] = pts.map((p) => ({
      prob: p.prob,
      actual: p.actual,
    }));
    const ece = calibrationError(calibrationPoints);
    rows.push({ market, pick, n, avgProb, hitRate, brier, ece });
  }

  const MARKET_ORDER = [
    "DRAW_NO_BET",
    "TEAM_TOTAL_HOME",
    "TEAM_TOTAL_AWAY",
    "CLEAN_SHEET_HOME",
    "CLEAN_SHEET_AWAY",
    "WIN_TO_NIL_HOME",
    "WIN_TO_NIL_AWAY",
    "TO_WIN_EITHER_HALF",
    "RESULT_TOTAL_GOALS",
    "RESULT_BTTS",
  ];

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration historique des nouveaux marchés");
  out(`  ${dateLabel} — sans cotes, agrégation globale par (marché × pick)`);
  out("═══════════════════════════════════════════════════════");
  out();
  out(
    `Picks retenus (volume >= ${MIN_VOLUME}) : ${rows.length} sur ${groups.size} combinaisons marché×pick observées.`,
  );
  out();

  for (const market of MARKET_ORDER) {
    const marketRows = rows
      .filter((r) => r.market === market)
      .sort((a, b) => b.n - a.n);
    if (marketRows.length === 0) {
      out(`=== ${market} : aucun pick avec volume suffisant ===`);
      out();
      continue;
    }
    out(`=== ${market} ===`);
    for (const r of marketRows) {
      out(
        `  ${r.pick.padEnd(14)} n=${String(r.n).padEnd(6)} proba moy=${(100 * r.avgProb).toFixed(1)}%  taux réel=${(100 * r.hitRate).toFixed(1)}%  Brier=${r.brier.toFixed(4)}  ECE=${r.ece.toFixed(4)}`,
      );
    }
    out();
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
