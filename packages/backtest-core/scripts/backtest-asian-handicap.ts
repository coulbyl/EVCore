/**
 * Le biais favori/outsider existe-t-il sur le handicap asiatique ?
 *
 * ENJEU. Sur le 1X2, le réalisé dépasse la probabilité implicite de 2,4 points
 * sous la cote 1,25 et lui est inférieur de 1,7 point au-delà de la cote 8 —
 * monotone sur 285 758 jambes. Ce biais ne suffit pas à couvrir les 4,5 % de
 * marge du 1X2. L'Asian Handicap coûte 2,6 % à 3,7 % : si le même biais s'y
 * retrouve, un coupon de plusieurs jambes y devient positif, et c'est la seule
 * construction mesurée qui puisse l'être.
 *
 * MÉTHODE. Chaque ligne est un marché à deux issues dont les cotes se somment
 * en probabilité à 1 plus la marge : la probabilité équitable s'obtient par
 * normalisation à l'intérieur de la ligne. Le règlement passe par
 * `settleAsianHandicap`, qui traite les remboursements de ligne entière et la
 * scission des quarts de ligne — les ignorer inventerait ou effacerait l'edge
 * cherché.
 *
 * Le ROI est calculé sur le retour réel de la mise, remboursements compris.
 * Le « réalisé » affiché est l'espérance de gain par unité, pas un taux de
 * réussite : sur ce marché les deux ne coïncident pas.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core backtest:asian-handicap
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { settleAsianHandicap } from "@evcore/analysis-core";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(
  SCRIPT_DIR,
  "..",
  "reports",
  "asian-handicap",
  "raw.ndjson",
);
const REFERENCE_BOOKMAKER = "Pinnacle";
const MIN_LEGS_PER_BAND = 200;
/**
 * Une tranche jugée sur moins de rencontres que cela ne dit rien : c'est la
 * rencontre qui est l'unité indépendante, pas la jambe.
 */
const MIN_FIXTURES_PER_BAND = 100;

type Leg = {
  bookmaker: string;
  pick: "HOME" | "AWAY";
  line: number;
  odds: number;
};

type Row = {
  fixtureId: number;
  day: string;
  competition: string;
  homeScore: number;
  awayScore: number;
  legs: Leg[];
};

type Priced = {
  /** Unité d'indépendance : toutes les jambes d'une rencontre sont corrélées. */
  fixtureId: number;
  day: string;
  pick: "HOME" | "AWAY";
  line: number;
  odds: number;
  /** Probabilité équitable du côté pris, marge retirée dans sa ligne. */
  fair: number;
  /** Retour d'une mise de 1 : 0 perte, 1 remboursement, `odds` gain plein. */
  payout: number;
};

function load(): Row[] {
  if (!existsSync(CACHE_FILE)) {
    throw new Error(
      `Cache absent. Lancer d'abord : pnpm --filter @evcore/backtest-core collect:asian-handicap`,
    );
  }
  const rows: Row[] = [];
  for (const line of readFileSync(CACHE_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as Row);
    } catch {
      // Ligne tronquée par une interruption de collecte.
    }
  }
  return rows;
}

/**
 * Apparie les deux côtés d'une même ligne chez un book donné.
 *
 * Convention de l'API vérifiée sur données réelles : les deux côtés portent le
 * MÊME signe. Une ligne dont un seul côté est servi est écartée — normaliser
 * sur une issue unique donnerait une probabilité de 1.
 */
function priceLines(row: Row, bookmaker: string): Priced[] {
  const byLine = new Map<number, Leg[]>();
  for (const leg of row.legs) {
    if (leg.bookmaker !== bookmaker) continue;
    const bucket = byLine.get(leg.line) ?? [];
    bucket.push(leg);
    byLine.set(leg.line, bucket);
  }
  const priced: Priced[] = [];
  for (const legs of byLine.values()) {
    const home = legs.find((leg) => leg.pick === "HOME");
    const away = legs.find((leg) => leg.pick === "AWAY");
    if (!home || !away) continue;
    const overround = 1 / home.odds + 1 / away.odds;
    if (!Number.isFinite(overround) || overround <= 0) continue;
    for (const leg of [home, away]) {
      priced.push({
        fixtureId: row.fixtureId,
        day: row.day,
        pick: leg.pick,
        line: leg.line,
        odds: leg.odds,
        fair: 1 / leg.odds / overround,
        payout: settleAsianHandicap({
          pick: leg.pick,
          line: leg.line,
          odds: leg.odds,
          homeScore: row.homeScore,
          awayScore: row.awayScore,
        }),
      });
    }
  }
  return priced;
}

type BandStats = {
  band: string;
  legs: number;
  fixtures: number;
  avgOdds: number;
  fair: number;
  expected: number;
  realised: number;
  edge: number;
  roi: number;
  margin: number;
};

function bandOf(odds: number): string {
  if (odds < 1.5) return "a. < 1.50";
  if (odds < 1.75) return "b. 1.50-1.75";
  if (odds < 1.95) return "c. 1.75-1.95";
  if (odds < 2.15) return "d. 1.95-2.15";
  if (odds < 2.5) return "e. 2.15-2.50";
  return "f. 2.50+";
}

/**
 * Écart-type groupé par rencontre.
 *
 * Une rencontre fournit jusqu'à une dizaine de jambes — plusieurs lignes, deux
 * côtés — qui gagnent et perdent quasiment ensemble. Les traiter comme
 * indépendantes divise l'intervalle par trois et fabrique une significativité
 * qui n'existe pas. On somme donc les écarts à l'intérieur de chaque rencontre
 * avant d'élever au carré : c'est l'estimateur de variance groupée usuel.
 */
function clusteredError(legs: readonly Priced[], mean: number): number {
  const byFixture = new Map<number, number>();
  for (const leg of legs) {
    byFixture.set(
      leg.fixtureId,
      (byFixture.get(leg.fixtureId) ?? 0) + (leg.payout - mean),
    );
  }
  const sumSquares = [...byFixture.values()].reduce(
    (sum, deviation) => sum + deviation ** 2,
    0,
  );
  const clusters = byFixture.size;
  if (clusters < 2) return Number.POSITIVE_INFINITY;
  // Correction de petit échantillon sur le nombre de groupes.
  const scale = clusters / (clusters - 1);
  return Math.sqrt((sumSquares * scale) / legs.length ** 2);
}

function summarise(legs: readonly Priced[], band: string): BandStats | null {
  const fixtures = new Set(legs.map((leg) => leg.fixtureId)).size;
  if (legs.length < MIN_LEGS_PER_BAND) return null;
  if (fixtures < MIN_FIXTURES_PER_BAND) return null;
  const n = legs.length;
  const avgOdds = legs.reduce((sum, leg) => sum + leg.odds, 0) / n;
  const fair = legs.reduce((sum, leg) => sum + leg.fair, 0) / n;
  // Retour moyen réel, remboursements compris.
  const realised = legs.reduce((sum, leg) => sum + leg.payout, 0) / n;
  // Retour qu'on obtiendrait si la probabilité équitable était exacte.
  const expected = legs.reduce((sum, leg) => sum + leg.fair * leg.odds, 0) / n;
  return {
    band,
    legs: n,
    fixtures,
    avgOdds,
    fair,
    expected,
    realised,
    // Écart en points de probabilité : ramené à l'échelle du 1X2 pour être
    // comparable au +2,4 pt mesuré sous la cote 1,25.
    edge: (realised - expected) / avgOdds,
    roi: realised - 1,
    margin: 1.96 * clusteredError(legs, realised),
  };
}

function groupByBand(legs: readonly Priced[]): BandStats[] {
  const groups = new Map<string, Priced[]>();
  for (const leg of legs) {
    const band = bandOf(leg.odds);
    const bucket = groups.get(band) ?? [];
    bucket.push(leg);
    groups.set(band, bucket);
  }
  return [...groups]
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([band, bucket]) => {
      const stats = summarise(bucket, band);
      return stats ? [stats] : [];
    });
}

function pct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)} %`;
}

function table(header: readonly string[], rows: readonly string[][]): string {
  return [header, header.map(() => "---"), ...rows]
    .map((line) => `| ${line.join(" | ")} |`)
    .join("\n");
}

function renderBands(rows: readonly BandStats[]): string {
  return table(
    [
      "Cote",
      "Jambes",
      "Rencontres",
      "Cote moy",
      "Implicite",
      "Retour attendu",
      "Retour réel",
      "Écart (pts)",
      "ROI",
      "± 95 %",
    ],
    rows.map((row) => [
      row.band,
      String(row.legs),
      String(row.fixtures),
      row.avgOdds.toFixed(2),
      pct(row.fair, 1),
      row.expected.toFixed(4),
      row.realised.toFixed(4),
      `${row.edge >= 0 ? "+" : ""}${(row.edge * 100).toFixed(2)}`,
      pct(row.roi),
      pct(row.margin),
    ]),
  );
}

function main(): void {
  const rows = load();
  const priced = rows.flatMap((row) => priceLines(row, REFERENCE_BOOKMAKER));
  const withHandicap = rows.filter((row) => row.legs.length > 0).length;
  const days = [...new Set(rows.map((row) => row.day))].sort();

  // Coupure à la médiane des rencontres, jamais une date en dur : une date
  // choisie hors de la fenêtre collectée produirait deux moitiés dont l'une
  // est vide, et une section de réplication qui ne réplique rien.
  const fixtureDays = [...new Set(priced.map((leg) => leg.fixtureId))].map(
    (id) => priced.find((leg) => leg.fixtureId === id)?.day ?? "",
  );
  const splitDate =
    fixtureDays.sort()[Math.floor(fixtureDays.length / 2)] ?? "";

  const all = groupByBand(priced);
  const before = groupByBand(priced.filter((leg) => leg.day < splitDate));
  const after = groupByBand(priced.filter((leg) => leg.day >= splitDate));
  const overround =
    priced.length > 0
      ? priced.reduce((sum, leg) => sum + leg.fair * leg.odds, 0) /
        priced.length
      : 0;

  const markdown = `# Handicap asiatique — le biais favori s'y retrouve-t-il ?

Régénérable : \`pnpm --filter @evcore/backtest-core backtest:asian-handicap\`
(collecte préalable : \`collect:asian-handicap\`).

## Périmètre

${rows.length} rencontres collectées, dont **${withHandicap} servant le marché**,
sur **${days.length} jours** du ${days[0] ?? "?"} au ${days.at(-1) ?? "?"}.
${priced.length} jambes cotées chez ${REFERENCE_BOOKMAKER}, lignes complètes
uniquement — une ligne dont un seul côté est servi est écartée, normaliser sur
une issue unique donnerait une probabilité de 1.

⚠️ **L'unité indépendante est la rencontre, pas la jambe.** Une rencontre sert
une dizaine de jambes — plusieurs lignes, deux côtés — qui gagnent et perdent
ensemble. Tous les intervalles ci-dessous sont **groupés par rencontre** ; lus
au niveau de la jambe, ils seraient environ trois fois trop étroits et
fabriqueraient une significativité inexistante. La fenêtre collectée est courte
(${days.length} jours) : aucune conclusion ne peut y survivre seule.

Marge moyenne du marché : **${pct(1 / overround - 1)}** par jambe, à comparer
aux 4,5 % du Match Winner.

Le règlement traite les remboursements de ligne entière et la scission des
quarts de ligne. Le « retour réel » est une espérance de gain par unité misée,
pas un taux de réussite : sur ce marché les deux ne coïncident pas.

## Toutes périodes

${renderBands(all)}

L'« écart » est la différence entre retour réel et retour attendu, ramenée en
points de probabilité pour être comparable au **+2,4 pt** mesuré sous la cote
1,25 sur le 1X2.

## Avant ${splitDate}

${renderBands(before)}

## À partir de ${splitDate}

${renderBands(after)}

## Lecture

Le biais du 1X2 est **monotone** : favorable aux cotes courtes, défavorable
aux longues. Sur un marché à deux issues symétriques comme le handicap
asiatique, un biais de même nature se lirait comme un écart positif sous la
cote 1,95 et négatif au-dessus.

Un écart qui ne se reproduit pas sur les deux périodes est du bruit : à ces
volumes, une tranche de 200 jambes porte encore plusieurs points d'incertitude.
`;

  const directory = join(SCRIPT_DIR, "..", "..", "..", "docs", "audits", "2026-09-16");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "ASIAN-HANDICAP.md"), markdown);

  console.log(
    `${withHandicap} rencontres servant l'AH sur ${days.length} jours, ${priced.length} jambes ${REFERENCE_BOOKMAKER}, marge ${pct(1 / overround - 1)}`,
  );
  for (const row of all) {
    console.log(
      `${row.band.padEnd(14)}${String(row.legs).padStart(6)} jambes ${String(row.fixtures).padStart(5)} renc.  écart ${(row.edge * 100).toFixed(2).padStart(6)} pts  ROI ${pct(row.roi).padStart(8)} ± ${pct(row.margin)}`,
    );
  }
  console.log("\nRapport : docs/audits/2026-09-16/ASIAN-HANDICAP.md");
}

main();
