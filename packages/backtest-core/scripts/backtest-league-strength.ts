/// <reference types="node" />
/**
 * Force des championnats dans les matchs entre championnats (UCL/UEL/UECL).
 *
 * POURQUOI. En coupe d'Europe, le moteur mélange 60 % des xG du championnat
 * national de chaque équipe sans facteur de niveau : Rennes – Olympiakos
 * compare 2,33 encaissés en L1 à 0,70 encaissés en GRE1 comme s'ils étaient
 * mesurés dans le même championnat (docs/audits/2026-11-04/
 * ESTIMATION-LOIN-DU-MARCHE.md). Plan du 04/11, étape 2.
 *
 * HYPOTHÈSE, FIXÉE AVANT LE REJEU. Une log-force par championnat national r_L,
 * estimée sur les matchs inter-championnats déjà joués (fitLeagueStrengths,
 * @evcore/analysis-core : Poisson pénalisé, λ0 = λ du moteur en décalage,
 * σ a priori 0,2, au moins 10 matchs, 0 sinon), appliquée en
 * λ_dom × exp(r_D − r_E) et λ_ext × exp(r_E − r_D), rapproche le 1X2
 * européen du prix Pinnacle hors échantillon.
 *
 * CE QUI EST REJOUÉ. La chaîne de production (production-chain.ts) à coup
 * d'envoi − 1 h : team_stats point-in-time, deriveLambdas (avec ou sans les
 * facteurs), H2H, blend 1X2, shrinkage, signaux. Championnat national d'une
 * équipe = compétition de sa dernière ligne team_stats avant l'instant,
 * hors coupes d'Europe, sélections et amicaux (loadDomesticLeague).
 *
 * PROTOCOLE (walk-forward par saison). Pour chaque saison évaluée S
 * (2024-25, 2025-26, 2026-27), les forces sont ajustées sur les matchs
 * européens des saisons < S seulement, une fois, puis figées pour S. Mesure
 * sur les matchs de S qui ont une clôture Pinnacle 1X2 (0–72 h, la plus proche
 * du coup d'envoi, marge retirée proportionnellement).
 *
 * MESURES. Brier et log-loss 1X2 (moteur actuel, corrigé, Pinnacle) ;
 * résidu contre Pinnacle = Brier moteur − Brier Pinnacle ; écart moyen
 * |p moteur − p Pinnacle| ; part des matchs dont une issue 1X2 dépasse un
 * plafond d'EV (EV_HARD_CAP 0,90, plafonds souples européens du backend) à la
 * meilleure cote disponible à l'instant ; issues retenues (EV ∈ [0,08 ;
 * plafond]) : réalisé ÷ annoncé et réalisé − Pinnacle. IC 95 % par bootstrap
 * en blocs de jours (2 000 tirages, graine fixe).
 *
 * RÈGLE D'EXPÉDITION, FIGÉE. Expédié seulement si (1) le Brier corrigé est
 * meilleur que l'actuel sur au moins 2 des 3 saisons, (2) l'IC 95 % du gain
 * agrégé est entièrement sous 0, (3) aucun type de match (agrégé sur les
 * saisons) n'a un IC 95 % de ΔBrier entièrement au-dessus de 0.
 *
 * Carte de production : en fin de rapport, la même estimation sur tous les
 * matchs rejoués, à recopier dans LEAGUE_STRENGTH_MAP à chaque début de saison.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:league-strength
 *      [--probe=<fixtureId> --as-of=<ISO>]  (reproduit le λ d'un match)
 * Output: packages/backtest-core/reports/backtest-league-strength-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { prisma } from "@evcore/db";
import {
  calculateEV,
  crossLeagueLambdaFactors,
  EV_HARD_CAP,
  fitLeagueStrengths,
  LEAGUE_STRENGTH_MIN_MATCHES,
  LEAGUE_STRENGTH_PRIOR_SD,
  removeOverround,
  type FullOddsSnapshot,
  type LeagueStrengthObservation,
  type LeagueStrengths,
  type StrategyContext,
} from "@evcore/analysis-core";
import type { PointInTimeLoader, ReplayFixture } from "../src";
import { loaderFromEnv } from "./odds-archive";
import { replayContext } from "./production-chain";

const FROM_DATE = new Date("2023-06-01T00:00:00.000Z");
const EUROPEAN = ["UCL", "UEL", "UECL"] as const;
const EVAL_SEASONS = ["2024-25", "2025-26", "2026-27"] as const;
const DECISION_LEAD_MS = 60 * 60 * 1000;
const PINNACLE_MAX_HOURS = 72;
const EV_THRESHOLD = new Decimal("0.08");
// apps/backend ev.constants.ts PICK_EV_SOFT_CAP_MAP, European 1X2 entries.
const SOFT_CAPS: Record<string, Decimal> = {
  "UEL|HOME": new Decimal("0.35"),
  "UEL|AWAY": new Decimal("0.35"),
  "UECL|AWAY": new Decimal("0.35"),
};
const BIG5 = new Set(["PL", "LL", "SA", "BL1", "L1"]);
const BOOTSTRAP_DRAWS = 2000;
const MIN_SEASONS_IMPROVED = 2;
const Z95 = 1.96;
const CONCURRENCY = 8;

type Outcome = "HOME" | "DRAW" | "AWAY";
const OUTCOMES: readonly Outcome[] = ["HOME", "DRAW", "AWAY"];
type Triple = Record<Outcome, number>;

type Item = {
  fixture: ReplayFixture;
  season: string;
  homeLeague: string | null;
  awayLeague: string | null;
  odds: FullOddsSnapshot | null;
  base: StrategyContext;
  corrected: StrategyContext | null;
  pinnacle: Triple | null;
};

function tripleOf(context: StrategyContext): Triple {
  const p = context.probabilities;
  return {
    HOME: p.home.toNumber(),
    DRAW: p.draw.toNumber(),
    AWAY: p.away.toNumber(),
  };
}

function resultOf(fixture: ReplayFixture): Outcome {
  if (fixture.homeScore > fixture.awayScore) return "HOME";
  if (fixture.homeScore < fixture.awayScore) return "AWAY";
  return "DRAW";
}

function brier(p: Triple, y: Outcome): number {
  return OUTCOMES.reduce((sum, k) => sum + (p[k] - (k === y ? 1 : 0)) ** 2, 0);
}

function logLoss(p: Triple, y: Outcome): number {
  return -Math.log(Math.max(1e-12, p[y]));
}

function matchType(item: Item): string {
  if (item.homeLeague === null || item.awayLeague === null) return "inconnu";
  const h = BIG5.has(item.homeLeague) ? "Big-5" : "autre";
  const a = BIG5.has(item.awayLeague) ? "Big-5" : "autre";
  return `${h} / ${a}`;
}

function oddsOf(odds: FullOddsSnapshot, k: Outcome): Decimal {
  return k === "HOME"
    ? odds.homeOdds
    : k === "DRAW"
      ? odds.drawOdds
      : odds.awayOdds;
}

function capOf(competition: string, k: Outcome): Decimal {
  return SOFT_CAPS[`${competition}|${k}`] ?? EV_HARD_CAP;
}

// ─── Bootstrap by day ──────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mean of `values` and its 95 % interval, resampling whole days. */
function meanCi(rows: ReadonlyArray<{ day: string; value: number }>): {
  mean: number;
  lo: number;
  hi: number;
} {
  if (rows.length === 0) return { mean: NaN, lo: NaN, hi: NaN };
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const bucket = byDay.get(r.day);
    if (bucket) bucket.push(r.value);
    else byDay.set(r.day, [r.value]);
  }
  const days = [...byDay.values()];
  const mean = rows.reduce((s, r) => s + r.value, 0) / rows.length;
  const random = mulberry32(20261104);
  const draws: number[] = [];
  for (let b = 0; b < BOOTSTRAP_DRAWS; b++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < days.length; i++) {
      const day = days[Math.floor(random() * days.length)]!;
      for (const v of day) sum += v;
      n += day.length;
    }
    draws.push(sum / n);
  }
  draws.sort((x, y) => x - y);
  return {
    mean,
    lo: draws[Math.floor(0.025 * BOOTSTRAP_DRAWS)]!,
    hi: draws[Math.floor(0.975 * BOOTSTRAP_DRAWS)]!,
  };
}

// ─── Data ──────────────────────────────────────────────────────────────────

async function loadSeasonNames(
  seasonIds: readonly string[],
): Promise<Map<string, string>> {
  const rows = await prisma.season.findMany({
    where: { id: { in: [...new Set(seasonIds)] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Pinnacle 1X2 closest to kickoff within 72 h, margin removed. */
async function loadPinnacle(
  fixtureIds: readonly string[],
): Promise<Map<string, Triple>> {
  const rows = await prisma.$queryRaw<
    {
      fixtureId: string;
      homeOdds: string;
      drawOdds: string;
      awayOdds: string;
    }[]
  >`
    SELECT DISTINCT ON ("fixtureId") "fixtureId"::text AS "fixtureId",
           "homeOdds"::text AS "homeOdds", "drawOdds"::text AS "drawOdds",
           "awayOdds"::text AS "awayOdds"
    FROM odds_closing_line
    WHERE bookmaker = 'Pinnacle' AND market = 'ONE_X_TWO'
      AND "hoursBeforeKickoff" BETWEEN 0 AND ${PINNACLE_MAX_HOURS}
      AND "homeOdds" > 1 AND "drawOdds" > 1 AND "awayOdds" > 1
      AND "fixtureId" = ANY(${[...fixtureIds]}::uuid[])
    ORDER BY "fixtureId", "hoursBeforeKickoff" ASC`;
  const result = new Map<string, Triple>();
  for (const row of rows) {
    const [home, draw, away] = removeOverround([
      row.homeOdds,
      row.drawOdds,
      row.awayOdds,
    ]);
    result.set(row.fixtureId, {
      HOME: home!.toNumber(),
      DRAW: draw!.toNumber(),
      AWAY: away!.toNumber(),
    });
  }
  return result;
}

async function mapLimit<T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await run(items[index]!);
      }
    }),
  );
  return out;
}

async function replayBase(
  loader: PointInTimeLoader,
  out: (line?: string) => void,
): Promise<Item[]> {
  const fixtures = await loader.listFixtures({
    from: FROM_DATE,
    to: new Date(),
    competitionCodes: EUROPEAN,
  });
  const seasons = await loadSeasonNames(fixtures.map((f) => f.seasonId));
  const pinnacle = await loadPinnacle(fixtures.map((f) => f.id));
  const oddsByFixture = await loader.loadOddsBatch(
    fixtures.map((f) => ({
      fixtureId: f.id,
      asOf: new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
    })),
    // The 2023–2025 PREMATCH rows were imported after kickoff: bound by
    // bookmaker time only (point-in-time-loader.ts, captureGuard).
    { captureGuard: "snapshotAt" },
  );
  out(
    `${fixtures.length} matchs européens terminés depuis ${FROM_DATE.toISOString().slice(0, 10)}.`,
  );
  const replayed = await mapLimit(fixtures, async (fixture) => {
    const asOf = new Date(fixture.scheduledAt.getTime() - DECISION_LEAD_MS);
    const odds = oddsByFixture.get(fixture.id) ?? null;
    const [base, homeLeague, awayLeague] = await Promise.all([
      replayContext({ loader, fixture, odds, asOf }),
      loader.loadDomesticLeague({ teamId: fixture.homeTeamId, asOf }),
      loader.loadDomesticLeague({ teamId: fixture.awayTeamId, asOf }),
    ]);
    if (base === null) return null;
    const item: Item = {
      fixture,
      season: seasons.get(fixture.seasonId) ?? "?",
      homeLeague,
      awayLeague,
      odds,
      base,
      corrected: null,
      pinnacle: pinnacle.get(fixture.id) ?? null,
    };
    return item;
  });
  const items = replayed.filter((i): i is Item => i !== null);
  out(
    `${items.length} rejoués (team_stats des deux équipes à l'instant), ` +
      `${fixtures.length - items.length} écartés faute de team_stats.`,
  );
  return items;
}

function observationOf(item: Item): LeagueStrengthObservation {
  return {
    homeLeague: item.homeLeague,
    awayLeague: item.awayLeague,
    lambdaHome: item.base.lambdaHome ?? NaN,
    lambdaAway: item.base.lambdaAway ?? NaN,
    homeGoals: item.fixture.homeScore,
    awayGoals: item.fixture.awayScore,
  };
}

function fit(training: readonly Item[]): LeagueStrengths {
  return fitLeagueStrengths(training.map(observationOf), {
    priorSd: LEAGUE_STRENGTH_PRIOR_SD,
    minMatches: LEAGUE_STRENGTH_MIN_MATCHES,
  });
}

async function replayCorrected(input: {
  loader: PointInTimeLoader;
  items: Item[];
  strengths: LeagueStrengths;
}): Promise<void> {
  const { loader, items, strengths } = input;
  await mapLimit(items, async (item) => {
    const factors = crossLeagueLambdaFactors({
      homeLeague: item.homeLeague,
      awayLeague: item.awayLeague,
      strengths,
    });
    if (factors.home === 1 && factors.away === 1) {
      item.corrected = item.base;
      return;
    }
    const asOf = new Date(
      item.fixture.scheduledAt.getTime() - DECISION_LEAD_MS,
    );
    item.corrected = await replayContext({
      loader,
      fixture: item.fixture,
      odds: item.odds,
      asOf,
      crossLeagueFactors: factors,
    });
  });
}

// ─── Report ────────────────────────────────────────────────────────────────

type Retained = { n: number; announced: number; won: number; pin: number };

function retained(items: readonly Item[], pick: (i: Item) => Triple): Retained {
  const r: Retained = { n: 0, announced: 0, won: 0, pin: 0 };
  for (const item of items) {
    if (item.odds === null || item.pinnacle === null) continue;
    const p = pick(item);
    const y = resultOf(item.fixture);
    for (const k of OUTCOMES) {
      const ev = calculateEV(p[k], oddsOf(item.odds, k));
      if (ev.lt(EV_THRESHOLD) || ev.gt(capOf(item.fixture.competitionCode, k)))
        continue;
      r.n += 1;
      r.announced += p[k];
      r.won += k === y ? 1 : 0;
      r.pin += item.pinnacle[k];
    }
  }
  return r;
}

function cappedShare(
  items: readonly Item[],
  pick: (i: Item) => Triple,
): number {
  const priced = items.filter((i) => i.odds !== null);
  if (priced.length === 0) return NaN;
  const capped = priced.filter((item) => {
    const p = pick(item);
    return OUTCOMES.some((k) =>
      calculateEV(p[k], oddsOf(item.odds!, k)).gt(
        capOf(item.fixture.competitionCode, k),
      ),
    );
  });
  return capped.length / priced.length;
}

const fmt = (v: number, d = 4): string =>
  Number.isFinite(v) ? (v >= 0 ? " " : "") + v.toFixed(d) : "   n/a";
const ci = (c: { mean: number; lo: number; hi: number }, d = 4): string =>
  `${fmt(c.mean, d)} [${fmt(c.lo, d)} ; ${fmt(c.hi, d)}]`;

function describe(
  items: readonly Item[],
  label: string,
): {
  lines: string[];
  delta: { mean: number; lo: number; hi: number };
} {
  const rows = items.filter(
    (i): i is Item & { corrected: StrategyContext; pinnacle: Triple } =>
      i.corrected !== null && i.pinnacle !== null,
  );
  const day = (i: Item): string =>
    i.fixture.scheduledAt.toISOString().slice(0, 10);
  const per = rows.map((i) => {
    const y = resultOf(i.fixture);
    const b = tripleOf(i.base);
    const c = tripleOf(i.corrected);
    const gap = (p: Triple) =>
      OUTCOMES.reduce((s, k) => s + Math.abs(p[k] - i.pinnacle[k]), 0) / 3;
    return {
      day: day(i),
      bBase: brier(b, y),
      bCorr: brier(c, y),
      bPin: brier(i.pinnacle, y),
      lBase: logLoss(b, y),
      lCorr: logLoss(c, y),
      lPin: logLoss(i.pinnacle, y),
      gBase: gap(b),
      gCorr: gap(c),
    };
  });
  const avg = (f: (r: (typeof per)[number]) => number) =>
    per.length === 0 ? NaN : per.reduce((s, r) => s + f(r), 0) / per.length;
  const delta = meanCi(
    per.map((r) => ({ day: r.day, value: r.bCorr - r.bBase })),
  );
  const deltaLog = meanCi(
    per.map((r) => ({ day: r.day, value: r.lCorr - r.lBase })),
  );
  const resBase = meanCi(
    per.map((r) => ({ day: r.day, value: r.bBase - r.bPin })),
  );
  const resCorr = meanCi(
    per.map((r) => ({ day: r.day, value: r.bCorr - r.bPin })),
  );
  const rBase = retained(rows, (i) => tripleOf(i.base));
  const rCorr = retained(rows, (i) => tripleOf(i.corrected!));
  const retainedLine = (r: Retained) =>
    r.n === 0
      ? "n 0"
      : `n ${r.n} annoncé ${(r.announced / r.n).toFixed(3)} réalisé ${(r.won / r.n).toFixed(3)} ` +
        `Pinnacle ${(r.pin / r.n).toFixed(3)} réalisé÷annoncé ${(r.won / r.announced).toFixed(3)} ` +
        `réalisé−Pinnacle ${fmt((r.won - r.pin) / r.n, 3)} ± ${(Z95 * Math.sqrt(((r.won / r.n) * (1 - r.won / r.n)) / r.n)).toFixed(3)}`;
  const lines = [
    `── ${label} — ${per.length} matchs avec clôture Pinnacle`,
    `  Brier 1X2      actuel ${fmt(avg((r) => r.bBase))}  corrigé ${fmt(avg((r) => r.bCorr))}  Pinnacle ${fmt(avg((r) => r.bPin))}`,
    `  log-loss 1X2   actuel ${fmt(avg((r) => r.lBase))}  corrigé ${fmt(avg((r) => r.lCorr))}  Pinnacle ${fmt(avg((r) => r.lPin))}`,
    `  résidu (Brier moteur − Pinnacle)  actuel ${ci(resBase)}  corrigé ${ci(resCorr)}`,
    `  ΔBrier corrigé − actuel ${ci(delta)}   Δlog-loss ${ci(deltaLog)}`,
    `  écart moyen |p − Pinnacle|  actuel ${avg((r) => r.gBase).toFixed(4)}  corrigé ${avg((r) => r.gCorr).toFixed(4)}`,
    `  part plafonnée ev_above_*  actuel ${(100 * cappedShare(rows, (i) => tripleOf(i.base))).toFixed(1)} %  corrigé ${(100 * cappedShare(rows, (i) => tripleOf(i.corrected!))).toFixed(1)} %`,
    `  retenus actuel   ${retainedLine(rBase)}`,
    `  retenus corrigé  ${retainedLine(rCorr)}`,
  ];
  return { lines, delta };
}

async function probe(input: {
  loader: PointInTimeLoader;
  fixtureId: string;
  asOf: Date;
  all: readonly Item[] | null;
  out: (line?: string) => void;
}): Promise<void> {
  const { loader, fixtureId, asOf, out } = input;
  const row = await prisma.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    select: {
      id: true,
      seasonId: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      season: { select: { competition: { select: { code: true } } } },
    },
  });
  const fixture: ReplayFixture = {
    ...row,
    competitionCode: row.season.competition.code,
    homeScore: 0,
    awayScore: 0,
    homeHtScore: null,
    awayHtScore: null,
  };
  const [context, homeLeague, awayLeague] = await Promise.all([
    replayContext({ loader, fixture, odds: null, asOf }),
    loader.loadDomesticLeague({ teamId: fixture.homeTeamId, asOf }),
    loader.loadDomesticLeague({ teamId: fixture.awayTeamId, asOf }),
  ]);
  out(
    `Sonde ${fixtureId} à ${asOf.toISOString()} (${fixture.competitionCode}) :`,
  );
  out(
    `  λ rejoué ${context?.lambdaHome?.toFixed(3)} / ${context?.lambdaAway?.toFixed(3)}, ` +
      `championnats ${homeLeague} / ${awayLeague}`,
  );
  if (input.all !== null && context !== null) {
    const strengths = fit(
      input.all.filter((i) => i.fixture.scheduledAt < asOf),
    );
    const factors = crossLeagueLambdaFactors({
      homeLeague,
      awayLeague,
      strengths,
    });
    const corrected = await replayContext({
      loader,
      fixture,
      odds: null,
      asOf,
      crossLeagueFactors: factors,
    });
    out(
      `  forces ${homeLeague} ${fmt(strengths[homeLeague ?? ""] ?? 0, 3)}, ${awayLeague} ${fmt(strengths[awayLeague ?? ""] ?? 0, 3)} ` +
        `→ facteurs ${factors.home.toFixed(3)} / ${factors.away.toFixed(3)}, ` +
        `λ ${corrected?.lambdaHome?.toFixed(3)} / ${corrected?.lambdaAway?.toFixed(3)}, ` +
        `1X2 ${tripleOf(context).HOME.toFixed(3)}/${tripleOf(context).DRAW.toFixed(3)}/${tripleOf(context).AWAY.toFixed(3)} → ` +
        `${corrected ? `${tripleOf(corrected).HOME.toFixed(3)}/${tripleOf(corrected).DRAW.toFixed(3)}/${tripleOf(corrected).AWAY.toFixed(3)}` : "n/a"}`,
    );
  }
}

async function main(): Promise<void> {
  const lines: string[] = [];
  const out = (line = ""): void => {
    console.log(line);
    lines.push(line);
  };
  const arg = (name: string): string | undefined =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const { loader, close } = await loaderFromEnv();
  const probeId = arg("probe");
  const probeAsOf = arg("as-of");

  out(
    `Force des championnats — rejeu point-in-time, ${new Date().toISOString().slice(0, 10)}`,
  );
  out(
    `σ a priori ${LEAGUE_STRENGTH_PRIOR_SD}, minimum ${LEAGUE_STRENGTH_MIN_MATCHES} matchs, décision à coup d'envoi − 1 h.`,
  );
  out();
  const items = await replayBase(loader, out);

  if (probeId && probeAsOf) {
    await probe({
      loader,
      fixtureId: probeId,
      asOf: new Date(probeAsOf),
      all: items,
      out,
    });
    out();
  }

  const results: { season: string; delta: number }[] = [];
  const evaluated: Item[] = [];
  for (const season of EVAL_SEASONS) {
    const training = items.filter((i) => i.season < season);
    const target = items.filter((i) => i.season === season);
    const strengths = fit(training);
    await replayCorrected({ loader, items: target, strengths });
    evaluated.push(...target);
    const top = Object.entries(strengths).sort((a, b) => b[1] - a[1]);
    out(
      `═══ Saison ${season} : forces ajustées sur ${training.length} matchs antérieurs (${top.length} championnats)`,
    );
    out(
      `  ${top.map(([l, r]) => `${l} ${r >= 0 ? "+" : ""}${r.toFixed(2)}`).join("  ")}`,
    );
    const { lines: block, delta } = describe(target, `${season} — tous`);
    block.forEach((l) => out(l));
    results.push({ season, delta: delta.mean });
    for (const type of [
      "Big-5 / autre",
      "autre / Big-5",
      "autre / autre",
      "Big-5 / Big-5",
      "inconnu",
    ]) {
      describe(
        target.filter((i) => matchType(i) === type),
        `${season} — ${type}`,
      ).lines.forEach((l) => out(l));
    }
    out();
  }

  out(`═══ Hors échantillon, saisons agrégées`);
  const pooled = describe(evaluated, "toutes saisons");
  pooled.lines.forEach((l) => out(l));
  const degraded: string[] = [];
  for (const type of [
    "Big-5 / autre",
    "autre / Big-5",
    "autre / autre",
    "Big-5 / Big-5",
    "inconnu",
  ]) {
    const d = describe(
      evaluated.filter((i) => matchType(i) === type),
      type,
    );
    d.lines.forEach((l) => out(l));
    if (d.delta.lo > 0) degraded.push(type);
  }
  out();
  const improved = results.filter((r) => r.delta < 0).length;
  const ship =
    improved >= MIN_SEASONS_IMPROVED &&
    pooled.delta.hi < 0 &&
    degraded.length === 0;
  out(
    `Règle figée : saisons améliorées ${improved}/${results.length} (≥ ${MIN_SEASONS_IMPROVED}), ` +
      `IC agrégé sous 0 : ${pooled.delta.hi < 0 ? "oui" : "non"}, types dégradés : ${degraded.join(", ") || "aucun"}.`,
  );
  out(`Verdict : ${ship ? "EXPÉDIER" : "NE PAS EXPÉDIER"}.`);

  // The production map (LEAGUE_STRENGTH_MAP, @evcore/analysis-core
  // league-strength-map.ts): the same fit on every European fixture replayed,
  // to paste as is. Refit at each European season start.
  const production = fit(items);
  out();
  out(
    `Carte de production — ${items.length} matchs jusqu'au ${items.at(-1)?.fixture.scheduledAt.toISOString().slice(0, 10)} :`,
  );
  for (const [league, r] of Object.entries(production).sort(
    (a, b) => b[1] - a[1],
  )) {
    out(`  ${league}: ${r.toFixed(3)},`);
  }

  close();
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const path = join(
    reportsDir,
    `backtest-league-strength-${new Date().toISOString().slice(0, 10)}.txt`,
  );
  writeFileSync(path, lines.join("\n") + "\n");
  console.log(`\nRapport : ${path}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
