/// <reference types="node" />
/**
 * Lot ML-3 : sous-modèle B, corners et cartons
 * (docs/audits/2026-11-05/ML3-CORNERS-CARTONS.md).
 *
 * ÉTAT ACTUEL. Le Chasseur Corners classe les côtés 1xBet (1,70–2,10) par
 * marge 1xBet puis par « fréquence du marché » : Pinnacle sans marge
 * (proportionnelle) sur la même ligne quand Pinnacle la cote, sinon la paire
 * 1xBet elle-même (priceCornersSides). La feuille de match lit la paire du
 * premier book (1xBet d'abord), Shin. Aucun modèle de comptage.
 *
 * CE QUI EST MESURABLE (vérifié avant le rejeu). Pinnacle CORNERS et CARDS
 * en PREMATCH du 16/09 au 03/11 ; clôture ≤ 2 h sur 2 196 matchs corners
 * et 683 matchs cartons réglables. 1xBet corners du 27/10 au 03/11 seulement
 * (511 matchs, échelle 5,5–14,5 contre 7,5–11,5 chez Pinnacle) ; 1xBet
 * cartons : 8 matchs. Les critères qui comparent au prix 1xBet reposent donc
 * sur 8 jours ; les cartons ne peuvent pas être jugés contre 1xBet : ils
 * sont mesurés (H1, H2a) et restent neutres quoi qu'il arrive.
 *
 * HYPOTHÈSE (posée avant les données). Le total de corners (cartons) d'un
 * match suit une binomiale négative de moyenne μ et de taille r (Poisson si
 * r = ∞). μ est ajusté sur l'échelle Pinnacle à l'instant (Shin par paire,
 * moindres carrés sur P(plus | pas de remboursement), refus au-delà d'un
 * écart quadratique moyen de 0,02, lignes à plus de 60 min de la dernière
 * paire écartées) : fitCountMean / selectCountLadder. r est UN paramètre par
 * marché, lu sur la FORME des prix (jamais sur les résultats) : la valeur de
 * la grille {∞, 100, 50, 30, 20, 15, 10, 7, 5, 3} qui minimise l'écart total
 * des ajustements sur les matchs à ≥ 3 lignes Pinnacle à T − 1 h jusqu'au
 * 15/10 inclus. La dispersion réalisée E[(Y−μ)²] ÷ E[μ + μ²/r] est
 * rapportée en contrôle. Le modèle donne toute ligne, y compris celles que
 * 1xBet cote et Pinnacle non.
 * Repli sans Pinnacle (S) : μ_S = (attD·défE + attE·défD) ÷ (L/2), att/déf =
 * moyennes pour/contre des 20 derniers matchs de l'équipe rétrécies vers L/2
 * avec K = 6, L = total moyen du championnat sur 365 j (global sous 50
 * matchs) ; r_S par moments sur les matchs 2024-01-01 → 2026-09-15.
 *
 * REJEU. Matchs terminés du 16/09 au 04/11 à stats, deux instants :
 * 17 h UTC la veille (composition du chasseur) et T − 1 h (feuille). Lignes
 * cotées et observées avant l'instant. Juge : clôture Pinnacle ≤ 2 h, Shin,
 * lignes en ,5. Base B (chasseur) : Pinnacle proportionnel sur la ligne s'il
 * la cote, sinon 1xBet proportionnel ; base B2 (feuille) : 1xBet Shin s'il
 * cote la ligne, sinon Pinnacle Shin. Cartons réglés comme le règlement :
 * seulement si jaunes + rouges et jaunes + 2 × rouges donnent la même issue.
 * IC 95 % par bootstrap en blocs de jours (1 000 tirages, graine fixe).
 *
 * RÈGLE D'EXPÉDITION (écrite avant le rejeu complet).
 *   H1 calibration de M : ratio réalisé ÷ annoncé, côté PLUS et côté MOINS
 *      séparés, toutes lignes en ,5 cotées par Pinnacle ou 1xBet : borne
 *      basse ≥ 0,97 des deux côtés ; aucune ligne à ≥ 200 matchs dont un
 *      côté a une borne basse < 0,90 ;
 *   H2a lignes que Pinnacle cote à l'instant : IC de (p_M − c)² − (p_B − c)²
 *      pas entièrement au-dessus de 0 ;
 *   H2b lignes 1xBet que Pinnacle ne cote pas à l'instant mais à la
 *      clôture : même IC entièrement sous 0, sur ≥ 100 matchs (sinon échec) ;
 *   H3 mêmes lignes 1xBet hors Pinnacle, issue réelle : IC de la log-perte
 *      (M − B) pas entièrement au-dessus de 0 ;
 *   H4 chasseur : côtés 1xBet dans la bande 1,70–2,10, chance de M (B sans
 *      ajustement) : IC du ratio réalisé ÷ annoncé contient 1.
 *   Chasseur Corners expédié si H1–H4 tiennent à 17 h la veille contre B ;
 *   feuille « Autres paris » corners si H1–H3 tiennent à T − 1 h contre B2.
 *   Repli S expédié seulement si, à 17 h la veille, sur les lignes 1xBet des
 *   matchs sans ajustement Pinnacle, l'IC de la log-perte (S − B) est
 *   entièrement sous 0 (H5). Sinon : la fréquence du marché reste.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:corners-cards
 *      [--from=2026-09-16] [--to=2026-11-04]
 * Output: packages/backtest-core/reports/backtest-corners-cards-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@evcore/db";
import {
  COUNT_MARKET_MAX_RMSE,
  COUNT_MARKET_QUOTE_GAP_MINUTES,
  countConditionalOver,
  fitCountMean,
  HUNTER_CORNERS_CLASS,
  selectCountLadder,
  shinProbabilities,
  type CountLineFair,
  type CountQuote,
} from "@evcore/analysis-core";
import Decimal from "decimal.js";
import { bootstrapDaySums } from "../src";

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const FROM = arg("from") ?? "2026-09-16";
const TO = arg("to") ?? "2026-11-04";
const SIZE_FIT_UNTIL = new Date("2026-10-16T00:00:00Z");
const S_TRAIN_FROM = new Date("2024-01-01T00:00:00Z");
const S_TRAIN_TO = new Date("2026-09-16T00:00:00Z");
const SIZE_GRID: ReadonlyArray<number | null> = [
  null,
  100,
  50,
  30,
  20,
  15,
  10,
  7,
  5,
  3,
];
const S_WINDOW = 20;
const S_SHRINK_K = 6;
const S_LEAGUE_DAYS = 365;
const S_LEAGUE_MIN = 50;
const CLOSE_MAX_HOURS = 2;
const BOOT = { draws: 1000, seed: 20261105 };
const MIN_EXTRAP_FIXTURES = 100;
const MIN_LINE_FIXTURES = 200;

type CountMarket = "CORNERS" | "CARDS";
const MARKETS: CountMarket[] = ["CORNERS", "CARDS"];
type InstantName = "veille17h" | "T-1h";
const INSTANTS: InstantName[] = ["veille17h", "T-1h"];

type OddsRow = {
  fixtureId: string;
  bookmaker: string;
  market: CountMarket;
  pick: "OVER" | "UNDER";
  line: number;
  odds: number;
  snapshotAt: Date;
  observedAt: Date;
};
type StatFixture = {
  id: string;
  kickoff: Date;
  league: string;
  home: string;
  away: string;
  corners: number | null;
  cardsOnce: number | null;
  cardsTwice: number | null;
  cornersByTeam: { h: number; a: number } | null;
  /** Yellows plus reds once, per team. */
  cardsByTeam: { h: number; a: number } | null;
};

// ─────────────────────────── chargement ───────────────────────────

async function loadStats(): Promise<StatFixture[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      kickoff: Date;
      league: string;
      home: string;
      away: string;
      hc: number | null;
      ac: number | null;
      hy: number | null;
      ay: number | null;
      hr: number | null;
      ar: number | null;
    }>
  >(`
    SELECT f.id, f."scheduledAt" AS kickoff, c.code AS league,
           f."homeTeamId" AS home, f."awayTeamId" AS away,
           max(s.value) FILTER (WHERE s.type='corner_kicks' AND s."teamId"=f."homeTeamId")::float AS hc,
           max(s.value) FILTER (WHERE s.type='corner_kicks' AND s."teamId"=f."awayTeamId")::float AS ac,
           max(s.value) FILTER (WHERE s.type='yellow_cards' AND s."teamId"=f."homeTeamId")::float AS hy,
           max(s.value) FILTER (WHERE s.type='yellow_cards' AND s."teamId"=f."awayTeamId")::float AS ay,
           max(s.value) FILTER (WHERE s.type='red_cards' AND s."teamId"=f."homeTeamId")::float AS hr,
           max(s.value) FILTER (WHERE s.type='red_cards' AND s."teamId"=f."awayTeamId")::float AS ar
    FROM fixture f
    JOIN season se ON se.id = f."seasonId"
    JOIN competition c ON c.id = se."competitionId"
    JOIN fixture_statistic s ON s."fixtureId" = f.id
    WHERE f.status = 'FINISHED'
      AND s.type IN ('corner_kicks','yellow_cards','red_cards')
    GROUP BY f.id, c.code
    ORDER BY f."scheduledAt"`);
  return rows.map((r) => {
    const cards =
      r.hy === null || r.ay === null
        ? null
        : { y: r.hy + r.ay, red: (r.hr ?? 0) + (r.ar ?? 0) };
    return {
      id: r.id,
      kickoff: r.kickoff,
      league: r.league,
      home: r.home,
      away: r.away,
      corners: r.hc === null || r.ac === null ? null : r.hc + r.ac,
      cardsOnce: cards ? cards.y + cards.red : null,
      cardsTwice: cards ? cards.y + 2 * cards.red : null,
      cornersByTeam:
        r.hc === null || r.ac === null ? null : { h: r.hc, a: r.ac },
      cardsByTeam:
        r.hy === null || r.ay === null
          ? null
          : { h: r.hy + (r.hr ?? 0), a: r.ay + (r.ar ?? 0) },
    };
  });
}

async function loadOdds(): Promise<OddsRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<Omit<OddsRow, "line" | "odds"> & { line: string; odds: string }>
  >(`
    SELECT o."fixtureId", o.bookmaker, o.market::text AS market, o.pick,
           o.line::text AS line, o.odds::text AS odds, o."snapshotAt",
           COALESCE(o."observedAt", o."createdAt") AS "observedAt"
    FROM odds_snapshot o
    JOIN fixture f ON f.id = o."fixtureId"
    WHERE o.market IN ('CORNERS','CARDS')
      AND o.bookmaker IN ('Pinnacle','1xBet')
      AND o.line IS NOT NULL AND o.odds IS NOT NULL
      AND f.status = 'FINISHED'
      AND f."scheduledAt" >= '${FROM}' AND f."scheduledAt" < '${TO}'`);
  return rows.map((r) => ({
    ...r,
    line: Number(r.line),
    odds: Number(r.odds),
  }));
}

async function loadClose(): Promise<Map<string, Map<number, number>>> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      fixtureId: string;
      market: string;
      line: string;
      over: string;
      under: string;
    }>
  >(`
    SELECT o."fixtureId", o.market::text AS market, o.line::text AS line,
           o.odds::text AS over, u.odds::text AS under
    FROM odds_closing_line o
    JOIN odds_closing_line u ON u."fixtureId" = o."fixtureId"
      AND u.bookmaker = o.bookmaker AND u.market = o.market AND u.line = o.line
      AND u.pick = 'UNDER' AND u."snapshotAt" = o."snapshotAt"
    WHERE o.bookmaker = 'Pinnacle' AND o.market IN ('CORNERS','CARDS')
      AND o.pick = 'OVER' AND o."hoursBeforeKickoff" <= ${CLOSE_MAX_HOURS}
      AND mod(o.line, 1) = 0.5`);
  const out = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const fair = shinProbabilities([
      { pick: "OVER", odds: new Decimal(r.over) },
      { pick: "UNDER", odds: new Decimal(r.under) },
    ])?.get("OVER");
    if (!fair) continue;
    const key = `${r.fixtureId}|${r.market}`;
    const m = out.get(key) ?? new Map<number, number>();
    m.set(Number(r.line), fair.toNumber());
    out.set(key, m);
  }
  return out;
}

// ─────────────────────── repli S (stats) ───────────────────────

type SPrediction = Map<string, number>; // fixtureId → μ_S

function statsMeans(
  fixtures: readonly StatFixture[],
  value: (f: StatFixture) => { h: number; a: number } | null,
): SPrediction {
  const teams = new Map<string, Array<{ for: number; against: number }>>();
  const leagues = new Map<string, Array<{ at: number; total: number }>>();
  const all: number[] = [];
  const out: SPrediction = new Map();
  const avg = (xs: readonly number[]) =>
    xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const f of fixtures) {
    const at = f.kickoff.getTime();
    const league = (leagues.get(f.league) ?? []).filter(
      (x) => at - x.at <= S_LEAGUE_DAYS * 86_400_000,
    );
    leagues.set(f.league, league);
    const L =
      league.length >= S_LEAGUE_MIN
        ? avg(league.map((x) => x.total))
        : all.length > 0
          ? avg(all.slice(-5000))
          : null;
    if (L !== null && L > 0) {
      const half = L / 2;
      const shrink = (xs: readonly number[]) =>
        (xs.reduce((a, b) => a + b, 0) + S_SHRINK_K * half) /
        (xs.length + S_SHRINK_K);
      const h = (teams.get(f.home) ?? []).slice(-S_WINDOW);
      const a = (teams.get(f.away) ?? []).slice(-S_WINDOW);
      const attH = shrink(h.map((x) => x.for));
      const defH = shrink(h.map((x) => x.against));
      const attA = shrink(a.map((x) => x.for));
      const defA = shrink(a.map((x) => x.against));
      out.set(f.id, (attH * defA + attA * defH) / half);
    }
    const v = value(f);
    if (!v) continue;
    const push = (team: string, x: { for: number; against: number }) => {
      const list = teams.get(team) ?? [];
      list.push(x);
      if (list.length > S_WINDOW) list.shift();
      teams.set(team, list);
    };
    push(f.home, { for: v.h, against: v.a });
    push(f.away, { for: v.a, against: v.h });
    league.push({ at, total: v.h + v.a });
    all.push(v.h + v.a);
  }
  return out;
}

// ─────────────────────── outils ───────────────────────

function instantOf(name: InstantName, kickoff: Date): Date {
  if (name === "T-1h") return new Date(kickoff.getTime() - 3_600_000);
  return new Date(
    Date.UTC(
      kickoff.getUTCFullYear(),
      kickoff.getUTCMonth(),
      kickoff.getUTCDate() - 1,
      17,
    ),
  );
}

/** Latest same-snapshot pair per line of one book's quotes. */
function latestPairs(
  rows: readonly OddsRow[],
): Map<number, { over: number; under: number }> {
  const best = new Map<number, { at: number; over: number; under: number }>();
  const byKey = new Map<
    string,
    { over?: number; under?: number; line: number; at: number }
  >();
  for (const r of rows) {
    const at = r.snapshotAt.getTime();
    const key = `${r.line}|${at}`;
    const e = byKey.get(key) ?? { line: r.line, at };
    if (r.pick === "OVER") e.over = r.odds;
    else e.under = r.odds;
    byKey.set(key, e);
  }
  for (const e of byKey.values()) {
    if (e.over === undefined || e.under === undefined) continue;
    const cur = best.get(e.line);
    if (!cur || e.at > cur.at)
      best.set(e.line, { at: e.at, over: e.over, under: e.under });
  }
  return new Map(
    [...best].map(([l, v]) => [l, { over: v.over, under: v.under }]),
  );
}

const proportional = (p: { over: number; under: number }) =>
  1 / p.over / (1 / p.over + 1 / p.under);
const shinOver = (p: { over: number; under: number }) =>
  shinProbabilities([
    { pick: "OVER", odds: new Decimal(p.over) },
    { pick: "UNDER", odds: new Decimal(p.under) },
  ])
    ?.get("OVER")
    ?.toNumber() ?? null;
const clamp = (p: number) => Math.min(1 - 1e-6, Math.max(1e-6, p));
const logLoss = (p: number, o: boolean) => -Math.log(clamp(o ? p : 1 - p));
const isHalf = (line: number) => Math.abs((line % 1) - 0.5) < 1e-9;
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const ci = (r: { value: number; lo: number; hi: number }, d = 3) =>
  `${fmt(r.value, d)} [${fmt(r.lo, d)} ; ${fmt(r.hi, d)}]`;

/** Per-day vectors → bootstrap of a statistic. */
function boot(
  rows: ReadonlyArray<{ day: string; v: number[] }>,
  stat: (s: number[]) => number,
) {
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const cur = byDay.get(r.day) ?? new Array<number>(r.v.length).fill(0);
    r.v.forEach((x, i) => (cur[i] = (cur[i] ?? 0) + x));
    byDay.set(r.day, cur);
  }
  return bootstrapDaySums([...byDay.values()], stat, BOOT);
}
const ratio = (s: number[]) => (s[0] ?? 0) / (s[1] ?? 0);
const meanOf = (s: number[]) => (s[0] ?? 0) / (s[1] ?? 0);

type LegRow = {
  market: CountMarket;
  instant: InstantName;
  fixtureId: string;
  day: string;
  line: number;
  inP: boolean;
  inX: boolean;
  pM: number | null;
  pB: number | null;
  pB2: number | null;
  pS: number | null;
  close: number | null;
  outcome: boolean | null;
  xPair: { over: number; under: number } | null;
};

// ─────────────────────── rejeu ───────────────────────

async function main(): Promise<void> {
  const out: string[] = [];
  const log = (s = "") => {
    out.push(s);
    console.log(s);
  };
  log(
    `ML-3 corners et cartons — rejeu du ${new Date().toISOString().slice(0, 10)}, matchs ${FROM} → ${TO}`,
  );

  const [stats, odds, close] = await Promise.all([
    loadStats(),
    loadOdds(),
    loadClose(),
  ]);
  const statById = new Map(stats.map((s) => [s.id, s]));
  const oddsBy = new Map<string, OddsRow[]>();
  for (const r of odds) {
    const key = `${r.fixtureId}|${r.market}`;
    const list = oddsBy.get(key) ?? [];
    list.push(r);
    oddsBy.set(key, list);
  }

  // ── S : moyennes d'équipe point-in-time ──
  const sMean: Record<CountMarket, SPrediction> = {
    CORNERS: statsMeans(stats, (f) => f.cornersByTeam),
    CARDS: statsMeans(stats, (f) => f.cardsByTeam),
  };
  const totalOf = (m: CountMarket, f: StatFixture) =>
    m === "CORNERS" ? f.corners : f.cardsOnce;
  const sSize: Record<CountMarket, number | null> = {
    CORNERS: null,
    CARDS: null,
  };
  log("\n## Repli S : taille r_S par moments (2024-01-01 → 2026-09-15)");
  for (const m of MARKETS) {
    let mu2 = 0;
    let excess = 0;
    let n = 0;
    for (const f of stats) {
      if (f.kickoff < S_TRAIN_FROM || f.kickoff >= S_TRAIN_TO) continue;
      const mu = sMean[m].get(f.id);
      const y = totalOf(m, f);
      if (mu === undefined || y === null) continue;
      mu2 += mu * mu;
      excess += (y - mu) ** 2 - mu;
      n++;
    }
    sSize[m] = excess > 0 ? mu2 / excess : null;
    log(
      `${m} : n ${n}, r_S ${sSize[m] === null ? "∞ (Poisson)" : fmt(sSize[m] as number, 2)}`,
    );
  }

  const fixturesOf = (m: CountMarket) =>
    [...new Set(odds.filter((r) => r.market === m).map((r) => r.fixtureId))]
      .map((id) => statById.get(id))
      .filter((f): f is StatFixture => f !== undefined);

  const ladderAt = (rows: readonly OddsRow[], instant: Date): CountLineFair[] =>
    selectCountLadder(
      rows
        .filter(
          (r) =>
            r.bookmaker === "Pinnacle" &&
            r.snapshotAt < instant &&
            r.observedAt < instant,
        )
        .map(
          (r): CountQuote => ({
            line: r.line,
            pick: r.pick,
            odds: r.odds,
            snapshotAt: r.snapshotAt,
          }),
        ),
      COUNT_MARKET_QUOTE_GAP_MINUTES,
    );

  // ── étape 0 : taille r lue sur la forme des prix ──
  const size: Record<CountMarket, number | null> = {
    CORNERS: null,
    CARDS: null,
  };
  log(
    "\n## Étape 0 : taille r sur la forme des prix Pinnacle (T − 1 h, matchs ≤ 15/10, ≥ 3 lignes)",
  );
  for (const m of MARKETS) {
    const ladders = fixturesOf(m)
      .filter((f) => f.kickoff < SIZE_FIT_UNTIL)
      .map((f) =>
        ladderAt(
          oddsBy.get(`${f.id}|${m}`) ?? [],
          instantOf("T-1h", f.kickoff),
        ),
      )
      .filter((l) => l.length >= 3);
    let best: { r: number | null; sse: number } | null = null;
    const cells: string[] = [];
    for (const r of SIZE_GRID) {
      let sse = 0;
      for (const lines of ladders) {
        const fit = fitCountMean({ lines, size: r, maxRmse: Infinity });
        if (fit) sse += fit.rmse ** 2 * lines.length;
      }
      cells.push(`${r === null ? "∞" : r}: ${sse.toFixed(4)}`);
      if (!best || sse < best.sse) best = { r, sse };
    }
    size[m] = best?.r ?? null;
    log(`${m} : ${ladders.length} échelles ; Σ écart² ${cells.join(" · ")}`);
    log(`${m} : r retenu = ${size[m] === null ? "∞ (Poisson)" : size[m]}`);
  }

  // ── jambes ──
  const legs: LegRow[] = [];
  const dispersion: Record<
    CountMarket,
    { sq: number; nb: number; po: number; n: number }
  > = {
    CORNERS: { sq: 0, nb: 0, po: 0, n: 0 },
    CARDS: { sq: 0, nb: 0, po: 0, n: 0 },
  };
  const loo: Record<CountMarket, Array<{ day: string; v: number[] }>> = {
    CORNERS: [],
    CARDS: [],
  };
  const fitCounts: Record<
    string,
    { fx: number; fitted: number; refused: number }
  > = {};
  for (const m of MARKETS) {
    for (const f of fixturesOf(m)) {
      const y = totalOf(m, f);
      if (y === null) continue;
      const rows = oddsBy.get(`${f.id}|${m}`) ?? [];
      const cl = close.get(`${f.id}|${m}`) ?? new Map<number, number>();
      const day = f.kickoff.toISOString().slice(0, 10);
      const outcomeAt = (line: number): boolean | null => {
        if (m === "CORNERS") return y > line;
        const once = (f.cardsOnce as number) > line;
        const twice = (f.cardsTwice as number) > line;
        return once === twice ? once : null;
      };
      for (const inst of INSTANTS) {
        const at = instantOf(inst, f.kickoff);
        const before = rows.filter(
          (r) => r.snapshotAt < at && r.observedAt < at,
        );
        const ladder = ladderAt(rows, at);
        const fit = fitCountMean({
          lines: ladder,
          size: size[m],
          maxRmse: COUNT_MARKET_MAX_RMSE,
        });
        const fc = (fitCounts[`${m}|${inst}`] ??= {
          fx: 0,
          fitted: 0,
          refused: 0,
        });
        fc.fx++;
        if (fit) fc.fitted++;
        else if (ladder.length > 0) fc.refused++;
        const pin = latestPairs(
          before.filter((r) => r.bookmaker === "Pinnacle"),
        );
        const x = latestPairs(before.filter((r) => r.bookmaker === "1xBet"));
        if (inst === "T-1h" && fit) {
          const mu = fit.mean;
          const r = size[m];
          dispersion[m].sq += (y - mu) ** 2;
          dispersion[m].nb += mu + (r === null ? 0 : (mu * mu) / r);
          dispersion[m].po += mu;
          dispersion[m].n++;
          // extrapolation : la ligne extrême retirée, prédite par les autres
          const halves = ladder.filter((l) => isHalf(l.line));
          if (halves.length >= 3) {
            for (const held of [halves[0], halves[halves.length - 1]]) {
              if (!held) continue;
              const c = cl.get(held.line);
              if (c === undefined) continue;
              const others = ladder.filter((l) => l.line !== held.line);
              const f2 = fitCountMean({
                lines: others,
                size: r,
                maxRmse: COUNT_MARKET_MAX_RMSE,
              });
              if (!f2) continue;
              const pLoo = countConditionalOver({
                mean: f2.mean,
                size: r,
                line: held.line,
              }).toNumber();
              const pDir = held.fairOver.toNumber();
              loo[m].push({ day, v: [(pLoo - c) ** 2, (pDir - c) ** 2, 1] });
            }
          }
        }
        const lines = new Set<number>(
          [...pin.keys(), ...x.keys()].filter(isHalf),
        );
        const muS = sMean[m].get(f.id);
        for (const line of lines) {
          const p = pin.get(line);
          const xp = x.get(line);
          const pB = p ? proportional(p) : xp ? proportional(xp) : null;
          const pB2 = xp ? shinOver(xp) : p ? shinOver(p) : null;
          legs.push({
            market: m,
            instant: inst,
            fixtureId: f.id,
            day,
            line,
            inP: p !== undefined,
            inX: xp !== undefined,
            pM: fit
              ? countConditionalOver({
                  mean: fit.mean,
                  size: size[m],
                  line,
                }).toNumber()
              : null,
            pB,
            pB2,
            pS:
              muS === undefined
                ? null
                : countConditionalOver({
                    mean: muS,
                    size: sSize[m],
                    line,
                  }).toNumber(),
            close: cl.get(line) ?? null,
            outcome: outcomeAt(line),
            xPair: xp ?? null,
          });
        }
      }
    }
  }

  log("\n## Ajustements");
  for (const [k, v] of Object.entries(fitCounts)) {
    log(
      `${k} : ${v.fx} matchs, ${v.fitted} ajustés sur Pinnacle, ${v.refused} échelles refusées`,
    );
  }
  log(
    "\n## Dispersion réalisée (T − 1 h, μ ajusté) : E[(Y−μ)²] ÷ E[variance du modèle]",
  );
  for (const m of MARKETS) {
    const d = dispersion[m];
    log(
      `${m} : n ${d.n}, ÷ NB(r) ${fmt(d.sq / d.nb)} · ÷ Poisson ${fmt(d.sq / d.po)}`,
    );
  }
  log(
    "\n## Extrapolation (description) : ligne extrême Pinnacle retirée, T − 1 h, contre la clôture",
  );
  for (const m of MARKETS) {
    const rows = loo[m];
    const a = boot(rows, (s) => (s[0] ?? 0) / (s[2] ?? 1));
    const b = boot(rows, (s) => (s[1] ?? 0) / (s[2] ?? 1));
    log(
      `${m} : ${rows.length} lignes ; écart² prédit ${ci(a, 5)} · écart² du prix direct ${ci(b, 5)}`,
    );
  }

  const verdict: Record<string, boolean> = {};
  for (const m of MARKETS) {
    for (const inst of INSTANTS) {
      const L = legs.filter((l) => l.market === m && l.instant === inst);
      const base = inst === "veille17h" ? "pB" : "pB2";
      const tag = `${m} ${inst} (base ${base === "pB" ? "B" : "B2"})`;
      log(`\n## ${tag}`);
      // H1
      const cal = L.filter((l) => l.pM !== null && l.outcome !== null);
      const over = boot(
        cal.map((l) => ({
          day: l.day,
          v: [l.outcome ? 1 : 0, l.pM as number],
        })),
        ratio,
      );
      const under = boot(
        cal.map((l) => ({
          day: l.day,
          v: [l.outcome ? 0 : 1, 1 - (l.pM as number)],
        })),
        ratio,
      );
      log(
        `H1 M plus ${ci(over)} · moins ${ci(under)} (${cal.length} lignes, ${new Set(cal.map((l) => l.fixtureId)).size} matchs)`,
      );
      const calB = L.filter(
        (l) => l[base] !== null && l.outcome !== null && l.pM !== null,
      );
      log(
        `   même jambes, base : plus ${ci(
          boot(
            calB.map((l) => ({
              day: l.day,
              v: [l.outcome ? 1 : 0, l[base] as number],
            })),
            ratio,
          ),
        )} · moins ${ci(
          boot(
            calB.map((l) => ({
              day: l.day,
              v: [l.outcome ? 0 : 1, 1 - (l[base] as number)],
            })),
            ratio,
          ),
        )}`,
      );
      let h1 = over.lo >= 0.97 && under.lo >= 0.97;
      for (const line of [...new Set(cal.map((l) => l.line))].sort(
        (a, b) => a - b,
      )) {
        const at = cal.filter((l) => l.line === line);
        const n = new Set(at.map((l) => l.fixtureId)).size;
        const o = boot(
          at.map((l) => ({
            day: l.day,
            v: [l.outcome ? 1 : 0, l.pM as number],
          })),
          ratio,
        );
        const u = boot(
          at.map((l) => ({
            day: l.day,
            v: [l.outcome ? 0 : 1, 1 - (l.pM as number)],
          })),
          ratio,
        );
        const bad = n >= MIN_LINE_FIXTURES && (o.lo < 0.9 || u.lo < 0.9);
        if (bad) h1 = false;
        log(
          `   ligne ${line} : ${n} matchs, plus ${ci(o)} · moins ${ci(u)}${bad ? " ✗" : ""}`,
        );
      }
      // H2a / H2b
      const gap = (rows: LegRow[]) =>
        boot(
          rows.map((l) => ({
            day: l.day,
            v: [
              ((l.pM as number) - (l.close as number)) ** 2 -
                ((l[base] as number) - (l.close as number)) ** 2,
              1,
            ],
          })),
          meanOf,
        );
      const withClose = L.filter(
        (l) => l.pM !== null && l.close !== null && l[base] !== null,
      );
      const sameRows = withClose.filter((l) => l.inP);
      const extrapRows = withClose.filter((l) => !l.inP && l.inX);
      const same = gap(sameRows);
      const extrap = gap(extrapRows);
      const extrapFx = new Set(extrapRows.map((l) => l.fixtureId)).size;
      const h2a = sameRows.length > 0 && same.lo <= 0;
      const h2b = extrapFx >= MIN_EXTRAP_FIXTURES && extrap.hi < 0;
      log(
        `H2a Δécart² lignes Pinnacle ${ci(same, 5)} (${sameRows.length} lignes) ${h2a ? "✓" : "✗"}`,
      );
      log(
        `H2b Δécart² lignes 1xBet hors Pinnacle ${ci(extrap, 5)} (${extrapRows.length} lignes, ${extrapFx} matchs) ${h2b ? "✓" : "✗"}`,
      );
      // H3
      const llRows = L.filter(
        (l) =>
          !l.inP &&
          l.inX &&
          l.pM !== null &&
          l[base] !== null &&
          l.outcome !== null,
      );
      const h3r = boot(
        llRows.map((l) => ({
          day: l.day,
          v: [
            logLoss(l.pM as number, l.outcome as boolean) -
              logLoss(l[base] as number, l.outcome as boolean),
            1,
          ],
        })),
        meanOf,
      );
      const h3 = llRows.length > 0 && h3r.lo <= 0;
      log(
        `H3 Δlog-perte lignes 1xBet hors Pinnacle ${ci(h3r, 4)} (${llRows.length} lignes) ${h3 ? "✓" : "✗"}`,
      );
      log(`H1 ${h1 ? "✓" : "✗"}`);
      // H4 + H5 (chasseur, corners, veille)
      let h4 = true;
      if (m === "CORNERS" && inst === "veille17h") {
        const band = L.filter(
          (l) => l.xPair !== null && l.outcome !== null,
        ).flatMap((l) => {
          const xp = l.xPair as { over: number; under: number };
          const pOver = l.pM ?? (l.pB as number);
          const bOver = l.pB as number;
          return (
            [
              {
                side: "OVER",
                odds: xp.over,
                p: pOver,
                b: bOver,
                won: l.outcome as boolean,
              },
              {
                side: "UNDER",
                odds: xp.under,
                p: 1 - pOver,
                b: 1 - bOver,
                won: !(l.outcome as boolean),
              },
            ] as const
          )
            .filter(
              (s) =>
                s.odds >= HUNTER_CORNERS_CLASS.minLegOdds &&
                s.odds <= HUNTER_CORNERS_CLASS.maxLegOdds,
            )
            .map((s) => ({
              ...s,
              day: l.day,
              fixtureId: l.fixtureId,
              line: l.line,
              margin: 1 / xp.over + 1 / xp.under - 1,
            }));
        });
        const rm = boot(
          band.map((s) => ({ day: s.day, v: [s.won ? 1 : 0, s.p] })),
          ratio,
        );
        const rb = boot(
          band.map((s) => ({ day: s.day, v: [s.won ? 1 : 0, s.b] })),
          ratio,
        );
        h4 = band.length > 0 && rm.lo <= 1 && rm.hi >= 1;
        log(
          `H4 côtés 1xBet dans la bande (${band.length}, ${new Set(band.map((s) => s.day)).size} jours) : M ${ci(rm)} · B ${ci(rb)} ${h4 ? "✓" : "✗"}`,
        );
        // jambes du chasseur rejouées
        const byDay = new Map<string, typeof band>();
        for (const s of band)
          byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
        const pick = (xs: typeof band, key: "p" | "b") =>
          xs.reduce<(typeof band)[number] | null>(
            (best, s) =>
              !best ||
              s.margin < best.margin ||
              (s.margin === best.margin && s[key] > best[key])
                ? s
                : best,
            null,
          );
        let diff = 0;
        const legM: Array<{ day: string; v: number[] }> = [];
        const legB: Array<{ day: string; v: number[] }> = [];
        for (const [d, xs] of byDay) {
          const a = pick(xs, "p");
          const b = pick(xs, "b");
          if (a) legM.push({ day: d, v: [a.won ? 1 : 0, a.p] });
          if (b) legB.push({ day: d, v: [b.won ? 1 : 0, b.b] });
          if (
            a &&
            b &&
            (a.fixtureId !== b.fixtureId ||
              a.line !== b.line ||
              a.side !== b.side)
          )
            diff++;
        }
        const sum = (rows: Array<{ v: number[] }>, i: number) =>
          rows.reduce((s, r) => s + (r.v[i] ?? 0), 0);
        log(
          `   jambes du chasseur : ${legM.length} jours, ${diff} jambes différentes ; M ${sum(legM, 0)} gagnées / ${fmt(sum(legM, 1), 2)} annoncées · B ${sum(legB, 0)} / ${fmt(sum(legB, 1), 2)}`,
        );
        // H5 repli S
        const sRows = L.filter(
          (l) =>
            l.pM === null &&
            l.inX &&
            l.pS !== null &&
            l.pB !== null &&
            l.outcome !== null,
        );
        const h5r = boot(
          sRows.map((l) => ({
            day: l.day,
            v: [
              logLoss(l.pS as number, l.outcome as boolean) -
                logLoss(l.pB as number, l.outcome as boolean),
              1,
            ],
          })),
          meanOf,
        );
        verdict["S"] = sRows.length > 0 && h5r.hi < 0;
        log(
          `H5 repli S, Δlog-perte (S − B) lignes 1xBet sans Pinnacle ${ci(h5r, 4)} (${sRows.length} lignes, ${new Set(sRows.map((l) => l.fixtureId)).size} matchs) ${verdict["S"] ? "✓" : "✗"}`,
        );
      }
      const sCal = L.filter(
        (l) => l.pS !== null && l.outcome !== null && l.pM !== null,
      );
      log(
        `   S (référence) sur les jambes de M : plus ${ci(
          boot(
            sCal.map((l) => ({
              day: l.day,
              v: [l.outcome ? 1 : 0, l.pS as number],
            })),
            ratio,
          ),
        )} ; Δlog-perte (S − M) ${ci(
          boot(
            sCal.map((l) => ({
              day: l.day,
              v: [
                logLoss(l.pS as number, l.outcome as boolean) -
                  logLoss(l.pM as number, l.outcome as boolean),
                1,
              ],
            })),
            meanOf,
          ),
          4,
        )}`,
      );
      verdict[`${m}|${inst}`] = h1 && h2a && h2b && h3 && h4;
    }
  }

  log("\n## Verdict (règle de l'en-tête)");
  log(
    `Chasseur Corners (veille 17 h, base B) : ${verdict["CORNERS|veille17h"] ? "EXPÉDIÉ" : "neutre"}`,
  );
  log(
    `Feuille corners (T − 1 h, base B2) : ${verdict["CORNERS|T-1h"] ? "EXPÉDIÉ" : "neutre"}`,
  );
  log(
    `Cartons : neutres (pas de prix 1xBet à juger) — H1–H3 rapportés ci-dessus`,
  );
  log(`Repli S : ${verdict["S"] ? "EXPÉDIÉ" : "non expédié"}`);
  log(
    `Tailles retenues : CORNERS r = ${size.CORNERS ?? "∞"}, CARDS r = ${size.CARDS ?? "∞"}`,
  );

  const dir = join(__dirname, "..", "reports");
  mkdirSync(dir, { recursive: true });
  const file = join(
    dir,
    `backtest-corners-cards-${new Date().toISOString().slice(0, 10)}.txt`,
  );
  writeFileSync(file, out.join("\n") + "\n");
  console.log(`\n→ ${file}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
