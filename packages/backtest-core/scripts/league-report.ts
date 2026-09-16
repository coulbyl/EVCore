/**
 * Rapport observationnel par championnat.
 *
 * Trois couches indépendantes, volontairement séparées parce qu'elles n'ont
 * ni la même profondeur ni la même fiabilité :
 *
 *  A. Taux de base — issus des seuls scores finaux, sur toutes les saisons
 *     disponibles. Aucun moteur, aucune cote : la tendance brute du
 *     championnat, mesurée saison par saison pour juger de sa stabilité.
 *  B. Calibration du moteur — sur les sélections analysées avant le coup
 *     d'envoi uniquement. Les lignes rétro-analysées le 2026-06-30 sur des
 *     matchs déjà joués sont exclues : elles ne prouvent rien.
 *  C. Souplesse du marché — réalisé contre probabilité implicite consensus
 *     des books, là où une cote d'avant match existe.
 *
 * Le rapport observe, il ne sélectionne pas. Toute cellule survivante doit
 * être confirmée hors de cette fenêtre avant de piloter quoi que ce soit :
 * 68 championnats fois 29 issues produisent des extrêmes par pur hasard.
 *
 * Usage :
 *   pnpm report:league                 # lit la base (DATABASE_URL requis)
 *   pnpm report:league -- --from <dir> # rejoue depuis des JSON déjà extraits
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPORT_VERSION = "league-report-v1";
const SPLIT_DATE = "2026-08-25";
const MIN_CELL_OBSERVATIONS = 100;
const MIN_HALF_OBSERVATIONS = 60;
const MIN_SEASONS_FOR_STABILITY = 3;
const MIN_SEASON_CELL = 80;
const MIN_EDGE_OBSERVATIONS = 300;
const MIN_ROI_LEGS = 200;
const MIN_ROI_HALF_LEGS = 100;
const MIN_EXOTIC_CELL = 150;
const COUPON_TARGET_ODDS = 5;
const MAX_COUPON_LEGS = 8;
const KEY_SEPARATOR = "||";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const QUERY_FILES = {
  coverage: "01-coverage.sql",
  baseRates: "02-base-rates.sql",
  channels: "03-channel-track.sql",
  marketEdge: "04-market-edge.sql",
  edgeDeciles: "05-edge-deciles.sql",
  overround: "06-overround.sql",
  exoticMarkets: "07-exotic-markets.sql",
} as const;

type QueryName = keyof typeof QUERY_FILES;

type CoverageRow = {
  competition: string;
  name: string;
  country: string;
  seasons: number;
  finished: number;
  withHalfTime: number;
  firstKickoff: string;
  lastKickoff: string;
};

type BaseRateRow = {
  competition: string;
  season: string;
  seasonStart: string;
  outcome: string;
  n: number;
  hits: number;
};

type ChannelRow = {
  competition: string;
  channel: string;
  market: string;
  period: "A" | "B";
  n: number;
  hits: number;
  announced: number;
  oddsN: number;
  oddsSum: number;
  profit: number;
};

type MarketEdgeRow = {
  competition: string;
  marketKey: string;
  pick: string;
  n: number;
  hits: number;
  impliedSum: number;
  oddsSum: number;
};

type EdgeDecileRow = {
  decile: number;
  n: number;
  claimedEdge: number;
  implied: number;
  announced: number;
  realised: number;
  legRoi: number;
};

type OverroundRow = {
  marketKey: string;
  fixtures: number;
  overround: number;
};

type ExoticRow = {
  competition: string;
  market: string;
  pick: string;
  period: "A" | "B";
  n: number;
  hits: number;
  impliedSum: number;
  oddsSum: number;
  profit: number;
};

type RawData = {
  coverage: CoverageRow[];
  baseRates: BaseRateRow[];
  channels: ChannelRow[];
  marketEdge: MarketEdgeRow[];
  edgeDeciles: EdgeDecileRow[];
  overround: OverroundRow[];
  exoticMarkets: ExoticRow[];
};

// ── statistiques ──────────────────────────────────────────────────────────

function wilson(hits: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = hits / n;
  const denominator = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(centre - margin) / denominator, (centre + margin) / denominator];
}

function normalTail(z: number): number {
  // Abramowitz & Stegun 7.1.26, suffisant pour trier un affichage.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const density = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = density * poly;
  return z >= 0 ? tail : 1 - tail;
}

/** Homogénéité d'une issue entre saisons : p-value approchée du chi-deux. */
function heterogeneityPValue(cells: ReadonlyArray<[number, number]>): number {
  const totalHits = cells.reduce((sum, cell) => sum + cell[0], 0);
  const totalN = cells.reduce((sum, cell) => sum + cell[1], 0);
  if (cells.length < 2 || totalN === 0) return 1;
  const pooled = totalHits / totalN;
  if (pooled <= 0 || pooled >= 1) return 1;
  const chi2 = cells.reduce((sum, cell) => {
    const [hits, n] = cell;
    const expected = pooled * n;
    const rest = (1 - pooled) * n;
    if (expected === 0 || rest === 0) return sum;
    return sum + (hits - expected) ** 2 / expected + (n - hits - rest) ** 2 / rest;
  }, 0);
  const df = cells.length - 1;
  const term = 2 / (9 * df);
  const z = ((chi2 / df) ** (1 / 3) - (1 - term)) / Math.sqrt(term);
  return normalTail(z);
}

function ratioOf(realised: number, announced: number): number | null {
  return announced > 0 ? realised / announced : null;
}

function groupRows<T>(
  rows: readonly T[],
  keyFor: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return groups;
}

// ── couche A : taux de base ───────────────────────────────────────────────

type OutcomeStat = {
  competition: string;
  outcome: string;
  n: number;
  hits: number;
  rate: number;
  low95: number;
  high95: number;
  seasons: number;
  seasonRates: Array<{ season: string; n: number; rate: number }>;
  seasonSpread: number;
  stabilityPValue: number;
  stable: boolean;
};

function buildOutcomeStats(rows: readonly BaseRateRow[]): OutcomeStat[] {
  const groups = groupRows(
    rows,
    (row) => `${row.competition}${KEY_SEPARATOR}${row.outcome}`,
  );
  const stats: OutcomeStat[] = [];
  for (const bucket of groups.values()) {
    const head = bucket[0];
    if (!head) continue;
    const ordered = [...bucket].sort((a, b) =>
      a.seasonStart.localeCompare(b.seasonStart),
    );
    const n = ordered.reduce((sum, row) => sum + row.n, 0);
    const hits = ordered.reduce((sum, row) => sum + row.hits, 0);
    if (n === 0) continue;
    const seasonRates = ordered.map((row) => ({
      season: row.season,
      n: row.n,
      rate: row.n > 0 ? row.hits / row.n : 0,
    }));
    const usable = ordered.filter((row) => row.n >= MIN_SEASON_CELL);
    const rates = usable.map((row) => row.hits / row.n);
    const spread =
      rates.length >= 2 ? Math.max(...rates) - Math.min(...rates) : 0;
    const pValue = heterogeneityPValue(
      usable.map((row): [number, number] => [row.hits, row.n]),
    );
    const [low95, high95] = wilson(hits, n);
    stats.push({
      competition: head.competition,
      outcome: head.outcome,
      n,
      hits,
      rate: hits / n,
      low95,
      high95,
      seasons: ordered.length,
      seasonRates,
      seasonSpread: spread,
      stabilityPValue: pValue,
      stable: usable.length >= MIN_SEASONS_FOR_STABILITY && pValue >= 0.05,
    });
  }
  return stats.sort(
    (a, b) =>
      a.competition.localeCompare(b.competition) ||
      a.outcome.localeCompare(b.outcome),
  );
}

type OutcomeBaseline = Map<string, number>;

function buildBaselines(stats: readonly OutcomeStat[]): OutcomeBaseline {
  const totals = new Map<string, { hits: number; n: number }>();
  for (const stat of stats) {
    const current = totals.get(stat.outcome) ?? { hits: 0, n: 0 };
    totals.set(stat.outcome, {
      hits: current.hits + stat.hits,
      n: current.n + stat.n,
    });
  }
  return new Map(
    [...totals].map(([outcome, value]) => [
      outcome,
      value.n > 0 ? value.hits / value.n : 0,
    ]),
  );
}

type LeagueSignature = {
  competition: string;
  outcome: string;
  rate: number;
  baseline: number;
  delta: number;
  n: number;
  seasonSpread: number;
  stable: boolean;
  significant: boolean;
};

function buildSignatures(
  stats: readonly OutcomeStat[],
  baselines: OutcomeBaseline,
): LeagueSignature[] {
  return stats
    .map((stat) => {
      const baseline = baselines.get(stat.outcome) ?? 0;
      return {
        competition: stat.competition,
        outcome: stat.outcome,
        rate: stat.rate,
        baseline,
        delta: stat.rate - baseline,
        n: stat.n,
        seasonSpread: stat.seasonSpread,
        stable: stat.stable,
        significant: baseline < stat.low95 || baseline > stat.high95,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── couche B : calibration du moteur ──────────────────────────────────────

type PeriodStat = { n: number; realised: number; announced: number };

type ChannelCell = {
  competition: string;
  channel: string;
  market: string;
  n: number;
  hits: number;
  realised: number;
  announced: number;
  ratio: number | null;
  low95: number;
  high95: number;
  avgOdds: number | null;
  legRoi: number | null;
  periodA: PeriodStat | null;
  periodB: PeriodStat | null;
  replicated: boolean;
};

function foldPeriod(rows: readonly ChannelRow[]): PeriodStat | null {
  const n = rows.reduce((sum, row) => sum + row.n, 0);
  if (n < MIN_HALF_OBSERVATIONS) return null;
  const hits = rows.reduce((sum, row) => sum + row.hits, 0);
  const announced = rows.reduce((sum, row) => sum + row.announced, 0);
  return { n, realised: hits / n, announced: announced / n };
}

function buildChannelCells(rows: readonly ChannelRow[]): ChannelCell[] {
  const groups = groupRows(
    rows,
    (row) =>
      [row.competition, row.channel, row.market].join(KEY_SEPARATOR),
  );
  const cells: ChannelCell[] = [];
  for (const bucket of groups.values()) {
    const head = bucket[0];
    if (!head) continue;
    const n = bucket.reduce((sum, row) => sum + row.n, 0);
    const hits = bucket.reduce((sum, row) => sum + row.hits, 0);
    const announced = bucket.reduce((sum, row) => sum + row.announced, 0);
    const oddsN = bucket.reduce((sum, row) => sum + row.oddsN, 0);
    const oddsSum = bucket.reduce((sum, row) => sum + row.oddsSum, 0);
    const profit = bucket.reduce((sum, row) => sum + row.profit, 0);
    const [low95, high95] = wilson(hits, n);
    const periodA = foldPeriod(bucket.filter((row) => row.period === "A"));
    const periodB = foldPeriod(bucket.filter((row) => row.period === "B"));
    const ratioA = periodA ? ratioOf(periodA.realised, periodA.announced) : null;
    const ratioB = periodB ? ratioOf(periodB.realised, periodB.announced) : null;
    cells.push({
      competition: head.competition,
      channel: head.channel,
      market: head.market,
      n,
      hits,
      realised: hits / n,
      announced: announced / n,
      ratio: ratioOf(hits / n, announced / n),
      low95,
      high95,
      avgOdds: oddsN > 0 ? oddsSum / oddsN : null,
      legRoi: oddsN > 0 ? profit / oddsN : null,
      periodA,
      periodB,
      replicated:
        ratioA !== null && ratioB !== null && ratioA >= 0.98 && ratioB >= 0.98,
    });
  }
  return cells.sort((a, b) => b.n - a.n);
}

// ── couche C : souplesse du marché ────────────────────────────────────────

type MarketEdgeCell = MarketEdgeRow & {
  realised: number;
  implied: number;
  delta: number;
  low95: number;
  high95: number;
  avgOdds: number;
  beatsMarket: boolean;
};

function buildMarketEdgeCells(rows: readonly MarketEdgeRow[]): MarketEdgeCell[] {
  return rows
    .filter((row) => row.n > 0)
    .map((row) => {
      const [low95, high95] = wilson(row.hits, row.n);
      const implied = row.impliedSum / row.n;
      return {
        ...row,
        realised: row.hits / row.n,
        implied,
        delta: row.hits / row.n - implied,
        low95,
        high95,
        avgOdds: row.oddsSum / row.n,
        beatsMarket: low95 > implied,
      };
    })
    .sort((a, b) => b.delta - a.delta);
}

// ── ROI au niveau jambe ───────────────────────────────────────────────────

type ChannelRoi = {
  channel: string;
  legs: number;
  roi: number;
  standardError: number;
  avgOdds: number;
  realised: number;
  announced: number;
  roiA: number | null;
  roiB: number | null;
  replicated: boolean;
};

function foldRoi(rows: readonly ChannelRow[]): { legs: number; roi: number } {
  const legs = rows.reduce((sum, row) => sum + row.oddsN, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  return { legs, roi: legs > 0 ? profit / legs : 0 };
}

/**
 * Le niveau jambe est le seul où l'échantillon donne de la puissance : à nos
 * volumes l'erreur type d'un ROI de coupon se compte en dizaines de points,
 * celle d'un ROI de jambe en unités.
 */
function buildChannelRoi(rows: readonly ChannelRow[]): ChannelRoi[] {
  const result: ChannelRoi[] = [];
  for (const [channel, bucket] of groupRows(rows, (row) => row.channel)) {
    const legs = bucket.reduce((sum, row) => sum + row.oddsN, 0);
    if (legs < MIN_ROI_LEGS) continue;
    const n = bucket.reduce((sum, row) => sum + row.n, 0);
    const hits = bucket.reduce((sum, row) => sum + row.hits, 0);
    const announced = bucket.reduce((sum, row) => sum + row.announced, 0);
    const oddsSum = bucket.reduce((sum, row) => sum + row.oddsSum, 0);
    const profit = bucket.reduce((sum, row) => sum + row.profit, 0);
    const realised = hits / n;
    const avgOdds = oddsSum / legs;
    const first = foldRoi(bucket.filter((row) => row.period === "A"));
    const second = foldRoi(bucket.filter((row) => row.period === "B"));
    result.push({
      channel,
      legs,
      roi: profit / legs,
      standardError:
        (Math.sqrt(realised * (1 - realised)) * avgOdds) / Math.sqrt(legs),
      avgOdds,
      realised,
      announced: announced / n,
      roiA: first.legs >= MIN_ROI_HALF_LEGS ? first.roi : null,
      roiB: second.legs >= MIN_ROI_HALF_LEGS ? second.roi : null,
      replicated:
        first.legs >= MIN_ROI_HALF_LEGS &&
        second.legs >= MIN_ROI_HALF_LEGS &&
        first.roi > 0 &&
        second.roi > 0,
    });
  }
  return result.sort((first, second) => second.roi - first.roi);
}

// ── marchés exotiques ─────────────────────────────────────────────────────

type ExoticMarket = {
  market: string;
  bets: number;
  realised: number;
  implied: number;
  avgOdds: number;
  roi: number;
  standardError: number;
  roiA: number | null;
  roiB: number | null;
};

function periodRoi(
  rows: readonly ExoticRow[],
  period: "A" | "B",
): number | null {
  const scoped = rows.filter((row) => row.period === period);
  const bets = scoped.reduce((sum, row) => sum + row.n, 0);
  if (bets < MIN_EXOTIC_CELL) return null;
  return scoped.reduce((sum, row) => sum + row.profit, 0) / bets;
}

function buildExoticMarkets(rows: readonly ExoticRow[]): ExoticMarket[] {
  const result: ExoticMarket[] = [];
  for (const [market, bucket] of groupRows(rows, (row) => row.market)) {
    const bets = bucket.reduce((sum, row) => sum + row.n, 0);
    if (bets === 0) continue;
    const hits = bucket.reduce((sum, row) => sum + row.hits, 0);
    const realised = hits / bets;
    const avgOdds = bucket.reduce((sum, row) => sum + row.oddsSum, 0) / bets;
    result.push({
      market,
      bets,
      realised,
      implied: bucket.reduce((sum, row) => sum + row.impliedSum, 0) / bets,
      avgOdds,
      roi: bucket.reduce((sum, row) => sum + row.profit, 0) / bets,
      standardError:
        (Math.sqrt(realised * (1 - realised)) * avgOdds) / Math.sqrt(bets),
      roiA: periodRoi(bucket, "A"),
      roiB: periodRoi(bucket, "B"),
    });
  }
  return result.sort((first, second) => second.roi - first.roi);
}

type ExoticScan = {
  cells: number;
  positive: number;
  significant: number;
  expectedByChance: number;
  replicated: number;
};

/**
 * Balayage de toutes les cellules championnat x marché x choix. Le nombre de
 * cellules significatives n'a de sens que comparé à celui qu'un tirage au
 * hasard produirait : c'est le seul garde-fou contre la multiplicité des
 * tests.
 */
function scanExoticCells(rows: readonly ExoticRow[]): ExoticScan {
  const groups = groupRows(rows, (row) =>
    [row.competition, row.market, row.pick].join(KEY_SEPARATOR),
  );
  let cells = 0;
  let positive = 0;
  let significant = 0;
  let replicated = 0;
  for (const bucket of groups.values()) {
    const bets = bucket.reduce((sum, row) => sum + row.n, 0);
    if (bets < MIN_EXOTIC_CELL) continue;
    cells += 1;
    const profit = bucket.reduce((sum, row) => sum + row.profit, 0);
    if (profit <= 0) continue;
    positive += 1;
    const hits = bucket.reduce((sum, row) => sum + row.hits, 0);
    const realised = hits / bets;
    const avgOdds = bucket.reduce((sum, row) => sum + row.oddsSum, 0) / bets;
    const standardError =
      (Math.sqrt(Math.max(realised * (1 - realised), 1e-9)) * avgOdds) /
      Math.sqrt(bets);
    if (profit / bets - 1.96 * standardError <= 0) continue;
    significant += 1;
    const halfA = periodRoi(bucket, "A");
    const halfB = periodRoi(bucket, "B");
    if (halfA !== null && halfB !== null && halfA > 0 && halfB > 0) {
      replicated += 1;
    }
  }
  return {
    cells,
    positive,
    significant,
    expectedByChance: cells * 0.025,
    replicated,
  };
}

// ── efficience du marché ──────────────────────────────────────────────────

type MarketEfficiency = {
  cells: number;
  beatingMarket: number;
  significant: number;
  expectedByChance: number;
  observations: number;
  meanDelta: number;
};

function measureEfficiency(
  cells: readonly MarketEdgeCell[],
): MarketEfficiency {
  const eligible = cells.filter((cell) => cell.n >= MIN_EDGE_OBSERVATIONS);
  const observations = eligible.reduce((sum, cell) => sum + cell.n, 0);
  const hits = eligible.reduce((sum, cell) => sum + cell.hits, 0);
  const implied = eligible.reduce((sum, cell) => sum + cell.impliedSum, 0);
  return {
    cells: eligible.length,
    beatingMarket: eligible.filter((cell) => cell.delta > 0).length,
    significant: eligible.filter((cell) => cell.beatsMarket).length,
    expectedByChance: eligible.length * 0.025,
    observations,
    meanDelta: observations > 0 ? (hits - implied) / observations : 0,
  };
}

// ── chargement ────────────────────────────────────────────────────────────

function offlineDir(): string | null {
  const index = process.argv.indexOf("--from");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--from requiert un répertoire");
  return value;
}

function readQuery(name: QueryName): string {
  return readFileSync(join(SCRIPT_DIR, "league-report", QUERY_FILES[name]), "utf8");
}

function readOffline<T>(dir: string, name: QueryName): T[] {
  const file = join(dir, QUERY_FILES[name].replace(/\.sql$/, ".json"));
  return JSON.parse(readFileSync(file, "utf8")) as T[];
}

async function loadFromDatabase(): Promise<RawData> {
  const { prisma } = await import("@evcore/db");
  const run = <T>(name: QueryName): Promise<T[]> =>
    prisma.$queryRawUnsafe<T[]>(readQuery(name));
  try {
    const [
      coverage,
      baseRates,
      channels,
      marketEdge,
      edgeDeciles,
      overround,
      exoticMarkets,
    ] = await Promise.all([
        run<CoverageRow>("coverage"),
        run<BaseRateRow>("baseRates"),
        run<ChannelRow>("channels"),
        run<MarketEdgeRow>("marketEdge"),
        run<EdgeDecileRow>("edgeDeciles"),
        run<OverroundRow>("overround"),
        run<ExoticRow>("exoticMarkets"),
      ]);
    return {
      coverage,
      baseRates,
      channels,
      marketEdge,
      edgeDeciles,
      overround,
      exoticMarkets,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function loadOffline(dir: string): RawData {
  return {
    coverage: readOffline<CoverageRow>(dir, "coverage"),
    baseRates: readOffline<BaseRateRow>(dir, "baseRates"),
    channels: readOffline<ChannelRow>(dir, "channels"),
    marketEdge: readOffline<MarketEdgeRow>(dir, "marketEdge"),
    edgeDeciles: readOffline<EdgeDecileRow>(dir, "edgeDeciles"),
    overround: readOffline<OverroundRow>(dir, "overround"),
    exoticMarkets: readOffline<ExoticRow>(dir, "exoticMarkets"),
  };
}

// ── rendu ─────────────────────────────────────────────────────────────────

function pct(value: number | null, digits = 1): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(digits)} %`;
}

function num(value: number | null, digits = 2): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
}

function table(header: readonly string[], rows: readonly string[][]): string {
  const separator = header.map(() => "---");
  return [header, separator, ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function renderCoverage(data: RawData): string {
  const liveByLeague = new Map<string, number>();
  for (const row of data.channels) {
    liveByLeague.set(
      row.competition,
      (liveByLeague.get(row.competition) ?? 0) + row.n,
    );
  }
  return table(
    ["Code", "Pays", "Saisons", "Matchs", "Mi-temps", "Sélections live"],
    [...data.coverage]
      .sort((a, b) => b.finished - a.finished)
      .map((row) => [
        row.competition,
        row.country,
        String(row.seasons),
        String(row.finished),
        pct(row.withHalfTime / row.finished, 0),
        String(liveByLeague.get(row.competition) ?? 0),
      ]),
  );
}

function renderSignatures(signatures: readonly LeagueSignature[]): string {
  return table(
    ["Ligue", "Issue", "Taux ligue", "Taux global", "Écart", "Écart max saison", "n"],
    signatures
      .filter((row) => row.stable && row.significant && row.n >= 500)
      .slice(0, 45)
      .map((row) => [
        row.competition,
        row.outcome,
        pct(row.rate),
        pct(row.baseline),
        signed(row.delta),
        pct(row.seasonSpread),
        String(row.n),
      ]),
  );
}

function renderMarketEdge(cells: readonly MarketEdgeCell[]): string {
  return table(
    ["Ligue", "Marché", "Choix", "n", "Réalisé", "Implicite", "Écart", "Cote"],
    cells
      .filter((cell) => cell.n >= MIN_EDGE_OBSERVATIONS && cell.beatsMarket)
      .slice(0, 30)
      .map((cell) => [
        cell.competition,
        cell.marketKey,
        cell.pick,
        String(cell.n),
        pct(cell.realised),
        pct(cell.implied),
        signed(cell.delta),
        num(cell.avgOdds),
      ]),
  );
}

function renderExoticMarkets(rows: readonly ExoticMarket[]): string {
  return table(
    [
      "Marché",
      "Paris",
      "Cote",
      "Réalisé",
      "Implicite brut",
      "ROI",
      "Erreur type",
      "ROI A",
      "ROI B",
    ],
    rows.map((row) => [
      row.market,
      String(row.bets),
      num(row.avgOdds),
      pct(row.realised),
      pct(row.implied),
      pct(row.roi),
      pct(row.standardError),
      pct(row.roiA),
      pct(row.roiB),
    ]),
  );
}

function renderChannelRoi(rows: readonly ChannelRoi[]): string {
  return table(
    [
      "Canal",
      "Jambes",
      "ROI jambe",
      "Erreur type",
      "ROI période A",
      "ROI période B",
      "Cote",
      "Réalisé",
      "Annoncé",
    ],
    rows.map((row) => [
      row.channel,
      String(row.legs),
      pct(row.roi),
      pct(row.standardError),
      pct(row.roiA),
      pct(row.roiB),
      num(row.avgOdds),
      pct(row.realised),
      pct(row.announced),
    ]),
  );
}

/**
 * Conclusion mécanique de la table précédente. Le canal de référence est le
 * meilleur de ceux dont les DEUX périodes sont mesurées : un canal qui n'a
 * qu'une période ne peut pas avoir répliqué, et le prendre pour référence
 * reproduirait le biais de sélection que ce rapport documente.
 */
function renderRoiVerdict(
  rows: readonly ChannelRoi[],
  overround: number,
): string {
  const measured = rows.filter(
    (row) => row.roiA !== null && row.roiB !== null,
  );
  const replicated = measured.filter((row) => row.replicated);
  const best = measured[0];
  if (!best) return "Aucun canal n'a ses deux périodes mesurées.";
  const compose = (legs: number): string => pct((1 + best.roi) ** legs - 1);
  const single = rows.filter(
    (row) => row.roi > 0 && (row.roiA === null || row.roiB === null),
  );
  const watchlist =
    single.length === 0
      ? ""
      : ` ${single
          .map(
            (row) =>
              `${row.channel} affiche ${pct(row.roi)} par jambe (erreur type ${pct(row.standardError)}) sur une seule période : à surveiller, pas à conclure`,
          )
          .join(" ; ")}.`;
  const headline =
    replicated.length === 0
      ? `Aucun des ${measured.length} canaux mesurés sur les deux périodes ne tient un ROI par jambe positif.`
      : `${replicated.length} canaux sur ${measured.length} tiennent un ROI par jambe positif sur les deux périodes.`;
  return `${headline} Le meilleur, ${best.channel}, est à ${pct(best.roi)} par
jambe pour une erreur type de ${pct(best.standardError)}, soit
${pct(Math.max(0, -best.roi))} sous l'équilibre, face à une marge de marché de
${pct(overround - 1)}. Composé tel quel, ce ROI donne ${compose(2)} à deux
jambes, ${compose(4)} à quatre et ${compose(8)} à huit : la composition ne crée
pas d'espérance, elle multiplie celle des jambes.${watchlist}`;
}

function renderDeciles(rows: readonly EdgeDecileRow[]): string {
  return table(
    ["Décile", "n", "Edge annoncé", "Implicite", "Annoncé", "Réalisé", "ROI jambe"],
    rows.map((row) => [
      String(row.decile),
      String(row.n),
      signed(row.claimedEdge),
      pct(row.implied),
      pct(row.announced),
      pct(row.realised),
      pct(row.legRoi),
    ]),
  );
}

function weightedOverround(rows: readonly OverroundRow[]): number {
  const fixtures = rows.reduce((sum, row) => sum + row.fixtures, 0);
  if (fixtures === 0) return 1;
  return (
    rows.reduce((sum, row) => sum + row.overround * row.fixtures, 0) / fixtures
  );
}

function renderMargins(rows: readonly OverroundRow[]): string {
  return table(
    ["Marché", "Rencontres", "Somme des implicites", "Marge par jambe"],
    rows.map((row) => [
      row.marketKey,
      String(row.fixtures),
      num(row.overround, 4),
      pct(1 - 1 / row.overround),
    ]),
  );
}

function renderLegCost(overround: number): string {
  return table(
    ["Jambes", "Cote par jambe", "Espérance sans edge", "Edge requis par jambe"],
    Array.from({ length: MAX_COUPON_LEGS - 1 }, (_, index) => index + 2).map(
      (legs) => [
        String(legs),
        num(COUPON_TARGET_ODDS ** (1 / legs)),
        pct(1 / overround ** legs - 1),
        pct(overround - 1),
      ],
    ),
  );
}

type Analysis = {
  outcomes: OutcomeStat[];
  signatures: LeagueSignature[];
  channelCells: ChannelCell[];
  marketEdgeCells: MarketEdgeCell[];
  efficiency: MarketEfficiency;
  channelRoi: ChannelRoi[];
  exoticMarkets: ExoticMarket[];
  exoticScan: ExoticScan;
  overround: number;
};

function analyse(data: RawData): Analysis {
  const outcomes = buildOutcomeStats(data.baseRates);
  const channelCells = buildChannelCells(data.channels);
  const marketEdgeCells = buildMarketEdgeCells(data.marketEdge);
  return {
    outcomes,
    signatures: buildSignatures(outcomes, buildBaselines(outcomes)),
    channelCells,
    marketEdgeCells,
    efficiency: measureEfficiency(marketEdgeCells),
    channelRoi: buildChannelRoi(data.channels),
    exoticMarkets: buildExoticMarkets(data.exoticMarkets),
    exoticScan: scanExoticCells(data.exoticMarkets),
    overround: weightedOverround(data.overround),
  };
}

function renderMarkdown(data: RawData, analysis: Analysis): string {
  const bets = data.channels.reduce((sum, row) => sum + row.n, 0);
  const fixtures = data.coverage.reduce((sum, row) => sum + row.finished, 0);
  const priced = data.marketEdge.reduce((sum, row) => sum + row.n, 0);
  const exoticBets = data.exoticMarkets.reduce((sum, row) => sum + row.n, 0);
  const cells = analysis.channelCells.filter(
    (cell) => cell.n >= MIN_CELL_OBSERVATIONS,
  );
  const median = [...analysis.channelCells]
    .map((cell) => cell.n)
    .sort((first, second) => first - second)[
    Math.floor(analysis.channelCells.length / 2)
  ];
  const scan = analysis.exoticScan;
  const efficiency = analysis.efficiency;

  return `# Rapport par championnat — ${REPORT_VERSION}

Régénérable : \`pnpm --filter @evcore/backtest-core report:league\`.
Requêtes : \`packages/backtest-core/scripts/league-report/*.sql\`.

## Périmètre

- ${data.coverage.length} championnats, ${fixtures} matchs terminés.
- ${bets} paris uniques du moteur, analysés avant le coup d'envoi et réglés.
- ${priced} issues cotées sur les marchés à consensus (1X2, over/under, BTTS,
  mi-temps).
- ${exoticBets} issues cotées sur les marchés exotiques.
- Coupure de réplication : ${SPLIT_DATE} — période A avant, période B après.

Deux exclusions structurent tout le rapport :

1. Les rétro-analyses du 2026-06-30 sur des matchs déjà joués sont écartées :
   elles ont été produites après les résultats.
2. **Une rencontre est ré-analysée 5 à 7 fois avant son coup d'envoi**, et
   chaque analyse réécrit une ligne de \`ChannelSelection\`. Seule la dernière
   analyse avant le coup d'envoi est retenue. Sans cette déduplication le même
   pari compte six fois, les erreurs types sont divisées par ~2,4 et des blocs
   entièrement corrélés passent pour un échantillon.

## 1. Couverture

${renderCoverage(data)}

## 2. Signature de championnat (taux de base)

Issues où le championnat s'écarte du taux global, avec un écart stable d'une
saison à l'autre (chi-deux d'homogénéité p >= 0,05) et un intervalle de Wilson
qui exclut le taux global. Ces taux ne dépendent d'aucun modèle et reposent
sur toutes les saisons en base : ce sont les mesures les plus solides du
rapport.

${renderSignatures(analysis.signatures)}

## 3. Le marché price-t-il déjà ces tendances ?

Sur ${efficiency.cells} cellules championnat x marché d'au moins
${MIN_EDGE_OBSERVATIONS} issues, comparées à la probabilité implicite
normalisée (marge retirée) :

- ${efficiency.beatingMarket} la dépassent, soit
  ${pct(efficiency.beatingMarket / Math.max(efficiency.cells, 1))} — le pile ou
  face attendu si le marché ne se trompe nulle part ;
- ${efficiency.significant} le font significativement à 95 %, pour
  ${efficiency.expectedByChance.toFixed(1)} attendues par pur hasard ;
- l'écart moyen sur ${efficiency.observations} issues est de
  ${signed(efficiency.meanDelta)}.

Le consensus d'avant match est donc calibré au niveau championnat x marché.
Les tendances du paragraphe 2 sont réelles, mais déjà dans la cote. Les
cellules ci-dessous sont listées pour mémoire : leur nombre est celui du
hasard.

${renderMarketEdge(analysis.marketEdgeCells)}

## 4. Les marchés exotiques sont-ils moins bien price ?

Hypothèse testée : un marché secondaire, moins liquide, serait moins bien
tenu. La comparaison se fait ici contre la probabilité implicite **brute**
(1 / cote) : la question n'est pas la calibration mais la jouabilité. Le ROI
est celui d'une mise sur chaque choix coté, marge comprise.

${renderExoticMarkets(analysis.exoticMarkets)}

C'est l'inverse de l'hypothèse. La marge croît avec l'exotisme du marché, et
le résultat se reproduit à l'identique sur les deux périodes : ce n'est pas du
bruit, c'est la grille tarifaire du bookmaker.

Balayage des ${scan.cells} cellules championnat x marché x choix d'au moins
${MIN_EXOTIC_CELL} paris : ${scan.positive} au ROI positif,
${scan.significant} significatives à 95 % pour
${scan.expectedByChance.toFixed(1)} attendues par hasard, dont
${scan.replicated} positives sur les deux périodes. Aucune cellule exotique
n'est jouable.

## 5. ROI au niveau jambe, par canal

Le seul niveau où l'échantillon a de la puissance, et sur paris dédupliqués.
Un canal doit battre la marge du paragraphe 6, soit environ
${pct(analysis.overround - 1)} par jambe, pour qu'un coupon composé de ses
jambes ait une espérance positive.

${renderChannelRoi(analysis.channelRoi)}

${renderRoiVerdict(analysis.channelRoi, analysis.overround)}

## 6. L'edge annoncé est-il prédictif ?

Paris dédupliqués, classés par edge annoncé (probabilité du moteur moins
probabilité implicite de la cote), du plus faible au plus fort.

${renderDeciles(data.edgeDeciles)}

Le taux réalisé suit la colonne implicite, pas la colonne annoncée. Le décile
qui perd le moins est celui où le moteur annonce **moins** que le marché. Ce
résultat reproduit sur données fraîches l'audit du 2026-08-22 : l'edge annoncé
n'est pas un signal de sélection.

## 7. Ce que la marge impose au coupon

${renderMargins(data.overround)}

${renderLegCost(analysis.overround)}

À cote cible égale, chaque jambe supplémentaire paie la marge une fois de
plus. Un coupon de cote ${COUPON_TARGET_ODDS} construit en 8 jambes part de
${pct(1 / analysis.overround ** 8 - 1)} d'espérance, contre
${pct(1 / analysis.overround ** 2 - 1)} en 2 jambes. Le nombre de jambes est
le premier levier, avant tout choix de championnat ou de marché.

## 8. Ce que les données ne permettent pas encore de dire

Une fois les ré-analyses dédupliquées, la cellule médiane championnat x canal
x marché contient **${median ?? 0} paris**, et ${cells.length} cellules
seulement sur ${analysis.channelCells.length} atteignent
${MIN_CELL_OBSERVATIONS} paris. Il n'existe donc pas encore de trace par
championnat exploitable au niveau canal : toute table à ce grain listerait des
extrêmes de tirage. Les conclusions par championnat du présent rapport
viennent toutes du paragraphe 2 (taux de base, plusieurs saisons) et du
paragraphe 3 (cotes, plusieurs dizaines de milliers d'issues).

## Limites

- La trace du moteur ne couvre que juillet à septembre 2026 : une seule
  fenêtre, pas de saison complète, pas de cycle hiver/été.
- Les marchés exotiques ne sont cotés que depuis le 2026-07-19 pour la
  plupart, à l'exception d'OVER_UNDER_HT (2023) et HALF_TIME_FULL_TIME
  (2026-04).
- Le paragraphe 4 mesure la marge d'une mise sur chaque choix coté ; il
  démontre le coût d'entrée, pas l'impossibilité d'une stratégie sélective.
- Le paragraphe 7 suppose des jambes indépendantes, ce que des jambes du même
  match ou de la même journée ne sont pas.
`;
}

async function main(): Promise<void> {
  const dir = offlineDir();
  const data = dir ? loadOffline(dir) : await loadFromDatabase();
  const analysis = analyse(data);
  const reportsDir = join(SCRIPT_DIR, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `${REPORT_VERSION}.json`),
    `${JSON.stringify({ version: REPORT_VERSION, ...analysis }, null, 2)}\n`,
  );
  const docsDir = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits", "2026-09-15");
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, "LEAGUE-REPORT.md"), renderMarkdown(data, analysis));
  console.log(
    `${data.coverage.length} championnats, ${analysis.channelCells.length} cellules canal, ${analysis.marketEdgeCells.length} cellules marché.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
