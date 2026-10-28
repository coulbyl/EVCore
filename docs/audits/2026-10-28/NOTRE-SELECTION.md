# Notre sélection : le choix du moteur sur chaque match

_28/10/2026, étape 4 de l'ordre recommandé dans `SELECTIONS-LAISSEES.md`. Même copie de prod (116 jours, 01/07 → 24/10). La règle d'aujourd'hui (`primaryPick`, côté web) est rejouée à l'identique, avec une calibration canal × compétition calculée sur les 90 jours **précédents**. Scripts : `scripts/our_pick*.py`, sorties `our-pick-*-out.txt`._

## Réponse courte

**On garde la règle actuelle.** C'est l'inverse du coupon cote 2 : ici, le choix du moteur fait mieux que le prix.

1. **Notre sélection passe 2,7 points au-dessus du marché** (± 1,2, sur 5 881 matchs), autant en juillet–août (+3,2) qu'en septembre–octobre (+2,3). À cote 1,20–1,50, sur les mêmes matchs : +2,4 points pour la règle actuelle, contre +0,8 pour le pari le plus probable selon le marché. Le coût est le même (−5,4 % contre −5,6 % au prix d'analyse).
2. **L'avantage vient du choix de la sélection principale dans le match.** À marché et cote égaux, la sélection principale fait 1,9 point de mieux que les autres sélections du même match (± 2,3), dans le même sens sur les deux périodes.
3. **Il ne vient ni du statut de calibration, ni du désaccord avec le marché.**
   - Canal « fiable » sur la compétition : +1,7. « Non mesuré » : +1,4. « À surveiller » : +0,2.
   - Plus le moteur se croit au-dessus du marché, moins il fait mieux que lui (+2,7, puis +3,3, +2,0, +1,4).
4. **Retirer le statut de calibration de la règle ne change rien** : +2,5 au lieu de +2,7, même pari sur 81 % des matchs.
5. **La fréquence affichée depuis hier**, celle du marché, est donc un peu prudente pour Notre sélection : celle-ci passe environ 3 points plus souvent. On ne l'annonce pas. Le résultat reste négatif à mise fixe (−2,0 %, contre −4,7 % pour le reste du marché à cote égale).

## 1. Notre sélection, un pari par match

« Écart » = réalisé moins référence, en points, intervalle à 95 %.

| Palier                                    | Matchs | Cote méd. | Moteur | Marché | Réalisé | Écart au moteur | Écart au marché |
| ----------------------------------------- | -----: | --------: | -----: | -----: | ------: | --------------: | --------------: |
| Tous                                      |  5 881 |      1,36 | 73,4 % | 66,8 % |  69,7 % |      −3,7 ± 1,2 |  **+2,7 ± 1,2** |
| 0 : canal calibré, cote 1,20–1,50         |  2 456 |      1,30 | 76,3 % | 72,5 % |  75,1 % |      −1,2 ± 1,7 |      +2,5 ± 1,8 |
| 1 : canal non « peu fiable », 1,20–1,50   |  1 854 |      1,31 | 75,8 % | 71,5 % |  73,4 % |      −2,4 ± 2,0 |      +2,2 ± 2,1 |
| 2 : canal calibré, cote ≥ 1,50            |    686 |      1,76 | 61,4 % | 52,0 % |  52,8 % |      −8,7 ± 3,7 |      +2,8 ± 3,8 |
| 3 : canal non « peu fiable », cote ≥ 1,50 |    736 |      1,75 | 65,4 % | 51,2 % |  54,5 % |     −11,0 ± 3,5 |      +4,7 ± 3,6 |
| Paliers 0–1, juillet–août                 |  1 585 |      1,34 | 74,6 % | 70,3 % |  72,9 % |      −1,8 ± 2,2 |      +2,6 ± 2,4 |
| Paliers 0–1, septembre–octobre            |  2 725 |      1,28 | 76,9 % | 73,0 % |  75,2 % |      −1,7 ± 1,6 |      +2,2 ± 1,7 |

Le moteur annonce trop, surtout au-dessus de 1,50 (jusqu'à −11 points). Le marché annonce un peu trop peu : Notre sélection le bat de 2 à 3 points partout.

## 2. D'où vient l'avantage

Toutes nos sélections retenues, cote 1,20–1,50, hors matchs « Données suspectes » :

| Ensemble                                    | Jambes | Écart au marché |
| ------------------------------------------- | -----: | --------------: |
| Statut « fiable » (GREEN)                   |  4 029 |      +1,7 ± 1,6 |
| Statut « à surveiller » (ORANGE)            |  1 283 |      +0,2 ± 2,7 |
| Statut « non mesuré » (NA)                  |  3 150 |      +1,4 ± 1,8 |
| Statut « peu fiable » (RED)                 |    121 |      +8,4 ± 7,4 |
| **Sélection principale du match**           |  3 600 |  **+2,4 ± 1,5** |
| Autres sélections du même match             |  4 983 |      +0,8 ± 1,4 |
| Référence : tout ce qui est coté, 1,20–1,50 | 36 777 |      +0,9 ± 0,5 |

À marché et cote égaux (15 cellules marché × tranche) : la sélection principale fait +2,5 points, les autres +0,6, soit un écart de +1,9 ± 2,3. L'écart est de +3,4 en juillet–août et de +1,5 en septembre–octobre. Sa composition ne l'explique qu'en partie. Elle compte plus de « buts plus ou moins » et de « total d'une équipe », moins de double chance et de « remboursé si nul ».

## 3. Trois façons de choisir le pari d'un match

Mêmes matchs : ceux dont Notre sélection est à cote 1,20–1,50, soit 74 % des matchs.

| Règle                                                 | Matchs | Cote méd. | Marché | Réalisé | Écart au marché | Coût au prix d'analyse |
| ----------------------------------------------------- | -----: | --------: | -----: | ------: | --------------: | ---------------------: |
| **Actuelle** : palier, puis probabilité du moteur     |  4 310 |      1,30 | 72,0 % |  74,3 % |  **+2,4 ± 1,4** |                 −5,4 % |
| Nos sélections du match, classées par le prix         |  3 390 |      1,27 | 73,5 % |  75,2 % |      +1,7 ± 1,4 |                 −5,4 % |
| Tout ce qui est coté sur le match, classé par le prix |  4 339 |      1,22 | 77,1 % |  77,9 % |      +0,8 ± 1,2 |                 −5,6 % |

Le pur prix choisit des cotes plus courtes (1,22), qui passent plus souvent, mais il ne fait pas mieux que ce que le marché annonçait. La règle actuelle, si.

## Comment ça se raccorde au reste

- **L'étude principale** ne trouvait pas d'écart entre nos sélections et ce qu'on laisse (+0,4). Elle comparait toutes nos sélections retenues, alors que l'avantage se concentre sur la sélection **principale** de chaque match.
- **Le combiné du jour** (`COMBINE.md`) part de ces mêmes sélections principales : +2,3 pour son vivier, +8,8 pour ses deux jambes retenues. C'est cohérent.
- **Le coupon cote 2** ne part pas des sélections du moteur et n'en a pas besoin. Sa fenêtre de cote (2 à 3) et son but (la combinaison la moins chère) sont différents.

## Décisions

- **Notre sélection reste choisie comme aujourd'hui.**
- **La fréquence affichée reste celle du marché.** Elle est honnête et un peu prudente pour Notre sélection. On n'affiche jamais l'avantage mesuré.
- **Le statut de calibration ne sert à rien dans ce choix.** Il change 19 % des paris sans changer le résultat. On le garde jusqu'à la relecture de décembre, avec plus de données, puis on le retire s'il reste neutre.

## À refaire vers le 10/12

Relancer `our_pick.py`, `our_pick_cells.py` et `our_pick_simple.py` sur une copie de prod fraîche, en même temps que `COMBINE.md`.

- Si la sélection principale garde environ +2 points au-dessus du marché et +1,5 point au-dessus des autres sélections du match, c'est un résultat. On cherche alors ce qui le produit, en commençant par le classement par probabilité du moteur à l'intérieur du match.
- S'il retombe vers +1 point, c'était du bruit, et Notre sélection passe au prix.
