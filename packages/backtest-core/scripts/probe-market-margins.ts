/**
 * Mesure la marge réelle par book et par marché, sur un échantillon de
 * rencontres tirées de la base.
 *
 * Motivation : l'inventaire de `probe-api-football.ts` montre que l'API sert
 * 33 books et 338 marchés, alors que l'ETL n'en stocke que 4 et ~18. La marge
 * est le coût d'entrée de chaque pari ; si un marché non ingéré coûte deux
 * fois moins cher, c'est le premier levier de rentabilité, avant tout modèle.
 *
 * La marge d'un marché est la somme des probabilités implicites de ses issues
 * exclusives et exhaustives, moins 1. Elle n'est calculable que sur les
 * marchés dont on sait que les issues couvrent tout l'espace — d'où la liste
 * explicite ci-dessous plutôt qu'un balayage aveugle.
 *
 * N'écrit rien en base. La clé est lue dans l'environnement, jamais affichée.
 *
 * L'échantillon est lu dans `reports/probe-fixtures.json`, une simple liste
 * d'identifiants externes de rencontres. Le régénérer :
 *
 *   docker exec evcore-postgres psql -U postgres -d evcore -t -A -c \
 *     "SELECT json_agg(t.\"externalId\") FROM (
 *        SELECT f.\"externalId\" FROM fixture f
 *        WHERE f.status='FINISHED' AND f.\"scheduledAt\" > now() - INTERVAL '30 days'
 *        ORDER BY random() LIMIT 100) t;" \
 *     > packages/backtest-core/reports/probe-fixtures.json
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core probe:margins
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;
const DELAY_MS = 1200;
const SAMPLE_SIZE = 100;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Marchés dont les issues sont exclusives et exhaustives, donc dont la somme
 * des probabilités implicites vaut 1 plus la marge. `groupBy` sépare les
 * lignes d'un même marché (chaque handicap, chaque total est son propre
 * marché à deux ou trois issues).
 */
const MARKETS: ReadonlyArray<{
  name: string;
  groupBy: "none" | "line";
  /** Somme des probabilités vraies des issues listées : 1 sauf exception. */
  total?: number;
  /**
   * Nombre d'issues attendues. Un groupe incomplet est ignoré : sommer deux
   * issues sur trois donnerait une marge négative qui n'existe pas.
   */
  outcomes: number;
}> = [
  { name: "Match Winner", groupBy: "none", outcomes: 3 },
  { name: "Asian Handicap", groupBy: "line", outcomes: 2 },
  { name: "Goals Over/Under", groupBy: "line", outcomes: 2 },
  { name: "Both Teams Score", groupBy: "none", outcomes: 2 },
  // 1X, 12 et X2 se recouvrent : leurs probabilités vraies somment à 2.
  { name: "Double Chance", groupBy: "none", total: 2, outcomes: 3 },
  { name: "First Half Winner", groupBy: "none", outcomes: 3 },
  { name: "Goals Over/Under First Half", groupBy: "line", outcomes: 2 },
  { name: "Total - Home", groupBy: "line", outcomes: 2 },
  { name: "Total - Away", groupBy: "line", outcomes: 2 },
  { name: "Corners Over Under", groupBy: "line", outcomes: 2 },
  { name: "Total Corners (1st Half)", groupBy: "line", outcomes: 2 },
  { name: "Cards Over/Under", groupBy: "line", outcomes: 2 },
  { name: "Odd/Even", groupBy: "none", outcomes: 2 },
  { name: "Odd/Even - First Half", groupBy: "none", outcomes: 2 },
  { name: "Goals Over/Under - Second Half", groupBy: "line", outcomes: 2 },
  // Trois issues exclusives et exhaustives : « Draw » / « 1st Half » /
  // « 2nd Half », et « Home » / « Away » / « No goal ».
  { name: "Highest Scoring Half", groupBy: "none", outcomes: 3 },
  { name: "Team To Score First", groupBy: "none", outcomes: 3 },
];

type OddValue = { value: string; odd: string };
type Bet = { name: string; values: OddValue[] };
type Bookmaker = { name: string; bets: Bet[] };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchOdds(fixture: number): Promise<Bookmaker[]> {
  const response = await fetch(`${BASE}/odds?fixture=${fixture}`, {
    headers: { "x-apisports-key": KEY ?? "" },
  });
  const body = (await response.json()) as {
    response?: Array<{ bookmakers?: Bookmaker[] }>;
  };
  await sleep(DELAY_MS);
  return body.response?.[0]?.bookmakers ?? [];
}

/**
 * Sépare « Over 2.5 » de « Over 3.5 » : la ligne est le nombre présent dans
 * l'intitulé de l'issue. Sans ce découpage on additionnerait des issues qui
 * ne s'excluent pas, et la marge calculée n'aurait aucun sens.
 */
function lineOf(value: string): string {
  const match = /(-?\d+(?:\.\d+)?)/.exec(value);
  return match ? match[1] ?? "" : "";
}

function marginsOf(
  bet: Bet,
  market: { groupBy: "none" | "line"; total?: number; outcomes: number },
): number[] {
  const { groupBy, outcomes } = market;
  const total = market.total ?? 1;
  const groups = new Map<string, number[]>();
  for (const entry of bet.values) {
    const odd = Number(entry.odd);
    if (!Number.isFinite(odd) || odd <= 1) continue;
    const key = groupBy === "line" ? lineOf(entry.value) : "all";
    const bucket = groups.get(key) ?? [];
    bucket.push(1 / odd);
    groups.set(key, bucket);
  }
  const margins: number[] = [];
  for (const implied of groups.values()) {
    if (implied.length !== outcomes) continue;
    margins.push(
      implied.reduce((sum, value) => sum + value, 0) / total - 1,
    );
  }
  return margins;
}

type Cell = { samples: number[]; fixtures: Set<number> };

async function main(): Promise<void> {
  if (!KEY) {
    console.error("API_FOOTBALL_KEY absente de l'environnement.");
    process.exitCode = 1;
    return;
  }
  const fixtures = JSON.parse(
    readFileSync(join(SCRIPT_DIR, "..", "reports", "probe-fixtures.json"), "utf8"),
  ) as number[];
  const sample = fixtures.slice(0, SAMPLE_SIZE);
  console.log(`Marge par book et par marché, sur ${sample.length} rencontres.`);

  const cells = new Map<string, Cell>();
  const marketsByBook = new Map<string, Set<string>>();
  for (const fixture of sample) {
    const bookmakers = await fetchOdds(fixture);
    for (const bookmaker of bookmakers) {
      const seen = marketsByBook.get(bookmaker.name) ?? new Set<string>();
      for (const bet of bookmaker.bets) seen.add(bet.name);
      marketsByBook.set(bookmaker.name, seen);
      for (const market of MARKETS) {
        const bet = bookmaker.bets.find((item) => item.name === market.name);
        if (!bet) continue;
        const key = `${bookmaker.name}||${market.name}`;
        const cell = cells.get(key) ?? { samples: [], fixtures: new Set() };
        cell.samples.push(...marginsOf(bet, market));
        cell.fixtures.add(fixture);
        cells.set(key, cell);
      }
    }
  }

  const rows = [...cells]
    .map(([key, cell]) => {
      const [book = "", market = ""] = key.split("||");
      const mean =
        cell.samples.reduce((sum, value) => sum + value, 0) /
        Math.max(cell.samples.length, 1);
      return { book, market, mean, lines: cell.samples.length, fixtures: cell.fixtures.size };
    })
    .filter((row) => row.lines >= 5)
    .sort((first, second) => first.mean - second.mean);

  console.log(
    `\n${"book".padEnd(16)}${"marché".padEnd(30)}${"lignes".padStart(8)}${"matchs".padStart(8)}${"marge".padStart(9)}`,
  );
  for (const row of rows) {
    console.log(
      `${row.book.padEnd(16)}${row.market.padEnd(30)}${String(row.lines).padStart(8)}${String(row.fixtures).padStart(8)}${`${(row.mean * 100).toFixed(2)} %`.padStart(9)}`,
    );
  }

  const coverage = [...marketsByBook].sort(
    (first, second) => second[1].size - first[1].size,
  );
  console.log("\nCouverture par book sur l'échantillon :");
  for (const [book, markets] of coverage) {
    console.log(`  ${book.padEnd(16)} ${markets.size} marchés`);
  }

  writeReport(rows, coverage, sample.length);
}

type MarginRow = {
  book: string;
  market: string;
  mean: number;
  lines: number;
  fixtures: number;
};

/**
 * Rapport durable plutôt que constante : tant qu'aucun sélecteur ne consomme
 * ce classement, une constante `PREFERRED_MARKETS` serait un réglage dormant.
 * Le chantier G la créera, alimentée par cette mesure.
 */
function writeReport(
  rows: readonly MarginRow[],
  coverage: ReadonlyArray<[string, Set<string>]>,
  sampleSize: number,
): void {
  const pct = (value: number): string => `${(value * 100).toFixed(2)} %`;
  const table = (
    header: readonly string[],
    body: readonly string[][],
  ): string =>
    [header, header.map(() => "---"), ...body]
      .map((line) => `| ${line.join(" | ")} |`)
      .join("\n");

  const cheapest = new Map<string, MarginRow>();
  for (const row of rows) {
    const current = cheapest.get(row.market);
    if (!current || row.mean < current.mean) cheapest.set(row.market, row);
  }
  const ranked = [...cheapest.values()].sort(
    (first, second) => first.mean - second.mean,
  );

  const markdown = `# Marge par marché et par book

Régénérable : \`pnpm --filter @evcore/backtest-core probe:margins\`.
Échantillon : ${sampleSize} rencontres tirées au hasard depuis la base.

La marge est la somme des probabilités implicites des issues complètes d'un
marché, moins 1. C'est le coût d'entrée de chaque jambe, avant tout modèle.
Un groupe d'issues incomplet est ignoré : sommer deux issues sur trois
produirait une marge négative qui n'existe pas.

## Le marché le moins cher, par book le moins cher

${table(
  ["Marché", "Book le moins cher", "Marge", "Lignes", "Rencontres"],
  ranked.map((row) => [
    row.market,
    row.book,
    pct(row.mean),
    String(row.lines),
    String(row.fixtures),
  ]),
)}

## Détail book x marché

${table(
  ["Book", "Marché", "Lignes", "Rencontres", "Marge"],
  rows.map((row) => [
    row.book,
    row.market,
    String(row.lines),
    String(row.fixtures),
    pct(row.mean),
  ]),
)}

## Couverture par book

${table(
  ["Book", "Marchés servis"],
  coverage.map(([book, markets]) => [book, String(markets.size)]),
)}
`;
  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits", "2026-09-15");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "MARKET-MARGINS.md"), markdown);
  console.log("\nRapport écrit : docs/audits/2026-09-15/MARKET-MARGINS.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
