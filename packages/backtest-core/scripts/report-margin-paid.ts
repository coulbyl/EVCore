/**
 * Marge payée contre meilleure marge disponible (chantier E, E-5/E-6).
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:margin-paid
 *   pnpm --filter @evcore/backtest-core report:margin-paid -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUERY_FILE = "14-margin-paid.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Cible E-6 : écart quotidien entre marge payée et marge minimale. */
const GAP_TARGET = 0.005;

type Row = {
  /** 3 = total, 1 = par marché, 2 = par book retenu. */
  level: number;
  market: string | null;
  bookmaker: string | null;
  selections: number;
  withMargin: number;
  marginPaid: number | null;
  marginBest: number | null;
  gap: number | null;
  gapSe: number | null;
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

function pct(value: number | null, digits = 2): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits)} %`;
}

function render(rows: readonly Row[]): string {
  const header = [
    "Marché",
    "Book",
    "Sélections",
    "Avec marge",
    "Marge payée",
    "Meilleure marge",
    "Écart (± ET)",
  ];
  const body = rows.map((row) => [
    row.level === 3 ? "**total**" : row.level === 1 ? (row.market ?? "—") : "—",
    row.level === 3
      ? "**tous**"
      : row.level === 2
        ? (row.bookmaker ?? "(inconnu)")
        : "—",
    String(row.selections),
    `${row.withMargin} (${pct(row.selections > 0 ? row.withMargin / row.selections : null, 0)})`,
    pct(row.marginPaid),
    pct(row.marginBest),
    row.gap === null
      ? "—"
      : `${(row.gap * 100).toFixed(2)}${row.gapSe === null ? "" : ` ± ${(row.gapSe * 100).toFixed(2)}`} pt`,
  ]);
  const table = [header, header.map(() => "---"), ...body]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
  const total = rows.find(
    (row) => row.market === null && row.bookmaker === null,
  );
  const verdict =
    total === undefined || total.gap === null
      ? "Aucune sélection ne porte encore sa marge : les colonnes sont écrites par le moteur depuis le 2026-10-11."
      : total.gap <= GAP_TARGET
        ? `Écart moyen ${(total.gap * 100).toFixed(2)} pt : sous la cible de ${(GAP_TARGET * 100).toFixed(1)} pt (E-6).`
        : `Écart moyen ${(total.gap * 100).toFixed(2)} pt : au-dessus de la cible de ${(GAP_TARGET * 100).toFixed(1)} pt (E-6) — le book retenu n'est pas le moins cher.`;

  return `# Marge payée contre meilleure marge disponible

Régénérable : \`pnpm --filter @evcore/backtest-core report:margin-paid\`.
Fenêtre : 30 derniers jours, sélections dédupliquées.

La marge payée est la surcote du groupe d'issues complet chez le book qui a
servi la cote de la sélection ; la meilleure marge est la plus basse qu'un
book du relevé offrait sur ce groupe au même instant. L'écart est ce que le
choix du book coûte face au meilleur prix disponible.

${table}

${verdict}
`;
}

async function main(): Promise<void> {
  const rows = await load(offlineDir());
  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "MARGIN-PAID.md"), render(rows));
  for (const row of rows.filter((r) => r.level !== 2)) {
    console.log(
      `${(row.level === 3 ? "total" : (row.market ?? "—")).padEnd(22)}${String(row.selections).padStart(7)} sél.   payée ${pct(row.marginPaid)}   meilleure ${pct(row.marginBest)}`,
    );
  }
  console.log("\nRapport écrit : docs/audits/MARGIN-PAID.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
