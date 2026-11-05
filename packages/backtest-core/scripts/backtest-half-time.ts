/// <reference types="node" />
/**
 * Lot ML-2b : sous-modèle A, la mi-temps sur la grille de marché
 * (docs/audits/2026-11-05/ML2B-MI-TEMPS.md).
 *
 * ÉTAT ACTUEL. Sous la grille (ML-1, ρ de ML-2a), les canaux mi-temps
 * (FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME, WIN_EITHER_HALF) lisent
 * λ_MT = E[buts] × 0,44 par équipe (FIRST_HALF_GOAL_FRACTION, poisson.ts),
 * la seconde période λ × 0,56, deux périodes indépendantes.
 *
 * HYPOTHÈSE (posée avant les données). Quand le book de la grille cote la
 * mi-temps (FIRST_HALF_WINNER complet et au moins une ligne OVER_UNDER_HT
 * complète, même instant à 60 min), λ_MT dom./ext. ajustés sur ces prix
 * (Shin par groupe, moindres carrés 1X2 MT × 3 + lignes × 1, même
 * Levenberg-Marquardt que la grille, refus au-delà d'un écart de 0,02 ou si
 * λ_MT ≥ λ − 0,05) annoncent mieux la mi-temps que la constante. Sinon, une
 * fraction de mi-temps par championnat — Σ buts MT ÷ Σ buts sur les matchs
 * passés, (n·f̂ + K·0,44) / (n + K), K = SHRINK_K, 0,44 sous MIN_FIXTURES —
 * remplace 0,44. Walk-forward : la carte d'un mois ne voit que les matchs
 * des mois précédents. Pas de ρ de mi-temps.
 *
 * REJEU. Matchs terminés de 2026, décision à coup d'envoi − 1 h, lignes
 * captées et cotées avant l'instant (ML-1). Trois moteurs sur les mêmes
 * matchs, tous sur la grille à ρ du championnat (prod) :
 *   base : 0,44 (prod) ;   frac : fraction du championnat ;
 *   ht   : prix de mi-temps, sinon fraction du championnat (candidat).
 * Les 20 stratégies tournent, les 16 de Phase 1 sont mesurées, une jambe par
 * match × canal × marché. Juge : clôture Pinnacle ≤ 2 h (FIRST_HALF_WINNER,
 * OVER_UNDER_HT 0,5 et 1,5), Shin. La grille à T − 1 h lit la mi-temps
 * presque à la clôture : son résidu est en partie mécanique ; d'où la même
 * mesure à 17 h UTC la veille (heure des coupons). IC 95 % par bootstrap en
 * blocs de jours (1 000 tirages, graine fixe).
 *
 * RÈGLE D'EXPÉDITION (écrite avant le rejeu complet). « ht » est expédié si
 * les six tiennent :
 *   H1 calibration : jambes des 4 canaux mi-temps, borne basse de l'IC du
 *      ratio réalisé ÷ annoncé ≥ 0,97 ;
 *   H2 résidu à T − 1 h : sur les matchs à clôture mi-temps Pinnacle, IC de
 *      Σ_issues [(p_ht − c)² − (p_base − c)²] entièrement sous 0 ;
 *   H3 résidu la veille à 17 h : même mesure, grilles de la veille ;
 *   H4 aucun canal mi-temps à ≥ 100 jambes dont |ratio − 1| est plus grand
 *      qu'en base, IC de la différence hors de 0 ;
 *   H5 canaux plein-match intacts : jambes identiques au bit près ;
 *   H6 log-perte du résultat MT réel (1X2 MT + plus/moins 0,5 et 1,5) : IC
 *      de (ht − base) pas entièrement au-dessus de 0.
 * Si « ht » échoue, « frac » seul est expédié s'il tient les six.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:half-time
 *      [--from=2026-01-01] [--to=2026-11-04]
 * Output: packages/backtest-core/reports/backtest-half-time-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@evcore/db";
import {
  computeMarketGrid,
  createChannelStrategyOrchestrator,
  crossLeagueLambdaFactors,
  FIRST_HALF_GOAL_FRACTION,
  isEuropeanCompetition,
  LEAGUE_STRENGTH_MAP,
  Market,
  MARKET_GRID_FIRST_HALF_MARKETS,
  MARKET_GRID_MARKETS,
  marketGridRho,
  FILTER_STRATEGY_CHANNELS,
  META_STRATEGY_CHANNELS,
  shinOutcomeGroups,
  type MarketGridResult,
  type RawOddsRow,
  type StrategyChannel,
  type StrategyContext,
} from "@evcore/analysis-core";
import { bootstrapDaySums, settleReplayPick, type ReplayFixture } from "../src";
import { loaderFromEnv } from "./odds-archive";
import { replayContext } from "./production-chain";

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const TRAIN_FROM = new Date("2018-01-01T00:00:00.000Z");
const FROM = new Date(`${arg("from") ?? "2026-01-01"}T00:00:00.000Z`);
const TO = new Date(`${arg("to") ?? "2026-11-04"}T00:00:00.000Z`);
const DECISION_LEAD_MS = 60 * 60 * 1000;
const COUPON_HOUR_UTC = 17;
const CLOSING_MAX_HOURS = 2;
const BOOTSTRAP = 1000;
const MIN_FIXTURES = 200;
const SHRINK_K = 500;
const HALF_TIME_CHANNELS: ReadonlySet<string> = new Set([
  "FIRST_HALF",
  "OVER_UNDER_HT",
  "HALF_TIME_FULL_TIME",
  "WIN_EITHER_HALF",
]);
const GRID_MARKETS = [
  ...MARKET_GRID_MARKETS,
  ...MARKET_GRID_FIRST_HALF_MARKETS,
];
const CLOSE_KEYS = [
  `${Market.FIRST_HALF_WINNER}|HOME`,
  `${Market.FIRST_HALF_WINNER}|DRAW`,
  `${Market.FIRST_HALF_WINNER}|AWAY`,
  `${Market.OVER_UNDER_HT}|OVER_0_5`,
  `${Market.OVER_UNDER_HT}|OVER_1_5`,
] as const;

type Engine = "base" | "frac" | "ht";
const ENGINES: readonly Engine[] = ["base", "frac", "ht"];
type Ok = Extract<MarketGridResult, { status: "ok" }>;

type Leg = {
  engine: Engine;
  day: string;
  channel: StrategyChannel;
  p: number;
  won: number;
  pClose: number | null;
};

/** The five half-time probabilities judged against the closing line. */
type HalfProba = [number, number, number, number, number];

type FixtureScore = {
  day: string;
  y: HalfProba;
  p: Record<Engine, HalfProba>;
  veille: Record<Engine, HalfProba> | null;
  close: (number | null)[];
  source: "prices" | "fraction";
};

const bootstrap = (
  days: readonly number[][],
  stat: (sums: number[]) => number,
) => bootstrapDaySums(days, stat, { draws: BOOTSTRAP, seed: 20261105 });

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
const ratio = (v: number[]) => (v[0] ?? 0) / (v[1] ?? 1);

// ── League first-half fraction, walk-forward ───────────────────────────────
type FractionMap = Map<string, { f: number; n: number; raw: number }>;
type Acc = Map<string, { ht: number; ft: number; n: number }>;

function accumulate(acc: Acc, fixture: ReplayFixture): void {
  const { homeHtScore: hh, awayHtScore: ah, homeScore, awayScore } = fixture;
  if (hh === null || ah === null || hh > homeScore || ah > awayScore) return;
  const c = acc.get(fixture.competitionCode) ?? { ht: 0, ft: 0, n: 0 };
  c.ht += hh + ah;
  c.ft += homeScore + awayScore;
  c.n += 1;
  acc.set(fixture.competitionCode, c);
}

function fractionMap(acc: Acc): FractionMap {
  const map: FractionMap = new Map();
  for (const [code, c] of acc) {
    if (c.n < MIN_FIXTURES || c.ft === 0) continue;
    const raw = c.ht / c.ft;
    const f =
      (c.n * raw + SHRINK_K * FIRST_HALF_GOAL_FRACTION) / (c.n + SHRINK_K);
    map.set(code, { f: Number(f.toFixed(3)), n: c.n, raw });
  }
  return map;
}

const fractionOf = (map: FractionMap, code: string) =>
  map.get(code)?.f ?? FIRST_HALF_GOAL_FRACTION;

// ── Grids of the three engines ──────────────────────────────────────────────
const FULL_TIME_ONLY = (rows: readonly RawOddsRow[]) =>
  rows.filter((row) => MARKET_GRID_MARKETS.includes(row.market));

function grids(
  rows: readonly RawOddsRow[],
  options: { cutoff: Date; code: string; fraction: number },
): Record<Engine, Ok> | null {
  const rho = marketGridRho(options.code);
  const fullTime = FULL_TIME_ONLY(rows);
  const base = computeMarketGrid(fullTime, options.cutoff, { rho });
  if (base.status !== "ok") return null;
  const frac = computeMarketGrid(fullTime, options.cutoff, {
    rho,
    firstHalfFraction: options.fraction,
  });
  const ht = computeMarketGrid(rows, options.cutoff, {
    rho,
    firstHalfFraction: options.fraction,
  });
  if (frac.status !== "ok" || ht.status !== "ok") return null;
  return { base, frac, ht };
}

function halfProba(grid: Ok): HalfProba {
  const p = grid.probabilities;
  return [
    p.firstHalfWinner.home.toNumber(),
    p.firstHalfWinner.draw.toNumber(),
    p.firstHalfWinner.away.toNumber(),
    p.ouHT.OVER_0_5?.toNumber() ?? Number.NaN,
    p.ouHT.OVER_1_5?.toNumber() ?? Number.NaN,
  ];
}

function closingFair(rows: readonly RawOddsRow[]): (number | null)[] {
  const priced = rows
    .filter(
      (row) =>
        MARKET_GRID_FIRST_HALF_MARKETS.includes(row.market) &&
        row.pick &&
        row.odds !== null,
    )
    .map((row) => ({
      fixtureId: "f",
      market: row.market,
      pick: row.pick as string,
      odds: Number(row.odds),
    }));
  const fair = new Map(
    shinOutcomeGroups(priced).map((r) => [
      `${r.market}|${r.pick}`,
      r.fair.toNumber(),
    ]),
  );
  return CLOSE_KEYS.map((key) => fair.get(key) ?? null);
}

const PHASE_ONE = (channel: StrategyChannel) =>
  !FILTER_STRATEGY_CHANNELS.has(channel) &&
  !META_STRATEGY_CHANNELS.has(channel);

function gridContext(base: StrategyContext, grid: Ok): StrategyContext {
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

/** Squared gap to the closing line, summed over the priced outcomes. */
function closeGap(p: HalfProba, close: readonly (number | null)[]): number {
  return close.reduce<number>(
    (sum, c, k) => (c === null ? sum : sum + ((p[k] as number) - c) ** 2),
    0,
  );
}

/** Log-loss of the real half-time result, 1X2 + over 0.5 + over 1.5. */
function halfLogLoss(p: HalfProba, y: HalfProba): number {
  const ll = (q: number) => -Math.log(Math.max(q, 1e-12));
  const result = y[0] ? p[0] : y[1] ? p[1] : p[2];
  return ll(result) + ll(y[3] ? p[3] : 1 - p[3]) + ll(y[4] ? p[4] : 1 - p[4]);
}

async function main() {
  const generatedAt = new Date();
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-half-time-${generatedAt.toISOString().slice(0, 10)}.txt`,
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
  const acc: Acc = new Map();
  past.forEach((f) => accumulate(acc, f));
  const fixtures = await loader.listFixtures({ from: FROM, to: TO });
  out(
    `Mi-temps sur la grille — ${generatedAt.toISOString()} — entraînement de la fraction : ${past.length} matchs depuis ${TRAIN_FROM.toISOString().slice(0, 10)} ; rejeu : ${fixtures.length} matchs du ${FROM.toISOString().slice(0, 10)} au ${TO.toISOString().slice(0, 10)}`,
  );

  const legs: Leg[] = [];
  const scores: FixtureScore[] = [];
  const monthly: string[] = [];
  const coverage = {
    grid: 0,
    prices: 0,
    noQuotes: 0,
    fitError: 0,
    inconsistent: 0,
    none: 0,
  };
  let fullTimeDiff = 0;
  let fullTimeLegs = 0;
  let map = fractionMap(acc);
  let currentMonth = "";
  let pending: ReplayFixture[] = [];
  const BATCH = 50;
  for (let offset = 0; offset < fixtures.length; offset += BATCH) {
    const batch = fixtures.slice(offset, offset + BATCH);
    const asOfs = batch.map(
      (f) => new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
    );
    const veilles = batch.map((f) => {
      const v = new Date(f.scheduledAt);
      v.setUTCDate(v.getUTCDate() - 1);
      v.setUTCHours(COUPON_HOUR_UTC, 0, 0, 0);
      return v;
    });
    const [odds, gridRows, closing] = await Promise.all([
      loader.loadOddsBatch(
        batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
      ),
      loader.loadMarketGridRowsBatch(
        [
          ...batch.map((f, i) => ({ fixtureId: f.id, asOf: asOfs[i] as Date })),
          ...batch.map((f, i) => ({
            fixtureId: f.id,
            asOf: veilles[i] as Date,
          })),
        ],
        GRID_MARKETS,
      ),
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
      if (month !== currentMonth) {
        // Walk-forward: the month's fractions see only the months before.
        currentMonth = month;
        pending.forEach((f) => accumulate(acc, f));
        pending = [];
        map = fractionMap(acc);
        monthly.push(
          `${month}  championnats ajustés ${map.size}  médiane ${fmt([...map.values()].map((c) => c.f).sort((a, b) => a - b)[Math.floor(map.size / 2)] ?? Number.NaN)}`,
        );
      }
      pending.push(fixture);
      const fraction = fractionOf(map, fixture.competitionCode);
      const g = grids(gridRows[i] ?? [], {
        cutoff: asOf,
        code: fixture.competitionCode,
        fraction,
      });
      if (!g) continue;
      coverage.grid += 1;
      const half = g.ht.firstHalf;
      if (half.source === "prices") coverage.prices += 1;
      else if (half.reason === "no_quotes") coverage.noQuotes += 1;
      else if (half.reason === "fit_error") coverage.fitError += 1;
      else if (half.reason === "inconsistent") coverage.inconsistent += 1;
      else coverage.none += 1;

      const close = closingFair(closing.get(fixture.id) ?? []);
      const { homeHtScore: hh, awayHtScore: ah } = fixture;
      if (hh !== null && ah !== null) {
        const gv =
          veille < asOf
            ? grids(gridRows[batch.length + i] ?? [], {
                cutoff: veille,
                code: fixture.competitionCode,
                fraction,
              })
            : null;
        scores.push({
          day,
          y: [
            hh > ah ? 1 : 0,
            hh === ah ? 1 : 0,
            hh < ah ? 1 : 0,
            hh + ah > 0 ? 1 : 0,
            hh + ah > 1 ? 1 : 0,
          ],
          p: {
            base: halfProba(g.base),
            frac: halfProba(g.frac),
            ht: halfProba(g.ht),
          },
          veille: gv
            ? {
                base: halfProba(gv.base),
                frac: halfProba(gv.frac),
                ht: halfProba(gv.ht),
              }
            : null,
          close,
          source: half.source,
        });
      }

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
      const closeFair = new Map<string, number>();
      CLOSE_KEYS.forEach((key, k) => {
        const c = close[k];
        if (c !== null && c !== undefined) closeFair.set(key, c);
      });
      const fullTimeSig: Record<Engine, string[]> = {
        base: [],
        frac: [],
        ht: [],
      };
      for (const engine of ENGINES) {
        const seen = new Set<string>();
        for (const decision of orchestrator.evaluate(
          gridContext(statsCtx, g[engine]),
        )) {
          if (!PHASE_ONE(decision.channel) || decision.status !== "SELECTED") {
            continue;
          }
          for (const sel of decision.selections) {
            const key = `${decision.channel}|${sel.market}`;
            if (seen.has(key) || sel.odds === undefined) continue;
            seen.add(key);
            const p = sel.probability.toNumber();
            if (!HALF_TIME_CHANNELS.has(decision.channel)) {
              fullTimeSig[engine].push(`${key}|${sel.pick}|${p}`);
              if (engine !== "base") continue;
            }
            const status = settleReplayPick(fixture, sel);
            if (status !== "WON" && status !== "LOST") continue;
            legs.push({
              engine,
              day,
              channel: decision.channel,
              p,
              won: status === "WON" ? 1 : 0,
              pClose: closeFair.get(`${sel.market}|${sel.pick}`) ?? null,
            });
          }
        }
      }
      const sig = (e: Engine) => fullTimeSig[e].sort().join(";");
      fullTimeLegs += fullTimeSig.base.length;
      if (sig("frac") !== sig("base") || sig("ht") !== sig("base")) {
        fullTimeDiff += 1;
      }
    }
    console.log(
      `[${Math.min(offset + BATCH, fixtures.length)}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s, ${scores.length} matchs, ${legs.length} jambes`,
    );
  }
  pending.forEach((f) => accumulate(acc, f));

  // ── Fractions ────────────────────────────────────────────────────────────
  out();
  out("== FRACTION DE MI-TEMPS WALK-FORWARD (début de chaque mois) ==");
  monthly.forEach((l) => out(l));
  const finalMap = fractionMap(acc);
  out();
  out(
    `== FRACTION FINALE (tout l'historique) — à recopier si « frac » ou « ht » est expédié ==`,
  );
  for (const [code, c] of [...finalMap].sort((x, y) =>
    x[0].localeCompare(y[0]),
  )) {
    out(`  ${code}: ${c.f}, // n ${c.n}, f̂ ${fmt(c.raw)}`);
  }

  out();
  out("== COUVERTURE (grille à T − 1 h) ==");
  out(
    `grilles ${coverage.grid}  prix MT ajustés ${coverage.prices} (${fmt((100 * coverage.prices) / Math.max(coverage.grid, 1), 1)} %)  sans prix MT complets ${coverage.noQuotes + coverage.none}  écart > 0,02 ${coverage.fitError}  λ_MT ≥ λ ${coverage.inconsistent}`,
  );

  // ── Half-time issues, announced vs realised ─────────────────────────────
  const names = ["MT dom.", "MT nul", "MT ext.", "MT plus 0,5", "MT plus 1,5"];
  out();
  out(`== ISSUES MI-TEMPS, ${scores.length} matchs (réalisé ÷ annoncé) ==`);
  out(
    "issue          réalisé   base [IC]                frac [IC]                ht [IC]",
  );
  names.forEach((name, k) => {
    const real =
      scores.reduce((t, s) => t + (s.y[k] as number), 0) / scores.length;
    const cells = ENGINES.map((e) =>
      ci(
        bootstrap(
          perDay(scores, (s) => [s.y[k] as number, s.p[e][k] as number]),
          ratio,
        ),
      ).padEnd(24),
    );
    out(`${name.padEnd(14)} ${fmt(real, 4)}    ${cells.join(" ")}`);
  });
  const priced = scores.filter((s) => s.source === "prices");
  out(`  dont matchs à prix MT (${priced.length}) :`);
  names.forEach((name, k) => {
    const cells = ENGINES.map((e) =>
      ci(
        bootstrap(
          perDay(priced, (s) => [s.y[k] as number, s.p[e][k] as number]),
          ratio,
        ),
      ).padEnd(24),
    );
    out(`  ${name.padEnd(12)}          ${cells.join(" ")}`);
  });

  // ── Criteria ─────────────────────────────────────────────────────────────
  out();
  out("== CRITÈRES D'EXPÉDITION ==");
  const verdict = (engine: Exclude<Engine, "base">) => {
    const withClose = scores.filter((s) => s.close.some((c) => c !== null));
    const gapDiff = (
      pick: (s: FixtureScore) => Record<Engine, HalfProba> | null,
    ) => {
      const sub = withClose.filter((s) => pick(s) !== null);
      const r = bootstrap(
        perDay(sub, (s) => {
          const p = pick(s) as Record<Engine, HalfProba>;
          return [closeGap(p[engine], s.close) - closeGap(p.base, s.close), 1];
        }),
        ratio,
      );
      return { r, n: sub.length };
    };
    const h2 = gapDiff((s) => s.p);
    const h3 = gapDiff((s) => s.veille);
    const h6 = bootstrap(
      perDay(scores, (s) => [
        halfLogLoss(s.p[engine], s.y) - halfLogLoss(s.p.base, s.y),
        1,
      ]),
      ratio,
    );
    const htLegs = legs.filter(
      (l) => l.engine === engine && HALF_TIME_CHANNELS.has(l.channel),
    );
    const h1 = bootstrap(
      perDay(htLegs, (l) => [l.won, l.p]),
      ratio,
    );
    let h4 = true;
    for (const ch of HALF_TIME_CHANNELS) {
      const sub = legs.filter(
        (l) => l.channel === ch && (l.engine === engine || l.engine === "base"),
      );
      if (sub.filter((l) => l.engine === engine).length < 100) continue;
      const d = bootstrap(
        perDay(sub, (l) =>
          l.engine === engine ? [l.won, l.p, 0, 0] : [0, 0, l.won, l.p],
        ),
        (v) =>
          Math.abs((v[0] ?? 0) / (v[1] ?? 1) - 1) -
          Math.abs((v[2] ?? 0) / (v[3] ?? 1) - 1),
      );
      if (d.lo > 0) h4 = false;
    }
    const ok = {
      h1: h1.lo >= 0.97,
      h2: h2.r.hi < 0,
      h3: h3.r.hi < 0,
      h4,
      h5: fullTimeDiff === 0,
      h6: !(h6.lo > 0),
    };
    out(`-- ${engine} --`);
    out(
      `H1 ratio des jambes mi-temps ${ci(h1)} (${htLegs.length} jambes, borne basse ≥ 0,97) → ${ok.h1 ? "OK" : "NON"}`,
    );
    out(
      `H2 écart² à la clôture, T − 1 h, ${engine} − base ${signed(h2.r, 5)} (${h2.n} matchs, IC sous 0) → ${ok.h2 ? "OK" : "NON"}`,
    );
    out(
      `H3 écart² à la clôture, veille 17 h, ${engine} − base ${signed(h3.r, 5)} (${h3.n} matchs, IC sous 0) → ${ok.h3 ? "OK" : "NON"}`,
    );
    out(`H4 aucun canal mi-temps dégradé → ${ok.h4 ? "OK" : "NON"}`);
    out(
      `H5 canaux plein-match identiques : ${fullTimeDiff} matchs différents sur ${fullTimeLegs} jambes → ${ok.h5 ? "OK" : "NON"}`,
    );
    out(
      `H6 log-perte du résultat MT, ${engine} − base ${signed(h6, 5)} (pas entièrement au-dessus de 0) → ${ok.h6 ? "OK" : "NON"}`,
    );
    return Object.values(ok).every(Boolean);
  };
  const shipHt = verdict("ht");
  const shipFrac = verdict("frac");

  // ── Channels ─────────────────────────────────────────────────────────────
  out();
  out("== CANAUX MI-TEMPS (mêmes matchs) ==");
  out(
    "canal                  jambes b/f/h      base [IC]                frac [IC]                ht [IC]                  ΔBrier ht − base vs clôture",
  );
  const ratioOf = (sub: readonly Leg[]) =>
    ci(
      bootstrap(
        perDay(sub, (l) => [l.won, l.p]),
        ratio,
      ),
    ).padEnd(24);
  for (const ch of [...HALF_TIME_CHANNELS, "TOUS"]) {
    const sub = legs.filter((l) =>
      ch === "TOUS" ? HALF_TIME_CHANNELS.has(l.channel) : l.channel === ch,
    );
    const by = (e: Engine) => sub.filter((l) => l.engine === e);
    if (by("base").length === 0) continue;
    const withClose = sub.filter(
      (l) => l.pClose !== null && l.engine !== "frac",
    );
    const dBrier = withClose.length
      ? signed(
          bootstrap(
            perDay(withClose, (l) => {
              const d =
                (l.p - l.won) ** 2 - ((l.pClose as number) - l.won) ** 2;
              return l.engine === "ht" ? [d, 1, 0, 0] : [0, 0, d, 1];
            }),
            (v) => (v[0] ?? 0) / (v[1] ?? 1) - (v[2] ?? 0) / (v[3] ?? 1),
          ),
          4,
        )
      : "—";
    out(
      `${ch.padEnd(22)} ${`${by("base").length}/${by("frac").length}/${by("ht").length}`.padStart(16)}  ${ratioOf(by("base"))} ${ratioOf(by("frac"))} ${ratioOf(by("ht"))} ${dBrier}`,
    );
  }
  const fullTime = legs.filter((l) => !HALF_TIME_CHANNELS.has(l.channel));
  out(
    `plein-match (base)     ${String(fullTime.length).padStart(16)}  ${ratioOf(fullTime)}`,
  );

  out();
  out(
    `VERDICT → ${shipHt ? "« ht » EXPÉDIÉ" : shipFrac ? "« frac » EXPÉDIÉ (ht échoue)" : "NON EXPÉDIÉ"}`,
  );

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
