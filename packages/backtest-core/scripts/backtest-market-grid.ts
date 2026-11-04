/// <reference types="node" />
/**
 * Lot ML-1 : la grille de marché contre le moteur-stats, rejeu point-in-time
 * de 2026 (docs/audits/2026-11-04/ML1-GRILLE-MARCHE.md).
 *
 * HYPOTHÈSE (ML-V2-PROPOSITION § 2.2, § 3.1). Les probabilités tirées de la
 * grille de score impliquée par le prix affûté (Pinnacle, Bet365 sinon ;
 * Shin ; λ dom./ext. ajustés ; computeMarketGrid d'@evcore/analysis-core)
 * donnent aux 16 canaux de Phase 1 des jambes calibrées, là où le
 * moteur-stats sur-annonce, sans tuer les produits.
 *
 * CE QUI EST REJOUÉ. Pour chaque match terminé de 2026 (compétitions de
 * backtest), à coup d'envoi − 1 h :
 *   - moteur actuel : production-chain.ts (team_stats point-in-time, λ,
 *     force des championnats en coupe d'Europe avec LEAGUE_STRENGTH_MAP,
 *     H2H, blend 1X2, shrinkage, signaux) ;
 *   - grille : le même contexte, probabilités et λ remplacés par la grille
 *     quand elle est disponible ; sinon le match reste au moteur-stats (le
 *     repli de prod) et n'entre pas dans la comparaison appariée ;
 *   - grille « veille » : la même à 17 h UTC la veille (heure de composition
 *     des coupons), pour mesurer ce que le mouvement de ligne coûte.
 * Les 20 stratégies tournent via createChannelStrategyOrchestrator ; seules
 * les 16 de Phase 1 sont mesurées (VALUE/SAFE en observation, méta sans
 * pick). Une jambe par match × canal × marché. Cotes et prix de la grille :
 * relevés captés ET cotés avant l'instant (règle de prod ; les lignes
 * HISTORICAL, importées après coup, en sont exclues d'office).
 *
 * JUGE. La clôture Pinnacle (odds_closing_line, ≤ 2 h avant le coup
 * d'envoi), marge retirée par Shin, double chance et remboursé-si-nul
 * déduits de son 1X2. Lue après la décision, jamais en entrée. La grille
 * étant construite sur Pinnacle à l'instant d'analyse, son écart à la
 * clôture = erreur d'ajustement + mouvement de ligne entre l'analyse et la
 * clôture : les deux sont rapportés.
 *
 * MESURES. Par moteur et par canal : jambes, annoncé, réalisé, réalisé ÷
 * annoncé ; sur les jambes à clôture : réalisé − Pinnacle (le résidu),
 * annoncé − Pinnacle, ΔBrier (annoncé contre Pinnacle) ; part au-dessus du
 * plafond MAX_LEG_EDGE ; jours avec deux jambes de vivier 1,20–1,50 sur deux
 * matchs. IC 95 % par bootstrap en blocs de jours (1 000 tirages, graine
 * fixe). Brier 1X2 par match contre la clôture.
 *
 * RÈGLE D'EXPÉDITION (figée avant le premier rejeu, recopiée dans le
 * rapport). Expédié si les cinq tiennent :
 *   C1 couverture : grille disponible sur ≥ 80 % des matchs rejoués avec
 *      cotes, de septembre à novembre ;
 *   C2 calibration : sur toutes les jambes Phase 1 de la grille, borne basse
 *      de l'IC du ratio réalisé ÷ annoncé ≥ 0,97 ;
 *   C3 mieux que l'actuel : sur les mêmes matchs, IC de (ΔBrier grille −
 *      ΔBrier actuel) contre la clôture Pinnacle entièrement sous 0 ;
 *   C4 aucun canal dégradé : aucun canal à ≥ 100 jambes dont |ratio − 1| est
 *      plus grand avec la grille, IC de la différence hors de 0 ;
 *   C5 produits : de septembre à novembre, part des jours avec deux jambes de
 *      vivier 1,20–1,50 (canaux admis, sous MAX_LEG_EDGE) sur deux matchs
 *      distincts pas plus de 10 points sous celle du moteur actuel.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:market-grid
 *      [--from=2026-01-01] [--to=2026-11-04]
 * Output: packages/backtest-core/reports/backtest-market-grid-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { prisma } from "@evcore/db";
import {
  computeMarketGrid,
  createChannelStrategyOrchestrator,
  crossLeagueLambdaFactors,
  isEuropeanCompetition,
  LEAGUE_STRENGTH_MAP,
  Market,
  MAX_LEG_EDGE,
  POOL_ELIGIBLE_CHANNELS,
  POOL_EXCLUDED_MARKETS,
  CLOSING_COST_EXCLUDED_MARKETS,
  FILTER_STRATEGY_CHANNELS,
  META_STRATEGY_CHANNELS,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
  shinDoubleChance,
  shinOutcomeGroups,
  type MarketGridResult,
  type RawOddsRow,
  type StrategyContext,
  type StrategyChannel,
} from "@evcore/analysis-core";
import type { ReplayFixture } from "../src";
import { loaderFromEnv } from "./odds-archive";
import { replayContext } from "./production-chain";

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const FROM = new Date(`${arg("from") ?? "2026-01-01"}T00:00:00.000Z`);
const TO = new Date(`${arg("to") ?? "2026-11-04"}T00:00:00.000Z`);
const RECENT = new Date("2026-09-01T00:00:00.000Z");
const DECISION_LEAD_MS = 60 * 60 * 1000;
const COUPON_HOUR_UTC = 17;
const CLOSING_MAX_HOURS = 2;
const BOOTSTRAP = 1000;
const POOL_BAND = { min: 1.2, max: 1.5 };

type Engine = "stats" | "grid" | "veille";
const ENGINES: readonly Engine[] = ["stats", "grid", "veille"];

type Leg = {
  engine: Engine;
  fixtureId: string;
  day: string;
  month: string;
  gridAvailable: boolean;
  channel: StrategyChannel;
  market: Market;
  pick: string;
  p: number;
  odds: number;
  won: number;
  pClose: number | null;
  aboveEdgeCap: boolean;
  pool: boolean;
};

// ── Seeded bootstrap by day ────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Day-block bootstrap of a statistic computed from per-day sums. */
function bootstrap(
  days: readonly number[][],
  stat: (sums: number[]) => number,
): { value: number; lo: number; hi: number } {
  const width = days[0]?.length ?? 0;
  const total = (indices: Iterable<number>): number[] => {
    const sums = new Array<number>(width).fill(0);
    for (const i of indices) {
      const day = days[i] as number[];
      for (let k = 0; k < width; k++) sums[k] = (sums[k] ?? 0) + (day[k] ?? 0);
    }
    return sums;
  };
  const value = stat(total(days.keys()));
  const rng = mulberry32(20261104);
  const draws: number[] = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    const picks = Array.from({ length: days.length }, () =>
      Math.floor(rng() * days.length),
    );
    const v = stat(total(picks));
    if (Number.isFinite(v)) draws.push(v);
  }
  draws.sort((x, y) => x - y);
  const at = (q: number) => draws[Math.floor(q * (draws.length - 1))] ?? NaN;
  return { value, lo: at(0.025), hi: at(0.975) };
}

/** Per-day sums of `fields(leg)` for the legs, keyed by day. */
function perDay(
  legs: readonly Leg[],
  fields: (leg: Leg) => number[],
  dayKeys: readonly string[],
): number[][] {
  const index = new Map(dayKeys.map((d, i) => [d, i]));
  const width = legs[0] ? fields(legs[0]).length : 0;
  const out = dayKeys.map(() => new Array<number>(width).fill(0));
  for (const leg of legs) {
    const row = out[index.get(leg.day) as number] as number[];
    fields(leg).forEach((v, k) => (row[k] = (row[k] ?? 0) + v));
  }
  return out;
}

const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const ci = (r: { value: number; lo: number; hi: number }, d = 3) =>
  `${r.value >= 0 && d !== 3 ? "+" : ""}${fmt(r.value, d)} [${fmt(r.lo, d)} ; ${fmt(r.hi, d)}]`;
const signed = (r: { value: number; lo: number; hi: number }, d = 3) => {
  const s = (x: number) => `${x >= 0 ? "+" : ""}${fmt(x, d)}`;
  return `${s(r.value)} [${s(r.lo)} ; ${s(r.hi)}]`;
};

// ── Settlement and closing truth ───────────────────────────────────────────
function settle(fixture: ReplayFixture, market: Market, pick: string) {
  const { homeScore, awayScore, homeHtScore, awayHtScore } = fixture;
  switch (market) {
    case Market.OVER_UNDER_HT:
    case Market.FIRST_HALF_WINNER:
      return resolveFirstHalfBetStatus(pick, homeHtScore, awayHtScore);
    case Market.HALF_TIME_FULL_TIME:
      return resolveHalfTimeFullTimeBetStatus({
        pick,
        homeHtScore,
        awayHtScore,
        homeScore,
        awayScore,
      });
    case Market.TO_WIN_EITHER_HALF:
      return resolveWinEitherHalfBetStatus(
        pick,
        homeHtScore,
        awayHtScore,
        homeScore,
        awayScore,
      );
    default:
      return resolvePickBetStatus(market, pick, homeScore, awayScore);
  }
}

/** Fair closing probability per `${market}|${pick}`, Shin within each group. */
function closingFair(rows: readonly RawOddsRow[]): Map<string, number> {
  const fair = new Map<string, number>();
  const priced: {
    fixtureId: string;
    market: string;
    pick: string;
    odds: number;
  }[] = [];
  for (const row of rows) {
    if (row.market === Market.ONE_X_TWO) {
      const sides = [
        ["HOME", row.homeOdds],
        ["DRAW", row.drawOdds],
        ["AWAY", row.awayOdds],
      ] as const;
      for (const [pick, odds] of sides) {
        if (odds !== null)
          priced.push({
            fixtureId: "f",
            market: row.market,
            pick,
            odds: Number(odds),
          });
      }
    } else if (row.pick && row.odds !== null) {
      priced.push({
        fixtureId: "f",
        market: row.market,
        pick: row.pick,
        odds: Number(row.odds),
      });
    }
  }
  for (const r of shinOutcomeGroups(priced)) {
    fair.set(`${r.market}|${r.pick}`, r.fair.toNumber());
  }
  const oneXTwo = priced
    .filter((r) => r.market === Market.ONE_X_TWO)
    .map((r) => ({ pick: r.pick, odds: new Decimal(r.odds) }));
  const dc = shinDoubleChance(oneXTwo);
  for (const [pick, p] of dc ?? []) {
    const key = `${Market.DOUBLE_CHANCE}|${pick}`;
    if (!fair.has(key)) fair.set(key, p.toNumber());
  }
  const home = fair.get(`${Market.ONE_X_TWO}|HOME`);
  const away = fair.get(`${Market.ONE_X_TWO}|AWAY`);
  if (home !== undefined && away !== undefined) {
    for (const [pick, p] of [
      ["HOME", home],
      ["AWAY", away],
    ] as const) {
      const key = `${Market.DRAW_NO_BET}|${pick}`;
      if (!fair.has(key)) fair.set(key, p / (home + away));
    }
  }
  return fair;
}

// ── Replay ─────────────────────────────────────────────────────────────────
const PHASE_ONE = (channel: StrategyChannel) =>
  !FILTER_STRATEGY_CHANNELS.has(channel) &&
  !META_STRATEGY_CHANNELS.has(channel);
const POOL_CHANNELS = new Set<StrategyChannel>(POOL_ELIGIBLE_CHANNELS);

function veilleAsOf(kickoff: Date): Date {
  const d = new Date(kickoff);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(COUPON_HOUR_UTC, 0, 0, 0);
  return d;
}

function gridContext(
  base: StrategyContext,
  grid: Extract<MarketGridResult, { status: "ok" }>,
  odds: StrategyContext["odds"],
): StrategyContext {
  return {
    ...base,
    probabilities: grid.probabilities,
    lambdaHome: grid.fit.lambdaHome,
    lambdaAway: grid.fit.lambdaAway,
    odds,
    signals: {
      ...base.signals,
      lambdaFloorHit: false,
      lambdaTotal: grid.fit.lambdaHome + grid.fit.lambdaAway,
    },
  };
}

type Coverage = {
  fixtures: number;
  withOdds: number;
  grid: number;
  pinnacle: number;
  bet365: number;
  fitError: number;
  noQuotes: number;
  rmse: number[];
  ageHours: number[];
  closing: number;
};
const emptyCoverage = (): Coverage => ({
  fixtures: 0,
  withOdds: 0,
  grid: 0,
  pinnacle: 0,
  bet365: 0,
  fitError: 0,
  noQuotes: 0,
  rmse: [],
  ageHours: [],
  closing: 0,
});
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : (s[Math.floor(s.length / 2)] as number);
};

type FixtureBrier = {
  day: string;
  stats: number;
  grid: number;
  close: number;
  gridVsCloseAbs: number;
};

async function main() {
  const generatedAt = new Date();
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-market-grid-${generatedAt.toISOString().slice(0, 10)}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  const { loader, close: closeArchive } = await loaderFromEnv();
  const orchestrator = createChannelStrategyOrchestrator();
  const fixtures = await loader.listFixtures({ from: FROM, to: TO });
  out(
    `Grille de marché contre moteur-stats — ${generatedAt.toISOString()} — ${fixtures.length} matchs terminés du ${FROM.toISOString().slice(0, 10)} au ${TO.toISOString().slice(0, 10)}`,
  );

  const legs: Leg[] = [];
  const briers: FixtureBrier[] = [];
  const coverage = new Map<string, Coverage>();
  const covFor = (month: string) => {
    let c = coverage.get(month);
    if (!c) coverage.set(month, (c = emptyCoverage()));
    return c;
  };

  const startedAt = Date.now();
  const BATCH = 50;
  for (let offset = 0; offset < fixtures.length; offset += BATCH) {
    const batch = fixtures.slice(offset, offset + BATCH);
    const asOfs = batch.map(
      (f) => new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
    );
    const veilles = batch.map((f) => veilleAsOf(f.scheduledAt));
    const [odds, oddsVeille, gridRows, closing] = await Promise.all([
      loader.loadOddsBatch(
        batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
      ),
      loader.loadOddsBatch(
        batch.map((f, i) => ({ fixtureId: f.id, asOf: veilles[i] as Date })),
      ),
      loader.loadMarketGridRowsBatch([
        ...batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
        ...batch.map((f, i) => ({ fixtureId: f.id, asOf: veilles[i] as Date })),
      ]),
      loader.loadClosingPricesBatch(
        batch.map((f) => f.id),
        { bookmaker: "Pinnacle", maxHoursBeforeKickoff: CLOSING_MAX_HOURS },
      ),
    ]);

    for (const [i, fixture] of batch.entries()) {
      const asOf = asOfs[i] as Date;
      const veille = veilles[i] as Date;
      const day = fixture.scheduledAt.toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      const cov = covFor(month);
      cov.fixtures += 1;
      const fixtureOdds = odds.get(fixture.id) ?? null;
      if (!fixtureOdds) continue;

      let crossLeagueFactors: { home: number; away: number } | undefined;
      if (isEuropeanCompetition(fixture.competitionCode)) {
        const [homeLeague, awayLeague] = await Promise.all([
          loader.loadDomesticLeague({ teamId: fixture.homeTeamId, asOf }),
          loader.loadDomesticLeague({ teamId: fixture.awayTeamId, asOf }),
        ]);
        crossLeagueFactors = crossLeagueLambdaFactors({
          homeLeague,
          awayLeague,
          strengths: LEAGUE_STRENGTH_MAP,
        });
      }
      const statsCtx = await replayContext({
        loader,
        fixture,
        odds: fixtureOdds,
        asOf,
        crossLeagueFactors,
      });
      if (!statsCtx) continue;
      cov.withOdds += 1;

      const grid = computeMarketGrid(gridRows[i] ?? [], asOf);
      const gridVeille =
        veille < asOf
          ? computeMarketGrid(gridRows[batch.length + i] ?? [], veille)
          : null;
      if (grid.status === "ok") {
        cov.grid += 1;
        if (grid.quotes.bookmaker === "Pinnacle") cov.pinnacle += 1;
        else cov.bet365 += 1;
        cov.rmse.push(grid.fit.rmse);
        cov.ageHours.push(
          (asOf.getTime() - grid.quotes.snapshotAt.getTime()) / 3_600_000,
        );
      } else if (grid.reason === "fit_error") cov.fitError += 1;
      else cov.noQuotes += 1;

      const closingRows = closing.get(fixture.id) ?? [];
      const fair = closingFair(closingRows);
      if (fair.has(`${Market.ONE_X_TWO}|HOME`)) cov.closing += 1;

      const contexts: Array<[Engine, StrategyContext]> = [["stats", statsCtx]];
      if (grid.status === "ok") {
        contexts.push(["grid", gridContext(statsCtx, grid, fixtureOdds)]);
      }
      const veilleOdds = oddsVeille.get(fixture.id) ?? null;
      if (gridVeille?.status === "ok" && veilleOdds) {
        contexts.push([
          "veille",
          gridContext(statsCtx, gridVeille, veilleOdds),
        ]);
      }

      for (const [engine, ctx] of contexts) {
        const seen = new Set<string>();
        for (const decision of orchestrator.evaluate(ctx)) {
          if (!PHASE_ONE(decision.channel) || decision.status !== "SELECTED") {
            continue;
          }
          for (const sel of decision.selections) {
            const key = `${decision.channel}|${sel.market}`;
            if (seen.has(key) || sel.odds === undefined) continue;
            seen.add(key);
            const status = settle(fixture, sel.market, sel.pick);
            if (status !== "WON" && status !== "LOST") continue;
            const p = sel.probability.toNumber();
            const o = sel.odds.toNumber();
            legs.push({
              engine,
              fixtureId: fixture.id,
              day,
              month,
              gridAvailable: grid.status === "ok",
              channel: decision.channel,
              market: sel.market,
              pick: sel.pick,
              p,
              odds: o,
              won: status === "WON" ? 1 : 0,
              pClose: fair.get(`${sel.market}|${sel.pick}`) ?? null,
              aboveEdgeCap: p - 1 / o > MAX_LEG_EDGE,
              pool:
                POOL_CHANNELS.has(decision.channel) &&
                !POOL_EXCLUDED_MARKETS.includes(sel.market) &&
                !CLOSING_COST_EXCLUDED_MARKETS.includes(sel.market),
            });
          }
        }
      }

      // Fixture-level 1X2 Brier against the Pinnacle close.
      const ch = fair.get(`${Market.ONE_X_TWO}|HOME`);
      const cd = fair.get(`${Market.ONE_X_TWO}|DRAW`);
      const ca = fair.get(`${Market.ONE_X_TWO}|AWAY`);
      if (
        grid.status === "ok" &&
        ch !== undefined &&
        cd !== undefined &&
        ca !== undefined
      ) {
        const y = [
          fixture.homeScore > fixture.awayScore ? 1 : 0,
          fixture.homeScore === fixture.awayScore ? 1 : 0,
          fixture.homeScore < fixture.awayScore ? 1 : 0,
        ];
        const brier = (p: number[]) =>
          p.reduce((s, v, k) => s + (v - (y[k] as number)) ** 2, 0);
        const sp = statsCtx.probabilities;
        const gp = grid.probabilities;
        const g = [gp.home.toNumber(), gp.draw.toNumber(), gp.away.toNumber()];
        briers.push({
          day,
          stats: brier([
            sp.home.toNumber(),
            sp.draw.toNumber(),
            sp.away.toNumber(),
          ]),
          grid: brier(g),
          close: brier([ch, cd, ca]),
          gridVsCloseAbs:
            (Math.abs((g[0] as number) - ch) +
              Math.abs((g[1] as number) - cd) +
              Math.abs((g[2] as number) - ca)) /
            3,
        });
      }
    }
    console.log(
      `[${Math.min(offset + BATCH, fixtures.length)}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s, ${legs.length} jambes`,
    );
  }

  // ── Coverage ─────────────────────────────────────────────────────────────
  out();
  out("== COUVERTURE (grille à coup d'envoi − 1 h) ==");
  out(
    "mois     matchs  rejoués  grille  Pinnacle Bet365  erreur  sans-prix  rmse méd.  âge prix méd. (h)  clôture Pin ≤2h",
  );
  const sumCov = emptyCoverage();
  const recentCov = emptyCoverage();
  for (const [month, c] of [...coverage].sort()) {
    for (const target of month >= RECENT.toISOString().slice(0, 7)
      ? [sumCov, recentCov]
      : [sumCov]) {
      target.fixtures += c.fixtures;
      target.withOdds += c.withOdds;
      target.grid += c.grid;
      target.pinnacle += c.pinnacle;
      target.bet365 += c.bet365;
      target.fitError += c.fitError;
      target.noQuotes += c.noQuotes;
      target.rmse.push(...c.rmse);
      target.ageHours.push(...c.ageHours);
      target.closing += c.closing;
    }
    out(
      `${month}  ${String(c.fixtures).padStart(6)}  ${String(c.withOdds).padStart(7)}  ${String(c.grid).padStart(6)}  ${String(c.pinnacle).padStart(8)} ${String(c.bet365).padStart(6)}  ${String(c.fitError).padStart(6)}  ${String(c.noQuotes).padStart(9)}  ${fmt(median(c.rmse), 4).padStart(9)}  ${fmt(median(c.ageHours), 1).padStart(17)}  ${String(c.closing).padStart(15)}`,
    );
  }
  for (const [label, c] of [
    ["total", sumCov],
    ["sept.–nov.", recentCov],
  ] as const) {
    out(
      `${label} : ${c.withOdds} rejoués, grille ${c.grid} (${fmt((100 * c.grid) / Math.max(c.withOdds, 1), 1)} %), Pinnacle ${c.pinnacle}, Bet365 ${c.bet365}, erreur d'ajustement ${c.fitError}, sans prix affûté ${c.noQuotes}, rmse médiane ${fmt(median(c.rmse), 4)}`,
    );
  }

  // ── Fixture-level 1X2 ────────────────────────────────────────────────────
  out();
  out(
    "== 1X2 PAR MATCH CONTRE LA CLÔTURE PINNACLE (matchs à grille et clôture ≤ 2 h) ==",
  );
  const bDays = [...new Set(briers.map((b) => b.day))].sort();
  const bIndex = new Map(bDays.map((d, i) => [d, i]));
  const bRows = bDays.map(() => [0, 0, 0, 0, 0]);
  for (const b of briers) {
    const row = bRows[bIndex.get(b.day) as number] as number[];
    row[0] = (row[0] ?? 0) + b.stats;
    row[1] = (row[1] ?? 0) + b.grid;
    row[2] = (row[2] ?? 0) + b.close;
    row[3] = (row[3] ?? 0) + 1;
    row[4] = (row[4] ?? 0) + b.gridVsCloseAbs;
  }
  out(
    `n ${briers.length} matchs. Brier actuel ${fmt(briers.reduce((s, b) => s + b.stats, 0) / Math.max(briers.length, 1), 4)} / grille ${fmt(briers.reduce((s, b) => s + b.grid, 0) / Math.max(briers.length, 1), 4)} / clôture ${fmt(briers.reduce((s, b) => s + b.close, 0) / Math.max(briers.length, 1), 4)}`,
  );
  out(
    `  résidu actuel (Brier − clôture)  ${signed(
      bootstrap(bRows, (s) => ((s[0] ?? 0) - (s[2] ?? 0)) / (s[3] ?? 1)),
      4,
    )}`,
  );
  out(
    `  résidu grille (Brier − clôture)  ${signed(
      bootstrap(bRows, (s) => ((s[1] ?? 0) - (s[2] ?? 0)) / (s[3] ?? 1)),
      4,
    )}`,
  );
  out(
    `  écart moyen |grille − clôture| par issue ${fmt(bootstrap(bRows, (s) => (s[4] ?? 0) / (s[3] ?? 1)).value, 4)} (mouvement de ligne entre T−1 h et la clôture + erreur d'ajustement)`,
  );

  // ── Per channel ──────────────────────────────────────────────────────────
  const channels = [...new Set(legs.map((l) => l.channel))].sort();
  const days = [...new Set(legs.map((l) => l.day))].sort();
  const paired = legs.filter((l) => l.gridAvailable);
  const table = (title: string, subset: Leg[]) => {
    out();
    out(`== ${title} ==`);
    out(
      "canal / moteur          jambes  annoncé réalisé  réalisé÷annoncé [IC]     | clôt.  annoncé−Pin  réalisé−Pin [IC]          ΔBrier vs Pin [IC]          | >plafond",
    );
    const rows: Array<[string, Leg[]]> = [
      ...channels.map(
        (ch) => [ch, subset.filter((l) => l.channel === ch)] as [string, Leg[]],
      ),
      ["TOUS", subset],
    ];
    for (const [ch, chLegs] of rows) {
      for (const engine of ENGINES) {
        const e = chLegs.filter((l) => l.engine === engine);
        if (e.length === 0) continue;
        const ratio = bootstrap(
          perDay(e, (l) => [l.won, l.p], days),
          (s) => (s[0] ?? 0) / (s[1] ?? 1),
        );
        const withClose = e.filter((l) => l.pClose !== null);
        const resid = bootstrap(
          perDay(withClose, (l) => [l.won - (l.pClose as number), 1], days),
          (s) => (s[0] ?? 0) / (s[1] ?? 1),
        );
        const overAnn =
          withClose.reduce((s, l) => s + l.p - (l.pClose as number), 0) /
          Math.max(withClose.length, 1);
        const dBrier = bootstrap(
          perDay(
            withClose,
            (l) => [
              (l.p - l.won) ** 2 - ((l.pClose as number) - l.won) ** 2,
              1,
            ],
            days,
          ),
          (s) => (s[0] ?? 0) / (s[1] ?? 1),
        );
        const ann = e.reduce((s, l) => s + l.p, 0) / e.length;
        const real = e.reduce((s, l) => s + l.won, 0) / e.length;
        const capped = e.filter((l) => l.aboveEdgeCap).length / e.length;
        out(
          `${`${ch} / ${engine}`.padEnd(24)}${String(e.length).padStart(6)}  ${fmt(ann)}   ${fmt(real)}    ${ci(ratio).padEnd(24)} | ${String(withClose.length).padStart(5)}  ${(withClose.length ? `${overAnn >= 0 ? "+" : ""}${fmt(overAnn)}` : "—").padStart(11)}  ${(withClose.length ? signed(resid) : "—").padEnd(25)} ${(withClose.length ? signed(dBrier, 4) : "—").padEnd(27)} | ${fmt(100 * capped, 1)} %`,
        );
      }
    }
  };
  table(
    "TOUS LES MATCHS (grille = matchs où elle existe ; actuel = tous)",
    legs,
  );
  table("APPARIÉ : MATCHS OÙ LA GRILLE EXISTE", paired);

  // ── Shipping criteria ────────────────────────────────────────────────────
  out();
  out("== CRITÈRES D'EXPÉDITION ==");
  const c1 = recentCov.grid / Math.max(recentCov.withOdds, 1);
  out(
    `C1 couverture sept.–nov. ${fmt(100 * c1, 1)} % (seuil 80 %) → ${c1 >= 0.8 ? "OK" : "NON"}`,
  );
  const gridLegs = paired.filter((l) => l.engine === "grid");
  const c2 = bootstrap(
    perDay(gridLegs, (l) => [l.won, l.p], days),
    (s) => (s[0] ?? 0) / (s[1] ?? 1),
  );
  out(
    `C2 ratio grille ${ci(c2)} (borne basse ≥ 0,97) → ${c2.lo >= 0.97 ? "OK" : "NON"}`,
  );
  const both = (fn: (l: Leg) => number) => (l: Leg) =>
    l.pClose === null
      ? [0, 0, 0, 0]
      : l.engine === "grid"
        ? [fn(l), 1, 0, 0]
        : l.engine === "stats"
          ? [0, 0, fn(l), 1]
          : [0, 0, 0, 0];
  const c3 = bootstrap(
    perDay(
      paired.filter((l) => l.engine !== "veille"),
      both((l) => (l.p - l.won) ** 2 - ((l.pClose as number) - l.won) ** 2),
      days,
    ),
    (s) => (s[0] ?? 0) / (s[1] ?? 1) - (s[2] ?? 0) / (s[3] ?? 1),
  );
  out(
    `C3 ΔBrier grille − ΔBrier actuel ${signed(c3, 4)} (IC sous 0) → ${c3.hi < 0 ? "OK" : "NON"}`,
  );
  let c4ok = true;
  for (const ch of channels) {
    const sub = paired.filter((l) => l.channel === ch && l.engine !== "veille");
    const nGrid = sub.filter((l) => l.engine === "grid").length;
    if (nGrid < 100 || sub.filter((l) => l.engine === "stats").length === 0)
      continue;
    const d = bootstrap(
      perDay(
        sub,
        (l) => (l.engine === "grid" ? [l.won, l.p, 0, 0] : [0, 0, l.won, l.p]),
        days,
      ),
      (s) =>
        Math.abs((s[0] ?? 0) / (s[1] ?? 1) - 1) -
        Math.abs((s[2] ?? 0) / (s[3] ?? 1) - 1),
    );
    const worse = d.lo > 0;
    if (worse) c4ok = false;
    out(
      `C4 ${ch.padEnd(20)} |ratio−1| grille − actuel ${signed(d)}${worse ? "  ← dégradé" : ""}`,
    );
  }
  out(`C4 → ${c4ok ? "OK" : "NON"}`);
  const poolDays = (engine: Engine) => {
    const recentDays = days.filter(
      (d) => d >= RECENT.toISOString().slice(0, 10),
    );
    const byDay = new Map<string, Set<string>>();
    for (const l of legs) {
      if (l.engine !== engine || !l.pool || l.aboveEdgeCap) continue;
      if (l.odds < POOL_BAND.min || l.odds > POOL_BAND.max) continue;
      const set = byDay.get(l.day) ?? new Set<string>();
      set.add(l.fixtureId);
      byDay.set(l.day, set);
    }
    const ok = recentDays.filter((d) => (byDay.get(d)?.size ?? 0) >= 2).length;
    const sizes = recentDays.map((d) => byDay.get(d)?.size ?? 0);
    return {
      share: ok / Math.max(recentDays.length, 1),
      median: median(sizes),
      n: recentDays.length,
    };
  };
  // Production with the grid = grid legs where it exists, statistics legs elsewhere.
  const hybrid = legs.filter(
    (l) => l.engine === "grid" || (l.engine === "stats" && !l.gridAvailable),
  );
  const hybridDays = (() => {
    const recentDays = days.filter(
      (d) => d >= RECENT.toISOString().slice(0, 10),
    );
    const byDay = new Map<string, Set<string>>();
    for (const l of hybrid) {
      if (
        !l.pool ||
        l.aboveEdgeCap ||
        l.odds < POOL_BAND.min ||
        l.odds > POOL_BAND.max
      )
        continue;
      const set = byDay.get(l.day) ?? new Set<string>();
      set.add(l.fixtureId);
      byDay.set(l.day, set);
    }
    const ok = recentDays.filter((d) => (byDay.get(d)?.size ?? 0) >= 2).length;
    return {
      share: ok / Math.max(recentDays.length, 1),
      median: median(recentDays.map((d) => byDay.get(d)?.size ?? 0)),
    };
  })();
  const ps = poolDays("stats");
  out(
    `C5 jours à ≥ 2 matchs de vivier 1,20–1,50 (sept.–nov., ${ps.n} jours) : actuel ${fmt(100 * ps.share, 1)} % (médiane ${ps.median} matchs/jour), grille + repli ${fmt(100 * hybridDays.share, 1)} % (médiane ${hybridDays.median}) → ${hybridDays.share >= ps.share - 0.1 ? "OK" : "NON"}`,
  );

  // ── Volume per channel (production with the grid vs today) ───────────────
  out();
  out(
    "== VOLUME PAR CANAL (jambes réglées, sept.–nov.) : actuel → grille + repli ==",
  );
  const recentDay = RECENT.toISOString().slice(0, 10);
  for (const ch of channels) {
    const now = legs.filter(
      (l) => l.engine === "stats" && l.channel === ch && l.day >= recentDay,
    ).length;
    const next = hybrid.filter(
      (l) => l.channel === ch && l.day >= recentDay,
    ).length;
    const cappedNow = legs.filter(
      (l) =>
        l.engine === "stats" &&
        l.channel === ch &&
        l.day >= recentDay &&
        l.aboveEdgeCap,
    ).length;
    const cappedNext = hybrid.filter(
      (l) => l.channel === ch && l.day >= recentDay && l.aboveEdgeCap,
    ).length;
    out(
      `${ch.padEnd(20)} ${String(now).padStart(6)} → ${String(next).padStart(6)}   au-dessus de MAX_LEG_EDGE ${fmt((100 * cappedNow) / Math.max(now, 1), 1)} % → ${fmt((100 * cappedNext) / Math.max(next, 1), 1)} %`,
    );
  }

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`Rapport écrit : ${outputPath}`);
  closeArchive();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
