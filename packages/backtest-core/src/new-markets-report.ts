import Decimal from "decimal.js";
import { BetStatus } from "@evcore/analysis-core";

// report:new-markets (plan des stratégies, phase 3): per market, book and
// odds band, the market's frequency without its margin against the
// realised one. Pure: the script loads the closing lines and the outcomes.

/** A closing price of one outcome, the odds as stored (decimal text). */
export type ClosingQuote = {
  fixtureId: string;
  bookmaker: string;
  market: string;
  pick: string;
  line: number | null;
  odds: string;
};

export type OddsBand = { label: string; min: number; max: number };

export const ODDS_BANDS: readonly OddsBand[] = [
  { label: "1,00–1,50", min: 1, max: 1.5 },
  { label: "1,50–2,00", min: 1.5, max: 2 },
  { label: "2,00–3,00", min: 2, max: 3 },
  { label: "3,00–5,00", min: 3, max: 5 },
  { label: "5,00–10,00", min: 5, max: 10 },
  { label: "10,00 +", min: 10, max: Number.POSITIVE_INFINITY },
];

/**
 * Markets whose outcomes form a closed group (they add up to one): the
 * margin comes off by normalising the group. The others (a scorer, at
 * least N shots) price one side only — 1/odds is all there is, margin
 * included; and first scorer's group misses the players we could not
 * identify, so it is not closed either.
 */
const CLOSED_GROUPS: Readonly<Record<string, readonly string[]>> = {
  CORNERS_HOME: ["OVER", "UNDER"],
  CORNERS_AWAY: ["OVER", "UNDER"],
  CORNERS_1X2: ["HOME", "DRAW", "AWAY"],
  MINUTE_1X2: ["HOME", "DRAW", "AWAY"],
};

const groupKey = (quote: ClosingQuote): string =>
  [quote.fixtureId, quote.bookmaker, quote.market, quote.line ?? ""].join("|");

export const quoteKey = (quote: ClosingQuote): string =>
  [groupKey(quote), quote.pick].join("|");

/**
 * Frequency without margin of each quote of a complete closed group
 * (proportional normalisation of 1/odds); quotes of an incomplete or open
 * group are absent.
 */
export function fairProbabilities(
  quotes: readonly ClosingQuote[],
): Map<string, Decimal> {
  const groups = new Map<string, ClosingQuote[]>();
  for (const quote of quotes) {
    if (CLOSED_GROUPS[quote.market] === undefined) continue;
    const key = groupKey(quote);
    groups.set(key, [...(groups.get(key) ?? []), quote]);
  }
  const fair = new Map<string, Decimal>();
  for (const group of groups.values()) {
    const [first] = group;
    if (first === undefined) continue;
    const expected = CLOSED_GROUPS[first.market] ?? [];
    const picks = new Set(group.map((quote) => quote.pick));
    if (
      group.length !== expected.length ||
      !expected.every((pick) => picks.has(pick))
    ) {
      continue;
    }
    const implied = group.map((quote) => new Decimal(1).div(quote.odds));
    const total = implied.reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0),
    );
    group.forEach((quote, index) => {
      const value = implied[index];
      if (value !== undefined) fair.set(quoteKey(quote), value.div(total));
    });
  }
  return fair;
}

/** Wilson score interval at 95 %. */
export function wilsonInterval(
  successes: number,
  trials: number,
): { low: number; high: number } | null {
  if (trials === 0) return null;
  const z = 1.96;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) /
    denominator;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export type NewMarketsReportRow = {
  market: string;
  bookmaker: string;
  band: string;
  /** Closing quotes in the cell, whatever their outcome. */
  quotes: number;
  /** Refunded (did not play, met line). */
  voids: number;
  /** Not known (facts missing): left out, never a loss. */
  unknown: number;
  /** Won or lost: the set every figure below is computed on. */
  settled: number;
  won: number;
  /** Mean 1/odds, margin included. */
  implied: number | null;
  /** Mean frequency without margin, on `fairSettled` of the settled. */
  fair: number | null;
  fairSettled: number;
  realised: number | null;
  ciLow: number | null;
  ciHigh: number | null;
};

/**
 * One row per market, book and odds band. Every figure next to `settled`
 * comes from those settled quotes only (refunds and unknowns are counted
 * apart).
 */
export function buildNewMarketsReport(input: {
  quotes: readonly ClosingQuote[];
  outcomeOf: (quote: ClosingQuote) => BetStatus | null;
}): NewMarketsReportRow[] {
  const fair = fairProbabilities(input.quotes);
  type Cell = {
    market: string;
    bookmaker: string;
    band: OddsBand;
    quotes: number;
    voids: number;
    unknown: number;
    won: number;
    settled: number;
    implied: Decimal;
    fair: Decimal;
    fairSettled: number;
  };
  const cells = new Map<string, Cell>();

  for (const quote of input.quotes) {
    const odds = new Decimal(quote.odds);
    if (!odds.gt(1)) continue;
    const band = ODDS_BANDS.find(
      (candidate) => odds.gte(candidate.min) && odds.lt(candidate.max),
    );
    if (band === undefined) continue;
    const key = [quote.market, quote.bookmaker, band.label].join("|");
    const cell = cells.get(key) ?? {
      market: quote.market,
      bookmaker: quote.bookmaker,
      band,
      quotes: 0,
      voids: 0,
      unknown: 0,
      won: 0,
      settled: 0,
      implied: new Decimal(0),
      fair: new Decimal(0),
      fairSettled: 0,
    };
    cells.set(key, cell);
    cell.quotes++;
    const outcome = input.outcomeOf(quote);
    if (outcome === null) {
      cell.unknown++;
      continue;
    }
    if (outcome === BetStatus.VOID || outcome === BetStatus.PENDING) {
      cell.voids++;
      continue;
    }
    cell.settled++;
    if (outcome === BetStatus.WON) cell.won++;
    cell.implied = cell.implied.plus(new Decimal(1).div(odds));
    const fairValue = fair.get(quoteKey(quote));
    if (fairValue !== undefined) {
      cell.fair = cell.fair.plus(fairValue);
      cell.fairSettled++;
    }
  }

  const bandOrder = (band: OddsBand) => ODDS_BANDS.indexOf(band);
  return [...cells.values()]
    .sort(
      (a, b) =>
        a.market.localeCompare(b.market) ||
        a.bookmaker.localeCompare(b.bookmaker) ||
        bandOrder(a.band) - bandOrder(b.band),
    )
    .map((cell) => {
      const ci = wilsonInterval(cell.won, cell.settled);
      return {
        market: cell.market,
        bookmaker: cell.bookmaker,
        band: cell.band.label,
        quotes: cell.quotes,
        voids: cell.voids,
        unknown: cell.unknown,
        settled: cell.settled,
        won: cell.won,
        implied:
          cell.settled === 0 ? null : cell.implied.div(cell.settled).toNumber(),
        fair:
          cell.fairSettled === 0
            ? null
            : cell.fair.div(cell.fairSettled).toNumber(),
        fairSettled: cell.fairSettled,
        realised: cell.settled === 0 ? null : cell.won / cell.settled,
        ciLow: ci?.low ?? null,
        ciHigh: ci?.high ?? null,
      };
    });
}

const pct = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)} %`;

/** The report as a Markdown table, with its reading rules. */
export function renderNewMarketsReport(input: {
  rows: readonly NewMarketsReportRow[];
  from: Date;
  to: Date;
  maxHoursBeforeKickoff: number;
}): string {
  const header = [
    "Marché",
    "Book",
    "Cote",
    "Cotes",
    "Réglées",
    "Remb.",
    "Inconnues",
    "1/cote",
    "Sans marge (n)",
    "Réalisé [IC 95 %]",
  ];
  const body = input.rows.map((row) => [
    row.market,
    row.bookmaker,
    row.band,
    String(row.quotes),
    String(row.settled),
    String(row.voids),
    String(row.unknown),
    pct(row.implied),
    row.fair === null ? "—" : `${pct(row.fair)} (${row.fairSettled})`,
    row.realised === null
      ? "—"
      : `${pct(row.realised)} [${pct(row.ciLow)} – ${pct(row.ciHigh)}]`,
  ]);
  const table = [header, header.map(() => "---"), ...body]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
  const day = (date: Date) => date.toISOString().slice(0, 10);

  return `# Nouveaux marchés : fréquence du marché contre réalisé

Régénérable : \`pnpm --filter @evcore/backtest-core report:new-markets\`.
Matchs joués du ${day(input.from)} au ${day(input.to)}, dernière cote relevée au plus
${input.maxHoursBeforeKickoff} h avant le coup d'envoi (\`odds_closing_line\`).

- Une ligne par marché, book et tranche de cote ; une cote = un choix d'un
  match (les deux côtés d'une même ligne comptent chacun : l'IC suppose des
  observations indépendantes, il est donc un peu trop étroit).
- « Sans marge » : 1/cote normalisée sur le groupe d'issues complet
  (plus/moins, 1X2). Buteurs et tirs n'ont qu'un côté coté : seule la
  colonne 1/cote existe, marge comprise.
- Réalisé, 1/cote et sans marge portent sur les cotes réglées seulement ;
  remboursées (joueur absent, ligne égalée) et inconnues (données de match
  manquantes) sont comptées à part, jamais perdues.

${input.rows.length === 0 ? "Aucune cote de clôture réglable sur la fenêtre." : table}
`;
}
