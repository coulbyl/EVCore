# Générateur déterministe — generator-v2

Régénérable : `pnpm --filter @evcore/backtest-core backtest:generator`.
Requête : `packages/backtest-core/scripts/league-report/09-fixture-features.sql`.

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

Grille de 7 bandes et critère de choix (taux de jours gagnants)
fixés dans le script avant exécution. Bande choisie sur les journées
antérieures au 2025-01-01, puis évaluée **une seule fois** ensuite.

## 1. Fenêtre de sélection (avant 2025-01-01)

| Bande | Jours | Gagnants | Perdants | % gagnants | Pire série | ROI |
| --- | --- | --- | --- | --- | --- | --- |
| cote 1.10 – 1.35 **← retenue** | 331 | 280 | 51 | 84.6 % | 3 | 1.9 % |
| cote 1.15 – 1.40 | 349 | 284 | 65 | 81.4 % | 3 | 1.2 % |
| cote 1.15 – 1.45 | 393 | 314 | 79 | 79.9 % | 3 | 0.8 % |
| cote 1.20 – 1.45 | 379 | 294 | 85 | 77.6 % | 3 | -0.1 % |
| cote 1.20 – 1.50 | 415 | 322 | 93 | 77.6 % | 3 | 1.1 % |
| cote 1.25 – 1.50 | 400 | 304 | 96 | 76.0 % | 3 | 1.2 % |
| cote 1.15 – 1.55 | 456 | 360 | 96 | 78.9 % | 3 | 2.0 % |

Bande retenue : **cote 1.10 – 1.35**, 84.6 % de jours
gagnants.

## 2. Fenêtre de validation (à partir du 2025-01-01)

| Année | Jours | Gagnants | Perdants | % gagnants | Pire série | ROI |
| --- | --- | --- | --- | --- | --- | --- |
| 2025 | 209 | 176 | 33 | 84.2 % | 3 | 0.9 % ± 6.0 |
| 2026 | 191 | 164 | 27 | 85.9 % | 3 | 3.2 % ± 6.0 |

Ensemble de la validation : **400 jours, 340
gagnants contre 60 perdants, soit
85.0 %**, pour 84.6 % en
sélection — moins d'un point
d'écart.

Cote moyenne 1.20, probabilité implicite
79.3 %, réalisé 85.0 % : un écart de
**5.7 points** en faveur du générateur.
ROI **2.0 % ± 4.3**.

## 3. Robustesse de la bande (validation)

| Bande | Jours | % gagnants | Pire série | Cote | ROI |
| --- | --- | --- | --- | --- | --- |
| cote 1.10 – 1.35 | 400 | 85.0 % | 3 | 1.20 | 2.0 % |
| cote 1.15 – 1.40 | 433 | 81.3 % | 3 | 1.24 | 0.8 % |
| cote 1.15 – 1.45 | 459 | 81.3 % | 3 | 1.26 | 1.6 % |
| cote 1.20 – 1.45 | 449 | 80.0 % | 4 | 1.28 | 2.3 % |
| cote 1.20 – 1.50 | 471 | 79.0 % | 4 | 1.29 | 1.6 % |
| cote 1.25 – 1.50 | 455 | 74.7 % | 5 | 1.33 | -1.0 % |
| cote 1.15 – 1.55 | 501 | 79.4 % | 4 | 1.28 | 0.6 % |

Toutes les bandes de la grille tiennent le même comportement : le résultat
n'est pas suspendu à un réglage fin.

## 4. Historique complet

| Année | Jours | Gagnants | Perdants | % gagnants | Pire série | ROI |
| --- | --- | --- | --- | --- | --- | --- |
| 2023 | 127 | 107 | 20 | 84.3 % | 1 | 2.3 % ± 7.8 |
| 2024 | 204 | 173 | 31 | 84.8 % | 3 | 1.6 % ± 6.0 |
| 2025 | 209 | 176 | 33 | 84.2 % | 3 | 0.9 % ± 6.0 |
| 2026 | 191 | 164 | 27 | 85.9 % | 3 | 3.2 % ± 6.0 |

Sur 731 jours : **620 gagnants, 111
perdants**, 84.8 %. Pire série :
**3 jours consécutifs**, 0 série de quatre
jours ou plus.

| Longueur de la série perdante | Occurrences | Part des séries |
| --- | --- | --- |
| 1 jour | 85 | 88.5 % |
| 2 jours | 7 | 7.3 % |
| 3 jours | 4 | 4.2 % |

## 5. Le résultat dépend-il du courtage ?

Au meilleur prix des books, ROI 1.9 %. Au prix consensus,
1.5 %. L'écart est de
0.4 point : **l'edge
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
