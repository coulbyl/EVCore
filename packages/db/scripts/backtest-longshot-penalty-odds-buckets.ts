/// <reference types="node" />
/**
 * Étude de la pénalité longshot hors 1X2 — RESULT_TOTAL_GOALS, RESULT_BTTS,
 * HALF_TIME_FULL_TIME, FIRST_HALF_WINNER, OVER_UNDER (ligne 4.5).
 *
 * `getOneXTwoLongshotPenalty` (pick-validation.ts) amortit le qualityScore
 * des picks AWAY/DRAW à cote longue sur ONE_X_TWO uniquement (seuils 5.0/6.0,
 * floors 0.12/0.20 — dérivés d'audits sur des paris 1X2 réellement réglés).
 * TODO.md flague que ce raisonnement (surestimation de probabilité à cote
 * longue) n'est pas spécifique au 1X2, mais l'historique de paris RÉELS sur
 * ces 5 marchés est trop faible pour un audit "paris déjà placés" comme
 * l'original (20-90 paris réglés selon le marché — voir `bet` table).
 *
 * Ce script mesure directement le signal sous-jacent sur TOUTES les
 * fixtures terminées ayant une cote bookmaker réelle pour le marché/pick
 * (odds_snapshot, indépendant de ce qui a été staké) : probabilité Poisson
 * brute rejouée vs issue réelle, groupée par tranche de cote. Si le motif
 * "le modèle surestime P à cote longue" existe aussi sur ces marchés, il
 * doit apparaître comme une dégradation de calibration/ROI dans les
 * tranches de cote élevée — même schéma que l'audit qui a produit les
 * seuils 1X2 originaux, juste sur cotes marché plutôt que sur des paris
 * déjà placés.
 *
 * Run: pnpm --filter @evcore/db db:backtest:longshot-penalty-odds-buckets
 * Output: packages/db/reports/backtest-longshot-penalty-odds-buckets-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deriveLambdas,
  computePoissonMarkets,
  isHalfTimeFullTimePick,
  type HalfTimeFullTimePick,
  type LambdaConfig,
  type TeamStatsInput,
} from "@evcore/analysis-core";
import { Market } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  meanLambda: 1.4,
  homeAdvFactor: 1.05,
  awayDisadvFactor: 0.95,
  lambdaScale: 1,
};
const MIN_BUCKET_VOLUME = 30;

const ODDS_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "<2.0", min: 0, max: 2 },
  { label: "2.0-2.99", min: 2, max: 3 },
  { label: "3.0-3.99", min: 3, max: 4 },
  { label: "4.0-4.99", min: 4, max: 5 },
  { label: "5.0-6.99", min: 5, max: 7 },
  { label: "7.0-9.99", min: 7, max: 10 },
  { label: "10.0-14.99", min: 10, max: 15 },
  { label: "15.0+", min: 15, max: Infinity },
];
function bucketFor(odds: number): string {
  return ODDS_BUCKETS.find((b) => odds >= b.min && odds < b.max)!.label;
}

function bookmakerRank(bookmaker: string): number {
  if (bookmaker === "Pinnacle") return 0;
  if (bookmaker === "Bet365") return 1;
  if (bookmaker === "Unibet") return 2;
  if (bookmaker === "Marathonbet") return 3;
  if (bookmaker === "Bwin") return 4;
  if (bookmaker === "MarketAvg") return 5;
  return 6;
}

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

type OddsRow = {
  fixtureId: string;
  market: Market;
  bookmaker: string;
  pick: string;
  odds: number;
  snapshotAt: Date;
};

type Point = {
  market: string;
  pick: string;
  odds: number;
  prob: number;
  actual: 0 | 1;
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

function outcomeFromScores(
  home: number,
  away: number,
): "HOME" | "DRAW" | "AWAY" {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-longshot-penalty-odds-buckets-${dateLabel}.txt`,
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
  out(
    `  ${statsRaw.length} lignes TeamStats chargées (${teamIds.length} équipes).`,
  );

  out("Chargement des cotes réelles (odds_snapshot) pour les 5 marchés...");
  const TARGET_MARKETS = [
    Market.RESULT_TOTAL_GOALS,
    Market.RESULT_BTTS,
    Market.HALF_TIME_FULL_TIME,
    Market.FIRST_HALF_WINNER,
    Market.OVER_UNDER,
  ] as const;
  const oddsRaw = await prisma.oddsSnapshot.findMany({
    where: { market: { in: [...TARGET_MARKETS] }, odds: { not: null } },
    select: {
      fixtureId: true,
      market: true,
      bookmaker: true,
      pick: true,
      odds: true,
      snapshotAt: true,
    },
  });
  const oddsRows: OddsRow[] = oddsRaw
    .filter((r) => fixtureIds.has(r.fixtureId) && r.pick !== null)
    .map((r) => ({
      fixtureId: r.fixtureId,
      market: r.market,
      bookmaker: r.bookmaker,
      pick: r.pick!,
      odds: Number(r.odds),
      snapshotAt: r.snapshotAt,
    }));
  out(`  ${oddsRows.length} lignes de cotes chargées.`);

  // Best (latest snapshot, then sharpest bookmaker) odds per (fixture, market, pick).
  out("Résolution du meilleur bookmaker par (fixture, marché, pick)...");
  const bestOddsByKey = new Map<string, OddsRow>();
  for (const row of oddsRows) {
    const key = `${row.fixtureId}::${row.market}::${row.pick}`;
    const current = bestOddsByKey.get(key);
    if (!current) {
      bestOddsByKey.set(key, row);
      continue;
    }
    if (row.snapshotAt.getTime() > current.snapshotAt.getTime()) {
      bestOddsByKey.set(key, row);
    } else if (
      row.snapshotAt.getTime() === current.snapshotAt.getTime() &&
      bookmakerRank(row.bookmaker) < bookmakerRank(current.bookmaker)
    ) {
      bestOddsByKey.set(key, row);
    }
  }
  const oddsByFixture = new Map<string, OddsRow[]>();
  for (const row of bestOddsByKey.values()) {
    const arr = oddsByFixture.get(row.fixtureId) ?? [];
    arr.push(row);
    oddsByFixture.set(row.fixtureId, arr);
  }
  out(`  ${bestOddsByKey.size} paires (fixture, marché, pick) résolues.`);

  out("Replay du pipeline Poisson par fixture...");
  const points: Point[] = [];
  let processed = 0;
  let skippedColdStart = 0;
  let skippedNoOdds = 0;

  for (const fixture of fixtures) {
    const fixtureOdds = oddsByFixture.get(fixture.id);
    if (!fixtureOdds || fixtureOdds.length === 0) {
      skippedNoOdds++;
      continue;
    }

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
    const markets = computePoissonMarkets(lambda.home, lambda.away);
    processed++;

    const outcome = outcomeFromScores(fixture.homeScore, fixture.awayScore);
    const totalGoals = fixture.homeScore + fixture.awayScore;
    const btts = fixture.homeScore > 0 && fixture.awayScore > 0;
    const hasHt = fixture.homeHtScore !== null && fixture.awayHtScore !== null;
    const htOutcome = hasHt
      ? outcomeFromScores(fixture.homeHtScore!, fixture.awayHtScore!)
      : null;

    for (const row of fixtureOdds) {
      if (row.market === Market.RESULT_TOTAL_GOALS) {
        const prob =
          markets.resultTotalGoals[
            row.pick as keyof typeof markets.resultTotalGoals
          ];
        if (prob === undefined) continue;
        const match = /^(HOME|DRAW|AWAY)_(OVER|UNDER)_(\d)_(\d)$/.exec(
          row.pick,
        );
        if (!match) continue;
        const side = match[1]!;
        const ouSide = match[2]!;
        const line = Number(`${match[3]}.${match[4]}`);
        const actual: 0 | 1 =
          outcome === side &&
          (ouSide === "OVER" ? totalGoals > line : totalGoals < line)
            ? 1
            : 0;
        points.push({
          market: "RESULT_TOTAL_GOALS",
          pick: row.pick,
          odds: row.odds,
          prob: prob.toNumber(),
          actual,
        });
      } else if (row.market === Market.RESULT_BTTS) {
        const prob =
          markets.resultBtts[row.pick as keyof typeof markets.resultBtts];
        if (prob === undefined) continue;
        const match = /^(HOME|DRAW|AWAY)_(YES|NO)$/.exec(row.pick);
        if (!match) continue;
        const side = match[1]!;
        const yes = match[2]! === "YES";
        const actual: 0 | 1 = outcome === side && btts === yes ? 1 : 0;
        points.push({
          market: "RESULT_BTTS",
          pick: row.pick,
          odds: row.odds,
          prob: prob.toNumber(),
          actual,
        });
      } else if (row.market === Market.HALF_TIME_FULL_TIME) {
        if (!hasHt || !isHalfTimeFullTimePick(row.pick)) continue;
        const prob = markets.htft[row.pick as HalfTimeFullTimePick];
        if (prob === undefined) continue;
        const actual: 0 | 1 = row.pick === `${htOutcome}_${outcome}` ? 1 : 0;
        points.push({
          market: "HALF_TIME_FULL_TIME",
          pick: row.pick,
          odds: row.odds,
          prob: prob.toNumber(),
          actual,
        });
      } else if (row.market === Market.FIRST_HALF_WINNER) {
        if (!hasHt) continue;
        // ThreeWayProba uses lowercase keys (home/draw/away); odds_snapshot
        // picks are uppercase (HOME/DRAW/AWAY) — map between the two.
        const key = row.pick as "HOME" | "DRAW" | "AWAY";
        const proba = markets.firstHalfWinner;
        const prob =
          key === "HOME"
            ? proba.home
            : key === "AWAY"
              ? proba.away
              : proba.draw;
        if (prob === undefined) continue;
        const actual: 0 | 1 = htOutcome === key ? 1 : 0;
        points.push({
          market: "FIRST_HALF_WINNER",
          pick: row.pick,
          odds: row.odds,
          prob: prob.toNumber(),
          actual,
        });
      } else if (row.market === Market.OVER_UNDER) {
        // Only the 4.5 line — the case flagged in TODO.md as reaching
        // longshot odds with no equivalent dampening.
        if (row.pick !== "OVER_4_5" && row.pick !== "UNDER_4_5") continue;
        const prob = row.pick === "OVER_4_5" ? markets.over45 : markets.under45;
        const actual: 0 | 1 =
          row.pick === "OVER_4_5"
            ? totalGoals > 4.5
              ? 1
              : 0
            : totalGoals < 4.5
              ? 1
              : 0;
        points.push({
          market: "OVER_UNDER_4_5",
          pick: row.pick,
          odds: row.odds,
          prob: prob.toNumber(),
          actual,
        });
      }
    }
  }
  out(
    `  ${processed} fixtures traitées (${skippedColdStart} cold-start, ${skippedNoOdds} sans cote sur ces marchés).`,
  );
  out(`  ${points.length} points (fixture × marché × pick avec cote réelle).`);

  // Group by (market, oddsBucket).
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${p.market}::${bucketFor(p.odds)}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — Pénalité longshot hors 1X2 : calibration/ROI par tranche de cote",
  );
  out(
    `  ${dateLabel} — cotes bookmaker réelles, probabilité Poisson brute rejouée`,
  );
  out("═══════════════════════════════════════════════════════");
  out();

  const MARKET_ORDER = [
    "RESULT_TOTAL_GOALS",
    "RESULT_BTTS",
    "HALF_TIME_FULL_TIME",
    "FIRST_HALF_WINNER",
    "OVER_UNDER_4_5",
  ];

  for (const market of MARKET_ORDER) {
    out(`=== ${market} ===`);
    let any = false;
    for (const bucket of ODDS_BUCKETS) {
      const key = `${market}::${bucket.label}`;
      const pts = groups.get(key);
      if (!pts || pts.length < MIN_BUCKET_VOLUME) {
        out(
          `  ${bucket.label.padEnd(12)} n=${pts ? pts.length : 0} (volume insuffisant, < ${MIN_BUCKET_VOLUME})`,
        );
        continue;
      }
      any = true;
      const n = pts.length;
      const avgProb = pts.reduce((s, p) => s + p.prob, 0) / n;
      const hitRate = pts.reduce((s, p) => s + p.actual, 0) / n;
      const avgOdds = pts.reduce((s, p) => s + p.odds, 0) / n;
      const avgImplied = pts.reduce((s, p) => s + 1 / p.odds, 0) / n;
      // Naive ROI: flat 1-unit stake on every pick in the bucket, using its
      // own real odds. Not a claimed-EV filter — a pure "what if we always
      // bet this bucket" simulation, same spirit as the original 1X2 audits.
      const roi = pts.reduce((s, p) => s + (p.actual ? p.odds - 1 : -1), 0) / n;
      out(
        `  ${bucket.label.padEnd(12)} n=${String(n).padEnd(5)} avgOdds=${avgOdds.toFixed(2).padEnd(6)} ` +
          `P(modèle)=${(100 * avgProb).toFixed(1)}%  P(implicite cote)=${(100 * avgImplied).toFixed(1)}%  ` +
          `taux réel=${(100 * hitRate).toFixed(1)}%  ROI simulé=${(100 * roi).toFixed(1)}%`,
      );
    }
    if (!any) out("  (aucune tranche avec volume suffisant)");
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
