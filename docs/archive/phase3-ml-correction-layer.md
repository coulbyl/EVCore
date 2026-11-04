# Phase 3 — ML Correction Layer

Référence de contexte:

- rapport initial: [edge-vs-pinnacle-2026-06-04.md](../packages/db/reports/edge-vs-pinnacle-2026-06-04.md)
- roadmap: [ROADMAP.md](../ROADMAP.md)

## Objectif

Le rôle du ML en Phase 3 n'est pas de "prédire l'inverse" du moteur actuel.

Son rôle est de:

- détecter où le modèle Poisson surestime ou sous-estime une probabilité
- apprendre des corrections contextuelles récurrentes
- recalibrer les probabilités avant la décision finale
- améliorer la sélection de marchés exploitables sans casser les signaux déjà sains

En pratique, le ML devient une couche de correction au-dessus du moteur probabiliste existant.

## Ce que le rapport nous dit

Le rapport [edge-vs-pinnacle-2026-06-04.md](../packages/db/reports/edge-vs-pinnacle-2026-06-04.md) montre déjà une structure utile:

- `SV` semble sain et exploitable
- `DRAW` est prometteur mais à faible volume
- `CONF` est mitigé
- `EV`, surtout sur `ONE_X_TWO`, semble souvent surconfiant

Exemples marquants:

- `EV / ONE_X_TWO`: edge moyen affiché positif, mais ROI Pinnacle très négatif
- `CONF / ONE_X_TWO`: hit rate correct, mais edge faible et ROI négatif
- `DRAW / ONE_X_TWO`: petit volume, mais comportement plus encourageant

Conclusion:

- il existe probablement des biais systématiques dans certaines sorties du moteur
- ces biais sont de bons candidats pour une correction ML
- il ne faut pas appliquer une logique "contrarian" globale

## Ce que le ML doit faire

Le ML doit apprendre:

- quand une proba Poisson est trop haute
- quand elle est trop basse
- dans quels contextes de ligue, marché, profil d'odds et structure de fixture cela arrive
- de combien il faut corriger cette probabilité

Le ML ne doit pas apprendre:

- à toujours contredire le moteur
- à remplacer totalement le Poisson
- à suivre mécaniquement Pinnacle

La bonne logique est:

1. le moteur Poisson produit une probabilité de base
2. le ML estime une correction
3. la proba corrigée est recalibrée
4. le backend décide si cette version corrigée est meilleure que la baseline

## Architecture cible

Le design le plus propre pour EVCore est un `correction layer`.

Pipeline cible:

1. `Poisson baseline`
   - calcule `P(home)`, `P(draw)`, `P(away)` et les autres marchés dérivés

2. `Feature extraction`
   - récupère les signaux déterministes et contextuels
   - inclut aussi les signaux de marché sharp

3. `ML correction model`
   - estime le biais de la baseline
   - produit une probabilité corrigée ou un delta

4. `Calibration layer`
   - applique une calibration finale des probabilités

5. `Decision layer`
   - conserve ou rejette la version corrigée selon les métriques de qualité

## Formes possibles de sortie ML

Trois formes sont plausibles.

### 1. Correction directe de probabilité

Le modèle prédit directement:

- `P(home)_corr`
- `P(draw)_corr`
- `P(away)_corr`

Avantage:

- simple à lire côté produit

Risque:

- plus dur à contraindre proprement

### 2. Prédiction d'un delta

Le modèle prédit:

- `delta_home`
- `delta_draw`
- `delta_away`

Puis:

- `P_corr = P_poisson + delta`

Avantage:

- colle bien à l'idée de correction
- plus facile à comparer à la baseline

Risque:

- nécessite une renormalisation rigoureuse

### 3. Re-ranking / meta-model

Le modèle ne remplace pas les probabilités, mais apprend un score de confiance sur:

- la qualité du signal
- la probabilité que l'edge affiché soit réel

Avantage:

- très utile pour filtrer les faux positifs EV

Risque:

- moins lisible qu'une correction probabiliste pure

## Recommandation pour EVCore

La meilleure option pour démarrer est:

- baseline Poisson inchangée
- modèle ML qui prédit une correction ou un score de fiabilité
- calibration finale par marché

Autrement dit:

- ne pas supprimer le moteur existant
- ne pas réécrire la décision autour du ML seul
- utiliser le ML comme filtre ou correcteur

## Features candidates

Les features les plus pertinentes pour le correction layer sont:

- probabilités Poisson brutes
- score déterministe
- forme récente
- xG for / against
- performance domicile / extérieur
- volatilité ligue
- bookmaker sharp odds (`Pinnacle`) et probabilité implicite dé-viguée
- delta entre probabilité moteur et probabilité marché
- segment d'odds
- ligue / marché / saison
- signaux shadow activables plus tard (`injuries`, `h2h`, `congestion`)

Pour `ONE_X_TWO`, les features de divergence moteur vs marché sont probablement centrales.

## Targets possibles

Deux familles de targets sont utiles.

### A. Target outcome

Apprendre:

- `HOME_WIN`
- `DRAW`
- `AWAY_WIN`

Usage:

- correction probabiliste classique

### B. Target edge validity

Apprendre si un edge affiché est:

- probablement réel
- probablement faux

Usage:

- filtrer les faux positifs du canal `EV`

Pour EVCore, la combinaison des deux est probablement la plus forte à terme, mais la première version devrait rester simple.

## Ce qu'il faut éviter

Erreurs à éviter:

- entraîner un modèle qui "fait l'inverse" du moteur sans nuance
- injecter trop tôt des marchés à couverture incomplète
- mélanger calibration, ranking et décision dans un seul score opaque
- laisser le ML remplacer silencieusement le backend comme autorité
- apprendre sur des segments trop petits ou trop bruités

## Stratégie de déploiement

Le déploiement doit être progressif.

Étape 1:

- produire un rapport `go / no-go` par `canal × marché`

Étape 2:

- cibler d'abord les segments où le biais est le plus clair
- priorité probable: `EV / ONE_X_TWO`

Étape 3:

- entraîner un premier modèle de correction hors décision prod
- comparer baseline vs corrected offline

Étape 4:

- activer en shadow mode
- journaliser les écarts et la performance

Étape 5:

- activer en prod uniquement si:
  - Brier Score meilleur
  - Calibration Error meilleure ou stable
  - ROI ajusté meilleur sur échantillon pertinent

## Règle produit recommandée

Formulation simple:

> Le ML ne doit pas deviner "le contraire" du moteur.
> Il doit apprendre où la baseline se trompe, de combien elle se trompe,
> puis corriger la probabilité de manière mesurable et réversible.

## Décision actuelle

À ce stade, la bonne suite Phase 3 est:

- continuer l'audit des biais par `canal × marché`
- isoler les segments `GO`, `WATCH`, `NO-GO`
- préparer ensuite `ml_model_version`
- puis brancher un worker ML qui entraîne une couche de correction, pas un remplacement global

En l'état, le meilleur candidat initial pour ce travail semble être:

- `EV / ONE_X_TWO`

Et le meilleur point de comparaison sain semble être:

- `SV`
