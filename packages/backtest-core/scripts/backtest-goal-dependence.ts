/// <reference types="node" />
/**
 * Lot ML-2a : sous-modèle D, la dépendance des buts (Dixon-Coles) sur la
 * grille de marché (docs/audits/2026-11-04/ML2A-DEPENDANCE-BUTS.md).
 *
 * HYPOTHÈSE (posée avant les données). Avec λ tirés du prix (grille ML-1),
 * un ρ de Dixon-Coles par championnat — régularisé vers un ρ global,
 * minimum de matchs, ajusté point-in-time sur le passé — corrige la
 * sous/sur-estimation des petits scores (nul, 0-0, 1-0, BTTS, scores exacts)
 * que l'indépendance de Poisson laisse.
 *
 * AJUSTEMENT DE ρ. Pour chaque match passé dont la grille existe, et pour
 * chaque ρ de RHO_GRID (−0,30 à +0,10 par 0,01), λ dom./ext. sont ré-ajustés
 * sous ρ (fitMarketGridLambdas : la grille reproduit toujours le 1X2 et les
 * lignes) et on garde la log-vraisemblance du score réel. ρ global = argmax
 * de la somme ; ρ d'un championnat = (n·ρ̂ + K·ρ global) / (n + K), K =
 * SHRINK_K, et le ρ global sous MIN_FIXTURES matchs. Entraînement :
 * 2023–2025 (lignes HISTORICAL Pinnacle de clôture, 1X2 et plus/moins lus
 * comme un seul état du marché, à l'heure du match) puis les grilles
 * point-in-time de 2026. Walk-forward : la carte d'un mois n'est ajustée que
 * sur les matchs des mois précédents.
 *
 * REJEU. Matchs terminés de 2026, décision à coup d'envoi − 1 h, comme ML-1
 * (lignes captées et cotées avant l'instant). Deux moteurs sur les mêmes
 * matchs : la grille indépendante (prod, ρ = 0) et la grille à ρ du
 * championnat. Les 20 stratégies tournent, les 16 de Phase 1 sont mesurées,
 * une jambe par match × canal × marché. Juge : clôture Pinnacle ≤ 2 h, Shin.
 * IC 95 % par bootstrap en blocs de jours (1 000 tirages, graine fixe).
 *
 * RÈGLE D'EXPÉDITION (écrite avant le rejeu complet). Expédié si les
 * quatre tiennent :
 *   D1 score exact : sur tous les matchs rejoués à deux grilles, IC de la
 *      log-perte moyenne du score réel (ρ − indépendant) entièrement sous 0 ;
 *   D2 résidu contre Pinnacle : sur les matchs à clôture BTTS Pinnacle, IC
 *      de [(p_ρ − p_clôture)² − (p_0 − p_clôture)²] sur BTTS oui
 *      entièrement sous 0 ;
 *   D3 calibration : sur toutes les jambes Phase 1 de la grille à ρ, borne
 *      basse de l'IC du ratio réalisé ÷ annoncé ≥ 0,97 ;
 *   D4 aucun canal dégradé : aucun canal à ≥ 100 jambes dont |ratio − 1|
 *      est plus grand avec ρ, IC de la différence hors de 0.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:goal-dependence
 *      [--from=2026-01-01] [--to=2026-11-04]
 * Output: packages/backtest-core/reports/backtest-goal-dependence-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, prisma } from "@evcore/db";
import {
  buildPoissonDistributions,
  computeMarketGrid,
  createChannelStrategyOrchestrator,
  crossLeagueLambdaFactors,
  fitMarketGridLambdas,
  isEuropeanCompetition,
  LEAGUE_STRENGTH_MAP,
  Market,
  MARKET_GRID_BOOKMAKERS,
  MARKET_GRID_MARKETS,
  FILTER_STRATEGY_CHANNELS,
  META_STRATEGY_CHANNELS,
  scoreCells,
  selectMarketGridQuotes,
  shinOneXTwo,
  shinOutcomeGroups,
  type MarketGridResult,
  type RawOddsRow,
  type ScoreCell,
  type StrategyChannel,
  type StrategyContext,
} from "@evcore/analysis-core";
import { bootstrapDaySums, settleReplayPick, type ReplayFixture } from "../src";
import { loaderFromEnv } from "./odds-archive";
import { replayContext } from "./production-chain";

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const TRAIN_FROM = new Date("2023-01-01T00:00:00.000Z");
const FROM = new Date(`${arg("from") ?? "2026-01-01"}T00:00:00.000Z`);
const TO = new Date(`${arg("to") ?? "2026-11-04"}T00:00:00.000Z`);
const DECISION_LEAD_MS = 60 * 60 * 1000;
const CLOSING_MAX_HOURS = 2;
const BOOTSTRAP = 1000;
const MAX_GOALS = 10;
const RHO_GRID = Array.from({ length: 41 }, (_, i) =>
  Number((-0.3 + 0.01 * i).toFixed(2)),
);
const MIN_FIXTURES = 200;
const SHRINK_K = 500;

type Engine = "indep" | "rho";
const ENGINES: readonly Engine[] = ["indep", "rho"];

type TrainRow = { at: number; competition: string; ll: Float64Array };
type RhoMap = {
  global: number;
  byCompetition: Map<string, { rho: number; n: number; mle: number }>;
};

type Leg = {
  engine: Engine;
  day: string;
  channel: StrategyChannel;
  p: number;
  won: number;
  pClose: number | null;
};

type FixtureScore = {
  day: string;
  rho: number;
  y: { cs: string; draw: number; nil: number; btts: number; under25: number };
  p: Record<
    Engine,
    {
      ll: number;
      draw: number;
      nil: number;
      oneNil: number;
      oneOne: number;
      btts: number;
      under25: number;
    }
  >;
  closeBtts: number | null;
  closeOver25: number | null;
  closeDraw: number | null;
};

const bootstrap = (
  days: readonly number[][],
  stat: (sums: number[]) => number,
) => bootstrapDaySums(days, stat, { draws: BOOTSTRAP, seed: 20261104 });

function perDay<T extends { day: string }>(
  items: readonly T[],
  fields: (item: T) => number[],
): number[][] {
  const keys = [...new Set(items.map((i) => i.day))].sort();
  const index = new Map(keys.map((d, i) => [d, i]));
  const width = items[0] ? fields(items[0]).length : 0;
  const out = keys.map(() => new Array<number>(width).fill(0));
  for (const item of items) {
    const row = out[index.get(item.day) as number] as number[];
    fields(item).forEach((v, k) => (row[k] = (row[k] ?? 0) + v));
  }
  return out;
}

const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const ci = (r: { value: number; lo: number; hi: number }, d = 3) =>
  `${fmt(r.value, d)} [${fmt(r.lo, d)} ; ${fmt(r.hi, d)}]`;
const signed = (r: { value: number; lo: number; hi: number }, d = 3) => {
  const s = (x: number) => `${x >= 0 ? "+" : ""}${fmt(x, d)}`;
  return `${s(r.value)} [${s(r.lo)} ; ${s(r.hi)}]`;
};

// ── Grid cells ─────────────────────────────────────────────────────────────
function gridCells(fit: {
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
}): ScoreCell {
  const { distHome, distAway } = buildPoissonDistributions(
    fit.lambdaHome,
    fit.lambdaAway,
    MAX_GOALS,
  );
  return scoreCells({
    homeDist: distHome,
    awayDist: distAway,
    lambdaHome: fit.lambdaHome,
    lambdaAway: fit.lambdaAway,
    rho: fit.rho,
  });
}

/** Log-likelihood of the real score at every ρ of RHO_GRID (λ re-fitted). */
function llVector(
  quotes: NonNullable<ReturnType<typeof selectMarketGridQuotes>>,
  score: { home: number; away: number },
): Float64Array | null {
  if (score.home > MAX_GOALS || score.away > MAX_GOALS) return null;
  const ll = new Float64Array(RHO_GRID.length);
  for (const [k, rho] of RHO_GRID.entries()) {
    const fit = fitMarketGridLambdas(
      { oneXTwo: quotes.fairOneXTwo, lines: quotes.lines },
      rho,
    );
    const p = gridCells(fit)(score.home, score.away);
    ll[k] = Math.log(Math.max(p, 1e-300));
  }
  return ll;
}

const argmax = (v: Float64Array) => {
  let best = 0;
  for (let k = 1; k < v.length; k++) if ((v[k] ?? 0) > (v[best] ?? 0)) best = k;
  return RHO_GRID[best] as number;
};

/** The ρ map fitted on the training rows before `before`. */
function fitRhoMap(train: readonly TrainRow[], before: number): RhoMap {
  const total = new Float64Array(RHO_GRID.length);
  const byComp = new Map<string, { sum: Float64Array; n: number }>();
  for (const row of train) {
    if (row.at >= before) continue;
    let c = byComp.get(row.competition);
    if (!c) {
      c = { sum: new Float64Array(RHO_GRID.length), n: 0 };
      byComp.set(row.competition, c);
    }
    c.n += 1;
    for (let k = 0; k < RHO_GRID.length; k++) {
      total[k] = (total[k] ?? 0) + (row.ll[k] ?? 0);
      c.sum[k] = (c.sum[k] ?? 0) + (row.ll[k] ?? 0);
    }
  }
  const global = byComp.size === 0 ? 0 : argmax(total);
  const byCompetition = new Map<
    string,
    { rho: number; n: number; mle: number }
  >();
  for (const [code, c] of byComp) {
    if (c.n < MIN_FIXTURES) continue;
    const mle = argmax(c.sum);
    const rho = (c.n * mle + SHRINK_K * global) / (c.n + SHRINK_K);
    byCompetition.set(code, { rho: Number(rho.toFixed(3)), n: c.n, mle });
  }
  return { global, byCompetition };
}

const rhoOf = (map: RhoMap, code: string) =>
  map.byCompetition.get(code)?.rho ?? map.global;

// ── Closing truth (as ML-1) ────────────────────────────────────────────────
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
      const o = shinOneXTwo({
        home: row.homeOdds,
        draw: row.drawOdds,
        away: row.awayOdds,
      });
      if (o) {
        const { home, draw, away } = o;
        fair.set(`${Market.ONE_X_TWO}|HOME`, home.toNumber());
        fair.set(`${Market.ONE_X_TWO}|DRAW`, draw.toNumber());
        fair.set(`${Market.ONE_X_TWO}|AWAY`, away.toNumber());
        fair.set(`${Market.DOUBLE_CHANCE}|1X`, home.plus(draw).toNumber());
        fair.set(`${Market.DOUBLE_CHANCE}|X2`, draw.plus(away).toNumber());
        fair.set(`${Market.DOUBLE_CHANCE}|12`, home.plus(away).toNumber());
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
  return fair;
}

const PHASE_ONE = (channel: StrategyChannel) =>
  !FILTER_STRATEGY_CHANNELS.has(channel) &&
  !META_STRATEGY_CHANNELS.has(channel);

function gridContext(
  base: StrategyContext,
  grid: Extract<MarketGridResult, { status: "ok" }>,
): StrategyContext {
  return {
    ...base,
    probabilities: grid.probabilities,
    lambdaHome: grid.fit.lambdaHome,
    lambdaAway: grid.fit.lambdaAway,
    scoreDependenceRho: grid.fit.rho || undefined,
    signals: {
      ...base.signals,
      lambdaFloorHit: false,
      lambdaTotal: grid.fit.lambdaHome + grid.fit.lambdaAway,
    },
  };
}

function scoreProbabilities(
  fit: { lambdaHome: number; lambdaAway: number; rho: number },
  fixture: ReplayFixture,
): FixtureScore["p"][Engine] {
  const cell = gridCells(fit);
  let draw = 0;
  let under25 = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      if (h === a) draw += cell(h, a);
      if (h + a <= 2) under25 += cell(h, a);
    }
  }
  let homeNil = 0;
  let awayNil = 0;
  for (let k = 0; k <= MAX_GOALS; k++) {
    homeNil += cell(0, k);
    awayNil += cell(k, 0);
  }
  return {
    ll: Math.log(Math.max(cell(fixture.homeScore, fixture.awayScore), 1e-300)),
    draw,
    nil: cell(0, 0),
    oneNil: cell(1, 0) + cell(0, 1),
    oneOne: cell(1, 1),
    btts: 1 - homeNil - awayNil + cell(0, 0),
    under25,
  };
}

/** 2023–2025 training rows: Pinnacle HISTORICAL closing, one market state. */
async function historicalTraining(
  fixtures: readonly ReplayFixture[],
): Promise<TrainRow[]> {
  const out: TrainRow[] = [];
  for (let offset = 0; offset < fixtures.length; offset += 500) {
    const batch = fixtures.slice(offset, offset + 500);
    const rows = await prisma.$queryRaw<
      Array<RawOddsRow & { fixtureId: string }>
    >(Prisma.sql`
      SELECT "fixtureId"::text AS "fixtureId", bookmaker, market::text AS market,
             pick, odds, "homeOdds", "drawOdds", "awayOdds", "snapshotAt"
      FROM odds_snapshot
      WHERE "fixtureId" = ANY(${batch.map((f) => f.id)}::uuid[])
        AND bookmaker IN (${Prisma.join([...MARKET_GRID_BOOKMAKERS])})
        AND market::text IN (${Prisma.join([...MARKET_GRID_MARKETS])})
        AND "snapshotAt" >= ${TRAIN_FROM}
        AND "snapshotAt" < ${FROM}`);
    const byFixture = new Map<string, RawOddsRow[]>();
    for (const row of rows) {
      const bucket = byFixture.get(row.fixtureId) ?? [];
      bucket.push(row);
      byFixture.set(row.fixtureId, bucket);
    }
    for (const fixture of batch) {
      // Closing 1X2 and totals of one CSV row: stamped at kickoff so the
      // grid reads them as a single market state.
      const fixtureRows = (byFixture.get(fixture.id) ?? []).map((row) => ({
        ...row,
        snapshotAt: fixture.scheduledAt,
      }));
      const quotes = selectMarketGridQuotes(fixtureRows, fixture.scheduledAt);
      if (!quotes) continue;
      const indep = fitMarketGridLambdas({
        oneXTwo: quotes.fairOneXTwo,
        lines: quotes.lines,
      });
      if (!(indep.rmse <= 0.02)) continue;
      const ll = llVector(quotes, {
        home: fixture.homeScore,
        away: fixture.awayScore,
      });
      if (ll) {
        out.push({
          at: fixture.scheduledAt.getTime(),
          competition: fixture.competitionCode,
          ll,
        });
      }
    }
    console.log(
      `[entraînement ${Math.min(offset + 500, fixtures.length)}/${fixtures.length}] ${out.length} grilles`,
    );
  }
  return out;
}

async function main() {
  const generatedAt = new Date();
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-goal-dependence-${generatedAt.toISOString().slice(0, 10)}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  const { loader, close: closeArchive } = await loaderFromEnv();
  const orchestrator = createChannelStrategyOrchestrator();
  const startedAt = Date.now();

  const past = await loader.listFixtures({
    from: TRAIN_FROM,
    to: new Date(FROM.getTime() - 1),
  });
  const train = await historicalTraining(past);
  out(
    `Dépendance des buts (Dixon-Coles) sur la grille — ${generatedAt.toISOString()} — entraînement 2023–2025 : ${train.length} matchs à grille sur ${past.length} (${((Date.now() - startedAt) / 1000).toFixed(0)} s)`,
  );

  const fixtures = await loader.listFixtures({ from: FROM, to: TO });
  out(
    `Rejeu : ${fixtures.length} matchs terminés du ${FROM.toISOString().slice(0, 10)} au ${TO.toISOString().slice(0, 10)}`,
  );

  const legs: Leg[] = [];
  const scores: FixtureScore[] = [];
  const monthly: string[] = [];
  let map: RhoMap = fitRhoMap(train, FROM.getTime());
  let currentMonth = "";
  const BATCH = 50;
  for (let offset = 0; offset < fixtures.length; offset += BATCH) {
    const batch = fixtures.slice(offset, offset + BATCH);
    const asOfs = batch.map(
      (f) => new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
    );
    const [odds, gridRows, closing] = await Promise.all([
      loader.loadOddsBatch(
        batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
      ),
      loader.loadMarketGridRowsBatch(
        batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
      ),
      loader.loadClosingPricesBatch(
        batch.map((f) => f.id),
        { bookmaker: "Pinnacle", maxHoursBeforeKickoff: CLOSING_MAX_HOURS },
      ),
    ]);

    for (const [i, fixture] of batch.entries()) {
      const asOf = asOfs[i] as Date;
      const day = fixture.scheduledAt.toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      if (month !== currentMonth) {
        // Walk-forward: the month's map sees only the fixtures before it.
        currentMonth = month;
        map = fitRhoMap(train, Date.parse(`${month}-01T00:00:00.000Z`));
        monthly.push(
          `${month}  ρ global ${fmt(map.global, 2)}  championnats ajustés ${map.byCompetition.size}  matchs d'entraînement ${train.filter((r) => r.at < Date.parse(`${month}-01T00:00:00.000Z`)).length}`,
        );
      }
      const rows = gridRows[i] ?? [];
      const indep = computeMarketGrid(rows, asOf);
      if (indep.status !== "ok") continue;
      const ll = llVector(indep.quotes, {
        home: fixture.homeScore,
        away: fixture.awayScore,
      });
      if (ll) {
        train.push({
          at: fixture.scheduledAt.getTime(),
          competition: fixture.competitionCode,
          ll,
        });
      }
      const rho = rhoOf(map, fixture.competitionCode);
      const dep = computeMarketGrid(rows, asOf, { rho });
      if (dep.status !== "ok" || !ll) continue;

      const fair = closingFair(closing.get(fixture.id) ?? []);
      const h = fixture.homeScore;
      const a = fixture.awayScore;
      scores.push({
        day,
        rho,
        y: {
          cs: `${h}:${a}`,
          draw: h === a ? 1 : 0,
          nil: h === 0 && a === 0 ? 1 : 0,
          btts: h > 0 && a > 0 ? 1 : 0,
          under25: h + a <= 2 ? 1 : 0,
        },
        p: {
          indep: scoreProbabilities(indep.fit, fixture),
          rho: scoreProbabilities(dep.fit, fixture),
        },
        closeBtts: fair.get(`${Market.BTTS}|YES`) ?? null,
        // The 2.5 line is stored under the bare OVER key (totalPickLine).
        closeOver25: fair.get(`${Market.OVER_UNDER}|OVER`) ?? null,
        closeDraw: fair.get(`${Market.ONE_X_TWO}|DRAW`) ?? null,
      });

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
      const contexts: Array<[Engine, StrategyContext]> = [
        ["indep", gridContext(statsCtx, indep)],
        ["rho", gridContext(statsCtx, dep)],
      ];
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
            const status = settleReplayPick(fixture, sel);
            if (status !== "WON" && status !== "LOST") continue;
            legs.push({
              engine,
              day,
              channel: decision.channel,
              p: sel.probability.toNumber(),
              won: status === "WON" ? 1 : 0,
              pClose: fair.get(`${sel.market}|${sel.pick}`) ?? null,
            });
          }
        }
      }
    }
    console.log(
      `[${Math.min(offset + BATCH, fixtures.length)}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s, ${scores.length} matchs, ${legs.length} jambes`,
    );
  }

  // ── ρ maps ───────────────────────────────────────────────────────────────
  out();
  out("== CARTE ρ WALK-FORWARD (ajustée au début de chaque mois) ==");
  monthly.forEach((l) => out(l));
  const finalMap = fitRhoMap(train, Number.POSITIVE_INFINITY);
  out();
  out(
    `== CARTE ρ FINALE (tout l'historique, ${train.length} matchs) — à recopier dans MARKET_GRID_RHO si expédié ==`,
  );
  out(`global: ${finalMap.global},`);
  for (const [code, c] of [...finalMap.byCompetition].sort((x, y) =>
    x[0].localeCompare(y[0]),
  )) {
    out(`  ${code}: ${c.rho}, // n ${c.n}, ρ̂ ${c.mle}`);
  }

  // ── Low scores: announced vs realised ────────────────────────────────────
  out();
  out(`== PETITS SCORES, ${scores.length} matchs rejoués à deux grilles ==`);
  out(
    "issue      réalisé   annoncé indép.  ratio [IC]            annoncé ρ   ratio [IC]",
  );
  const issues: Array<
    [
      string,
      (s: FixtureScore) => number,
      (p: FixtureScore["p"][Engine]) => number,
    ]
  > = [
    ["nul", (s) => s.y.draw, (p) => p.draw],
    ["0-0", (s) => s.y.nil, (p) => p.nil],
    [
      "1-0 / 0-1",
      (s) => (s.y.cs === "1:0" || s.y.cs === "0:1" ? 1 : 0),
      (p) => p.oneNil,
    ],
    ["1-1", (s) => (s.y.cs === "1:1" ? 1 : 0), (p) => p.oneOne],
    ["BTTS oui", (s) => s.y.btts, (p) => p.btts],
    ["moins 2,5", (s) => s.y.under25, (p) => p.under25],
  ];
  for (const [name, y, p] of issues) {
    const cells = ENGINES.map((e) =>
      bootstrap(
        perDay(scores, (s) => [y(s), p(s.p[e])]),
        (v) => (v[0] ?? 0) / (v[1] ?? 1),
      ),
    );
    const real = scores.reduce((t, s) => t + y(s), 0) / scores.length;
    const ann = ENGINES.map(
      (e) => scores.reduce((t, s) => t + p(s.p[e]), 0) / scores.length,
    );
    out(
      `${name.padEnd(10)} ${fmt(real, 4)}   ${fmt(ann[0] as number, 4)}          ${ci(cells[0] as never).padEnd(22)} ${fmt(ann[1] as number, 4)}      ${ci(cells[1] as never)}`,
    );
  }

  // ── D1 and D2 ────────────────────────────────────────────────────────────
  out();
  out("== CRITÈRES D'EXPÉDITION ==");
  const d1 = bootstrap(
    perDay(scores, (s) => [-(s.p.rho.ll - s.p.indep.ll), 1]),
    (v) => (v[0] ?? 0) / (v[1] ?? 1),
  );
  out(
    `D1 log-perte du score exact, ρ − indépendant ${signed(d1, 5)} (${scores.length} matchs, IC sous 0) → ${d1.hi < 0 ? "OK" : "NON"}`,
  );
  const gap = (
    name: string,
    pick: (s: FixtureScore) => number | null,
    model: (p: FixtureScore["p"][Engine]) => number,
  ) => {
    const sub = scores.filter((s) => pick(s) !== null);
    const r = bootstrap(
      perDay(sub, (s) => {
        const c = pick(s) as number;
        return [(model(s.p.rho) - c) ** 2 - (model(s.p.indep) - c) ** 2, 1];
      }),
      (v) => (v[0] ?? 0) / (v[1] ?? 1),
    );
    const bias = (e: Engine) =>
      sub.reduce((t, s) => t + model(s.p[e]) - (pick(s) as number), 0) /
      Math.max(sub.length, 1);
    out(
      `   ${name.padEnd(28)} ${String(sub.length).padStart(5)} matchs  écart² ρ − indép. ${signed(r, 6)}  biais vs clôture indép. ${fmt(bias("indep"), 4)}, ρ ${fmt(bias("rho"), 4)}`,
    );
    return r;
  };
  const d2 = gap(
    "BTTS oui (D2)",
    (s) => s.closeBtts,
    (p) => p.btts,
  );
  gap(
    "nul interne de la grille",
    (s) => s.closeDraw,
    (p) => p.draw,
  );
  gap(
    "moins 2,5",
    (s) => (s.closeOver25 === null ? null : 1 - s.closeOver25),
    (p) => p.under25,
  );
  out(
    `D2 BTTS contre la clôture Pinnacle (IC sous 0) → ${d2.hi < 0 ? "OK" : "NON"}`,
  );

  // ── Channels ─────────────────────────────────────────────────────────────
  out();
  out("== CANAUX (mêmes matchs, grille indépendante contre grille à ρ) ==");
  out(
    "canal                 jambes i/ρ     ratio indép. [IC]        ratio ρ [IC]            résidu ρ − indép. vs clôture",
  );
  const channels = [...new Set(legs.map((l) => l.channel))].sort();
  let d4ok = true;
  const ratioOf = (sub: readonly Leg[]) =>
    bootstrap(
      perDay(sub, (l) => [l.won, l.p]),
      (v) => (v[0] ?? 0) / (v[1] ?? 1),
    );
  for (const ch of [...channels, "TOUS" as const]) {
    const sub = ch === "TOUS" ? legs : legs.filter((l) => l.channel === ch);
    const e0 = sub.filter((l) => l.engine === "indep");
    const e1 = sub.filter((l) => l.engine === "rho");
    if (e1.length === 0 || e0.length === 0) continue;
    const withClose = sub.filter((l) => l.pClose !== null);
    const dBrier = withClose.length
      ? signed(
          bootstrap(
            perDay(withClose, (l) => {
              const d =
                (l.p - l.won) ** 2 - ((l.pClose as number) - l.won) ** 2;
              return l.engine === "rho" ? [d, 1, 0, 0] : [0, 0, d, 1];
            }),
            (v) => (v[0] ?? 0) / (v[1] ?? 1) - (v[2] ?? 0) / (v[3] ?? 1),
          ),
          4,
        )
      : "—";
    let flag = "";
    if (ch !== "TOUS" && e1.length >= 100) {
      const d = bootstrap(
        perDay(sub, (l) =>
          l.engine === "rho" ? [l.won, l.p, 0, 0] : [0, 0, l.won, l.p],
        ),
        (v) =>
          Math.abs((v[0] ?? 0) / (v[1] ?? 1) - 1) -
          Math.abs((v[2] ?? 0) / (v[3] ?? 1) - 1),
      );
      if (d.lo > 0) {
        d4ok = false;
        flag = `  ← dégradé ${signed(d)}`;
      }
    }
    out(
      `${ch.padEnd(20)} ${`${e0.length}/${e1.length}`.padStart(12)}   ${ci(ratioOf(e0)).padEnd(24)} ${ci(ratioOf(e1)).padEnd(24)} ${dBrier}${flag}`,
    );
  }
  const d3 = ratioOf(legs.filter((l) => l.engine === "rho"));
  out();
  out(
    `D3 ratio grille à ρ ${ci(d3)} (borne basse ≥ 0,97) → ${d3.lo >= 0.97 ? "OK" : "NON"}`,
  );
  out(`D4 aucun canal dégradé → ${d4ok ? "OK" : "NON"}`);
  const ship = d1.hi < 0 && d2.hi < 0 && d3.lo >= 0.97 && d4ok;
  out(`VERDICT → ${ship ? "EXPÉDIÉ" : "NON EXPÉDIÉ"}`);

  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(
    `\nRapport : ${outputPath} (${((Date.now() - startedAt) / 1000).toFixed(0)} s)`,
  );
  closeArchive();
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
