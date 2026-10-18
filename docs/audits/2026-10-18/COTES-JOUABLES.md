# Cotes affichées, cotes jouables (2026-10-18)

Constat de l'utilisateur : une sélection affichée à 1,14 ou 1,15 sort à 1,07
chez le bookmaker où il mise, sous le minimum de 1,10 que ce bookmaker
impose. Mesures sur le dump de production du 2026-10-16.

## 1. D'où viennent nos cotes

Neuf bookmakers relevés (1xBet, Bet365, Marathonbet, Betano, Betfair,
BetVictor, Pinnacle, William Hill, SBO). Le prix porté par une sélection de
Décisions vient de **Bet365 dans 59 % des cas, Pinnacle 24 %, Marathonbet
11 %** — les books les plus généreux du relevé. Sur les cotes courtes, du
1er au 16 octobre, Pinnacle ≥ Bet365 ≥ 1xBet ≥ le moins bon des neuf :

| Bet365    |     n | 1xBet | 1xBet / Bet365 | Pinnacle | Moins bon des 9 | 1xBet < 1,10 |
| --------- | ----: | ----: | -------------: | -------: | --------------: | -----------: |
| < 1,15    | 2 715 | 1,064 |          0,976 |    1,133 |           1,056 |     **74 %** |
| 1,15–1,20 |   798 | 1,149 |          0,979 |    1,190 |           1,128 |        1,5 % |
| 1,20–1,30 | 2 135 | 1,222 |          0,985 |    1,246 |           1,193 |          0 % |
| 1,30–1,50 | 2 528 | 1,358 |          0,991 |    1,386 |           1,322 |          0 % |

Le moins bon de nos neuf books est 5 % sous le meilleur en cote courte
(ratio 0,945–0,955). Un bookmaker local se situe en dessous encore : 1,14 →
1,07 est un ratio de 0,94, un cran sous notre pire relevé. **La cote n'a pas
bougé entre notre relevé et le coup d'envoi** (clôture / cote prise = 1,00
sur toutes les tranches sous 1,50) : le problème n'est pas la dérive, c'est
l'écart entre books, et la référence choisie.

Règle qui en découle : pour qu'une sélection reste à 1,10 ou plus chez un
bookmaker 6 % moins généreux que Bet365, il faut **1,20 au moins chez
Bet365** (1,20 × 0,94 = 1,13). À 1,15 on tombe à 1,08.

## 2. Ce que nos produits proposent aujourd'hui

Jambes des coupons courts depuis le 11 octobre, et ce qu'elles valent chez
le moins bon de nos neuf books :

| Produit                                                     | Jambes | Cote moy. (référence) | < 1,20 | < 1,10 chez le moins bon |
| ----------------------------------------------------------- | -----: | --------------------: | -----: | -----------------------: |
| Pari sûr (bande 1,10–1,35)                                  |      5 |                  1,18 |      3 |                        0 |
| Combiné du moteur (plancher 1,05, les moins chères d'abord) |     12 |                  1,12 |     11 |                   **10** |
| Combiné Analyse IA (même vivier)                            |      9 |                  1,19 |      2 |                        2 |

Le combiné du moteur est le cas grave : « les moins chères d'abord » sans
plancher le fait descendre à 1,05–1,12, injouable chez l'utilisateur. Sur
Décisions, **24 % des sélections mises en avant** (« Notre sélection ») sont
sous 1,20 (8,6 % sous 1,10).

## 3. Ce qu'un plancher à 1,20 coûte, mesuré sur l'historique

Pari sûr du jour (favori à domicile, 2026-07-01 → 10-16) :

| Bande              | Jours | Jours gagnants | Cote moy. | Retour | Pire série |
| ------------------ | ----: | -------------: | --------: | -----: | ---------: |
| 1,10–1,35 (actuel) |    86 |         80,2 % |      1,19 | −5,2 % |          2 |
| **1,20–1,35**      |    81 |     **84,0 %** |      1,26 | +5,3 % |          2 |
| 1,20–1,40          |    88 |         81,8 % |      1,27 | +3,6 % |          2 |

Le plancher ne coûte rien ici : cinq jours d'abstention de plus, autant de
jours gagnants, une cote plus haute. (Le retour positif est dans le bruit ;
retenir « ne coûte pas plus que la marge ».)

Combiné sur « Notre sélection » (calibration glissante 90 j, une par
championnat, les moins chères d'abord) :

|      Plancher | Jambes | Jours | Jours gagnants | Cote moy. | Retour | Pire série |
| ------------: | -----: | ----: | -------------: | --------: | -----: | ---------: |
| 1,05 (actuel) |      3 |    93 |         74,2 % |      1,46 |  1,051 |          5 |
|          1,05 |      2 |   104 |         82,7 % |      1,28 |  1,049 |          3 |
|      **1,20** |  **2** |   104 |     **71,2 %** |  **1,55** |  1,107 |          3 |
|          1,20 |      3 |    88 |         47,7 % |      1,92 |  0,907 |          5 |
|          1,25 |      2 |    99 |         59,6 % |      1,64 |  0,980 |          5 |

Avec le plancher, trois jambes tombent sous un jour gagnant sur deux ; deux
jambes gardent 71 % de jours gagnants à cote 1,55, avec des jambes toutes
jouables. C'est le même produit que le combiné actuel, à deux jambes au lieu
de trois, avec une cote plus haute et une pire série de trois jours.

## 4. Recommandation

1. **Plancher 1,20 sur la cote de référence pour tout ce qu'on propose** :
   pari sûr en 1,20–1,35, combiné à **deux jambes** de 1,20 à 1,50, même
   règle pour le combiné Analyse IA, et « Notre sélection » cherchée d'abord
   entre 1,20 et 1,50 (les sélections sous 1,20 restent visibles dans
   « autres marchés », jamais mises en avant). Le plancher est la seule
   mesure qui garantit que ce qu'on montre existe chez un bookmaker réel.
2. **Afficher la cote prudente à côté de la nôtre** : la plus basse des neuf
   books relevés (« chez le moins généreux : 1,13 »), pour que l'utilisateur
   ne découvre pas l'écart au moment de miser. Elle existe déjà dans
   `odds_snapshot`, c'est un affichage.
3. **Ne rien promettre sous 1,10 nulle part** : l'historique affiché sur les
   cartes ne change pas, il mesure ce qui a été proposé ; la nouvelle règle
   se mesure à part, par jambe, comme les précédentes.

Ce que ça ne règle pas : un bookmaker local peut être plus cher que le pire
de nos neuf. Si l'utilisateur nomme le sien et qu'il est dans la liste
d'API-Football (33 books servis, 9 relevés), on le relève et on l'affiche
nommément — c'est la vraie réponse, le plancher n'est que le filet.

## 5. Fait (2026-10-18, même jour)

- **Plancher 1,20** sur la cote de référence : pari sûr en 1,20–1,35
  (clé d'historique inchangée), combinés du moteur et Analyse IA à **deux
  jambes** de 1,20 à 1,50 (`COMBO_COUPON_CLASS`), « Notre sélection »
  cherchée d'abord entre 1,20 et 1,50 (`PRIMARY_MIN_ODDS`). Les sélections
  moins chères restent visibles, jamais mises en avant.
- **Garde à la génération** : une jambe dont le prix chez 1xBet (sinon le
  plus bas relevé) est sous 1,10 n'entre ni dans le pari sûr ni dans le
  combiné du moteur, même si notre référence la met à 1,20 — le 16 octobre,
  une jambe à 1,20 chez Bet365 valait 1,07 chez 1xBet. Un choix sans relevé
  passe : on ne refuse que ce qu'on a mesuré.
- **Cote jouable affichée** à côté de la nôtre, sur chaque sélection de
  Décisions et chaque jambe de coupon : le prix chez 1xBet quand il cote le
  choix, sinon le plus bas des neuf books relevés ; en rouge sous 1,10. Sur
  un coupon, la cote combinée chez 1xBet est une tuile à part quand elle
  diffère. Calcul au moment de la lecture (`PlayableOddsRepository`, dernier
  relevé d'avant coup d'envoi de chaque book), jamais bloquant.
- **Betclic** : absent des books servis par API-Football dans notre relevé
  (14 books vus sur 100 rencontres) ; non relevable aujourd'hui. 1xBet couvre
  95 % des rencontres et 88 % des choix cotés par Bet365.

L'historique des cartes (jours gagnés / réglés) continue sans rupture : la
clé des produits ne change pas, seule la règle de sélection se resserre. La
nouvelle règle se lit à part, par jambe, à partir du 2026-10-19.

## 6. Le coupon long, rebâti à cote 2,5–5 (ajout du 2026-10-18, soir)

Question de l'utilisateur : on a assez de marchés pour faire mieux qu'un
coupon 5–15 à deux jambes qui gagne un jour sur sept — un coupon à cote 2 à
5, avec autant de jambes qu'il faut. Mesuré sur les mêmes sélections
calibrées (une par championnat, plancher 1,20), ajoutées jusqu'à une cible
de cote combinée :

| Jambes admises, ordre                                   |   Cible | Jours | Jambes |   Jours gagnants | Cote moy. | Pire série |
| ------------------------------------------------------- | ------: | ----: | -----: | ---------------: | --------: | ---------: |
| 1,20–1,50 fiables, les moins chères d'abord             |     2,0 |    87 |    3,7 |           36,8 % |      2,24 |          6 |
| idem                                                    |     2,5 |    78 |    4,8 |           23,1 % |      2,85 |         15 |
| 1,20–1,80 non « peu fiables », les plus longues d'abord |     2,0 |   101 |    2,0 |           39,6 % |      2,71 |          8 |
| **idem**                                                | **2,5** |    96 |    2,3 | **34,4 % ± 4,8** |  **2,99** |          8 |
| idem                                                    |     3,0 |    95 |    2,8 |           27,4 % |      3,64 |          8 |
| idem                                                    |     4,0 |    84 |    3,4 |           26,2 % |      4,95 |          8 |
| Compositeur par le prix 5–15 (prod)                     |    5–15 |     — |      2 |          13–17 % |       6,2 |          — |

Deux enseignements. Empiler des jambes courtes pour monter la cote coûte
cher (une jambe de plus à 0,80 fait perdre 20 points) ; prendre des jambes
un peu plus longues mais encore calibrées (jusqu'à 1,80) fait la même cote
en moins de jambes et gagne plus souvent. Et le résultat suit l'arithmétique
des jambes calibrées : à cote 3, un jour sur trois.

Décision : **« Coupon long · cote 2,5–5 »** (classe `LONG`, source
`ENGINE`) — jambes de 1,20 à 1,80 dont le canal n'est pas « peu fiable »
sur la compétition, une par championnat, les plus longues d'abord, jusqu'à
quatre, cible 2,5, plafond 5. Même passe, même vivier, même garde « jouable
chez 1xBet » que les autres produits. Le coupon 5–15 du compositeur par le
prix reste généré et mesuré (endpoint `track-record`), plus affiché.

## 7. Le ticket enregistre le prix 1xBet (ajout du 2026-10-18, nuit)

Trois trous restaient entre « cote affichée » et « cote jouée » :

- **« Mes coupons » notait notre cote de référence**, pas celle que
  l'utilisateur a réellement obtenue. Un pari sûr joué à 1,22 chez nous et
  payé 1,16 chez 1xBet remontait 1,22 dans le suivi de bankroll, et sa
  cote combinée surévaluait le gain. Désormais `BetSlipService.create`
  ré-résout chaque choix côté serveur et enregistre le dernier prix 1xBet
  d'avant coup d'envoi quand il existe (`oddsSnapshot` du pari) ; sinon
  notre référence, comme avant. Le client n'envoie jamais le prix retenu.
- **Le brouillon du ticket** (Décisions, accueil, carte de coupon) affichait
  la cote de référence pendant que la ligne montrait « 1xBet 1,16 » à côté.
  Le brouillon porte maintenant la cote jouable quand elle est connue ; le
  serveur reste seul à décider du prix enregistré.
- **Le combiné Analyse IA** (vantage-worker) composait sur le même vivier
  que le moteur mais sans sa garde « jouable chez 1xBet » : il pouvait
  proposer une jambe à 1,20 chez Bet365 et 1,07 chez 1xBet. La garde est
  portée dans le worker (`loadOperatorQuotes`, même requête que le
  backend : dernier relevé 1xBet d'avant coup d'envoi, 1X2 en triplet),
  jamais bloquante : sans relevé, la jambe passe.

Couverture sur le dump du 16 octobre, deux jours de rencontres : 239
rencontres cotées par 1xBet, 39 184 prix à choix unique plus 239 triplets
1X2 — le même périmètre que `PlayableOddsRepository` côté backend.
