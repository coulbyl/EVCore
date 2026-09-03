/**
 * Hyperparamètres du coupon.
 *
 * Source (réécrite 2026-08-09 — le fichier `backtest-selected-params.json`
 * cité ici auparavant n'existe pas dans ce repo, gap documenté dans
 * docs/formation-content-maintenance.md §5) :
 * packages/db/scripts/backtest-coupon-params-validation.ts, rejouable via
 * `pnpm --filter @evcore/db db:backtest:coupon-params-validation`. Valide sur
 * les 403 vrais `CouponProposal` réglés depuis 2023-04-15 (pas une
 * simulation), split train/valid 60/40 par jour :
 *   - global (tous les paramètres actuels)   : train ROI +28.3% | valid ROI +19.8%
 *   - `minCouponEV` resserré à 0.15           : train ROI +29.2% | valid ROI +23.2%
 *     (0.20+ dégrade train, 0.30 inverse le signe — non retenu)
 *   - `maxCombinedOdds` resserré (≤4/≤5)      : train s'améliore (+36%/+39%)
 *     mais valid s'effondre (-18.5%/-1.6%) — signature de surapprentissage,
 *     PAS resserré, gardé à 6.0.
 *
 * `k`/`capMin`/`capMax`/`decayHalfLifeDays`/`windowDays`/`nLeagueMin` ne sont
 * PAS couverts par ce script (ils alimentent la courbe de fiabilité par
 * canal dans CouponPoolService.computeLegCalibration, pas testée ici) —
 * hérités sans nouvelle validation, à couvrir par un futur backtest dédié.
 *
 * NE PAS modifier manuellement — relancer le backtest ci-dessus pour toute
 * révision.
 */

import { StrategyChannel } from '@evcore/db';
import {
  DRAW_STAKED_LEAGUES,
  POOL_ELIGIBLE_CHANNELS,
  POOL_EXCLUDED_CHANNELS,
} from '@evcore/analysis-core';

// Any channel can label a coupon leg: the pool admits every non-meta,
// non-filter channel (POOL_ELIGIBLE_CHANNELS) and historical legs additionally
// carry VALUE/SAFE/BTTS/TEAM_TOTAL labels from before the 2026-08-22 switch.
export type CouponChannel = StrategyChannel;

// DRAW_STAKED_LEAGUES/POOL_EXCLUDED_CHANNELS/POOL_ELIGIBLE_CHANNELS moved to
// packages/analysis-core/src/coupon/pool-eligibility.ts 2026-09-03 —
// apps/vantage-worker's own coupon pool query needs the exact same
// channel-eligibility data (see docs/vantage-centric-redesign-2026-09-01.md
// §9bis). Full history (the 2026-08-22 `bet`-read structural-blindness
// measurement, why this isn't a quality bar) preserved in that file's doc
// comment. Re-exported here so existing imports against './coupon.constants'
// keep resolving unchanged.
export { DRAW_STAKED_LEAGUES, POOL_ELIGIBLE_CHANNELS, POOL_EXCLUDED_CHANNELS };

// Plafond du nombre de sélections RETENUES par canal dans le POOL (par jour),
// PAS le nombre de jambes d'un coupon — concept distinct des bornes de profil
// (`COUPON_BOUNDS.maxLegs`). Levée d'ambiguïté B8 : un coupon est borné par
// son profil ; ceci borne combien de candidats d'un canal entrent dans le pool.
// Per-canal cap on legs contributed to one day's coupons. Partial on purpose:
// a channel with no entry uses DEFAULT_MAX_COUPON_SELECTIONS. Caps are earned
// on a channel's own coupon record, so a newly-admitted channel starts at the
// conservative default rather than inheriting a cap another channel earned.
export const DEFAULT_MAX_COUPON_SELECTIONS = 2;

export const MAX_COUPON_SELECTIONS: Partial<Record<CouponChannel, number>> = {
  SAFE: 5,
  BTTS: 5,
  DOMINANT: 5,
  DRAW: 2,
  VALUE: 2,
  // Was aligned with a backtested topN=3 edge ranking in Investment
  // (db:backtest:invest-ranking, 2026-07-28). That backtest was invalidated on
  // 2026-08-22 — the paired test on TEAM_TOTAL's own cap came out at t=+0.70,
  // indistinguable du hasard sur 31 jours — and MODE_RANKING was deleted with
  // it. The cap survives here as a per-channel EXPOSURE bound in a coupon, not
  // as a claim that the top 3 rank better than the rest.
  TEAM_TOTAL: 3,
  // Admitted to the pool 2026-08-22 (POOL_ELIGIBLE_CHANNELS). None has any
  // coupon history yet, so all start at DRAW/VALUE's conservative cap of 2
  // rather than inheriting a cap earned by a different channel's record.
  DRAW_NO_BET: 2,
  WIN_EITHER_HALF: 2,
  HALF_TIME_FULL_TIME: 2,
  DOUBLE_CHANCE: 2,
  WIN_TO_NIL: 2,
  FIRST_HALF: 2,
} as const;

export const COUPON_PARAMS = {
  capMin: 0.05,
  capMax: 0.8,
  // Seuil d'EV de coupon (Étape 1 — EV au cœur du coupon). Un coupon n'est viable
  // que si `couponEV = P_coupon × Odd_coupon − 1 ≥ minCouponEV`. Resserré de
  // 0.05 à 0.15 le 2026-08-09 (db:backtest:coupon-params-validation, sur les
  // 403 CouponProposal réels réglés) : train ROI +28.3%→+29.2%, valid ROI
  // +19.8%→+23.2%, les deux améliorés — 0.20 dégrade train, 0.30 inverse le
  // signe, non retenus.
  legacyMinCouponEV: 0.15,
  // Nombre maximum de coupons publiés par jour. Ramené de 10 à 3 le
  // 2026-08-22 : 3 est ce que la simulation hors échantillon a validé
  // (ROI −6.57% ± 11.1) et ce que le produit demande. À 10, les rangs 4 à 10
  // se construisent sur les jambes restantes une fois les bonnes consommées —
  // ce sont des fonds de panier que rien ne justifie de publier.
  maxCoupons: 3,
  /**
   * Valeur écrite dans `coupon_proposal.signalWindowDays` (colonne NOT NULL et
   * composante de la clé unique). Depuis la suppression de la fenêtre
   * glissante le 2026-08-22, elle ne décrit plus rien : c'est un discriminant
   * constant, conservé pour ne pas exiger de migration.
   */
  legacySignalWindowDays: 38,
} as const;

/**
 * Plafond d'edge par jambe : `probabilité − 1/cote`. Une jambe au-dessus est
 * rejetée du pool de coupon.
 *
 * C'est le levier qui a fonctionné, après trois tentatives de correction de
 * `p̂` qui ont toutes échoué (voir plus bas). Mesuré le 2026-08-22 sur 51 860
 * sélections réglées à cote réelle, hors canaux meta et filtres — ratio
 * réalisé/annoncé par tranche d'edge :
 *
 *   edge          n        annoncé   réel    ratio
 *   < 0        18 750       0.481   0.511    1.062
 *   0.00-0.05  16 880       0.463   0.421    0.910
 *   0.05-0.10   8 162       0.550   0.447    0.814
 *   0.10-0.15   4 053       0.597   0.452    0.758
 *   0.15-0.25   2 776       0.637   0.435    0.683
 *   > 0.25      1 239       0.699   0.375    0.537
 *
 * Monotone, sur un volume énorme, et indépendant du canal. Le fait décisif est
 * dans les deux colonnes du milieu : le taux réel est PLAT (0.51, 0.42, 0.45,
 * 0.45, 0.44, 0.38) pendant que la probabilité annoncée grimpe de 0.481 à
 * 0.699. **L'edge revendiqué par le modèle ne porte aucune information sur le
 * résultat — seulement sur l'ampleur de son erreur.** Là où le modèle
 * contredit le plus le marché, il se trompe le plus ; là où il annonce MOINS
 * que le marché (edge < 0), il est même sous-confiant (ratio 1.062).
 *
 * Coupé à 0.10 : garde 84.4% du volume avec un ratio de 0.954, contre 0.694
 * pour les 15.6% rejetés.
 *
 * Symétrie à noter : `VALUE_MIN_EDGE = 0.10` (analysis-core) EXIGE au moins
 * autant d'edge pour qu'un pick VALUE soit retenu — c'est-à-dire qu'il
 * sélectionne exactement la région que cette mesure disqualifie.
 *
 * ── Pourquoi une contrainte sur l'edge et pas une correction de plus ────────
 *
 * Trois corrections de `p̂` ont été essayées et mesurées le 2026-08-22, chacune
 * dégradant la calibration par jambe et le volume :
 *
 *   ajustement population seul          ratio 0.803   237 coupons / 80 jours
 *   + ajustement conditionné sélection  ratio 0.770   138 coupons / 60 jours
 *   + pénalité de sélection uniforme    ratio 0.699    71 coupons / 37 jours
 *
 * et la proba BRUTE des jambes survivantes montait à chaque étape (0.656 →
 * 0.707 → 0.750). Raison : le composeur filtre et classe sur la quantité
 * corrigée, donc toute correction est absorbée par la sélection. Baisser `p̂`
 * relève la barre d'EV effective, ce qui ne garde que les candidats les plus
 * extrêmes — et « extrême » et « mal estimé » sont ici la même chose. Même une
 * pénalité UNIFORME, qui ne réordonne pourtant rien, déplace le seuil
 * d'admission : tronquer par le bas une distribution biaisée conserve la queue
 * la plus biaisée. La troncature est une sélection.
 *
 * L'edge, lui, est bâti sur la COTE, qui est exogène : le composeur ne peut
 * pas la déplacer en changeant ses préférences. La contrainte retire la cause
 * (des jambes que le modèle ne sait pas estimer) au lieu de pénaliser le
 * symptôme.
 *
 * ⚠️ Conséquence assumée : `minCouponEV` devient bien plus dur à atteindre,
 * puisque l'EV d'une jambe vaut ~edge × cote. C'est le fond du problème, pas
 * un effet de bord — s'il n'existe aucun coupon à +15% d'EV construit sur des
 * jambes que le modèle sait estimer, alors ces +15% n'ont jamais existé.
 * Arbitrer `minCouponEV` contre le volume est une décision produit.
 */
export const MAX_LEG_EDGE = 0.1;

/**
 * Cote minimale d'une jambe.
 *
 * Contrainte PRODUIT avant tout : depuis que le composeur sélectionne par
 * probabilité décroissante, il va chercher les jambes les plus courtes du
 * vivier. Sans plancher, 39% des jambes publiées tombaient sous 1.20 (309 sur
 * 786 le 2026-08-22) et des coupons sortaient à 1.30 de cote combinée, avec
 * des jambes à 1.04. Ce n'est pas un produit : il faut une mise énorme pour un
 * retour dérisoire, et une seule surprise efface tout.
 *
 * Et ça ne coûte rien en ROI — la bande qu'on retire est même la pire des
 * courtes. ROI par jambe mesuré (sélections réglées, edge ≤ MAX_LEG_EDGE) :
 *
 *   cote          n        hit     ROI jambe
 *   < 1.10       346      0.945    -0.62% ± 1.30
 *   1.10-1.20    742      0.829    -5.17% ± 1.59   ← retirée
 *   1.20-1.35  2 173      0.763    -3.06% ± 1.16   ← meilleure bande à volume
 *   1.35-1.60  5 506      0.644    -4.74% ± 0.96
 *   >= 1.60   35 025      0.405    -4.83% ± 0.72
 *
 * La bande < 1.10 est la seule meilleure, mais à 346 lignes elle ne porte
 * aucun volume, et c'est celle qui produit les coupons à 1.30.
 */
export const MIN_LEG_ODDS = 1.2;

/**
 * Plafond de cote pour une jambe TEAM_TOTAL — canal-spécifique, pas un
 * MAX_LEG_EDGE générique.
 *
 * Mesuré en base le 2026-08-28 sur `coupon_proposal_leg` réglées (requête
 * ad hoc, pas encore un backtest formalisé — à re-confirmer avec le harnais
 * de backtest partagé quand il couvre les coupons) : TEAM_TOTAL est bien
 * calibré à cote courte mais s'effondre à cote longue.
 *
 *   cote          n    réel    annoncé   ratio
 *   < 1.60       12    50.0%    87.6%    0.57
 *   1.60-2.29    18    55.6%    80.9%    0.69
 *   >= 2.30      14    21.4%    59.4%    0.36   ← retirée
 *
 * Confirmé sur trois fenêtres qui se recoupent (14j, 45j, et la période
 * post-exclusion VALUE du 25/08 seule) — pas un artefact d'un canal
 * contaminant l'échantillon (voir POOL_EXCLUDED_CHANNELS pour ce cas-là).
 * Contrairement à VALUE (dupliqué, exclu entièrement), TEAM_TOTAL reste
 * admis — il fonctionne, juste pas à cette cote : régler par une borne,
 * pas désactiver le canal (feedback_fix_not_disable).
 */
export const TEAM_TOTAL_MAX_ODDS = 2.3;

// Un plancher MIN_LEG_SIGNAL_SCORE (0.6) a été essayé le 2026-08-20 pour
// forcer une vraie séparation au rang 1 (qui ne battait pas le rang 2/3 même
// après le tri par signalScore, cf. compareCouponsBySignalThenEV) — retiré le
// jour même : une fois testé avec l'outil de backtest corrigé, il écrase
// VALUE au point que SAFE domine le pool par défaut, et SAFE porte sa propre
// surconfiance jamais corrigée (ex. OVER_UNDER_HT annoncé 73.5%, réel 20%).
// Pas réintroduit sans un vrai fix de la calibration SAFE en amont.

/**
 * Plancher de probabilité calibrée pour qu'une jambe soit une "ancre" (porte
 * la probabilité jointe du coupon) plutôt qu'une jambe "valeur" (porte la
 * cote combinée) — trouvé 2026-08-15, même incident/discussion que
 * `MIN_LEG_PROBABILITY`. Le composeur automatique ne triait le pool candidat
 * QUE par `signalScore` (moyenne canal×jour×ligue, identique pour toutes les
 * jambes d'un même canal/ligue/jour) puis par EV sous contraintes — jamais
 * de mix délibéré ancre/valeur. `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0)
 * documente que la méthode manuelle qui marche mélange TOUJOURS quelques
 * jambes-ancres (70-90%+) et quelques jambes-valeur (60-75%, meilleure cote)
 * — jamais un seul mode. `ANCHOR_MIN_PROBABILITY=0.70` reprend le bas de
 * cette fourchette documentée ; pas backtesté pour le composeur automatique.
 */
export const ANCHOR_MIN_PROBABILITY = 0.7;

// EVALUATED_MARKET_CANAL moved to
// packages/analysis-core/src/coupon/evaluated-market-leg.ts 2026-09-03,
// alongside resolveEvaluatedMarketLeg (its only real reader) — part of
// making the deterministic pool logic callable from apps/vantage-worker
// without depending on this app's NestJS layer. See
// docs/vantage-centric-redesign-2026-09-01.md §9bis. Full history (why the
// mapping exists, why it isn't a reproduction of each channel's own
// selection logic, why CORRECT_SCORE stays out) preserved in that file's
// doc comment.

// ─────────────────────────────────────────────
// Bornes de composition (profils supprimés — 2026-08-22)
// ─────────────────────────────────────────────

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
   * Le composeur remplit gloutonnement jusqu'à `maxLegs`, et chaque jambe
   * ajoutée fait mécaniquement BAISSER la probabilité que le coupon tombe.
   * À 5, le coupon de rang 1 — celui présenté comme le meilleur — était celui
   * qui tombait le moins souvent :
   *
   *   rang 1 : 3.62 jambes · cote 3.16 · tombe 39.0%
   *   rang 3 : 2.44 jambes · cote 2.67 · tombe 43.9%
   *   rang 5 : 2.03 jambes · cote 1.71 · tombe 63.3%
   *
   * « Au maximum 5 jambes » ne disait pas QUAND s'arrêter et le glouton
   * répondait « jamais ». La règle d'arrêt est maintenant explicite : on
   * s'arrête dès que la cible de cote de la classe est atteinte.
   */
  maxLegs: 3,
  minCombinedOdds: 1.0,
  /** Garde-fou produit, pas un critère de sélection. */
  maxCombinedOdds: 20.0,
} as const;

/**
 * Classes de coupon — un seul paramètre chacune : la cible de cote combinée.
 *
 * Le composeur ajoute des jambes par probabilité décroissante et S'ARRÊTE dès
 * que `targetCombinedOdds` est atteinte. C'est une règle d'ARRÊT, jamais un
 * filtre : un plancher qui rejette après coup coupe la journée entière, parce
 * que le glouton produit d'abord le coupon de cote la plus COURTE (bug commis
 * le 2026-08-22 avec `minCouponEV`, 3 coupons publiés sur 2 jours au lieu de
 * 136 sur 73).
 *
 * Prix mesuré de la cote, simulé sur ~1 000 jours (n≈2 600 coupons par
 * classe, SE ~3 points) :
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
 * même nom, composantes de la clé unique de `coupon_proposal` — c'est ce qui
 * permet aux trois classes de coexister sur une même date sans migration.
 */
export type CouponClassName = 'SAFE' | 'BALANCED' | 'BOLD';

export type CouponClass = {
  name: CouponClassName;
  /** Bande de cote des jambes admises — bornes disjointes entre classes. */
  minLegOdds: number;
  maxLegOdds: number;
  maxLegs: number;
  /** Cote combinée à partir de laquelle on cesse d'ajouter des jambes. */
  targetCombinedOdds: number;
  /** Écrits tels quels dans `coupon_proposal` — clé unique, pas de migration. */
  targetOddsMin: number;
  targetOddsMax: number;
};

/**
 * Les trois classes de coupon.
 *
 * Elles se différencient par la BANDE DE COTE DES JAMBES, pas par une cible de
 * cote combinée. Une première version ne variait que la cible (2.0 / 2.5 /
 * 3.0) : les trois classes puisaient dans le même vivier, atteignaient leur
 * cible avec les mêmes jambes, et livraient le même produit — mesuré en
 * production le 2026-08-22, cotes 2.54 / 2.80 / 2.85 et ROI −3.2% / −3.8% /
 * −3.3%. Avec `maxLegs = 3` et des jambes autour de 1.44, la plage atteignable
 * va de 1.44² = 2.07 à 1.44³ = 2.99 : les trois cibles tombaient dedans.
 *
 * Découper par bande de cote de jambe règle les deux problèmes d'un coup :
 * les produits deviennent réellement distincts, et les classes ne se disputent
 * plus les mêmes jambes — les bandes étant disjointes, un même pick ne peut
 * jamais apparaître dans deux classes.
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
 * n'est pas un résultat, c'est une cellule parmi six testées.
 *
 * Ce qui EST robuste d'un découpage à l'autre, c'est la différenciation :
 * cote 2.0-2.2 / 4.5-5.5 / 11-17.7 et taux de réussite 45-48% / 17-20% /
 * 7-9%. C'est ça qu'on livre ; le ROI reste indistinguable de zéro partout.
 */
export const COUPON_CLASSES: readonly CouponClass[] = [
  {
    name: 'SAFE',
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
    name: 'BALANCED',
    minLegOdds: 1.6,
    maxLegOdds: 2.3,
    maxLegs: 3,
    targetCombinedOdds: 4.0,
    targetOddsMin: 3.0,
    targetOddsMax: 9.99,
  },
  {
    name: 'BOLD',
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

/**
 * Il n'y a volontairement NI plancher de probabilité jointe NI plancher d'EV
 * de coupon. Les deux ont existé (`minJointProbability: 0.25`,
 * `minCouponEV: 0.15`) et les deux sont incompatibles avec la façon dont le
 * composeur choisit désormais.
 *
 * `minCouponEV` était un plancher de COTE déguisé : `EV = p × cote − 1` et
 * `p` est quasi constant dans un canal, donc exiger de l'EV revient à exiger
 * des cotes longues — précisément la zone où le modèle réalise 0.694 de ce
 * qu'il annonce contre 0.954 ailleurs (cf. MAX_LEG_EDGE).
 *
 * Pire avec la composition gloutonne : le glouton prend d'abord les plus
 * fortes probabilités, donc les cotes les plus courtes, donc l'EV la plus
 * BASSE. Le premier coupon de la journée est celui qui échoue le plus
 * facilement à un plancher d'EV. Mesuré le 2026-08-22 avec un plancher à 0 :
 * 3 coupons publiés sur 2 jours, contre 136 sur 73 sans lui.
 *
 * Et la simulation qui valide ces bornes (ROI −6.57% ± 11.1 hors échantillon)
 * n'appliquait aucun des deux. Les remettre n'est pas un durcissement
 * prudent : c'est un changement non testé qui filtre sur une quantité qu'on a
 * mesurée anti-prédictive.
 */

/** Forme des bornes — volontairement large (pas `typeof COUPON_BOUNDS`, dont
 * les types littéraux issus de `as const` interdiraient toute autre valeur). */
/**
 * Borne basse de cote combinée des anciens profils LONGSHOT. Ils n'existent
 * plus, mais les `CouponProposal` générés avant le 2026-08-22 portent encore
 * ce `targetOddsMin` : c'est ce qui permet de continuer à les afficher comme
 * "Expérimental" dans l'historique.
 */
export const LEGACY_LONGSHOT_MIN_ODDS = 50.0;

export type CouponBounds = {
  minLegs: number;
  maxLegs: number;
  minCombinedOdds: number;
  maxCombinedOdds: number;
};
