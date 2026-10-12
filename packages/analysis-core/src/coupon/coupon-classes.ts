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
export type CouponClassName =
  | "SAFE"
  | "BALANCED"
  | "BOLD"
  | "UNIQUE"
  | "FAVOURITE"
  | "COMBO";

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

// COUPON_CLASSES only decodes archived proposals. Its historical simulations
// were reused during parameter selection and are not prospective validation.

/**
 * Le pari sûr du jour : UNE jambe, le plus gros favori à domicile (1X2) dont
 * la cote d'analyse tombe dans 1,10–1,35. Abstention sinon.
 *
 * C'est la règle « generator-v2 » validée le 2026-09-15 sur 731 jours
 * (2023-01 → 2026-09, `docs/audits/2026-09-15/GENERATOR.md`) : 84,8 % de
 * jours gagnants, pire série 3 jours, ROI positif chaque année (+0,9 à
 * +3,2 %), validation hors échantillon 85,0 % sur 400 jours. Re-vérifiée en
 * prospectif sur les cotes d'analyse du 2026-07-01 au 2026-10-10 (80 jours,
 * `docs/audits/2026-10-12/MESURES-DECISIONS-COUPONS.md`) : 80,0 % de jours
 * gagnants, 81,3 % depuis le 16 septembre, pire série 2 jours.
 *
 * Pourquoi elle marche : le biais favori/outsider, mesuré à part sur 285 758
 * jambes et strictement monotone — le réalisé dépasse l'implicite de 2,4
 * points sous la cote 1,25. Aucune sortie du moteur ni du LLM n'intervient.
 *
 * Pourquoi une jambe et pas deux : plusieurs tickets par jour font tomber les
 * jours gagnants de 72 % à 51 % (la journée n'est positive que si tous
 * gagnent), et P(journée gagnante) ≤ 1 / cote combinée — à cote 5 il est
 * arithmétiquement impossible de gagner plus d'un jour sur cinq.
 *
 * `targetOddsMin`/`targetOddsMax` sont la bande de cote de la jambe elle-même
 * (une seule jambe : cote du coupon = cote de la jambe) ; ils composent la clé
 * unique de `coupon_proposal`, donc la classe coexiste avec le coupon long
 * 5–15 du même jour sans migration.
 */
export const FAVOURITE_COUPON_CLASS: CouponClass = {
  name: "FAVOURITE",
  minLegOdds: 1.1,
  maxLegOdds: 1.35,
  maxLegs: 1,
  targetCombinedOdds: 1.1,
  targetOddsMin: 1.1,
  targetOddsMax: 1.35,
};

/**
 * Le combiné du jour : TROIS sélections du moteur, prises telles que l'écran
 * Décisions les met en avant (« Notre sélection » : canal calibré sur la
 * compétition — ratio réel/annoncé ≥ 0,70 sur 90 jours — et cote sous 1,50),
 * une par championnat, les moins chères d'abord. Abstention sous trois.
 *
 * Mesuré le 2026-10-12 sur 87 jours (2026-07-01 → 10-10, calibration
 * glissante sur les 90 jours précédents, `docs/audits/2026-10-12/
 * MESURES-DECISIONS-COUPONS.md` §5) : 78,2 % ± 4,4 de jours gagnants, cote
 * 1,39, pire série 3 jours, retour 1,048 par unité (dans le bruit : « ne
 * coûte pas plus que la marge »). Jambes réalisées 0,85 pour 0,83 annoncé.
 *
 * Pourquoi trois et pas plus : la quatrième jambe fait tomber les jours
 * gagnants à 63 % et la série à 6 ; viser une cote 2,5 avec les mêmes jambes
 * ne gagne plus qu'un jour sur quatre. Pourquoi les moins chères : classées
 * par probabilité du moteur, les mêmes trois jambes gagnent 67 % des jours
 * avec une série de 8 — le prix classe mieux que le moteur, comme partout.
 *
 * `targetOddsMin`/`targetOddsMax` composent la clé unique de
 * `coupon_proposal` avec la source ENGINE : disjoints des autres classes.
 */
export const COMBO_COUPON_CLASS: CouponClass = {
  name: "COMBO",
  minLegOdds: 1.05,
  maxLegOdds: 1.5,
  maxLegs: 3,
  targetCombinedOdds: 1.2,
  targetOddsMin: 1.2,
  targetOddsMax: 3.4,
};

/** Retrouve la classe d'une proposition persistée depuis son `targetOddsMin`. */
export function classForTargetOddsMin(
  targetOddsMin: number,
): CouponClassName | null {
  return (
    [
      UNIFIED_COUPON_CLASS,
      FAVOURITE_COUPON_CLASS,
      COMBO_COUPON_CLASS,
      ...COUPON_CLASSES,
    ].find((c) => c.targetOddsMin === targetOddsMin)?.name ?? null
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

/**
 * Prospective product policy; legacy classes remain readable in history.
 *
 * `maxLegOdds` ramené de 15,01 à 1,80 le 2026-09-16. La calibration des jambes
 * se dégrade par paliers nets avec leur cote — ratio réalisé/annoncé mesuré sur
 * les 388 jambes réglées de la production LLM depuis le 2026-08-23 :
 *
 *   cote < 1,45    122 jambes   annoncé 83,0 %   réalisé 74,6 %   ratio 0,899
 *   cote 1,45-1,80 119 jambes   annoncé 69,4 %   réalisé 58,0 %   ratio 0,836
 *   cote 1,80+     147 jambes   annoncé 47,2 %   réalisé 29,3 %   ratio 0,619
 *
 * 1,80 est la frontière mesurée, pas un chiffre choisi : au-delà le modèle
 * annonce 47 % et réalise 29 %. À l'intérieur d'une bande, aucun canal ne se
 * détache (écarts de −9 à +18 points sur n = 20 à 41, tous dans le bruit) —
 * c'est donc bien la cote qui porte l'effet, jamais le canal, et c'est là qu'il
 * faut couper.
 *
 * CONSÉQUENCE ASSUMÉE. Atteindre la cote 5 avec des jambes plafonnées à 1,80
 * demande au moins trois jambes (1,80³ = 5,83). Les jours au vivier trop mince
 * produiront une abstention. C'est un résultat, pas une panne : le
 * `CouponGenerationAttempt` l'enregistre explicitement.
 */
export const UNIFIED_COUPON_CLASS: CouponClass = {
  name: "UNIQUE",
  minLegOdds: 1.2,
  maxLegOdds: 1.8,
  maxLegs: 5,
  targetCombinedOdds: 5,
  targetOddsMin: 5,
  targetOddsMax: 15,
};
export const UNIFIED_COUPON_BOUNDS: CouponBounds = {
  minLegs: 2,
  maxLegs: 5,
  minCombinedOdds: 5,
  maxCombinedOdds: 15,
};
// v1.1 (2026-10-10) : mêmes bornes et mêmes gates que v1, moins les trois
// marchés joints exclus sur leur coût à la clôture
// (CLOSING_COST_EXCLUDED_MARKETS, guardrails.ts). Versionné pour que les
// coupons publiés avant et après restent distinguables par jambe.
export const COUPON_POLICY_VERSION = "unified-5-15-v1.1";
export const DETERMINISTIC_COUPON_POLICY_VERSION = "deterministic-5-7-v1";

// Candidate frozen after development-window walk-forward comparison. It is
// not the live policy: the final holdout must pass before any integration.
//
// `maxLegOdds` is pinned here rather than inherited from UNIFIED_COUPON_CLASS.
// It used to spread that object, so tightening the live policy to 1,80 on
// 2026-09-16 silently moved this candidate too — and a candidate whose
// parameters change mid-validation has no holdout left to pass. The two
// policies are deliberately allowed to differ until this one is judged.
export const DETERMINISTIC_COUPON_CLASS: CouponClass = {
  ...UNIFIED_COUPON_CLASS,
  maxLegOdds: 15.01,
  maxLegs: 3,
};
export const DETERMINISTIC_COUPON_BOUNDS: CouponBounds = {
  ...UNIFIED_COUPON_BOUNDS,
  maxLegs: 3,
  maxCombinedOdds: 7,
};
export const DETERMINISTIC_MAX_POSITIVE_EDGE = 0.075;

// Shadow of the policy proposed on 2026-10-05 from the coupon review: the
// live LLM pool (unified-5-15-v1) offers twenty legs ranked by announced edge
// and admits a leg only when p × odds > 1, so 87 % of published legs sit in
// the edge >= 0.05 band (realised/announced 0.82) while the rare edge < 0
// legs realise exactly what they announce. This candidate keeps every v1
// guardrail (1.20-1.80 band, MAX_LEG_EDGE on the reference price, anti-
// correlation, 5-15 bounds) and drops the two EV gates and the value
// ranking. Recorded append-only beside the LLM attempt, never published;
// judged per leg against v1 on the same pool and days.
export const PROBABILITY_SHADOW_POLICY_VERSION = "unified-5-15-v2-shadow";
