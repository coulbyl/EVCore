/**
 * CLV par jambe de coupon (chantier E, tâches E-2 et E-3).
 *
 * Lit les colonnes de clôture que le règlement écrit sur chaque jambe
 * (`closingLineValue`, `closingOdds`, `closingBookmaker`) et les agrège par
 * source de coupon (LLM, compositeur par le prix) et par marché. C'est la
 * comparaison par jambe que CLAUDE.md exige entre les deux générateurs — le
 * ROI de coupon n'a aucune puissance à nos volumes.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:coupon-clv
 *   pnpm --filter @evcore/backtest-core report:coupon-clv -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUERY_FILE = "11-coupon-leg-clv.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Acceptation de E-2 : part des jambes réglées avec une clôture. */
const COVERAGE_TARGET = 0.8;

type Row = {
  source: string;
  market: string | null;
  legs: number;
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
    "Source",
    "Marché",
    "Jambes",
    "Avec clôture",
    "CLV moyen (± ET)",
    "Taux de réussite",
    "P(clôture) moyenne",
    "Cote prise",
    "Cote de clôture",
  ];
  const body = rows.map((row) => [
    row.source,
    row.market ?? "**toutes**",
    String(row.legs),
    `${row.withClosing} (${pct(row.withClosing / row.legs, 0)})`,
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
    (row) => row.legs > 0 && row.withClosing / row.legs >= COVERAGE_TARGET,
  );

  return `# CLV par jambe de coupon

Régénérable : \`pnpm --filter @evcore/backtest-core report:coupon-clv\`.

Le CLV d'une jambe est la cote prise × la probabilité de clôture sans marge
− 1 : positif, le prix pris battait ce que le marché a fini par estimer. Il
ne dépend pas du résultat du match, donc son erreur type se compte en
dixièmes de point là où un ROI en demande des dizaines. « Avec clôture » est
la part des jambes qui ont trouvé un groupe d'issues complet à moins de
90 min du coup d'envoi ; tant qu'elle est basse, la colonne CLV porte sur un
échantillon qui n'est pas la population.

${table}

**${covered.length} source${covered.length > 1 ? "s" : ""} sur ${totals.length}** atteint la couverture
cible de ${pct(COVERAGE_TARGET, 0)} (acceptation de E-2).
`;
}

async function main(): Promise<void> {
  const rows = await load(offlineDir());
  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "COUPON-CLV.md"), render(rows));
  for (const row of rows.filter((r) => r.market === null)) {
    console.log(
      `${row.source.padEnd(16)}${String(row.legs).padStart(6)} jambes${String(row.withClosing).padStart(6)} avec clôture   CLV ${clv(row)}`,
    );
  }
  console.log("\nRapport écrit : docs/audits/COUPON-CLV.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
