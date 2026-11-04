# ML-1 — la grille de marché comme source des probabilités

Rejeu du 2026-11-04 sur la base locale (copie de prod jusqu'au 03/11). Lot ML-1 de [ML-V2-PROPOSITION.md](../2026-10-29/ML-V2-PROPOSITION.md), qui industrialise le § 2.2. Script : `pnpm --filter @evcore/backtest-core backtest:market-grid`. Sortie complète : [ml1-grille-marche.txt](ml1-grille-marche.txt). Verdict : **expédié** (`MARKET_GRID`, repli sur le moteur-stats).

## 1. La grille

`packages/analysis-core/src/market-grid/` (`computeMarketGrid`), en quatre étapes.

1. **Le book.** On prend le premier de `MARKET_GRID_BOOKMAKERS` (Pinnacle, puis Bet365) qui cote, avant l'instant d'analyse, un 1X2 complet et au moins une ligne plus/moins complète. On lit la dernière ligne par issue, un seul book à la fois, sans jamais mélanger les books.
2. **La marge.** On la retire par la méthode de Shin (`shinProbabilities`), groupe par groupe : le 1X2, chaque ligne de plus/moins et chaque total d'équipe.
3. **λ dom. et λ ext.** On les ajuste par moindres carrés pondérés (le 1X2 compte ×3, chaque ligne ×1), avec un Levenberg-Marquardt à trois départs fixes, donc déterministe. Au-delà d'un écart quadratique de 0,02 entre la grille et les prix (`MARKET_GRID_MAX_RMSE`), les prix se contredisent, et on garde le moteur-stats.
4. **Les marchés.** Le 1X2 donné aux canaux est le 1X2 du book sans marge : une paire de Poisson indépendantes ne reproduit pas toujours le nul. Tout le reste sort de `deriveMarketsFromPoisson` sur les λ ajustés, avec la même forme que le moteur-stats.

**ρ (Dixon-Coles) n'est pas ajusté.** Un ρ par match sur des lignes bruitées, c'est exactement ce que le sous-modèle D du lot ML-2 remplacera par un ρ par championnat. Et les dérivations du moteur supposent des marges indépendantes (Dixon-Coles avait été rejeté le 30/06). Les tests vérifient la reproduction exacte des prix d'entrée, l'ordre des books, la borne de l'instant d'analyse et le refus de prix contradictoires.

## 2. Méthode (figée avant le rejeu)

- **Matchs.** 12 704 matchs terminés de 2026. Décision à coup d'envoi − 1 h. Cotes et prix de la grille **captés et cotés** avant cet instant, comme en prod. Les lignes HISTORICAL, importées après coup, en sont donc exclues : janvier et février n'ont aucune cote point-in-time, et 7 545 matchs sont rejoués.
- **Moteur actuel.** La chaîne de production (`production-chain.ts`) : team_stats point-in-time, λ, force des championnats en coupe d'Europe, H2H, blend 1X2, shrinkage, signaux.
- **Grille.** Le même contexte, dont seuls les probabilités et λ sont remplacés.
- **Grille « veille ».** La même grille, calculée à 17 h UTC la veille, l'heure où les coupons sont composés.
- **Canaux.** Les 20 stratégies tournent dans l'orchestrateur, et on mesure les 16 de Phase 1, avec une jambe par match × canal × marché.
- **Juge.** La clôture Pinnacle (`odds_closing_line`, ≤ 2 h avant le coup d'envoi), marge retirée par Shin. La double chance et le remboursé-si-nul sont déduits de son 1X2. Cette clôture n'existe vraiment que depuis la mi-septembre : 2 380 matchs.
- **Attention.** La grille à T − 1 h lit Pinnacle presque à la clôture, donc **son résidu est en partie mécanique**. La grille « veille » mesure ce que coûte le mouvement de ligne.
- **Intervalles.** IC 95 % par bootstrap en blocs de jours (1 000 tirages, graine fixe).

**Règle d'expédition, écrite dans l'en-tête du script avant le rejeu complet (commit 61f0d546).** Un essai de trois jours a servi à déboguer le script, et les critères n'ont pas bougé depuis. Il faut les cinq :

- **C1** : la grille est disponible sur au moins 80 % des matchs de septembre à novembre.
- **C2** : la borne basse de l'IC du ratio réalisé ÷ annoncé de la grille est d'au moins 0,97.
- **C3** : sur les mêmes matchs, l'IC de ΔBrier(grille) − ΔBrier(actuel) contre la clôture est entièrement sous 0.
- **C4** : aucun canal à 100 jambes ou plus n'a un |ratio − 1| significativement plus grand avec la grille.
- **C5** : la part des jours avec deux jambes de vivier entre 1,20 et 1,50 (canaux admis, sous `MAX_LEG_EDGE`) baisse de 10 points au plus.

## 3. Résultats

**Couverture.** La grille est disponible sur 7 180 matchs rejoués sur 7 545 (95,2 %), et sur 96,7 % de septembre à novembre. Elle vient de Pinnacle 7 149 fois et de Bet365 31 fois. Sur les autres matchs, 359 ont des prix contradictoires (4,8 %) et 6 n'ont aucun prix affûté. L'erreur d'ajustement médiane est de 0,009. Le prix a en médiane 11 à 22 h d'âge à l'instant d'analyse.

**1X2 par match contre la clôture** (2 380 matchs) : Brier actuel 0,6127, grille 0,5820, clôture 0,5809. Le résidu passe de **+0,032 [+0,024 ; +0,042]** à **+0,0011 [0,000 ; +0,002]**.

**Par canal, mêmes matchs** :

| Canal                      |  Jambes act./grille | Réalisé ÷ annoncé, actuel | Réalisé ÷ annoncé, grille | ΔBrier vs Pinnacle, actuel → grille |
| -------------------------- | ------------------: | ------------------------: | ------------------------: | ----------------------------------- |
| DOMINANT                   |       1 376 / 1 556 |     0,936 [0,890 ; 0,979] |     1,012 [0,973 ; 1,051] | +0,0148 → +0,0005                   |
| GOALS                      |       6 494 / 6 545 |     0,966 [0,953 ; 0,977] |     1,011 [0,997 ; 1,024] | +0,0032 → +0,0004                   |
| TEAM_TOTAL                 |       5 056 / 4 991 |     0,930 [0,913 ; 0,946] |     1,003 [0,985 ; 1,020] | +0,0108 → +0,0004                   |
| DOUBLE_CHANCE              |       4 129 / 3 657 |     0,956 [0,937 ; 0,974] |     0,993 [0,980 ; 1,007] | +0,0056 → +0,0004                   |
| DRAW_NO_BET                |       3 121 / 3 300 |     1,011 [0,983 ; 1,038] |     1,027 [1,005 ; 1,048] | +0,0229 → +0,0012                   |
| BTTS                       |       3 261 / 3 125 |     0,987 [0,954 ; 1,019] |     0,992 [0,962 ; 1,022] | —                                   |
| CLEAN_SHEET                |       3 888 / 4 392 |     0,965 [0,921 ; 1,015] |     0,990 [0,948 ; 1,035] | —                                   |
| WIN_TO_NIL                 |       4 185 / 4 839 |     0,992 [0,935 ; 1,053] |     0,984 [0,937 ; 1,032] | —                                   |
| WIN_EITHER_HALF            |       4 391 / 4 544 |     0,992 [0,967 ; 1,015] |     1,023 [1,004 ; 1,042] | —                                   |
| RESULT_BTTS                |       5 158 / 5 159 | **0,744 [0,693 ; 0,794]** |     0,961 [0,916 ; 1,004] | —                                   |
| RESULT_TOTAL_GOALS         |       3 073 / 2 924 |     0,900 [0,838 ; 0,964] |     1,018 [0,967 ; 1,068] | —                                   |
| HALF_TIME_FULL_TIME        |       1 170 / 1 170 |     0,992 [0,897 ; 1,096] |     0,998 [0,895 ; 1,108] | —                                   |
| FIRST_HALF                 |           818 / 804 |     1,004 [0,917 ; 1,087] |     1,032 [0,951 ; 1,109] | +0,0014 → −0,0007                   |
| OVER_UNDER_HT              |       1 115 / 1 114 |     0,969 [0,923 ; 1,013] |     1,013 [0,978 ; 1,045] | +0,0034 → −0,0001                   |
| CORRECT_SCORE              |       5 503 / 5 503 |     0,946 [0,872 ; 1,016] |     1,053 [0,969 ; 1,128] | —                                   |
| DRAW (Famille D, inchangé) |       1 515 / 1 515 |                     0,995 |                     0,995 | 0,0000                              |
| **Tous**                   | **54 253 / 55 138** | **0,956 [0,942 ; 0,970]** | **1,005 [0,995 ; 1,017]** | **+0,0092 → +0,0005**               |

« — » signifie que Pinnacle ne cote pas ce marché : le canal n'est alors jugé que sur sa calibration. Sur les jambes à clôture, réalisé − Pinnacle reste nul pour les deux moteurs : −0,002 [−0,011 ; +0,007] pour l'actuel, +0,007 [−0,003 ; +0,019] pour la grille. **La grille ne bat pas le marché, elle cesse de sur-promettre.**

**Mouvement de ligne.** Calculée la veille à 17 h, la grille garde un ratio de 1,005 [0,992 ; 1,017], et son ΔBrier contre la clôture monte de +0,0005 à +0,0008 [+0,0004 ; +0,0012]. Le mouvement entre la veille et la clôture coûte donc 0,0003 de Brier, environ 3 % de l'écart du moteur actuel. L'écart moyen par issue entre la grille à T − 1 h et la clôture vaut 0,009.

**Produits** (septembre à novembre, grille plus repli) :

- **Plafond `MAX_LEG_EDGE`.** La part des jambes au-dessus du plafond passe de 2 à 23 % selon le canal (DOMINANT 22,7 %, DRAW_NO_BET 13 %) à 0 à 0,5 %. Le plafond ne coupe presque plus rien : c'est la surconfiance qu'il coupait.
- **Volumes.** Ils restent du même ordre (DOMINANT 596 → 686, DOUBLE_CHANCE 2 509 → 2 112, WIN_TO_NIL 2 755 → 3 134).
- **Jours exploitables.** La part des jours avec au moins deux matchs de vivier entre 1,20 et 1,50 reste à 98,4 % (médiane 33 → 36 matchs par jour).

**Critères** : C1 96,7 % ✓. C2 0,995 ✓. C3 −0,0087 [−0,0114 ; −0,0066] ✓. C4 aucun canal dégradé ✓ (le plus défavorable est DRAW_NO_BET, à +0,017 [−0,008 ; +0,033]). C5 98,4 % contre 98,4 % ✓. **Expédié.**

## 4. Ce qui change en prod

- **Source des probabilités.** `analyzeFixture` appelle `computeMarketGrid` sur `findMarketGridRows` (lignes PREMATCH captées avant l'instant). Quand la grille est disponible, ses probabilités et λ remplacent ceux du moteur-stats, `predictionSource = MARKET_GRID`. Sinon, `POISSON_MAIN`.
- **Ce que garde le moteur-stats.** Il reste calculé : il donne le score déterministe et le repli. `features.statsProbabilities` et `statsLambdaHome/Away` gardent sa sortie.
- **Trace.** `features.market_grid` garde le book, les prix lus, λ, l'erreur d'ajustement, ou la raison pour laquelle la grille n'a pas servi.
- **Retour arrière.** Le drapeau `FEATURE_FLAGS.SCORING.MARKET_GRID` est à `true` et sert au retour arrière.
- **Inchangé.** Les canaux, leurs seuils, les plafonds et les coupons ne changent pas.
- **Corrections du moteur-stats.** Sous la grille, H2H, congestion, blend et shrinkage ne s'appliquent plus : le prix les contient déjà, ou ils ne lui ajoutaient rien (journal du 16/09).

## 5. Limites

- **Fenêtre du juge.** Le jugement contre la clôture repose surtout sur octobre (1 701 clôtures sur 2 380), et la grille à T − 1 h se nourrit presque de son juge. La lecture qui ne dépend pas de la clôture est le ratio réalisé ÷ annoncé sur 55 138 jambes, de mars à novembre.
- **Ratios au-dessus de 1.** DRAW_NO_BET (1,027) et WIN_EITHER_HALF (1,023) restent un peu au-dessus de 1. C'est une sous-annonce, sans danger pour la promesse. À relire avec ML-2 (mi-temps et dépendance).
- **Prix du pari.** Le prix de pari rejoué est celui du book le mieux classé (Pinnacle), pas celui de 1xBet. La bande 1,20–1,50 chez 1xBet est donc approchée.
- **Matchs sans team_stats.** Ils ne sont toujours pas analysés, même avec un prix. Les analyser serait un changement de périmètre, pas fait ici.
- **Seuils des canaux.** Ils ont été réglés sur un moteur sur-confiant et restent tels quels. On ne les relit pas sur ce rejeu.
