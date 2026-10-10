/**
 * CLV par sélection de canal (chantier E, tâches E-2 et E-3).
 *
 * Même lecture que `report:coupon-clv`, sur la population qui a la
 * puissance : les sélections de canal dédupliquées (33 000 paris réglés au
 * 2026-10-05, contre 1 300 jambes de coupon). Le CLV ne dépend pas du
 * résultat, donc son erreur type se compte en dixièmes de point sur
 * quelques centaines de sélections.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:selection-clv
 *   pnpm --filter @evcore/backtest-core report:selection-clv -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUERY_FILE = "12-selection-clv.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Acceptation de E-2 : part des sélections réglées avec une clôture. */
const COVERAGE_TARGET = 0.8;

type Row = {
  channel: string;
  market: string | null;
  selections: number;
  withProvenance: number;
  withClosing: number;
  meanClv: number | null;
  seClv: number | null;
  hitRate: number | null;
  meanClosingFair: number | null;
  meanOdds: number | null;
  meanClosingOdds: number | null;
};

function offlineDir(): string | null {
  const index = process.argv.indexOf("--from");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--from requiert un répertoire");
  return value;
}

async function load(dir: string | null): Promise<Row[]> {
  if (dir) {
    return JSON.parse(
      readFileSync(join(dir, QUERY_FILE.replace(/\.sql$/, ".json")), "utf8"),
    ) as Row[];
  }
  const { prisma } = await import("@evcore/db");
  try {
    return await prisma.$queryRawUnsafe<Row[]>(
      readFileSync(join(SCRIPT_DIR, "league-report", QUERY_FILE), "utf8"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function pct(value: number | null, digits = 1): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits)} %`;
}

function num(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

function clv(row: Row): string {
  if (row.meanClv === null) return "—";
  const se = row.seClv === null ? "" : ` ± ${(row.seClv * 100).toFixed(1)}`;
  return `${(row.meanClv * 100).toFixed(2)}${se} %`;
}

function render(rows: readonly Row[]): string {
  const header = [
    "Canal",
    "Marché",
    "Sélections",
    "Book connu",
    "Avec clôture",
    "CLV moyen (± ET)",
    "Taux de réussite",
    "P(clôture) moyenne",
    "Cote prise",
    "Cote de clôture",
  ];
  const body = rows.map((row) => [
    row.channel,
    row.market ?? "**tous**",
    String(row.selections),
    pct(row.withProvenance / row.selections, 0),
    `${row.withClosing} (${pct(row.withClosing / row.selections, 0)})`,
    clv(row),
    pct(row.hitRate),
    pct(row.meanClosingFair),
    num(row.meanOdds),
    num(row.meanClosingOdds),
  ]);
  const table = [header, header.map(() => "---"), ...body]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
  const totals = rows.filter((row) => row.market === null);
  const covered = totals.filter(
    (row) =>
      row.selections > 0 && row.withClosing / row.selections >= COVERAGE_TARGET,
  );

  return `# CLV par sélection de canal

Régénérable : \`pnpm --filter @evcore/backtest-core report:selection-clv\`.

Le CLV d'une sélection est sa cote × la probabilité de clôture sans marge
− 1, chez le book qui a servi la cote quand il est connu. Positif, le prix
pris battait ce que le marché a fini par estimer. « Book connu » est la part
des sélections dont la provenance du prix est enregistrée (aucune avant le
2026-10-08) ; « Avec clôture » celle qui a trouvé un groupe d'issues complet
à moins de 90 min du coup d'envoi. Tant que cette part est basse, la
colonne CLV porte sur un échantillon qui n'est pas la population.

${table}

**${covered.length} cana${covered.length > 1 ? "ux" : "l"} sur ${totals.length}** atteint la couverture
cible de ${pct(COVERAGE_TARGET, 0)} (acceptation de E-2).
`;
}

async function main(): Promise<void> {
  const rows = await load(offlineDir());
  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "SELECTION-CLV.md"), render(rows));
  for (const row of rows.filter((r) => r.market === null)) {
    console.log(
      `${row.channel.padEnd(20)}${String(row.selections).padStart(7)} sél.${String(row.withClosing).padStart(7)} avec clôture   CLV ${clv(row)}`,
    );
  }
  console.log("\nRapport écrit : docs/audits/SELECTION-CLV.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
