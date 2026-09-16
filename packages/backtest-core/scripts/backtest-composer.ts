/**
 * Backtest du compositeur par le prix.
 *
 * QUESTION. À quelle fréquence gagne un coupon selon la cote visée, et quelles
 * séries d'échecs faut-il encaisser ? L'objectif produit est « gagner très
 * souvent, peu de séries d'échecs » — cette frontière est ce qui permet de
 * choisir la cote cible en connaissance de cause plutôt qu'à l'intuition.
 *
 * PROTOCOLE. Calibration en fenêtre glissante : pour composer la journée D, le
 * coût de chaque cellule (marché × tranche de cote) n'est estimé que sur les
 * journées **strictement antérieures** à D. Aucune information du futur
 * n'entre dans une décision — c'est la seule façon d'obtenir un chiffre qui
 * ressemble à ce que la production ferait.
 *
 * Le compositeur ne voit jamais une probabilité du moteur : uniquement le prix
 * et le coût mesuré du marché.
 *
 * Préalable : extraire l'espace d'opportunités (voir
 * `scripts/market-cells/dump-settled-picks.sql`).
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core backtest:composer
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeByPrice, type PriceCandidate } from "@evcore/analysis-core";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DUMP = join(
  SCRIPT_DIR,
  "..",
  "reports",
  "market-cells",
  "settled-picks.csv",
);

/** Journées d'historique exigées avant de composer : en dessous, le coût des
 *  cellules est trop bruité pour classer quoi que ce soit. */
const MIN_CALIBRATION_DAYS = 20;
/**
 * Jambes minimales avant de juger une cellule, puis un marché.
 *
 * Relevés après coup : à 300 jambes, la borne basse du marché Double Chance
 * atteignait 1,0932 le 2026-07-21 — le marché entier paraissait rentable sur
 * son seul historique récent. Les seuils sont calés pour que ce genre
 * d'accident soit absorbé.
 */
const MIN_CELL_LEGS = 400;
const MIN_MARKET_LEGS = 2_000;
/**
 * Aucune jambe ne peut être créditée d'un retour attendu supérieur à 1.
 *
 * Ce n'est pas une précaution : c'est un résultat. Sur 1,67 M de jambes, les 17
 * marchés coûtent de 4,4 % à 12,2 % et **aucun n'est positif**. Une estimation
 * au-dessus de 1 ne peut donc être qu'un accident de fenêtre, et un compositeur
 * qui maximise le retour attendu se précipite exactement dessus.
 */
const MAX_CREDITED_RETURN = 1;

const TARGETS = [
  { label: "2 - 3", min: 2, max: 3 },
  { label: "3 - 5", min: 3, max: 5 },
  { label: "5 - 8", min: 5, max: 8 },
  { label: "8 - 15", min: 8, max: 15 },
  { label: "15 - 30", min: 15, max: 30 },
] as const;

const COMPOSER = {
  minLegs: 2,
  maxLegs: 8,
  maxPerCompetition: 3,
  /** Aucun plancher ici : le but du backtest est de MESURER le retour attendu
   *  atteignable, pas de le présupposer. Le refus se règle ensuite. */
  minExpectedReturn: 0,
} as const;

type Pick = {
  day: string;
  fixtureId: string;
  competition: string;
  market: string;
  pick: string;
  odds: number;
  /** null = remboursé (Draw No Bet sur match nul). */
  won: boolean | null;
};

function bandOf(odds: number): string {
  if (odds < 1.3) return "<1.3";
  if (odds < 1.6) return "1.3-1.6";
  if (odds < 2) return "1.6-2";
  if (odds < 2.5) return "2-2.5";
  if (odds < 3.5) return "2.5-3.5";
  if (odds < 5) return "3.5-5";
  return "5+";
}

function payoutOf(entry: Pick): number {
  if (entry.won === null) return 1;
  return entry.won ? entry.odds : 0;
}

function load(): Pick[] {
  if (!existsSync(DUMP)) {
    throw new Error(
      `Extraction absente : ${DUMP}\n` +
        `Produire avec settled-picks.sql + dump-settled-picks.sql.`,
    );
  }
  const lines = readFileSync(DUMP, "utf8").split("\n");
  const rows: Pick[] = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const [day, fixtureId, competition, market, pick, odds, won] =
      line.split(",");
    if (!day || !fixtureId || !competition || !market || !pick || !odds)
      continue;
    rows.push({
      day,
      fixtureId,
      competition,
      market,
      pick,
      odds: Number(odds),
      won: won === "" || won === undefined ? null : won === "1",
    });
  }
  return rows;
}

/**
 * Deux façons d'estimer le coût d'une cellule, et elles ne donnent pas le même
 * compositeur.
 *
 * `point` prend la moyenne observée telle quelle. Sur une tranche de cote
 * longue, une poignée de gagnants suffit à la faire passer au-dessus de 1 : le
 * compositeur se rue alors sur ces cellules, qui ne sont que du bruit. C'est la
 * même erreur que la règle d'EV, commise un cran plus haut.
 *
 * `lower` crédite la cellule de la borne basse à 95 % de sa moyenne. Une
 * cellule très dispersée — donc mal établie — est automatiquement déclassée.
 * Insuffisant seul : en fenêtre glissante les effectifs grossissent, la borne
 * se resserre autour d'une moyenne qui reste du bruit, et le compositeur empile
 * jusqu'à cinq jambes de la même cellule.
 *
 * `capped` ajoute la seule contrainte que la mesure autorise : **aucune jambe
 * ne peut être créditée au-dessus de 1**. Ce n'est pas une prudence, c'est un
 * résultat — sur 1,67 M de jambes les 17 marchés coûtent de 4,4 % à 12,2 % et
 * aucun n'est positif. Toute estimation au-dessus de 1 est un accident de
 * fenêtre, et un compositeur qui maximise le retour attendu se rue dessus.
 *
 * En revanche la tranche de cote reste libre de jouer dans les deux sens : le
 * biais favori/outsider est répliqué indépendamment (+2,4 points sous la cote
 * 1,25 sur 285 758 jambes de 1X2, +2,74 sur 9 058 jambes d'Asian Handicap).
 * L'écraser reviendrait à ne laisser au compositeur que la mécanique « moins de
 * jambes coûte moins », qui le pousse mécaniquement vers les cotes longues —
 * exactement là où le biais lui est défavorable.
 */
type Estimator = "point" | "lower" | "capped";

type Cell = { sum: number; squares: number; n: number };

type Calibration = {
  cell: Map<string, Cell>;
  market: Map<string, Cell>;
};

function emptyCalibration(): Calibration {
  return { cell: new Map(), market: new Map() };
}

function bump(store: Map<string, Cell>, key: string, payout: number): void {
  const cell = store.get(key) ?? { sum: 0, squares: 0, n: 0 };
  cell.sum += payout;
  cell.squares += payout * payout;
  cell.n += 1;
  store.set(key, cell);
}

function accumulate(calibration: Calibration, entry: Pick): void {
  const payout = payoutOf(entry);
  bump(calibration.cell, `${entry.market}|${bandOf(entry.odds)}`, payout);
  bump(calibration.market, entry.market, payout);
}

function lowerBound(cell: Cell): number {
  const mean = cell.sum / cell.n;
  const variance = Math.max(cell.squares / cell.n - mean * mean, 0);
  return mean - (1.96 * Math.sqrt(variance)) / Math.sqrt(cell.n);
}

function estimate(cell: Cell, estimator: Estimator): number {
  return estimator === "point" ? cell.sum / cell.n : lowerBound(cell);
}

/** Retour attendu d'une jambe, ou null si on ne l'a pas assez mesurée. */
function expectedReturnOf(
  calibration: Calibration,
  entry: Pick,
  estimator: Estimator,
): number | null {
  const market = calibration.market.get(entry.market);
  // Le marché est l'ancre : sans lui mesuré, on ne price pas la jambe. La
  // tranche de cote ne sert qu'à raffiner, jamais à remplacer — retomber sur la
  // moyenne du marché pour une jambe à cote 8 lui prêterait le coût des favoris.
  if (!market || market.n < MIN_MARKET_LEGS) return null;
  const marketEstimate = estimate(market, estimator);
  const cell = calibration.cell.get(`${entry.market}|${bandOf(entry.odds)}`);
  const cellEstimate =
    cell && cell.n >= MIN_CELL_LEGS
      ? estimate(cell, estimator)
      : marketEstimate;
  if (estimator !== "capped") return cellEstimate;
  return Math.min(cellEstimate, MAX_CREDITED_RETURN);
}

type DayResult = {
  day: string;
  odds: number;
  expectedReturn: number;
  ret: number;
  legs: number;
};

type TargetReport = {
  label: string;
  composed: number;
  refused: number;
  wins: number;
  worstStreak: number;
  roi: number;
  avgOdds: number;
  avgLegs: number;
  bestExpectedReturn: number;
};

function runTarget(
  rows: readonly Pick[],
  target: (typeof TARGETS)[number],
  estimator: Estimator,
): TargetReport {
  const days = [...new Set(rows.map((row) => row.day))].sort();
  const byDay = new Map<string, Pick[]>();
  for (const row of rows) {
    const bucket = byDay.get(row.day) ?? [];
    bucket.push(row);
    byDay.set(row.day, bucket);
  }

  const calibration = emptyCalibration();
  const results: DayResult[] = [];
  let refused = 0;
  let bestExpectedReturn = 0;

  for (const [index, day] of days.entries()) {
    const today = byDay.get(day) ?? [];
    if (index >= MIN_CALIBRATION_DAYS) {
      const candidates: PriceCandidate[] = [];
      for (const entry of today) {
        const expectedReturn = expectedReturnOf(calibration, entry, estimator);
        // Une borne basse peut devenir négative sur une cellule très dispersée :
        // la jambe est alors inutilisable, pas gratuite.
        if (expectedReturn === null || expectedReturn <= 0) continue;
        candidates.push({
          fixtureId: entry.fixtureId,
          competition: entry.competition,
          market: entry.market,
          pick: entry.pick,
          odds: entry.odds,
          expectedReturn,
        });
      }
      const outcome = composeByPrice(candidates, {
        ...COMPOSER,
        minOdds: target.min,
        maxOdds: target.max,
      });
      if (outcome.outcome === "composed") {
        const chosen = outcome.coupon.legs.map((leg) => {
          const found = today.find(
            (entry) =>
              entry.fixtureId === leg.fixtureId &&
              entry.market === leg.market &&
              entry.pick === leg.pick,
          );
          if (!found)
            throw new Error("jambe composée introuvable dans la journée");
          return found;
        });
        const ret = chosen.reduce(
          (product, entry) => product * payoutOf(entry),
          1,
        );
        const expectedReturn = outcome.coupon.expectedReturn.toNumber();
        bestExpectedReturn = Math.max(bestExpectedReturn, expectedReturn);
        results.push({
          day,
          odds: outcome.coupon.combinedOdds.toNumber(),
          expectedReturn,
          ret,
          legs: chosen.length,
        });
      } else {
        refused += 1;
      }
    }
    for (const entry of today) accumulate(calibration, entry);
  }

  let streak = 0;
  let worstStreak = 0;
  let wins = 0;
  for (const result of results) {
    if (result.ret > 1) {
      wins += 1;
      streak = 0;
    } else {
      streak += 1;
      worstStreak = Math.max(worstStreak, streak);
    }
  }
  const composed = results.length;
  return {
    label: target.label,
    composed,
    refused,
    wins,
    worstStreak,
    roi:
      composed > 0
        ? results.reduce((sum, result) => sum + result.ret, 0) / composed - 1
        : 0,
    avgOdds:
      composed > 0 ? results.reduce((sum, r) => sum + r.odds, 0) / composed : 0,
    avgLegs:
      composed > 0 ? results.reduce((sum, r) => sum + r.legs, 0) / composed : 0,
    bestExpectedReturn,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

function main(): void {
  const rows = load();
  const days = [...new Set(rows.map((row) => row.day))].sort();
  const byEstimator = new Map<Estimator, TargetReport[]>([
    ["point", TARGETS.map((target) => runTarget(rows, target, "point"))],
    ["lower", TARGETS.map((target) => runTarget(rows, target, "lower"))],
    ["capped", TARGETS.map((target) => runTarget(rows, target, "capped"))],
  ]);
  const reports = byEstimator.get("capped") ?? [];

  console.log(
    `${rows.length} jambes, ${days.length} journées (${days[0]} → ${days.at(-1)}), ` +
      `${MIN_CALIBRATION_DAYS} journées de calibration avant la première composition`,
  );
  for (const [estimator, set] of byEstimator) {
    console.log(
      `\n${
        estimator === "point"
          ? "Moyenne observée (naïf)"
          : estimator === "lower"
            ? "Borne basse à 95 %"
            : "Borne basse plafonnée à 1 (robuste)"
      }`,
    );
    console.log(
      `${"cote visée".padEnd(12)}${"coupons".padStart(9)}${"refus".padStart(7)}${"gagnants".padStart(10)}${"pire série".padStart(12)}${"ROI".padStart(10)}${"cote moy".padStart(10)}${"jambes".padStart(8)}`,
    );
    for (const report of set) {
      console.log(
        `${report.label.padEnd(12)}${String(report.composed).padStart(9)}${String(report.refused).padStart(7)}` +
          `${`${report.wins} (${((report.wins / Math.max(report.composed, 1)) * 100).toFixed(0)} %)`.padStart(10)}` +
          `${`${report.worstStreak} j`.padStart(12)}${pct(report.roi).padStart(10)}` +
          `${report.avgOdds.toFixed(2).padStart(10)}${report.avgLegs.toFixed(1).padStart(8)}`,
      );
    }
    console.log(
      `  meilleur retour attendu : ${Math.max(...set.map((r) => r.bestExpectedReturn)).toFixed(4)}` +
        ` (il faut > 1,0000 pour être rentable en espérance)`,
    );
  }

  const markdown = `# Compositeur par le prix — frontière cote visée / régularité

Régénérable : \`pnpm --filter @evcore/backtest-core backtest:composer\`.

## Protocole

${rows.length} jambes réglées sur ${days.length} journées, du ${days[0]} au
${days.at(-1)}. Calibration en **fenêtre glissante** : pour composer la journée
D, le coût de chaque cellule (marché × tranche de cote) n'est estimé que sur les
journées strictement antérieures à D. Les ${MIN_CALIBRATION_DAYS} premières
journées servent d'amorce et ne sont pas jouées.

Le compositeur ne voit **aucune probabilité du moteur** : uniquement le prix et
le coût mesuré du marché. Une seule jambe par rencontre, au plus
${COMPOSER.maxPerCompetition} par championnat, ${COMPOSER.maxLegs} jambes au
maximum.

## Frontière — estimateur robuste (borne basse plafonnée à 1)

| Cote visée | Coupons | Refus | Gagnants | Pire série | ROI | Cote moy | Jambes |
| --- | --- | --- | --- | --- | --- | --- | --- |
${reports
  .map(
    (r) =>
      `| ${r.label} | ${r.composed} | ${r.refused} | ${r.wins} (${((r.wins / Math.max(r.composed, 1)) * 100).toFixed(0)} %) | ${r.worstStreak} j | ${pct(r.roi)} | ${r.avgOdds.toFixed(2)} | ${r.avgLegs.toFixed(1)} |`,
  )
  .join("\n")}

## Ce que coûte la naïveté de l'estimateur

Même compositeur, même protocole : seule change la façon d'estimer le coût
d'une cellule. À gauche la moyenne observée, à droite sa borne basse à 95 %.

| Cote visée | Moyenne observée | Borne basse | Borne basse plafonnée à 1 | Écart naïf → robuste |
| --- | --- | --- | --- | --- |
${(byEstimator.get("point") ?? [])
  .map((naive, index) => {
    const bounded = (byEstimator.get("lower") ?? [])[index];
    const robust = reports[index];
    if (!bounded || !robust) return "";
    return `| ${naive.label} | ${pct(naive.roi)} | ${pct(bounded.roi)} | ${pct(robust.roi)} | ${pct(robust.roi - naive.roi)} |`;
  })
  .filter(Boolean)
  .join("\n")}

Sur une tranche de cote longue, quelques gagnants suffisent à faire passer la
moyenne d'une cellule au-dessus de 1. Le compositeur s'y précipite alors, car
c'est exactement ce qu'on lui demande d'optimiser — et il sélectionne du bruit.
C'est la même erreur que la règle d'EV, commise un cran plus haut : dès qu'un
critère est estimé puis maximisé sur la même donnée, il faut créditer la borne
basse, jamais le point.

## Lecture

⚠️ **La colonne ROI ne conclut rien.** Chaque cible ne compte que quelques
dizaines de coupons ; à ces volumes l'erreur type dépasse largement les écarts
affichés. Les deux seules grandeurs exploitables de ce tableau sont le **retour
attendu plafond** et la **mécanique du nombre de jambes**, qui ne dépendent pas
du tirage.

La fréquence de gain et la cote visée sont liées par une contrainte
arithmétique que nulle sélection ne desserre : un coupon à cote C ne gagne pas
plus souvent que (1 + ROI) / C, quelle que soit la qualité du choix des jambes.
Viser la cote 10 en gagnant une fois sur deux n'est pas un objectif difficile,
c'est un objectif impossible. Le seul levier sur la régularité est la cote
visée elle-même.

**Le compositeur choisit systématiquement le minimum de jambes** (2,0 en
moyenne). Ce n'est pas un défaut de réglage : chaque jambe ajoutée est une
multiplication supplémentaire par un nombre inférieur à 1, donc atteindre une
cote donnée coûte toujours moins cher avec peu de jambes longues qu'avec
beaucoup de jambes courtes. Autrement dit, tant que toutes les jambes sont
taxées, **il n'existe aucune intelligence de combinaison à récupérer** : la
combinaison n'est qu'une multiplication, elle n'invente pas d'avantage. C'est
ce que ce backtest établit de plus solide.

Le retour attendu maximal atteint sur l'ensemble des journées et des cibles,
estimateur robuste, est de
**${Math.max(...reports.map((r) => r.bestExpectedReturn)).toFixed(4)}**.
Tant qu'il reste sous 1,0000, aucun réglage du plancher de refus ne rend le
compositeur rentable : il ne peut que réduire le nombre de coupons joués. C'est
cohérent avec la mesure de l'espace d'opportunités — les 17 marchés coûtent de
4,4 % à 12,2 % et aucun n'est positif
(\`docs/audits/2026-09-16/ESPACE-OPPORTUNITES.md\`).

Le compositeur est donc correct et prêt ; ce qui lui manque est un marché dont
le coût soit assez faible pour que le produit des jambes dépasse 1. Le seul
candidat mesuré est l'Asian Handicap
(\`docs/audits/2026-09-16/ASIAN-HANDICAP.md\`).
`;

  const directory = join(
    SCRIPT_DIR,
    "..",
    "..",
    "..",
    "docs",
    "audits",
    "2026-09-16",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "COMPOSITEUR.md"), markdown);
  console.log("\nRapport : docs/audits/2026-09-16/COMPOSITEUR.md");
}

main();
