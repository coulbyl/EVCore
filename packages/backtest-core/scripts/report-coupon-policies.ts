/**
 * Comparaison par jambe des politiques de coupon : LLM publié (v1, v1.1),
 * ombre déterministe 5-7, ombre v2 (classement par probabilité sans gate
 * EV), et depuis le 2026-10-11 les sélections LLM non publiées. C'est la
 * comparaison que CLAUDE.md exige — jamais un ROI de coupon.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:coupon-policies
 *   pnpm --filter @evcore/backtest-core report:coupon-policies -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUERY_FILE = "13-coupon-policies-per-leg.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

type Row = {
  policy: string;
  legs: number;
  settled: number;
  hitRate: number | null;
  announced: number | null;
  meanOdds: number | null;
  meanImplied: number | null;
  roiPerLeg: number | null;
  roiSe: number | null;
  withClosing: number;
  clvTaken: number | null;
  clvAtClose: number | null;
  firstDay: Date | string | null;
  lastDay: Date | string | null;
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

function day(value: Date | string | null): string {
  if (value === null) return "—";
  return (value instanceof Date ? value.toISOString() : String(value)).slice(
    0,
    10,
  );
}

function render(rows: readonly Row[]): string {
  const header = [
    "Politique",
    "Jambes",
    "Réglées",
    "Réussite",
    "Annoncé",
    "Cote misée",
    "1 / cote",
    "ROI / jambe (± ET)",
    "Avec clôture",
    "CLV misé",
    "À la clôture",
    "Période",
  ];
  const body = rows.map((row) => [
    row.policy,
    String(row.legs),
    String(row.settled),
    pct(row.hitRate),
    pct(row.announced),
    row.meanOdds === null ? "—" : row.meanOdds.toFixed(2),
    pct(row.meanImplied),
    row.roiPerLeg === null
      ? "—"
      : `${(row.roiPerLeg * 100).toFixed(1)}${row.roiSe === null ? "" : ` ± ${(row.roiSe * 100).toFixed(1)}`} %`,
    String(row.withClosing),
    pct(row.clvTaken, 2),
    pct(row.clvAtClose, 2),
    `${day(row.firstDay)} → ${day(row.lastDay)}`,
  ]);
  const table = [header, header.map(() => "---"), ...body]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
  return `# Politiques de coupon, par jambe

Régénérable : \`pnpm --filter @evcore/backtest-core report:coupon-policies\`.

Une jambe = une sélection de canal misée au meilleur prix du moment. Le ROI
par jambe a une erreur type de l'ordre de 1,2 / √n ; un ROI de coupon n'a
aucune puissance à nos volumes et n'apparaît pas ici. « CLV misé » est la cote
misée × la probabilité de clôture sans marge − 1 ; « À la clôture » la même
valeur pour un pari pris au prix de clôture, c'est-à-dire la marge payée : la
barre est la marge, jamais zéro. Les ombres ne sont jamais publiées ; la
relance de 21:15 est dédoublonnée (première tentative par jour et politique).

${table}
`;
}

async function main(): Promise<void> {
  const rows = await load(offlineDir());
  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "COUPON-POLICIES.md"), render(rows));
  for (const row of rows) {
    console.log(
      `${row.policy.padEnd(36)}${String(row.legs).padStart(6)} jambes${String(row.settled).padStart(6)} réglées   réussite ${pct(row.hitRate)}   ROI/jambe ${row.roiPerLeg === null ? "—" : (row.roiPerLeg * 100).toFixed(1) + " %"}`,
    );
  }
  console.log("\nRapport écrit : docs/audits/COUPON-POLICIES.md");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
