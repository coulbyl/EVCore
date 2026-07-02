# Ligues pauvres en données — mal racine de calibration

Date : 2026-07-01
Statut : **diagnostic posé, traitement reporté** (à reprendre en évaluant d'abord si on peut récupérer les données manquantes)

---

## Résumé

Le modèle probabiliste 1X2 est **bien calibré là où il y a des données, et mauvais uniquement là où elles manquent**. Ce n'est pas un biais uniforme du modèle : c'est un problème de **données d'entrée** (xG absent, historique trop court). Les canaux stakés (VALUE surtout) héritent de cette miscalibration sous forme de pertes concentrées sur ces ligues.

Le plancher d'edge VALUE (`VALUE_MIN_EDGE`, voir `packages/analysis-core/src/strategies/value.strategy.ts`) est un **garde-fou** qui atténue le symptôme mais ne corrige pas la cause. La correction de fond est ici.

---

## Preuve (backtest calibration, `POST /backtest/calibration`)

Métrique : `calibrationError` (écart moyen |proba prédite − fréquence réelle| par bucket) sur `model_run`, fenêtre 2025-07-01 → 2026-06-30. Seuil PASS : `calErr ≤ 0.05`, `brier ≤ 0.65`.

**Bien calibré (référence, grosses ligues riches en données) :**

| Ligue | n   | calErr | brier |
| ----- | --- | ------ | ----- |
| SP2   | 456 | 0.008  | 0.636 |
| SA    | 369 | 0.010  | 0.616 |
| CH    | 545 | 0.016  | 0.642 |
| EL1   | 545 | 0.017  | 0.635 |
| EL2   | 545 | 0.018  | 0.635 |
| LL    | 370 | 0.019  | 0.611 |

**Miscalibré (FAIL) — corrélé au manque de données :**

| Ligue | n   | calErr | Type / cause probable                           |
| ----- | --- | ------ | ----------------------------------------------- |
| WCQCA | 36  | 0.243  | Qualif. mondiale — pas de xG, cross-comp bruité |
| WCQAS | 8   | 0.176  | idem (+ échantillon minuscule)                  |
| UNL   | 4   | 0.142  | Nations League — sélections, pas de xG          |
| WCQSA | 10  | 0.097  | Qualif. mondiale                                |
| ISL1  | 84  | 0.084  | Petite ligue (Islande)                          |
| POL2  | 298 | 0.063  | 2e division                                     |
| POL1  | 296 | 0.062  | Ligue moyenne                                   |
| WC    | 78  | 0.061  | Coupe du Monde — cross-comp fallback            |
| WCQAF | 107 | 0.061  | Qualif. mondiale                                |
| LAT1  | 79  | 0.057  | Petite ligue (Lettonie)                         |
| FRI   | 184 | 0.054  | Amicaux — pas de xG, contexte non compétitif    |
| FIN1  | 132 | 0.051  | Petite ligue (Finlande)                         |
| NOR2  | 180 | 0.051  | 2e division                                     |

→ Le classement des FAIL suit exactement l'axe **richesse des données**, pas une famille tactique ou géographique.

---

## Pourquoi (par type de ligue)

1. **Sélections nationales** (WC, WCQ\*, UNL, FRI) : l'API ne fournit pas de xG fiable pour les compétitions internationales. Le modèle tombe sur le **cross-comp fallback** (`NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT = 0.0` → xG ignoré, forme uniquement) : signal appauvri, λ mal estimés. Les amicaux ajoutent un biais de contexte (matchs non compétitifs).
2. **Petites divisions / petits championnats** (ISL1, LAT1, FIN1, NOR2, POL2, EST1) : historique court, xG rare ou absent, forte volatilité → estimation λ bruitée.
3. **Débuts de saison** (transverse) : les fixtures d'août n'ont pas d'historique intra-saison → souvent skippées (pas de `model_run`), ou analysées sur des stats trop maigres.

Conséquence commune : λ_home/λ_away mal estimés → **toute la distribution dérivée** (1X2, O/U, BTTS…) est décalée, et le modèle est **sur-confiant** (il croit avoir un edge que le marché, lui, price correctement).

---

## Pourquoi le plancher d'edge ne suffit pas

Le plancher VALUE (`edge = proba − 1/cote ≥ 0.10`) retire les faux edges **petits**. Mais dans une ligue sur-confiante, la miscalibration produit des faux edges **grands** (le modèle dit 0.67 là où la réalité est 0.47) qui **passent** le plancher. D'où : après plancher, WC reste à **−30% ROI** (n=16) alors que le global VALUE monte à +25%.

Le plancher traite le symptôme « winner's curse » global ; il ne peut pas distinguer un gros edge réel d'un gros edge fictif dû à la miscalibration. Seul un modèle mieux calibré (ou une suppression par ligue) le peut.

---

## Pistes de traitement (à évaluer un autre jour)

Ordre = récupérer la donnée d'abord, corriger le modèle ensuite, garde-fous en dernier recours.

1. **Récupérer les données manquantes (à explorer en priorité).**
   - xG pour les compétitions internationales / petites ligues : autre fournisseur, scraping, ou proxy (tirs, xG dérivé). Voir `ETL_PLAYBOOK.md`.
   - Densifier l'historique (plus de saisons importées) pour les petites ligues.
   - Question ouverte : **quelles ligues FAIL ont une source xG accessible ?** Si oui, l'import résout la racine sans toucher au modèle.
2. **Recalibration des probas (shrinkage vers le marché).**
   - Étendre le blend empirique au-delà du 1X2 (`rebalanceThreeWayProbabilities` dans `packages/analysis-core/src/probability/match-stats.ts` ne couvre que 1X2) : rétrécir la proba modèle vers l'implicite du book / la base rate, **avec un poids fonction de la fiabilité des données de la ligue** (fort shrink si data-poor).
   - Alternative : calibration post-hoc (Platt / isotonic) par segment de fiabilité.
3. **Garde-fous par ligue (déjà en place, à étendre si (1) et (2) tardent).**
   - EV threshold relevé (`LEAGUE_EV_THRESHOLD_MAP`, ex. WC/WCQ/FRI à 0.15).
   - Suspension VALUE ciblée (`getValueMinEdge`, ex. FRI) pour les ligues structurellement sans signal.

---

## Ne pas refaire (leçons de la session 2026-07-01)

- **Calibrer sur la fenêtre récente, pas l'historique complet** : l'historique mélange des versions antérieures du modèle. Des suspensions VALUE (SA, SWE1) posées sur l'historique complet étaient fausses — récent = sain.
- **Un manque de model_run n'est pas un bug** : les fixtures sans stats (débuts de saison) sont skippées légitimement ; elles existent à l'identique avec/sans changement de code, donc s'annulent dans une comparaison.

## Références

- Plancher d'edge & winner's curse : mémoire projet `project_value_edge_floor`.
- Correction modèle mi-temps (même esprit « corriger la racine, pas désactiver ») : `packages/analysis-core/src/probability/poisson.ts` (`FIRST_HALF_GOAL_FRACTION`).
- Calibration WC : `docs/wc2026-calibration.md`.
