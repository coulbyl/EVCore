import Decimal from "decimal.js";
import type { DerivedMarketsProba, ThreeWayProba } from "./markets";

type JointMarkets = ThreeWayProba &
  Pick<
    DerivedMarketsProba,
    | "over25"
    | "bttsYes"
    | "resultTotalGoals"
    | "resultBtts"
    | "cleanSheetHome"
    | "cleanSheetAway"
    | "winToNilHome"
    | "winToNilAway"
  >;

type Side = "HOME" | "DRAW" | "AWAY";
const SIDES: readonly Side[] = ["HOME", "DRAW", "AWAY"];
const ZERO = new Decimal(0);
const ONE = new Decimal(1);

function sideMass(p: ThreeWayProba, side: Side): Decimal {
  return side === "HOME" ? p.home : side === "DRAW" ? p.draw : p.away;
}

function ratio(after: Decimal, before: Decimal): Decimal {
  return before.isZero() ? ONE : after.div(before);
}

/**
 * Répercute un décalage de `over25` et/ou `bttsYes` sur les marchés joints
 * qui en sont des partitions, pour qu'un même match n'annonce pas deux
 * probabilités différentes de « plus de 2,5 buts » selon le canal qui le
 * lit.
 *
 * - RESULT_TOTAL_GOALS : Σ_side `${side}_OVER_2_5` = over25. Chaque
 *   `${side}_OVER_2_5` est scalé par over25'/over25 (plafonné à la masse de
 *   l'issue) et `${side}_UNDER_2_5` = side − OVER'. Les autres lignes
 *   (1,5 / 3,5 / 4,5) ne bougent pas : les corrections ne décalent que la
 *   ligne 2,5 et il n'y a pas de règle de propagation le long de l'échelle
 *   sans retoucher λ.
 * - RESULT_BTTS : Σ_side `${side}_YES` = bttsYes. Même scaling, NO = side − YES'.
 * - WIN_TO_NIL ⊂ CLEAN_SHEET : après des décalages indépendants, win to nil
 *   est ramené sous clean sheet.
 *
 * Mesuré le 2026-10-05 avant cette propagation (PL moyen, signal H2H over25
 * = 1) : over25 passait de 0,474 à 0,518 tandis que Σ `*_OVER_2_5` restait
 * à 0,474, et bttsYes 0,558 contre Σ `*_YES` 0,514.
 */
export function propagateGoalMarketShift<T extends JointMarkets>(
  before: T,
  after: T,
): T {
  const overRatio = ratio(after.over25, before.over25);
  const bttsRatio = ratio(after.bttsYes, before.bttsYes);

  const resultTotalGoals = { ...after.resultTotalGoals };
  const resultBtts = { ...after.resultBtts };
  for (const side of SIDES) {
    const mass = sideMass(after, side);

    const overKey = `${side}_OVER_2_5` as const;
    const underKey = `${side}_UNDER_2_5` as const;
    const over = before.resultTotalGoals[overKey];
    if (over !== undefined) {
      const scaledOver = Decimal.min(
        mass,
        Decimal.max(ZERO, over.times(overRatio)),
      );
      resultTotalGoals[overKey] = scaledOver;
      if (before.resultTotalGoals[underKey] !== undefined) {
        resultTotalGoals[underKey] = Decimal.max(ZERO, mass.minus(scaledOver));
      }
    }

    const yesKey = `${side}_YES` as const;
    const noKey = `${side}_NO` as const;
    const yes = before.resultBtts[yesKey];
    if (yes !== undefined) {
      const scaledYes = Decimal.min(
        mass,
        Decimal.max(ZERO, yes.times(bttsRatio)),
      );
      resultBtts[yesKey] = scaledYes;
      if (before.resultBtts[noKey] !== undefined) {
        resultBtts[noKey] = Decimal.max(ZERO, mass.minus(scaledYes));
      }
    }
  }

  return {
    ...after,
    resultTotalGoals,
    resultBtts,
    winToNilHome: Decimal.min(after.winToNilHome, after.cleanSheetHome),
    winToNilAway: Decimal.min(after.winToNilAway, after.cleanSheetAway),
  };
}
