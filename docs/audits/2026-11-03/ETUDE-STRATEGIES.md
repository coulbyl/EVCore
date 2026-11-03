# Améliorer chaque stratégie, en ajouter : l'étude complète

_03/11/2026. Demande : « une vraie étude, avec tous les outils, pour améliorer le produit, améliorer chaque stratégie et en ajouter de nouvelles qui intéressent les gens, buteurs et paris à la minute inclus, et ce que ça coûte en plan API-Football »._

_Sources : copie de prod du 03/11 04:01 (base locale) ; API-Football avec la clé du `.env` (sonde d'inventaire, 399 matchs finis de 10 championnats avec événements et stats par joueur, cotes buteurs de 10 matchs finis) ; audits précédents (`HUNTERS.md`, `CORNERS.md`, `BILAN-IA.md`, `COMBINE-IA-4-10.md`, `API-FOOTBALL-MARCHES.md`). Scripts dans `scripts/`._

## 0. Réponse courte

1. **Les stratégies en place tiennent ce qu'elles annoncent.** Depuis le 13/10, jambe par jambe : Favori 15/18, Combiné 39/46, Cote 2 8/10, toutes au-dessus de la fréquence annoncée. Les chasseurs ont une semaine, trop tôt pour juger. Aucune règle n'est à changer ; les seuls leviers mesurables sont **le coût** (la marge payée) et **le plafond de cote 1,80**, déjà appliqués.
2. **On n'améliorera pas le moteur avec les stats de match** : mesuré hors échantillon sur 7 000 à 11 700 matchs, tirs, xG et corners n'ajoutent rien à la cote de clôture (`API-FOOTBALL-MARCHES.md` § 6). Le marché les contient déjà.
3. **Les nouveaux produits les plus solides demandent zéro ingestion** : les marchés de mi-temps sont déjà collectés chez 1xBet et calibrés chez Pinnacle à 5 % de marge. Un **Chasseur Nul à la mi-temps** (40 % de réussite, cote ~2,4) se livre tout de suite.
4. **Corners par équipe et corners 1X2** : cotés chez 1xBet sur 8 matchs sur 10, réglables sur nos stats, prévisibles à la marge seulement (le marché fera le prix). Deux chasseurs de plus, une petite ingestion.
5. **Buteurs : le marché que les gens veulent, et le plus cher.** Bet365 cote 40 à 50 joueurs par match. Première mesure sur 10 matchs : les cotes impliquent 8 buteurs par match, il y en a 2 à 3. Un joueur coté 2,5–4 (annoncé 32 %) marque 13 % du temps. Un produit « Buteur du jour » est possible comme **pari plaisir à la fréquence réelle affichée**, jamais comme avantage. Il faut 4 semaines de collecte avant de le montrer.
6. **Paris à la minute** (1X2 à la 15e, 30e, 60e ; premier but avant la 30e) : cotés chez Marathonbet et Betano, calibrés d'après nos fréquences réelles, réglables avec les événements de match. Produit possible, mais sans retour de données tant que les événements ne sont pas collectés.
7. **Tirs cadrés par joueur** : Bet365 sur 9 grands matchs sur 10, réglables avec les stats par joueur ; un attaquant titulaire cadre au moins un tir 44 % du temps. Produit candidat, même chemin que les buteurs.
8. **Coût API-Football : zéro changement de plan.** Un seul appel `/fixtures?ids=` ramène 20 matchs avec événements, compositions, stats et stats par joueur : en remplaçant l'appel stats actuel (1 par match), on gagne ~90 appels par jour **et** on obtient buteurs, minutes et stats joueurs gratuitement. Les cotes buteurs et minutes sont déjà dans l'appel `/odds` par match. Le plan Pro (7 500 par jour, ~700 à 1 000 utilisés) suffit. **L'abonnement expire le 05/11 à 11:55 UTC.**

## 1. API-Football : quota, plan, ce que chaque donnée coûte

| Plan             | Requêtes / jour |      Prix | Notre usage                                                                         |
| ---------------- | --------------: | --------: | ----------------------------------------------------------------------------------- |
| Free             |             100 |       0 $ | —                                                                                   |
| **Pro (actuel)** |           7 500 | 19 $/mois | 721 utilisées à 10 h UTC le 03/11 ; ~700 à 1 500 par jour selon le volume de matchs |
| Ultra            |          75 000 | 29 $/mois | inutile à ce jour                                                                   |
| Mega             |         150 000 | 39 $/mois | inutile                                                                             |

Prix relevés sur des comparatifs tiers ([getbruin.com](https://getbruin.com/docs/ingestr/soccer-sources/api-football.html), [thestatsapi.com](https://www.thestatsapi.com/blog/thestatsapi-vs-api-football)) : à vérifier sur la page officielle au renouvellement. Pas de dépassement facturé : au-delà du quota, les appels échouent.

**Ce que coûte chaque donnée nouvelle** (mesuré avec la clé le 03/11) :

| Donnée                                                                                                       | Appel                                                       |                                             Coût par jour (≈ 100 matchs finis, 25 à 225 selon le jour) |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -----------------------------------------------------------------------------------------------------: |
| Événements (buts, buteurs, passeurs, cartons, minutes), compositions, stats d'équipe **et** stats par joueur | `/fixtures?ids=a-b-c…` (20 matchs par appel, vérifié)       | **5 à 12 appels** — et il **remplace** `/fixtures/statistics` (1 par match aujourd'hui, ~100 par jour) |
| Cotes buteurs, minutes, tirs joueurs                                                                         | déjà dans `/odds?fixture=` (tous les books, tous les paris) |                                                                                                  **0** |
| Compositions avant coup d'envoi (titulaires, ~1 h avant)                                                     | `/fixtures?ids=` sur les matchs de l'heure                  |                                                                                                    ~10 |
| Rattrapage de l'historique des événements (47 800 matchs avec stats)                                         | 2 400 appels une fois                                       |                                                                        tient dans une journée de quota |
| Effectifs (pour apparier les noms des cotes aux joueurs)                                                     | `/players/squads?team=`                                     |                                                         1 par équipe, ~1 300 une fois, puis au mercato |

Conclusion : **tout ce que l'étude propose tient dans le plan Pro**, avec moins d'appels qu'aujourd'hui. Un plan Ultra ne servirait qu'à des cotes en direct ou à des stats par joueur sur toute la planète, hors sujet.

## 2. Chaque stratégie existante, mesurée

Jambes de rang 1 réglées depuis le 13/10 (copie du 03/11), fréquence annoncée = fréquence du marché sans marge quand elle est stockée, sinon la probabilité du moteur ; marge = marge 1xBet payée ; « à mise fixe » = sur chaque jambe, à la cote jouée.

| Produit                                      | Jambes réglées | Gagnées | Annoncé | Réalisé | Cote moy. | Marge 1xBet | À mise fixe | Jours gagnés |
| -------------------------------------------- | -------------: | ------: | ------: | ------: | --------: | ----------: | ----------: | -----------: |
| Favori du jour (1,10–1,35)                   |             18 |      15 |  79,8 % |  83,3 % |      1,22 |       6,7 % |      +1,0 % |      15 / 18 |
| Combiné du jour (moteur, 1,20–1,50)          |             46 |      39 |  83,9 % |  84,8 % |      1,13 |       8,9 % |      −4,6 % |      14 / 20 |
| Coupon cote 2                                |             10 |       8 |  69,4 % |  80,0 % |      1,43 |       5,3 % |     +14,3 % |        3 / 5 |
| Chasseur Les deux marquent                   |              5 |       1 |  55,8 % |  20,0 % |      1,66 |       7,5 % |       −70 % |        1 / 5 |
| Chasseur Nul                                 |              6 |       1 |  28,7 % |  16,7 % |      3,42 |       2,7 % |       −39 % |        1 / 6 |
| Chasseur Score exact                         |              6 |       1 |  14,2 % |  16,7 % |      5,42 |           — |        −8 % |        1 / 6 |
| Chasseur Corners                             |              3 |       3 |  52,6 % |   100 % |      1,80 |       6,8 % |       +80 % |        3 / 3 |
| _Retirés_ : Coupon long (moteur 2,5–5)       |             37 |      26 |  64,9 % |  70,3 % |      1,53 |       8,4 % |      +6,5 % |       6 / 16 |
| _Retirés_ : Coupon prix 5–15                 |             42 |      19 |  39,1 % |  45,2 % |      2,36 |       9,2 % |      +7,2 % |       3 / 21 |
| _Coupé le 03/11_ : Combiné IA 2 jambes (LLM) |             36 |      32 |  80,6 % |  88,9 % |      1,18 |       8,8 % |      +4,6 % |      13 / 16 |

Lecture, et ce qui peut s'améliorer :

- **Favori, Combiné, Cote 2 : calibrés ou mieux.** Le réalisé est au-dessus de l'annoncé sur les trois. Sur 10 à 46 jambes, l'intervalle vaut ± 10 à 25 points : on ne conclut rien de plus que « rien ne cloche ». Le seul levier est le coût : 6,7 à 8,9 % de marge payée par jambe, quand le 1X2 des grands championnats chez 1xBet coûte 1,5 %. Le Combiné paie 8,9 % par jambe sur des cotes de 1,13 : c'est là que part le résultat à mise fixe (−4,6 % pour 84,8 % de réussite). **Piste** : sur le Combiné, préférer à chance égale la jambe à la marge la plus basse (les produits « prix » le font déjà, le Combiné classe par probabilité calibrée). À mesurer sur un mois avant de changer.
- **Chasseurs : une semaine, rien à conclure** (`CHASSEURS-EN-DIRECT.md`). Au prix du marché, BTTS à 1 sur 5 arrive une fois sur dix, Nul à 1 sur 6 quatre fois sur dix. Relecture le 10/12.
- **Les retirés avaient raison d'être retirés** : le coupon long gagnait 6 jours sur 16 et le 5–15 3 sur 21, c'est l'arithmétique des jambes, pas un défaut.
- **Le Combiné IA à 2 jambes** faisait 13 jours sur 16 avec des jambes à 1,18 : c'est le Combiné du moteur en plus cher. Remplacé par le Combiné IA 4–10 (§ 2.3).

### 2.1 Décisions et Notre sélection : les canaux du moteur par tranche de cote

Sélections de rang 1 réglées sur 90 jours (`channel_selection_deduped`, hors méta-canaux). Ratio = réalisé ÷ annoncé.

| Canal                                 |       < 1,45 |  1,45 – 1,80 |  1,80 – 2,50 |    2,50 et + |
| ------------------------------------- | -----------: | -----------: | -----------: | -----------: |
| DOMINANT                              |   1,15 (299) |   0,92 (348) |   0,75 (269) |   0,57 (133) |
| GOALS                                 | 0,97 (2 888) | 0,90 (1 757) | 0,82 (1 466) |   0,82 (111) |
| BTTS                                  |   1,06 (481) | 0,98 (1 276) |   0,83 (639) |            — |
| DOUBLE_CHANCE                         | 0,98 (3 234) |   0,79 (143) |            — |            — |
| TEAM_TOTAL                            | 0,96 (3 479) | 0,83 (1 796) | 0,78 (1 190) |            — |
| DRAW_NO_BET                           | 1,12 (1 650) |   0,93 (604) |   0,81 (408) |   0,69 (273) |
| WIN_EITHER_HALF                       | 1,14 (2 025) | 0,98 (1 674) |   0,83 (947) |            — |
| OVER_UNDER_HT                         |   1,02 (469) |   0,83 (203) |            — |            — |
| FIRST_HALF                            |            — |            — |   0,94 (375) |   0,96 (119) |
| DRAW                                  |            — |            — |            — | 0,95 (1 978) |
| CLEAN_SHEET                           |            — |   1,23 (118) | 1,05 (1 107) | 0,82 (3 799) |
| WIN_TO_NIL                            |            — |            — |   1,24 (488) | 0,86 (3 666) |
| VANTAGE (IA)                          | 1,01 (1 297) | 0,98 (1 634) |   0,84 (905) | 0,83 (1 209) |
| VALUE / SAFE (filtres, plus affichés) |         0,90 |  0,74 – 0,85 |         0,67 |         0,49 |

Ce que ça dit :

- **Le plafond à 1,80 est la bonne coupe, pour tous les canaux** : au-dessus, tout tombe entre 0,57 et 0,86. C'est déjà la règle des produits.
- **Sous 1,45, quatre canaux sous-annoncent** (DOMINANT 1,15, DRAW_NO_BET 1,12, WIN_EITHER_HALF 1,14, BTTS 1,06) : la chance affichée est prudente, pas trompeuse. La pastille canal × compétition sur 90 jours corrige déjà le niveau par championnat ; rien à faire de plus.
- **Deux canaux annoncent trop entre 1,45 et 1,80** : DOUBLE_CHANCE (0,79, 143 jambes) et TEAM_TOTAL (0,83, 1 796 jambes). TEAM_TOTAL a du volume : **piste** de recalibration de sa courbe de retrait (shrinkage) sur la tranche 1,45–1,80, à rejouer avec le backtest existant (`db:backtest:team-total-shrinkage-calibration`).
- **FIRST_HALF et DRAW tiennent au-dessus de 1,80** (0,94–0,96) : ce sont les deux seuls. Le Chasseur Nul s'appuie sur le second ; un **Chasseur mi-temps** peut s'appuyer sur le premier (§ 3.1).

### 2.2 Avis de l'IA

`BILAN-IA.md` et `AVIS-IA-ABSTENTION.md` : la v4 et la v5 sont calibrées (1,05 et 1,10 entre 1,45 et 1,80) et ne battent pas la cote. Depuis le 30/10 l'IA voit 100 % des matchs et en joue 80 %. La v6 (#295) écrit ses refus comme un avis sur le match. Levier restant : la part de jeu, 82 % contre un budget de 3 sur 10 demandé au prompt ; un plafond déterministe (n'afficher que les N avis les plus sûrs du jour) est la seule façon de la tenir. À décider après la lecture de v6 vers le 10/11.

### 2.3 Combiné IA 4–10

Livré le 03/11 (#296) : 3 à 4 avis joués par l'IA, 1xBet 1,45–1,80, un par championnat, le moins cher d'abord. Rejeu sur 44 jours : composé 36 jours, cote ~5,2, gagné 1 jour sur 3 pour 1 sur 4 annoncé. Première lecture le 17/11 (10 jours), jugée jambe par jambe.

## 3. Nouveaux marchés d'équipe

### 3.1 Mi-temps : déjà collecté, déjà calibré, livrable tout de suite

Clôtures Pinnacle (moins de 24 h), matchs finis avec score à la mi-temps :

| Marché                        | Matchs | Marché sans marge |    Réalisé | Marge Pinnacle | Cote type |
| ----------------------------- | -----: | ----------------: | ---------: | -------------: | --------: |
| 1X2 mi-temps — domicile       | 14 291 |            34,8 % |     34,8 % |          4,7 % |         — |
| 1X2 mi-temps — **nul**        | 14 291 |            39,7 % | **40,0 %** |          4,7 % |  **2,44** |
| 1X2 mi-temps — extérieur      | 14 291 |            25,5 % |     25,1 % |          4,7 % |         — |
| Plus de 0,5 but à la mi-temps |  4 334 |            67,4 % |     67,1 % |          5,9 % |      1,41 |
| Plus de 1,5 but à la mi-temps |  7 865 |            38,5 % |     38,7 % |          5,5 % |      2,53 |

Fréquences brutes depuis le 01/07/2025 (24 950 matchs) : les deux marquent en 1re mi-temps 20,0 % ; domicile mène à la mi-temps 34,1 % ; domicile gagne les deux mi-temps 13,2 % ; mi-temps et fin de match pour le domicile 26,6 %.

1xBet cote `FIRST_HALF_WINNER`, `OVER_UNDER_HT`, `HALF_TIME_FULL_TIME` et `ASIAN_HANDICAP_HT` sur **1 143 matchs sur 1 144** depuis le 20/10 : tout est déjà en base, avec la marge 1xBet.

**Produit proposé : Chasseur Nul à la mi-temps.** Le nul à la mi-temps est l'issue la plus fréquente du marché (40 %), à une cote de 2,3 à 2,6 ; un produit qui gagne 2 jours sur 5 à cote 2,4, pire série attendue ~6 jours. Même forme que le Chasseur Nul : tout ce qui est coté dans la bande 2,20–2,70, la marge 1xBet la plus basse d'abord, matchs AVOID exclus, réglé sur `homeHtScore`/`awayHtScore` (déjà remplis). **Zéro ingestion, zéro migration** : une classe, un spec, une ligne dans le service des chasseurs, les écrans. C'est le produit le moins cher à livrer de cette étude.

Variante pour plus tard : « Moins de 0,5 but à la mi-temps » (33 %, cote ~3) comme chasseur de prudence.

### 3.2 Corners par équipe, corners 1X2, handicap corners

Inventaire : cotés chez 1xBet sur 8 matchs sur 10 (57/58 corners d'une équipe, 55 corners 1X2, 56 handicap, 339 double chance), chez Pinnacle et Betano aussi. Nos stats (`corner_kicks`, par équipe, 47 790 matchs) les règlent.

Fréquences depuis le 01/07/2025 (18 448 matchs) : domicile 5,35 corners, extérieur 4,38 ; domicile en obtient plus 54,3 %, égalité 9,2 %, extérieur 36,5 % ; domicile ≥ 5 : 57 %, extérieur ≥ 4 : 58 %.

Prévisibilité (moyenne des 6 derniers matchs de chaque équipe, pour et contre, 17 695 matchs) : corrélation 0,19 avec les corners du domicile, 0,21 avec ceux de l'extérieur, 0,13 avec le total ; erreur absolue 2,28 contre 2,32 en annonçant la moyenne. Le corners 1X2 est deviné 57 % du temps hors égalité. **Un modèle maison ne verra pas plus loin que le marché** : les produits corners sont des paris de variété au prix du marché, comme le Chasseur Corners (calibré 49,9 %/49,9 %).

**Produits proposés : Chasseur Corners domicile / extérieur** (le côté le moins cher parmi les lignes d'équipe) et **Chasseur Corners 1X2**. Ingestion : 3 valeurs d'enum `Market` (`CORNERS_HOME`, `CORNERS_AWAY`, `CORNERS_1X2`), lignes en ,5 seulement, 1xBet et Pinnacle, comme `CORNERS` (lot 6). Volume : ~12 lignes de plus par match et par relevé.

### 3.3 Cartons

Pinnacle calibré (`CORNERS-TIRS-CARTONS.md`) mais coté sur 2 matchs sur 10 (27 % des matchs depuis le 15/10), 1xBet gardé depuis #297 (0 ligne en base pour l'instant : pas encore déployé). Décision d'un Chasseur Cartons vers le 17/11 sur le volume 1xBet réel et l'intitulé du décompte des rouges.

### 3.4 Tirs, fautes, hors-jeu, arrêts d'équipe

Au catalogue (87, 211, 164–175, 315–320…), mais sur 10 matchs : tirs et tirs cadrés chez Bet365 sur 2 (affiches de C1), fautes et hors-jeu **jamais**. Les stats pour régler existent (fautes 12,3 par équipe, hors-jeu 1,8, tirs 12,9, tirs cadrés 4,4). **Rien à livrer** tant qu'un book du flux ne les cote pas sur les matchs ordinaires. À regarder à nouveau avec l'inventaire chaque mois (la sonde `probe:inventory` prend 25 appels).

### 3.5 Nombre exact de buts, écart, les deux mi-temps

Cotés chez Bet365, Betano et William Hill (38, 40–42, 47, 32, 37) sur 9 à 10 matchs sur 10, pas chez 1xBet. Fréquences réelles : 2 ou 3 buts 45,3 % (cote vue 3,6–4 → marché ~27 % par valeur), 0 but 7,3 %, écart de 1 but 38,8 %, écart de 3 ou plus 15,2 %, domicile gagne les deux mi-temps 13,2 %. Marchés à grille, marges élevées attendues (25 % sur le score exact). **Pas prioritaires** : le score exact couvre déjà le besoin de grosse cote.

## 4. Buteurs

### Ce que l'API donne

- **Cotes** : Bet365 seul, sur 10 matchs sur 10 des grands championnats. Buteur à tout moment (92, 40 à 50 joueurs), premier buteur (93), dernier (94), par équipe (218–233), buteur ou passeur (257). Rafraîchies jusqu'à ~2 h du coup d'envoi.
- **Règlement** : `/fixtures?ids=` donne les événements avec buteur, passeur, minute, type (normal, penalty, csc) — et la composition avec les minutes jouées. 399 matchs sur 399 en avaient.
- **Identité des joueurs** : les cotes portent des noms (« Caleb Yirenkyi »), les événements des noms parfois abrégés (« K. Mbappe »). Sur 455 joueurs cotés, 337 appariés par le nom de famille, 118 non (26 %). Il faut la table des effectifs (`/players/squads`) pour apparier sur l'identifiant.

### Ce que disent les 399 matchs (10 championnats, octobre)

- 3,22 buts par match, 2,78 buteurs distincts, 6,6 % de penaltys, 3,5 % de buts contre son camp.
- Un titulaire marque dans 9,6 % des cas ; par poste : défenseur 4,1 %, milieu 10,5 %, **attaquant 20,5 %**.
- Les 10 meilleurs buteurs du mois ne font que 3,6 % des buts : le marché est dispersé, pas de « valeur sûre ».

### Première mesure de calibration (10 matchs de Premier League, cotes encore servies)

| Cote Bet365 | Joueurs cotés | Marché (1/cote) | Ont marqué |
| ----------- | ------------: | --------------: | ---------: |
| 1 – 2,5     |             5 |          48,9 % |     20,0 % |
| 2,5 – 4     |            72 |          31,7 % |     12,5 % |
| 4 – 6       |            54 |          21,4 % |      5,6 % |
| 6 – 10      |            97 |          13,4 % |      5,2 % |
| 10 et +     |           109 |           8,4 % |        0 % |
| **Tous**    |       **337** |      **17,5 %** |  **5,3 %** |

La somme des 1/cote vaut **7 à 10 buteurs par match** ; il y en a eu 1,9 sur ces 10 matchs, 2,8 sur les 399. Même en comptant 2,8, le marché fait payer **2,5 à 3 fois** la fréquence réelle, et 18,7 % des joueurs cotés n'ont pas joué (le pari est alors remboursé chez la plupart des books, à vérifier chez 1xBet et Betclic). Sur 10 matchs l'intervalle est large (± 7 points sur la tranche 2,5–4), mais l'écart est si grand que la direction ne fait pas de doute : **le buteur est le pari le plus taxé du carnet**, loin devant le score exact (27 %).

### Ce qu'on peut en faire

- **Jamais un produit « avantage »**, comme tout le reste : le moteur est derrière le marché, et ce marché-là coûte 3 fois plus que les autres.
- **Un produit plaisir honnête, « Buteur du jour »** : l'attaquant à la cote la plus basse du jour parmi les titulaires annoncés (compositions ~1 h avant), avec sa **fréquence réelle affichée** (« marque environ 1 fois sur 5 »), jamais la cote convertie. C'est ce que demandent les joueurs (football à 67 % des paris en Afrique de l'Ouest et de l'Est, [GeoPoll 2026](https://focusgn.com/africa/africas-betting-markets-show-sharp-differences-across-countries-geopoll-finds)), et c'est le pari que les books poussent le plus.
- **Avant de le montrer** : 4 semaines de collecte pour mesurer la fréquence réelle par tranche de cote sur 400 matchs et plus, et apparier les joueurs par identifiant. La règle « pas de phase d'ombre » vise les produits dont la mesure existe ; ici la mesure n'existe pas encore, et un produit affiché avec une chance fausse serait pire que rien.

**Coût** : 0 appel de plus (cotes dans `/odds`, événements dans `/fixtures?ids=`), ~1 300 appels une fois pour les effectifs. Stockage : ~45 lignes de cotes par match chez Bet365 (bet 92 seulement), ~15 événements et ~30 stats joueurs par match.

## 5. Paris à la minute

Cotés chez Marathonbet (1X2 à 15, 30, 60, 75 min), Betano (30, 60, 10 min), Bet365 (10 min), sur 10 matchs sur 10. Réglés sur les événements (minute de chaque but).

Fréquences réelles sur les 399 matchs, contre les prix vus :

| Marché                        |                     Réalisé | Prix vu (Marathonbet / Betano) | Marché sans marge |
| ----------------------------- | --------------------------: | ------------------------------ | ----------------: |
| Nul à la 10e minute           |                      76,9 % | 1,18 – 1,21 (Bet365, Betano)   |             ~78 % |
| Nul à la 15e                  |                      70,4 % | 1,31 – 1,35                    |             ~68 % |
| Nul à la 30e                  |                      52,1 % | 1,67 – 1,81                    |             ~53 % |
| Nul à la 60e                  |                      32,3 % | 2,47 – 2,75                    |             ~33 % |
| Premier but avant la 15e      |                      32,8 % | —                              |                 — |
| Premier but avant la 30e      |                      54,6 % | —                              |                 — |
| Premier but avant la mi-temps |                      71,4 % | —                              |                 — |
| Aucun but                     | 4,3 % (grands championnats) | —                              |                 — |

Les prix collent aux fréquences : marché calibré, marge ~8 %. Ce sont des paris courts, à cote basse, du même type que le Favori (« nul à la 15e » gagne 7 fois sur 10 à 1,33). **Produit possible, « Rien avant la 15e »**, mais pas chez 1xBet dans notre flux (Marathonbet, Betano, Bet365), et il faut d'abord collecter les événements pour régler. Priorité après les buteurs : même collecte, moins demandé.

## 6. Tirs par joueur

Bet365 cote les tirs et tirs cadrés par joueur (240, 241, 269, 275) sur **9 grands matchs sur 10**. Les stats par joueur de `/fixtures?ids=` les règlent (tirs, tirs cadrés, par joueur, avec les minutes).

Fréquences sur les 10 633 titulaires de l'échantillon :

| Poste     | ≥ 1 tir | ≥ 2 tirs | ≥ 1 tir cadré | Tirs moyens |
| --------- | ------: | -------: | ------------: | ----------: |
| Attaquant |  69,6 % |   41,6 % |        43,9 % |        1,49 |
| Milieu    |  56,4 % |   25,4 % |        28,4 % |        0,99 |
| Défenseur |  35,8 % |   10,4 % |        14,0 % |        0,50 |

« X aura au moins un tir cadré » est un pari à 40–45 % pour un attaquant, autour de 2,0 chez les books. Même chemin que les buteurs : collecte des cotes (Bet365, bets 269/275) et des stats joueurs, 4 semaines, puis décision. Candidat sérieux parce que **plus fréquent qu'un but** (44 % contre 20 %) : un produit qui gagne presque un jour sur deux.

## 7. Les stats pour le moteur

Déjà mesuré (`API-FOOTBALL-MARCHES.md` § 6) : les moyennes glissantes de tirs, tirs cadrés, tirs dans la surface, corners, xG et possession n'ajoutent rien à la cote de clôture Pinnacle sur le 1X2 et le plus/moins 2,5 (gain de log-loss entre −2 et +0,5 ‰, dans le bruit, 7 000 à 11 700 matchs de test). On ne touche pas au moteur sur cette base. Les événements et les compositions, une fois collectés, servent le contexte de l'IA (compositions, absents) : à mesurer sur le résidu, comme tout le reste, pas à brancher d'office.

## 8. Plan de livraison proposé

| #   | Lot                                                                                                           | Ingestion                                                                | Coût quota                    | Quand montrer                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **Renouveler l'abonnement** avant le 05/11 11:55 UTC                                                          | —                                                                        | —                             | —                                                                                   |
| 2   | **Chasseur Nul à la mi-temps**                                                                                | aucune                                                                   | 0                             | tout de suite (marché mesuré)                                                       |
| 3   | **Stats par `/fixtures?ids=`** : événements, compositions, stats joueurs stockés ; rattrapage de l'historique | 3 tables (`fixture_event`, `fixture_lineup`, `fixture_player_statistic`) | −90 par jour, +2 400 une fois | —                                                                                   |
| 4   | **Corners d'équipe et corners 1X2** : ingestion 1xBet + Pinnacle, puis chasseurs                              | 3 valeurs d'enum                                                         | 0                             | après 2 semaines de calibration mesurée                                             |
| 5   | **Cotes buteurs et tirs joueurs (Bet365)** stockées ; effectifs ; appariement par identifiant                 | 2 marchés d'enum, table joueurs                                          | 0 + 1 300 une fois            | **Buteur du jour** et **Tir cadré du jour** après 4 semaines, à la fréquence réelle |
| 6   | **Cartons** : décision le 17/11                                                                               | faite (#297)                                                             | 0                             | selon volume 1xBet                                                                  |
| 7   | **Paris à la minute** : cotes Marathonbet/Betano stockées                                                     | 2 marchés d'enum                                                         | 0                             | après 4 semaines                                                                    |
| 8   | Recalibration TEAM_TOTAL 1,45–1,80 ; Combiné : jambe la moins chère à chance égale                            | —                                                                        | —                             | après backtest                                                                      |

Ce qu'on ne fera pas : des modèles maison sur les buts (§ 7), des produits sur les tirs/fautes/hors-jeu d'équipe (pas de prix), des produits « avantage » sur les buteurs (3× le prix).

## 9. Scripts

- `scripts/probe-events-sample.mjs` : 10 championnats × 40 derniers matchs par `/fixtures?ids=`, et test de rémanence des cotes buteurs (56 appels).
- `scripts/analyse-events.py` : minutes, buteurs par poste, tirs par joueur, calibration buteur.
- `scripts/scorer-calibration.py` : appariement des noms et calibration par tranche.
- `scripts/match-stats-residual.py` : stats contre clôture (§ 7).
- Inventaire des marchés : `pnpm --filter @evcore/backtest-core probe:inventory` (25 appels).
