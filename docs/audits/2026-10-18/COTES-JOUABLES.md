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
