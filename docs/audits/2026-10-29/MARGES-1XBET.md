# La marge payée chez 1xBet

_Lot 3, étape 1 (`docs/plan-lot-3-2026-10-28.md`). Copie de prod du 24/10 ; les cotes 1xBet sont en base depuis le 13/09 (2 435 matchs). On prend la dernière cote d'avant-match. Scripts : `scripts/operator-export.sql` et `scripts/operator_margins.py` ; sortie : `scripts/operator-margins-out.txt`._

## Réponse courte

1. **Le joueur paie bien plus cher que ce qu'on mesurait.** Sur le vivier coté, la marge médiane est de 5,5 % chez les books de référence, mais de **9,3 % chez 1xBet**. Nos coûts « au prix d'analyse » étaient donc optimistes pour le joueur.
2. **Chez 1xBet, seul le 1X2 des grands championnats est bon marché.** Il coûte 1,5 à 1,6 % en Ligue 1, Premier League, Serie A, Liga, Bundesliga, Ligue des champions et en Russie, mais 10 à 11 % en D3, en deuxième division polonaise, finlandaise, turque ou chilienne, et en Estonie, Lettonie ou Chine 2. Médianes par marché : 1X2 7,0 %, double chance 7,1 %, BTTS 8,0 %, total d'une équipe 8,7 %, plus/moins à la mi-temps 8,9 %, vainqueur de la mi-temps 10,1 %, plus/moins 10,3 %, mi-temps/fin de match 21,3 %.
3. **Couverture chez 1xBet.** 86–87 % du vivier sur les marchés principaux, 66 % sur le total d'une équipe, 0 % sur « n'encaisse pas », « gagne sans encaisser » et les marchés résultat × buts ou résultat × BTTS, que 1xBet ne cote pas dans nos données. Au total, 45,9 % des sélections cotées ont leur groupe complet chez 1xBet.
4. **Le coupon cote 2 garde son classement.** Ajouter la marge 1xBet comme départage ne change presque rien (même marge moyenne : 5,9 %). Le classer sur le retour attendu au prix 1xBet choisit des cotes plus hautes et fait pire : 36,8 % réalisés pour 41,8 % annoncés, soit −5,5 points par jambe.
5. **Les chasseurs BTTS et Nul passent à la marge 1xBet.** BTTS : 7,5 % au lieu de 8,1 %. Nul : 2,5 % au lieu de 3,1 %. Sur 37 jours, les taux de réussite restent dans le bruit (±15 points). C'est la règle du coût, la seule qui persiste.
6. **Score exact : la grille de 1xBet n'est pas exploitable comme marge.** 121 scores dont les implicites totalisent 237 %. Classer sur cette « marge » ne donne que 5 % de réussite. Le chasseur garde sa règle : le score le plus probable selon le marché, sans coût par score.

## Le coupon cote 2, rejoué au prix 1xBet (39 jours)

| Classement                                | Jours | Cote 1xBet méd. | Annoncé | Réalisé | Marge 1xBet moy. | Écart par jambe |
| ----------------------------------------- | ----: | --------------: | ------: | ------: | ---------------: | --------------: |
| Actuel : probabilité, départage référence |    38 |            2,01 |  49,0 % |  63,2 % |            5,9 % |      +8,7 ± 9,0 |
| Probabilité, départage marge 1xBet        |    38 |            2,01 |  49,0 % |  60,5 % |            5,9 % |      +7,4 ± 9,3 |
| Retour attendu au prix 1xBet              |    38 |            2,47 |  41,8 % |  36,8 % |            4,9 % |     −5,5 ± 10,9 |

## Les chasseurs, rejoués au prix 1xBet (37 à 39 jours)

| Chasseur · classement                    | Marge 1xBet moy. | Marché | Réalisé | Écart au marché |
| ---------------------------------------- | ---------------: | -----: | ------: | --------------: |
| BTTS · marge de référence                |            8,1 % | 55,2 % |  45,9 % |     −9,2 ± 16,1 |
| BTTS · marge 1xBet (retenu)              |            7,5 % | 54,6 % |  64,9 % |    +10,3 ± 15,6 |
| Nul · marge de référence                 |            3,1 % | 29,6 % |  27,0 % |     −2,6 ± 14,5 |
| Nul · marge 1xBet (retenu)               |            2,5 % | 29,1 % |  29,7 % |     +0,6 ± 14,9 |
| Score exact · cote la plus basse (gardé) |   grille 144 % ¹ | 13,2 % |  15,4 % |               — |
| Score exact · grille la moins chère      |   grille 124 % ¹ | 10,7 % |   5,1 % |               — |

¹ La somme des implicites de la grille 1xBet moins 1. Elle ne mesure pas le coût d'un score donné.

## Ce que le lot en tire

- **On stocke et on montre la marge 1xBet de chaque jambe.** C'est le coût réel du joueur, et c'est le chiffre à afficher.
- **Chasseurs BTTS et Nul :** marge 1xBet la plus basse d'abord. Quand le groupe n'est pas complet chez 1xBet, on prend la marge typique de 1xBet sur ce marché, tirée des médianes ci-dessus.
- **Coupon cote 2 :** même classement, avec la marge 1xBet comme départage.
- **Score exact, combiné, Notre sélection :** règles inchangées, coût affiché quand il est connu.
