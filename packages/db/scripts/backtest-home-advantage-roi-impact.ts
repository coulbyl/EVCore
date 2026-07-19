/// <reference types="node" />
/**
 * Impact ROI (pas seulement calibration) du changement de
 * homeAdvFactor/awayDisadvFactor proposé par
 * backtest-home-advantage-calibration.ts (1.05/0.95 -> 1.00/0.75).
 *
 * La calibration (Brier/ECE) dit que le modèle "sait mieux ce qu'il dit"
 * une fois recalé, mais ça ne garantit pas un meilleur ROI une fois les
 * cotes réelles et le seuil EV appliqués — ce script simule une sélection
 * VALUE (EV max >= 0.08) sur ONE_X_TWO uniquement (marché avec la
 * couverture de cotes historiques la plus profonde — ~39 700 fixtures
 * terminées avec cote, vs 0 pour les 10 nouveaux marchés) et compare le
 * ROI réalisé avec l'ancien vs le nouveau facteur.
 *
 * Simplification assumée : simulation mono-marché (ONE_X_TWO seul), alors
 * que la vraie sélection VALUE compare l'EV sur tous les marchés éligibles
 * pour choisir le meilleur pick par fixture. ONE_X_TWO est le marché le
 * plus exposé à ce facteur (il pilote directement home/draw/away) et le
 * seul avec une couverture de cotes suffisante pour ce test — un
 * comparatif multi-marché est un suivi possible mais plus lourd.
 *
 * Run: pnpm --filter @evcore/db db:backtest:home-advantage-roi
 * Output: packages/db/reports/backtest-home-advantage-roi-impact-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { computePoissonMarkets, flatRoi, type TeamStatsInput } from "@evcore/analysis-core";
import { prisma } from "../src/client";

const MIN_PRIOR_TEAM_STATS = 5;
const MEAN_LAMBDA = 1.4;
const SHRINKAGE_FACTOR = 0.7;
const EV_THRESHOLD = 0.08; // config/ev.constants.ts — dupliqué ici en lecture seule pour ce script d'analyse

const OLD_HOME_FACTOR = 1.05;
const OLD_AWAY_FACTOR = 0.95;
const NEW_HOME_FACTOR = 1.0;
const NEW_AWAY_FACTOR = 0.75;

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

type Pick = "HOME" | "DRAW" | "AWAY";

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

type SelectedBet = { won: boolean; odds: number; pick: Pick };

function simulateValue(
  probHome: number,
  probDraw: number,
  probAway: number,
  oddsHome: number,
  oddsDraw: number,
  oddsAway: number,
  outcome: Pick,
): SelectedBet | null {
  const candidates: { pick: Pick; ev: number; odds: number }[] = [
    { pick: "HOME", ev: probHome * oddsHome - 1, odds: oddsHome },
    { pick: "DRAW", ev: probDraw * oddsDraw - 1, odds: oddsDraw },
    { pick: "AWAY", ev: probAway * oddsAway - 1, odds: oddsAway },
  ];
  const best = candidates.reduce((a, b) => (b.ev > a.ev ? b : a));
  if (best.ev < EV_THRESHOLD) return null;
  return { won: best.pick === outcome, odds: best.odds, pick: best.pick };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-home-advantage-roi-impact-${dateLabel}.txt`,
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

  out("Chargement des cotes ONE_X_TWO (snapshot le plus récent <= coup d'envoi, même convention que backtest.repository.ts)...");
  const oddsSnapshots = await prisma.oddsSnapshot.findMany({
    where: {
      market: "ONE_X_TWO",
      homeOdds: { not: null },
      drawOdds: { not: null },
      awayOdds: { not: null },
    },
    select: { fixtureId: true, homeOdds: true, drawOdds: true, awayOdds: true, snapshotAt: true },
    orderBy: [{ fixtureId: "asc" }, { snapshotAt: "desc" }],
  });
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const oddsByFixture = new Map<string, { home: number; draw: number; away: number }>();
  for (const s of oddsSnapshots) {
    if (oddsByFixture.has(s.fixtureId)) continue;
    const fixture = fixtureById.get(s.fixtureId);
    if (!fixture || s.snapshotAt.getTime() > fixture.scheduledAt.getTime()) continue;
    oddsByFixture.set(s.fixtureId, {
      home: Number(s.homeOdds),
      draw: Number(s.drawOdds),
      away: Number(s.awayOdds),
    });
  }
  out(`  ${oddsByFixture.size} fixtures avec cote ONE_X_TWO pré-match disponible.`);

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

  out("Simulation VALUE (ONE_X_TWO, EV max >= 0.08) — ancien vs nouveau facteur...");
  const oldBets: SelectedBet[] = [];
  const newBets: SelectedBet[] = [];
  let sameSideCount = 0;
  let flippedSideCount = 0;
  let enteredCount = 0; // sélectionné par le nouveau, pas par l'ancien
  let exitedCount = 0; // sélectionné par l'ancien, pas par le nouveau
  let skippedColdStart = 0;
  let usable = 0;

  for (const fixture of fixtures) {
    const odds = oddsByFixture.get(fixture.id);
    if (!odds) continue;

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
    usable++;

    const { rawHome, rawAway } = rawLambdas(home.stats, away.stats);
    const outcome: Pick =
      fixture.homeScore > fixture.awayScore
        ? "HOME"
        : fixture.awayScore > fixture.homeScore
          ? "AWAY"
          : "DRAW";

    const oldLambdaHome = clamp(rawHome * OLD_HOME_FACTOR, 0.05, 5);
    const oldLambdaAway = clamp(rawAway * OLD_AWAY_FACTOR, 0.05, 5);
    const oldMarkets = computePoissonMarkets(oldLambdaHome, oldLambdaAway);
    const oldBet = simulateValue(
      oldMarkets.home.toNumber(),
      oldMarkets.draw.toNumber(),
      oldMarkets.away.toNumber(),
      odds.home,
      odds.draw,
      odds.away,
      outcome,
    );

    const newLambdaHome = clamp(rawHome * NEW_HOME_FACTOR, 0.05, 5);
    const newLambdaAway = clamp(rawAway * NEW_AWAY_FACTOR, 0.05, 5);
    const newMarkets = computePoissonMarkets(newLambdaHome, newLambdaAway);
    const newBet = simulateValue(
      newMarkets.home.toNumber(),
      newMarkets.draw.toNumber(),
      newMarkets.away.toNumber(),
      odds.home,
      odds.draw,
      odds.away,
      outcome,
    );

    if (oldBet) oldBets.push(oldBet);
    if (newBet) newBets.push(newBet);

    if (oldBet && newBet) {
      if (oldBet.pick === newBet.pick) sameSideCount++;
      else flippedSideCount++;
    } else if (oldBet && !newBet) {
      exitedCount++;
    } else if (!oldBet && newBet) {
      enteredCount++;
    }
  }

  out(
    `  ${usable} fixtures avec cote + TeamStats utilisables, ${skippedColdStart} exclues (cold-start).`,
  );

  const roiOld = flatRoi(oldBets) * 100;
  const roiNew = flatRoi(newBets) * 100;
  const winRateOld = (oldBets.filter((b) => b.won).length / Math.max(1, oldBets.length)) * 100;
  const winRateNew = (newBets.filter((b) => b.won).length / Math.max(1, newBets.length)) * 100;

  const bySide = (bets: SelectedBet[], pick: Pick) => {
    const subset = bets.filter((b) => b.pick === pick);
    return { n: subset.length, roi: subset.length > 0 ? flatRoi(subset) * 100 : 0 };
  };

  out();
  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Impact ROI VALUE (ONE_X_TWO) du recalage homeAdv/awayDisadv");
  out(`  ${dateLabel} — EV_THRESHOLD=${EV_THRESHOLD}, staking flat`);
  out("═══════════════════════════════════════════════════════");
  out();
  out(`Ancien facteur (${OLD_HOME_FACTOR} / ${OLD_AWAY_FACTOR}) :`);
  out(`  Picks sélectionnés : ${oldBets.length}  ROI=${roiOld.toFixed(2)}%  Win rate=${winRateOld.toFixed(1)}%`);
  for (const pick of ["HOME", "DRAW", "AWAY"] as const) {
    const s = bySide(oldBets, pick);
    out(`    ${pick.padEnd(5)} n=${s.n}  ROI=${s.roi.toFixed(2)}%`);
  }
  out();
  out(`Nouveau facteur (${NEW_HOME_FACTOR} / ${NEW_AWAY_FACTOR}) :`);
  out(`  Picks sélectionnés : ${newBets.length}  ROI=${roiNew.toFixed(2)}%  Win rate=${winRateNew.toFixed(1)}%`);
  for (const pick of ["HOME", "DRAW", "AWAY"] as const) {
    const s = bySide(newBets, pick);
    out(`    ${pick.padEnd(5)} n=${s.n}  ROI=${s.roi.toFixed(2)}%`);
  }
  out();
  out("Mouvement des sélections (fixture par fixture) :");
  out(`  Même côté sous les deux configs : ${sameSideCount}`);
  out(`  Côté changé (HOME<->DRAW<->AWAY) : ${flippedSideCount}`);
  out(`  Entrées (sélectionné seulement par le nouveau) : ${enteredCount}`);
  out(`  Sorties (sélectionné seulement par l'ancien) : ${exitedCount}`);
  out();
  out(`Delta ROI global : ${(roiNew - roiOld).toFixed(2)} points`);
  out(`Delta volume : ${newBets.length - oldBets.length} picks`);

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
