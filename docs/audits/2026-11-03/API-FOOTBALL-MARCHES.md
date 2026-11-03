# Tout ce qu'API-Football offre d'exploitable

_Inventaire du 03/11 : sonde `probe:inventory` (catalogue `/odds/bets`, puis les cotes du prochain match de dix championnats : Premier League, Liga, Serie A, Bundesliga, Ligue 1, Portugal, Pays-Bas, Ligue des champions, MLS, Brésil). 338 types de paris au catalogue ; 129 cotés sur au moins un de ces dix matchs. Plan Pro, 7 500 requêtes par jour._

> ⚠️ **L'abonnement Pro se termine le 05/11/2026 à 11:55 UTC.** Sans renouvellement, plus de cotes, de matchs ni de stats.

Règle de lecture (corrigée par l'utilisateur le 03/11) : un marché est exploitable s'il est **coté chez un book qu'on ingère** et s'il **se règle sur une donnée qu'on a**. Le joueur parie chez le book de son choix ; on affiche la cote qu'on a. 1xBet reste la cote préférée quand elle existe.

## 1. Ce qu'on ingère déjà

|                     id | Marché                                                            | Books (sur 10 matchs)                                 | Usage                                        |
| ---------------------: | ----------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
|                      1 | Match Winner (1X2)                                                | 10 books, 1xBet 9                                     | moteur, Favori, Combiné, Nul                 |
|                      2 | Home/Away (remboursé si nul)                                      | 6 books                                               | moteur                                       |
|                 4 / 19 | Handicap asiatique, match / mi-temps                              | 8 / 7 books                                           | référence                                    |
|             5 / 6 / 26 | Plus/moins buts, match / 1re / 2e mi-temps                        | 8–9 books                                             | moteur, Combiné IA                           |
|                      7 | Mi-temps / fin de match                                           | 6 books                                               | moteur                                       |
|                      8 | Les deux marquent                                                 | 7 books                                               | moteur, Chasseur BTTS                        |
|                     10 | Score exact                                                       | 9 books                                               | Chasseur Score                               |
|      11 / 14 / 21 / 22 | Mi-temps la plus prolifique, premier buteur (équipe), pair/impair | 2–9 books                                             | référence                                    |
|                12 / 13 | Double chance, vainqueur 1re mi-temps                             | 8–9 books                                             | moteur                                       |
|                16 / 17 | Total d'une équipe                                                | 7 books                                               | moteur                                       |
|                24 / 25 | Résultat + BTTS, résultat + total                                 | 3 books                                               | moteur                                       |
| 27 / 28 / 29 / 30 / 39 | Clean sheet, gagner sans encaisser, gagner une mi-temps           | 1–3 books                                             | moteur                                       |
|                     45 | Corners plus/moins                                                | Bet365 9, Betano 9, **1xBet 8**, Pinnacle 6           | Chasseur Corners                             |
|                     77 | Corners 1re mi-temps                                              | Bet365 9, Betano 9, 1xBet 7, Pinnacle 6               | référence (pas de stat mi-temps pour régler) |
|                     80 | Cartons plus/moins                                                | Bet365, Pinnacle, 1xBet, Betano : **2 matchs sur 10** | référence ; 1xBet gardé depuis #297          |

## 2. Corners : le marché le plus riche, et presque tout non exploité

Les corners sont cotés sur 8 ou 9 matchs sur 10, **y compris chez 1xBet**, sous une dizaine de formes. Ils se règlent tous sur `corner_kicks`, présent pour ~47 800 matchs, une ligne par équipe, en temps plein.

|                  id | Marché                                             | Books                                       | Se règle sur nos stats ?        |
| ------------------: | -------------------------------------------------- | ------------------------------------------- | ------------------------------- |
|             57 / 58 | Corners d'une équipe, plus/moins                   | Bet365 9, Betano 9, **1xBet 8**, Pinnacle 6 | oui (corners par équipe)        |
|                  56 | Handicap asiatique corners                         | Betano 9, Bet365 8, Pinnacle 6, **1xBet 5** | oui                             |
|                  55 | Corners 1X2 (qui en obtient le plus)               | Betano 9, **1xBet 8**                       | oui                             |
|                 339 | Corners double chance                              | **1xBet 8**                                 | oui                             |
|                 338 | Corners pair/impair                                | 1xBet 8, Betano 5                           | oui (sans intérêt : 50/50 taxé) |
|                 239 | Handicap européen corners                          | Bet365 8                                    | oui                             |
|                  85 | Total corners à 3 issues                           | Bet365 9                                    | oui                             |
|                 295 | Corners par tranche (6–8, 9–11…)                   | Bet365 9                                    | oui                             |
|                 249 | Multicorners (corners mi-temps × mi-temps)         | Bet365 7                                    | non (mi-temps)                  |
| 247 / 297 / 324–329 | Course aux corners, corners par tranche de minutes | Bet365                                      | non (minute du corner absente)  |

**Priorité 1 : corners par équipe (57/58) et corners 1X2 (55).** Ils sont cotés chez 1xBet, se règlent sur nos stats et apportent une autre lecture du match que le total. Même forme que le Chasseur Corners : mesure de calibration du marché d'abord, puis le côté le moins cher.

## 3. Tirs, tirs cadrés, fautes, hors-jeu, arrêts : au catalogue, mais presque jamais cotés

|                              id | Marché                                      | Books (sur 10 matchs) |
| ------------------------------: | ------------------------------------------- | --------------------- |
|                              87 | Tirs cadrés, total                          | Bet365 **2**          |
|                             211 | Tirs, total                                 | Bet365 **2**          |
|                       176 / 340 | Tirs cadrés 1X2, tirs 1X2                   | Bet365 2              |
|     240 / 241 / 269 / 275 / 276 | Tirs d'un joueur, tirs cadrés d'un joueur   | Bet365 2–9            |
|                       266 / 267 | Fautes d'un joueur, arrêts du gardien       | Bet365 2              |
| 88 / 89 / 220 / 221 / 243 / 244 | Tirs et tirs cadrés par équipe              | **jamais**            |
|                   164–169 / 313 | Hors-jeu (total, 1X2, handicap, par équipe) | **jamais**            |
|             170–175 / 314 / 343 | Fautes (total, 1X2, handicap, par équipe)   | **jamais**            |
|                   315–320 / 323 | Arrêts (total, 1X2, handicap)               | **jamais**            |

Les deux matchs cotés en tirs et cartons sont les mêmes (Ligue des champions, Galatasaray). **Hors des grandes affiches européennes, Bet365 ne sert pas ces marchés dans le flux, et aucun autre book ne le fait.** Fautes et hors-jeu ne sont cotés nulle part sur l'échantillon.

On a de quoi les régler : `total_shots`, `shots_on_goal`, `fouls`, `offsides`, `goalkeeper_saves` existent pour ~45 000 à 47 600 matchs. Mais sans prix, il n'y a pas de pari à proposer. Un Chasseur Tirs aurait un match tous les quelques jours au mieux.

**Proposition** : ingérer 87 (tirs cadrés) et 211 (tirs) chez Bet365, comme le prix de référence des cartons, ce qui demande une migration de l'enum `Market`. On compte ensuite sur deux semaines combien de matchs par jour sont cotés. Un produit ne vient que si le volume suit, par exemple sur les soirs de coupe d'Europe.

## 4. Les autres marchés cotés qu'on n'ingère pas

| Famille              | Exemples (id)                                                                                                                                                                  | Books                       | Intérêt                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Mi-temps             | 3 (vainqueur 2e mi-temps), 20 / 33 (double chance par mi-temps), 34 / 35 (BTTS par mi-temps), 105–108 (total d'équipe par mi-temps), 109 / 182 (remboursé si nul par mi-temps) | 4–9 books, souvent 1xBet    | réglables sur le score à la mi-temps qu'on a déjà ; famille « mi-temps » du moteur (`docs/prediction-engine-families.md`) |
| Nombre exact de buts | 38, 40, 41, 42, 46, 349                                                                                                                                                        | 3 books                     | réglable ; marges élevées attendues                                                                                       |
| Écart, victoire      | 47 (écart), 32 / 37 / 53 (gagner les deux mi-temps), 222 (remonter et gagner), 110 (nul avec buts)                                                                             | 1–3 books                   | réglable                                                                                                                  |
| Buteurs              | 92, 93, 94, 218, 219, 231, 257                                                                                                                                                 | Bet365 10                   | demande les buteurs (`/fixtures/events`), non collectés                                                                   |
| Minutes              | 54, 136–139 (1X2 à 10/15/30/60/75 min)                                                                                                                                         | Bet365, Marathonbet, Betano | demande les minutes des buts (événements), non collectés                                                                  |

## 5. Les données, hors cotes

Stats de match en base (`fixture_statistic`, collectées chaque nuit à 04:00 UTC) :

| Stat                                     |                                   Matchs |
| ---------------------------------------- | ---------------------------------------: |
| corners, tirs cadrés / non cadrés, tirs  |                          47 578 – 47 790 |
| fautes, tirs contrés, possession, arrêts |                          47 042 – 47 504 |
| cartons jaunes                           |                                   46 963 |
| tirs dans / hors de la surface, passes   |                                  ~46 200 |
| hors-jeu                                 |                                   44 860 |
| xG                                       |                                   27 609 |
| cartons rouges                           | 12 462 (écrite seulement s'il y en a eu) |

Non collectés, offerts par l'API : événements du match (buts et cartons à la minute, remplacements), compositions, blessures (`/injuries`), stats par joueur (`/fixtures/players`), stats par mi-temps (`half` de `/fixtures/statistics`).

## 6. Ces données pour le moteur : mesuré, elles n'apportent rien au-delà de la cote

Le moteur est derrière le marché : Brier 0,639 contre 0,599, poids optimal 0 % (CLAUDE.md). Une stat ne l'aide que si elle explique **ce que la cote de clôture ne dit pas**, c'est-à-dire le résidu entre le réalisé et la probabilité du marché. C'est ce qu'on a mesuré (`scripts/match-stats-residual.py`, copie du 03/11).

**Méthode.**

- Sur chaque match fini avec une clôture Pinnacle à moins de 24 h, on prend la moyenne d'avant-match de chaque équipe sur ses 8 derniers matchs (puis 5) : buts, tirs cadrés, tirs, tirs dans la surface, corners, xG, possession et fautes, pour et contre.
- Variables testées : l'écart entre les équipes pour le 1X2, la somme des deux pour le plus/moins.
- Deux régressions logistiques : la probabilité du marché recalibrée, puis la même avec ces variables.
- Apprentissage avant le 01/07/2025, test après : 7 000 à 11 700 matchs selon la variable.

**Résultat, en gain de log-loss hors échantillon** (‰, avec un intervalle à 95 % ; positif = les stats aident) :

| Cible               |         Buts | Tirs, cadrés, surface, corners |           xG |         Tout |
| ------------------- | -----------: | -----------------------------: | -----------: | -----------: |
| Victoire à domicile | +0,00 ± 0,08 |                   −0,01 ± 0,40 | +0,05 ± 0,07 | −0,22 ± 0,90 |
| Nul                 | +0,03 ± 0,13 |                   +0,01 ± 0,35 | −0,18 ± 0,28 | −0,23 ± 0,59 |
| Plus de 2,5 buts    | −0,00 ± 0,00 |                   −2,11 ± 1,66 | −1,50 ± 1,53 | −2,09 ± 2,38 |

Sur 5 matchs : les mêmes ordres de grandeur, aucun gain hors du bruit (meilleur : +0,45 ± 1,11 ‰ sur le plus/moins). Les BTTS ont trop peu de clôtures Pinnacle anciennes pour être mesurés.

**Lecture.** La cote de clôture contient déjà tout ce que disent les tirs, les xG et les corners des dernières semaines : les ajouter ne bouge pas le log-loss d'un millième. Le Brier reste identique à la 4e décimale. Rendre le moteur meilleur sur ces données le rapprocherait du marché, sans jamais le dépasser. Ce n'est donc pas une piste pour battre la cote.

**Là où les stats restent utiles :**

- **régler** les marchés de stats (corners, tirs, cartons), ce qu'elles font déjà pour le Chasseur Corners ;
- **les marchés de stats eux-mêmes**, que les books soignent moins : la même étude refaite sur les lignes de corners (prix Pinnacle et 1xBet contre `corner_kicks`) dira si un modèle maison voit quelque chose que la cote corners ne voit pas. C'est l'hypothèse ML v2 (phase 3), à mesurer de la même façon, sur le résidu.

## 7. Ordre proposé

1. Renouveler l'abonnement avant le 05/11.
2. Ingérer les corners par équipe (57/58), corners 1X2 (55), corners handicap (56) ; mesurer leur calibration sur deux semaines, puis les chasseurs correspondants.
3. Étude du résidu sur les marchés de corners (§ 6, dernière ligne) ; sur les buts, elle est faite : rien à gagner.
4. Ingérer tirs et tirs cadrés Bet365 (87, 211), compter le volume ; produit seulement s'il suit.
5. Plus tard, si un produit le demande : événements du match (buteurs, minutes), stats par mi-temps (corners mi-temps).
