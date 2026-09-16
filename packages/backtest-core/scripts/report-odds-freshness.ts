/**
 * Fraîcheur des cotes par book (chantier B, tâche B-9).
 *
 * Mesure la distance entre le dernier relevé d'une rencontre et son coup
 * d'envoi, sur les 30 derniers jours. C'est l'indicateur de succès du
 * balayage de clôture : tant que `closingRate` reste à zéro, il n'existe
 * aucune ligne de clôture et le CLV est incalculable.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:freshness
 *   pnpm --filter @evcore/backtest-core report:freshness -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUERY_FILE = "10-odds-freshness.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Cible du chantier : part des rencontres avec un relevé de clôture. */
const CLOSING_TARGET = 0.7;

type Row = {
  bookmaker: string;
  fixtures: number;
  snapshotsPerFixture: number;
  medianHoursBefore: number;
  p10HoursBefore: number;
  p90HoursBefore: number;
  closingRate: number;
  withinNinetyMinutesRate: number;
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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

function render(rows: readonly Row[]): string {
  const header = [
    "Book",
    "Rencontres",
    "Relevés / rencontre",
    "Dernier relevé (h, médiane)",
    "p10",
    "p90",
    "Ligne de clôture",
    "Relevé < 90 min",
  ];
  const body = rows.map((row) => [
    row.bookmaker,
    String(row.fixtures),
    row.snapshotsPerFixture.toFixed(1),
    row.medianHoursBefore.toFixed(1),
    row.p10HoursBefore.toFixed(1),
    row.p90HoursBefore.toFixed(1),
    pct(row.closingRate),
    pct(row.withinNinetyMinutesRate),
  ]);
  const table = [header, header.map(() => "---"), ...body]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
  const reached = rows.filter((row) => row.closingRate >= CLOSING_TARGET);

  return `# Fraîcheur des cotes par book

Régénérable : \`pnpm --filter @evcore/backtest-core report:freshness\`.
Fenêtre : 30 derniers jours.

« Ligne de clôture » est la part des rencontres dont le dernier relevé tombe
dans le dernier quart d'heure avant le coup d'envoi. C'est la mesure de succès
du balayage de clôture : sans elle, le CLV — le seul indicateur qui dise à
l'avance si un pari a de la valeur — ne peut pas être calculé, et comparer
deux books relevés à des heures différentes ne mesure que du décalage
temporel.

${table}

**${reached.length} book${reached.length > 1 ? "s" : ""} sur ${rows.length}** atteint la cible de
${pct(CLOSING_TARGET)} de lignes de clôture.
`;
}

async function main(): Promise<void> {
  const rows = await load(offlineDir());
  const directory = join(
    SCRIPT_DIR,
    "..",
    "..",
    "..",
    "docs",
    "audits",
    "2026-09-15",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "ODDS-FRESHNESS.md"), render(rows));
  for (const row of rows) {
    console.log(
      `${row.bookmaker.padEnd(16)}${row.medianHoursBefore.toFixed(1).padStart(8)} h${pct(row.closingRate).padStart(10)} de clôture`,
    );
  }
  console.log("\nRapport écrit : docs/audits/2026-09-15/ODDS-FRESHNESS.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
