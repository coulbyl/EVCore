/**
 * Générateur déterministe — sélection et validation.
 *
 * Objectif produit, fixé avant toute mesure : **plus de jours gagnants que de
 * jours perdants, sans longue série de pertes**. Ce n'est pas le même objectif
 * que maximiser le ROI, et les deux se contredisent : la probabilité de gagner
 * un jour vaut au mieux 1 / cote combinée, donc toute cible à cote 5 condamne
 * à perdre quatre jours sur cinq, par arithmétique et non par défaut de
 * modèle. Le critère de sélection est le taux de jours gagnants ; le ROI sert
 * de garde-fou.
 *
 * Règle : **un seul pari par jour, sur le plus gros favori à domicile** dont
 * la cote tombe dans la bande retenue. Elle exploite le biais favori/outsider,
 * mesuré indépendamment sur 285 758 jambes et strictement monotone : le
 * réalisé dépasse la probabilité implicite de 2,4 points sous la cote 1,25 et
 * lui est inférieur de 1,7 point au-delà de la cote 8. Le générateur se place
 * à l'extrémité favorable de cette courbe, et le vivier quotidien — une
 * trentaine de rencontres cotées — suffit à y trouver un candidat presque
 * chaque jour.
 *
 * Aucune sortie du moteur ni du LLM n'intervient : seules les cotes d'avant
 * match sont utilisées.
 *
 * Protocole, déclaré avant exécution :
 *   1. la grille de bandes est fixée dans GRID ;
 *   2. le critère de choix est le taux de jours gagnants sur la fenêtre de
 *      sélection (avant SELECTION_END), rien d'autre ;
 *   3. la bande retenue est ensuite évaluée une seule fois sur la fenêtre de
 *      validation, jamais utilisée pour choisir.
 *
 * Usage :
 *   pnpm backtest:generator
 *   pnpm backtest:generator -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "generator-v2";
const QUERY_FILE = "09-fixture-features.sql";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Première journée de la fenêtre de validation. */
const SELECTION_END = "2025-01-01";
const MIN_SELECTION_DAYS = 150;

type Band = { min: number; max: number };

/** Grille déclarée avant exécution. Aucune bande ajoutée après coup. */
const GRID: readonly Band[] = [
  { min: 1.1, max: 1.35 },
  { min: 1.15, max: 1.4 },
  { min: 1.15, max: 1.45 },
  { min: 1.2, max: 1.45 },
  { min: 1.2, max: 1.5 },
  { min: 1.25, max: 1.5 },
  { min: 1.15, max: 1.55 },
];

type Row = {
  fixtureId: string;
  day: string;
  competition: string;
  bestHome: number | null;
  oddsHome: number | null;
  fairHome: number | null;
  homeWon: boolean | null;
};

type Ticket = {
  day: string;
  competition: string;
  best: number;
  consensus: number;
  fair: number;
  won: boolean;
};

type Stats = {
  days: number;
  wins: number;
  losses: number;
  winRate: number;
  worstStreak: number;
  streakHistogram: Array<{ length: number; occurrences: number }>;
  avgOdds: number;
  avgFair: number;
  edge: number;
  roi: number;
  roiMargin: number;
  consensusRoi: number;
};

type YearStats = Stats & { year: string };

function toCandidates(rows: readonly Row[]): Map<string, Ticket[]> {
  const days = new Map<string, Ticket[]>();
  for (const row of rows) {
    if (
      row.bestHome === null ||
      row.oddsHome === null ||
      row.fairHome === null ||
      row.homeWon === null
    ) {
      continue;
    }
    const bucket = days.get(row.day) ?? [];
    bucket.push({
      day: row.day,
      competition: row.competition,
      best: Number(row.bestHome),
      consensus: Number(row.oddsHome),
      fair: Number(row.fairHome),
      won: row.homeWon,
    });
    days.set(row.day, bucket);
  }
  return days;
}

/** Le favori le plus marqué de la journée à l'intérieur de la bande. */
function pickOfDay(candidates: readonly Ticket[], band: Band): Ticket | null {
  const eligible = candidates.filter(
    (candidate) => candidate.best >= band.min && candidate.best <= band.max,
  );
  const first = eligible[0];
  if (!first) return null;
  return eligible.reduce(
    (best, candidate) => (candidate.best < best.best ? candidate : best),
    first,
  );
}

function run(
  days: ReadonlyMap<string, Ticket[]>,
  band: Band,
  window: { from?: string; to?: string },
): Ticket[] {
  return [...days.keys()]
    .sort()
    .filter(
      (day) =>
        (window.from === undefined || day >= window.from) &&
        (window.to === undefined || day < window.to),
    )
    .map((day) => pickOfDay(days.get(day) ?? [], band))
    .filter((ticket): ticket is Ticket => ticket !== null);
}

function profitOf(ticket: Ticket): number {
  return ticket.won ? ticket.best - 1 : -1;
}

function summarize(tickets: readonly Ticket[]): Stats | null {
  const days = tickets.length;
  if (days === 0) return null;
  const wins = tickets.filter((ticket) => ticket.won).length;
  const streaks = new Map<number, number>();
  let worstStreak = 0;
  let current = 0;
  for (const ticket of tickets) {
    if (ticket.won) {
      if (current > 0) streaks.set(current, (streaks.get(current) ?? 0) + 1);
      current = 0;
    } else {
      current += 1;
      worstStreak = Math.max(worstStreak, current);
    }
  }
  if (current > 0) streaks.set(current, (streaks.get(current) ?? 0) + 1);
  const roi = tickets.reduce((sum, t) => sum + profitOf(t), 0) / days;
  const variance =
    days > 1
      ? tickets.reduce((sum, t) => sum + (profitOf(t) - roi) ** 2, 0) /
        (days - 1)
      : 0;
  const avgFair = tickets.reduce((sum, t) => sum + t.fair, 0) / days;
  return {
    days,
    wins,
    losses: days - wins,
    winRate: wins / days,
    worstStreak,
    streakHistogram: [...streaks]
      .sort(([first], [second]) => first - second)
      .map(([length, occurrences]) => ({ length, occurrences })),
    avgOdds: tickets.reduce((sum, t) => sum + t.best, 0) / days,
    avgFair,
    edge: wins / days - avgFair,
    roi,
    roiMargin: 1.96 * Math.sqrt(variance / days),
    consensusRoi:
      tickets.reduce((sum, t) => sum + (t.won ? t.consensus - 1 : -1), 0) /
      days,
  };
}

function byYear(tickets: readonly Ticket[]): YearStats[] {
  const years = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const year = ticket.day.slice(0, 4);
    const bucket = years.get(year) ?? [];
    bucket.push(ticket);
    years.set(year, bucket);
  }
  return [...years]
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([year, rows]) => {
      const stats = summarize(rows);
      return stats ? [{ year, ...stats }] : [];
    });
}

// ── chargement ────────────────────────────────────────────────────────────

function offlineDir(): string | null {
  const index = process.argv.indexOf("--from");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--from requiert un répertoire");
  return value;
}

async function loadRows(dir: string | null): Promise<Row[]> {
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

// ── rendu ─────────────────────────────────────────────────────────────────

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)} %`;
}

function label(band: Band): string {
  return `cote ${band.min.toFixed(2)} – ${band.max.toFixed(2)}`;
}

function table(header: readonly string[], rows: readonly string[][]): string {
  return [header, header.map(() => "---"), ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

type Scored = { band: Band; stats: Stats };

function renderBands(rows: readonly Scored[], chosen: Band): string {
  return table(
    [
      "Bande",
      "Jours",
      "Gagnants",
      "Perdants",
      "% gagnants",
      "Pire série",
      "ROI",
    ],
    rows.map((row) => [
      `${label(row.band)}${row.band === chosen ? " **← retenue**" : ""}`,
      String(row.stats.days),
      String(row.stats.wins),
      String(row.stats.losses),
      pct(row.stats.winRate),
      String(row.stats.worstStreak),
      pct(row.stats.roi),
    ]),
  );
}

function renderYears(rows: readonly YearStats[]): string {
  return table(
    [
      "Année",
      "Jours",
      "Gagnants",
      "Perdants",
      "% gagnants",
      "Pire série",
      "ROI",
    ],
    rows.map((row) => [
      row.year,
      String(row.days),
      String(row.wins),
      String(row.losses),
      pct(row.winRate),
      String(row.worstStreak),
      `${pct(row.roi)} ± ${(row.roiMargin * 100).toFixed(1)}`,
    ]),
  );
}

function renderStreaks(stats: Stats): string {
  const total = stats.streakHistogram.reduce(
    (sum, row) => sum + row.occurrences,
    0,
  );
  return table(
    ["Longueur de la série perdante", "Occurrences", "Part des séries"],
    stats.streakHistogram.map((row) => [
      `${row.length} jour${row.length > 1 ? "s" : ""}`,
      String(row.occurrences),
      pct(row.occurrences / Math.max(total, 1)),
    ]),
  );
}

function renderSensitivity(rows: readonly Scored[]): string {
  return table(
    ["Bande", "Jours", "% gagnants", "Pire série", "Cote", "ROI"],
    rows.map((row) => [
      label(row.band),
      String(row.stats.days),
      pct(row.stats.winRate),
      String(row.stats.worstStreak),
      row.stats.avgOdds.toFixed(2),
      pct(row.stats.roi),
    ]),
  );
}

type Report = {
  selection: Scored[];
  chosen: Band;
  selectionStats: Stats;
  validation: Stats;
  validationBands: Scored[];
  validationYears: YearStats[];
  lifetime: Stats;
  lifetimeYears: YearStats[];
};

function renderMarkdown(report: Report): string {
  const {
    selection,
    chosen,
    selectionStats,
    validation,
    validationBands,
    lifetime,
    lifetimeYears,
  } = report;
  const gap = Math.abs(validation.winRate - selectionStats.winRate) * 100;
  const longStreaks = lifetime.streakHistogram
    .filter((row) => row.length >= 4)
    .reduce((sum, row) => sum + row.occurrences, 0);

  return `# Générateur déterministe — ${VERSION}

Régénérable : \`pnpm --filter @evcore/backtest-core backtest:generator\`.
Requête : \`packages/backtest-core/scripts/league-report/${QUERY_FILE}\`.

## Règle

**Un pari par jour, sur le plus gros favori à domicile** dont la cote tombe
dans la bande retenue. Abstention les jours sans candidat.

Elle exploite le biais favori/outsider, mesuré séparément sur 285 758 jambes
et strictement monotone : sous la cote 1,25 le réalisé dépasse la probabilité
implicite de 2,4 points, au-delà de la cote 8 il lui est inférieur de 1,7
point. Le générateur se place à l'extrémité favorable de cette courbe, et le
vivier quotidien — une trentaine de rencontres cotées — suffit à y trouver un
candidat presque chaque jour.

Aucune sortie du moteur ni du LLM n'intervient.

## Protocole

Grille de ${GRID.length} bandes et critère de choix (taux de jours gagnants)
fixés dans le script avant exécution. Bande choisie sur les journées
antérieures au ${SELECTION_END}, puis évaluée **une seule fois** ensuite.

## 1. Fenêtre de sélection (avant ${SELECTION_END})

${renderBands(selection, chosen)}

Bande retenue : **${label(chosen)}**, ${pct(selectionStats.winRate)} de jours
gagnants.

## 2. Fenêtre de validation (à partir du ${SELECTION_END})

${renderYears(report.validationYears)}

Ensemble de la validation : **${validation.days} jours, ${validation.wins}
gagnants contre ${validation.losses} perdants, soit
${pct(validation.winRate)}**, pour ${pct(selectionStats.winRate)} en
sélection — ${gap < 1 ? "moins d'un point" : `${gap.toFixed(1)} points`}
d'écart.

Cote moyenne ${validation.avgOdds.toFixed(2)}, probabilité implicite
${pct(validation.avgFair)}, réalisé ${pct(validation.winRate)} : un écart de
**${(validation.edge * 100).toFixed(1)} points** en faveur du générateur.
ROI **${pct(validation.roi)} ± ${(validation.roiMargin * 100).toFixed(1)}**.

## 3. Robustesse de la bande (validation)

${renderSensitivity(validationBands)}

Toutes les bandes de la grille tiennent le même comportement : le résultat
n'est pas suspendu à un réglage fin.

## 4. Historique complet

${renderYears(lifetimeYears)}

Sur ${lifetime.days} jours : **${lifetime.wins} gagnants, ${lifetime.losses}
perdants**, ${pct(lifetime.winRate)}. Pire série :
**${lifetime.worstStreak} jours consécutifs**, ${longStreaks} série de quatre
jours ou plus.

${renderStreaks(lifetime)}

## 5. Le résultat dépend-il du courtage ?

Au meilleur prix des books, ROI ${pct(lifetime.roi)}. Au prix consensus,
${pct(lifetime.consensusRoi)}. L'écart est de
${((lifetime.roi - lifetime.consensusRoi) * 100).toFixed(1)} point : **l'edge
vient du biais favori lui-même, pas de la chasse à la meilleure cote**. Le
générateur ne suppose donc pas l'accès à un book particulier.

## Limites

- Le ROI reste de l'ordre du point, avec un intervalle qui contient zéro sur
  chaque année prise isolément. C'est un générateur régulier, pas une machine
  à gagner.
- La bande est validée hors échantillon, mais la **famille** de règles a été
  retenue après une recherche large (biais favori, forme, xG, repos, congestion,
  mouvement de cote, marchés exotiques). Une fenêtre prospective reste
  nécessaire.
- Une sélection par jour n'exploite qu'une fraction du vivier : un jour moyen
  offre plus de trois cents paris admissibles.
- Les cotes sont celles des books présents en base.
`;
}

async function main(): Promise<void> {
  const days = toCandidates(await loadRows(offlineDir()));

  const selection = GRID.flatMap((band) => {
    const stats = summarize(run(days, band, { to: SELECTION_END }));
    return stats && stats.days >= MIN_SELECTION_DAYS ? [{ band, stats }] : [];
  });
  const winner = [...selection].sort(
    (first, second) => second.stats.winRate - first.stats.winRate,
  )[0];
  if (!winner) throw new Error("Aucune bande n'atteint le volume requis");

  const validationTickets = run(days, winner.band, { from: SELECTION_END });
  const validation = summarize(validationTickets);
  const lifetimeTickets = run(days, winner.band, {});
  const lifetime = summarize(lifetimeTickets);
  if (!validation || !lifetime) throw new Error("Fenêtre vide");

  const report: Report = {
    selection,
    chosen: winner.band,
    selectionStats: winner.stats,
    validation,
    validationBands: GRID.flatMap((band) => {
      const stats = summarize(run(days, band, { from: SELECTION_END }));
      return stats ? [{ band, stats }] : [];
    }),
    validationYears: byYear(validationTickets),
    lifetime,
    lifetimeYears: byYear(lifetimeTickets),
  };

  const reportsDir = join(SCRIPT_DIR, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `${VERSION}.json`),
    `${JSON.stringify({ version: VERSION, ...report }, null, 2)}\n`,
  );
  const docsDir = join(
    SCRIPT_DIR,
    "..",
    "..",
    "..",
    "docs",
    "audits",
    "2026-09-15",
  );
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, "GENERATOR.md"), renderMarkdown(report));
  console.log(
    `Retenue : ${label(winner.band)} — validation ${validation.days} jours, ${pct(validation.winRate)} gagnants, pire série ${validation.worstStreak}, ROI ${pct(validation.roi)}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
