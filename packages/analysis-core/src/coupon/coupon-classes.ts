// Moved from apps/backend/src/modules/coupon/coupon.constants.ts 2026-09-03 —
// apps/vantage-worker's Phase B LLM selection step (one call per class, see
// docs/vantage-centric-redesign-2026-09-01.md §9bis) needs the exact same
// class definitions apps/backend used to build CouponComposerService.compose()
// calls with, so the two can never drift on what "SAFE"/"BALANCED"/"BOLD"
// mean.

/**
 * Bornes de composition partagées par toutes les classes de coupon.
 * Remplace les cinq profils (SAFE/BALANCED/AGGRESSIVE/LONGSHOT_*) supprimés le
 * 2026-08-22 : trois d'entre eux ne tournaient jamais en production, LONGSHOT
 * tournait contre son propre commentaire, et leurs bornes se sur-déterminaient
 * (`couponEV = P × cote − 1` — fixer cote ET proba jointe ET EV décrit le même
 * plan à deux dimensions, sans qu'on sache laquelle mordait).
 *
 * Ce qui varie d'une classe à l'autre tient désormais en UN paramètre, la
 * cible de cote combinée (voir COUPON_CLASSES). Tout le reste est ici.
 */
export const COUPON_BOUNDS = {
  minLegs: 2,
  /**
   * Ramené de 5 à 3 le 2026-08-22.
   *
   * Un composeur qui remplit gloutonnement jusqu'à `maxLegs` fait
   * mécaniquement BAISSER la probabilité que le coupon tombe à chaque jambe
   * ajoutée. À 5, le coupon de rang 1 — celui présenté comme le meilleur —
   * était celui qui tombait le moins souvent :
   *
   *   rang 1 : 3.62 jambes · cote 3.16 · tombe 39.0%
   *   rang 3 : 2.44 jambes · cote 2.67 · tombe 43.9%
   *   rang 5 : 2.03 jambes · cote 1.71 · tombe 63.3%
   *
   * « Au maximum 5 jambes » ne disait pas QUAND s'arrêter. La règle d'arrêt
   * est explicite : on s'arrête dès que la cible de cote de la classe est
   * atteinte (targetCombinedOdds ci-dessous).
   */
  maxLegs: 3,
  minCombinedOdds: 1.0,
  /** Garde-fou produit, pas un critère de sélection. */
  maxCombinedOdds: 20.0,
} as const;

/**
 * Classes de coupon — un seul paramètre chacune : la cible de cote combinée.
 *
 * Prix mesuré de la cote (simulation du composeur glouton, ~1 000 jours,
 * n≈2 600 coupons par classe, SE ~3 points) :
 *
 *   cible   cote obtenue   jambes   hit     ROI
 *   2.0         2.86        2.20   0.346   -5.36%
 *   2.5         3.40        2.44   0.279   -8.86%
 *   3.0         4.08        2.64   0.234  -10.03%
 *   3.5         4.78        2.76   0.196  -12.15%
 *
 * Le ROI se dégrade de façon monotone quand la cible monte : ~1 point de ROI
 * pour 0.3 de cote combinée. Le mécanisme est mesuré — viser plus haut force
 * des jambes plus longues, et la calibration des jambes se dégrade avec leur
 * cote (ratio 1.054 entre 1.20 et 1.35, 0.928 au-delà de 1.60). La classe
 * BOLD n'est donc pas « plus risquée à espérance égale » : elle est
 * réellement moins bonne, et l'affichage doit le dire.
 *
 * `targetOddsMin`/`targetOddsMax` sont ce qui est écrit dans les colonnes du
 * même nom côté `coupon_proposal` (apps/backend) — composantes de sa clé
 * unique, ce qui permet aux trois classes de coexister sur une même date
 * sans migration.
 *
 * Elles se différencient par la BANDE DE COTE DES JAMBES, pas seulement par
 * une cible de cote combinée — deux classes qui puisent dans le même vivier
 * avec la même cible atteignent leur cible avec les mêmes jambes et livrent
 * le même produit (mesuré en production le 2026-08-22, avant ce découpage).
 * Les bandes sont disjointes : un même pick ne peut jamais apparaître dans
 * deux classes.
 *
 * Simulé sur ~1 000 jours :
 *
 *   classe    jambes     jours  coupons   cote   legs   hit      ROI
 *   SAFE      1.20-1.60   668    1 392    2.00   2.00  0.479  -6.16% ± 2.67
 *   BALANCED  1.60-2.30   939    2 213    5.51   2.83  0.173  -8.84% ± 4.37
 *   BOLD      2.30+       807    1 763   17.67   2.71  0.074 +11.34% ± 10.35
 *
 * ⚠️ Les bandes sont choisies sur des critères PRODUIT (couverture en jours,
 * séparation des cotes, SAFE à exactement 2 jambes), PAS sur ces ROI. Un
 * découpage alternatif (1.20-1.50 / 1.50-2.00 / 2.00+) inverse le classement
 * — SAFE -3.74%, BOLD -7.59% — et les écarts entre les deux découpages sont
 * tous dans le bruit. Le +11.34% de BOLD porte une SE de 10.35 (t = 1.1) : ce
 * n'est pas un résultat, c'est une cellule parmi six testées. Ce qui EST
 * robuste d'un découpage à l'autre, c'est la différenciation : cote
 * 2.0-2.2 / 4.5-5.5 / 11-17.7 et taux de réussite 45-48% / 17-20% / 7-9%.
 */
export type CouponClassName = "SAFE" | "BALANCED" | "BOLD";

export type CouponClass = {
  name: CouponClassName;
  /** Bande de cote des jambes admises — bornes disjointes entre classes. */
  minLegOdds: number;
  maxLegOdds: number;
  maxLegs: number;
  /** Cote combinée à partir de laquelle on cesse d'ajouter des jambes. */
  targetCombinedOdds: number;
  /** Écrits tels quels dans `coupon_proposal` (apps/backend) — clé unique,
   * pas de migration. */
  targetOddsMin: number;
  targetOddsMax: number;
};

export const COUPON_CLASSES: readonly CouponClass[] = [
  {
    name: "SAFE",
    minLegOdds: 1.2,
    maxLegOdds: 1.6,
    // 3 et non 2 : à deux jambes bornées à 1.60, la cote combinée plafonne à
    // 2.56 et TOMBE à 1.44 dès que les deux meilleures jambes sont courtes.
    // Mesuré le 2026-08-22 avec maxLegs=2 : 60% des coupons de cette classe
    // sortaient sous 2.0. La troisième jambe est ce qui rend la cible
    // atteignable, pas un choix esthétique.
    maxLegs: 3,
    targetCombinedOdds: 2.0,
    targetOddsMin: 1.0,
    targetOddsMax: 2.99,
  },
  {
    name: "BALANCED",
    minLegOdds: 1.6,
    maxLegOdds: 2.3,
    maxLegs: 3,
    targetCombinedOdds: 4.0,
    targetOddsMin: 3.0,
    targetOddsMax: 9.99,
  },
  {
    name: "BOLD",
    minLegOdds: 2.3,
    maxLegOdds: 99.0,
    maxLegs: 3,
    targetCombinedOdds: 10.0,
    targetOddsMin: 10.0,
    targetOddsMax: 999.0,
  },
] as const;

/** Retrouve la classe d'une proposition persistée depuis son `targetOddsMin`. */
export function classForTargetOddsMin(
  targetOddsMin: number,
): CouponClassName | null {
  return (
    COUPON_CLASSES.find((c) => c.targetOddsMin === targetOddsMin)?.name ?? null
  );
}

/** Forme des bornes — volontairement large (pas `typeof COUPON_BOUNDS`, dont
 * les types littéraux issus de `as const` interdiraient toute autre valeur). */
export type CouponBounds = {
  minLegs: number;
  maxLegs: number;
  minCombinedOdds: number;
  maxCombinedOdds: number;
};
