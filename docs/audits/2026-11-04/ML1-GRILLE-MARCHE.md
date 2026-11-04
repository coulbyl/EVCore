# ML-1 — la grille de marché comme source des probabilités

Rejeu du 2026-11-04 sur la base locale, relancé le même jour après la revue (lignes lues à l'instant du 1X2, départ unique de l'ajustement, prix des 14 derniers jours : les chiffres bougent au plus d'une unité sur la dernière décimale) (copie de prod jusqu'au 03/11). Lot ML-1 de [ML-V2-PROPOSITION.md](../2026-10-29/ML-V2-PROPOSITION.md), qui industrialise le § 2.2. Script : `pnpm --filter @evcore/backtest-core backtest:market-grid`. Sortie complète : [ml1-grille-marche.txt](ml1-grille-marche.txt). Verdict : **expédié** (`MARKET_GRID`, repli sur le moteur-stats).

## 1. La grille

`packages/analysis-core/src/market-grid/` (`computeMarketGrid`), en quatre étapes.

1. **Le book.** On prend le premier de `MARKET_GRID_BOOKMAKERS` (les deux premiers de `BOOKMAKER_PREFERENCE` : Pinnacle, puis Bet365) qui cote, avant l'instant d'analyse et dans les 14 jours qui le précèdent, un 1X2 complet et au moins une ligne plus/moins complète. Un seul book à la fois, sans jamais mélanger les books.
   **Un seul instant.** On garde le dernier 1X2, puis les lignes cotées à 60 min au plus de lui (`MARKET_GRID_SAME_INSTANT_MINUTES`), dernière ligne par issue dans cette fenêtre. Une ligne hors fenêtre est ignorée : un plus d'un moment n'est jamais apparié au moins ou au 1X2 d'un autre.
2. **La marge.** On la retire par la méthode de Shin, groupe par groupe : le 1X2 (`shinOneXTwo`), chaque paire plus/moins et chaque total d'équipe (`shinOutcomeGroups`, appariement de `outcome-groups.ts`).
3. **λ dom. et λ ext.** On les ajuste par moindres carrés pondérés (le 1X2 compte ×3, chaque ligne ×1), avec un Levenberg-Marquardt déterministe parti d'un seul point lu sur les prix (total de Poisson de la ligne la plus proche de 2,5, réparti selon le 1X2). Sur les 7 580 grilles de 2026, ce départ unique et les trois départs fixes de la première version donnent le même ajustement à 1,6·10⁻⁷ près sur λ et 1,6·10⁻¹⁴ sur l'écart quadratique. Au-delà d'un écart quadratique de 0,02 entre la grille et les prix (`MARKET_GRID_MAX_RMSE`), les prix se contredisent, et on garde le moteur-stats.
4. **Les marchés.** Le 1X2 donné aux canaux est le 1X2 du book sans marge : une paire de Poisson indépendantes ne reproduit pas toujours le nul. Tout le reste sort de `deriveMarketsFromPoisson` sur les λ ajustés, avec la même forme que le moteur-stats.

**ρ (Dixon-Coles) n'est pas ajusté.** Un ρ par match sur des lignes bruitées, c'est exactement ce que le sous-modèle D du lot ML-2 remplacera par un ρ par championnat. Et les dérivations du moteur supposent des marges indépendantes (Dixon-Coles avait été rejeté le 30/06). Les tests vérifient la reproduction exacte des prix d'entrée, l'ordre des books, la borne de l'instant d'analyse et le refus de prix contradictoires.

## 2. Méthode (figée avant le rejeu)

- **Matchs.** 12 704 matchs terminés de 2026. Décision à coup d'envoi − 1 h. Cotes et prix de la grille **captés et cotés** avant cet instant, comme en prod. Les lignes HISTORICAL, importées après coup, en sont donc exclues : janvier et février n'ont aucune cote point-in-time, et 7 545 matchs sont rejoués.
- **Moteur actuel.** La chaîne de production (`production-chain.ts`) : team_stats point-in-time, λ, force des championnats en coupe d'Europe, H2H, blend 1X2, shrinkage, signaux.
- **Grille.** Le même contexte, dont seuls les probabilités et λ sont remplacés.
- **Grille « veille ».** La même grille, calculée à 17 h UTC la veille, l'heure où les coupons sont composés.
- **Canaux.** Les 20 stratégies tournent dans l'orchestrateur, et on mesure les 16 de Phase 1, avec une jambe par match × canal × marché.
- **Juge.** La clôture Pinnacle (`odds_closing_line`, ≤ 2 h avant le coup d'envoi), marge retirée par Shin. La double chance et le remboursé-si-nul sont déduits de son 1X2. Cette clôture n'existe vraiment que depuis la mi-septembre : 2 379 matchs.
- **Attention.** La grille à T − 1 h lit Pinnacle presque à la clôture, donc **son résidu est en partie mécanique**. La grille « veille » mesure ce que coûte le mouvement de ligne.
- **Intervalles.** IC 95 % par bootstrap en blocs de jours (1 000 tirages, graine fixe).

**Règle d'expédition, écrite dans l'en-tête du script avant le rejeu complet (commit 61f0d546).** Un essai de trois jours a servi à déboguer le script, et les critères n'ont pas bougé depuis. Il faut les cinq :

- **C1** : la grille est disponible sur au moins 80 % des matchs de septembre à novembre.
- **C2** : la borne basse de l'IC du ratio réalisé ÷ annoncé de la grille est d'au moins 0,97.
- **C3** : sur les mêmes matchs, l'IC de ΔBrier(grille) − ΔBrier(actuel) contre la clôture est entièrement sous 0.
- **C4** : aucun canal à 100 jambes ou plus n'a un |ratio − 1| significativement plus grand avec la grille.
- **C5** : la part des jours avec deux jambes de vivier entre 1,20 et 1,50 (canaux admis, sous `MAX_LEG_EDGE`) baisse de 10 points au plus.

## 3. Résultats

**Couverture.** La grille est disponible sur 7 178 matchs rejoués sur 7 545 (95,1 %), et sur 96,7 % de septembre à novembre. Elle vient de Pinnacle 7 148 fois et de Bet365 30 fois. Sur les autres matchs, 358 ont des prix contradictoires (4,7 %) et 9 n'ont aucun prix affûté dans les 14 jours. L'erreur d'ajustement médiane est de 0,009. Le prix a en médiane 11 à 22 h d'âge à l'instant d'analyse.

**1X2 par match contre la clôture** (2 379 matchs) : Brier actuel 0,6127, grille 0,5822, clôture 0,5811. Le résidu passe de **+0,032 [+0,024 ; +0,042]** à **+0,0011 [0,000 ; +0,002]**.

**Par canal, mêmes matchs** :

| Canal                      |  Jambes act./grille | Réalisé ÷ annoncé, actuel | Réalisé ÷ annoncé, grille | ΔBrier vs Pinnacle, actuel → grille |
| -------------------------- | ------------------: | ------------------------: | ------------------------: | ----------------------------------- |
| DOMINANT                   |       1 377 / 1 556 |     0,935 [0,889 ; 0,978] |     1,012 [0,972 ; 1,050] | +0,0148 → +0,0005                   |
| GOALS                      |       6 491 / 6 542 |     0,966 [0,953 ; 0,977] |     1,012 [0,997 ; 1,024] | +0,0032 → +0,0004                   |
| TEAM_TOTAL                 |       5 052 / 4 988 |     0,930 [0,912 ; 0,946] |     1,002 [0,984 ; 1,019] | +0,0108 → +0,0004                   |
| DOUBLE_CHANCE              |       4 129 / 3 656 |     0,956 [0,937 ; 0,974] |     0,993 [0,980 ; 1,007] | +0,0056 → +0,0004                   |
| DRAW_NO_BET                |       3 121 / 3 298 |     1,011 [0,983 ; 1,039] |     1,027 [1,004 ; 1,048] | +0,0227 → +0,0012                   |
| BTTS                       |       3 262 / 3 130 |     0,986 [0,952 ; 1,019] |     0,990 [0,961 ; 1,021] | —                                   |
| CLEAN_SHEET                |       3 888 / 4 389 |     0,965 [0,921 ; 1,016] |     0,989 [0,947 ; 1,034] | —                                   |
| WIN_TO_NIL                 |       4 183 / 4 836 |     0,993 [0,935 ; 1,053] |     0,984 [0,935 ; 1,032] | —                                   |
| WIN_EITHER_HALF            |       4 391 / 4 541 |     0,993 [0,968 ; 1,015] |     1,023 [1,005 ; 1,042] | —                                   |
| RESULT_BTTS                |       5 155 / 5 156 | **0,743 [0,692 ; 0,793]** |     0,963 [0,918 ; 1,005] | —                                   |
| RESULT_TOTAL_GOALS         |       3 069 / 2 921 |     0,900 [0,838 ; 0,963] |     1,016 [0,966 ; 1,066] | —                                   |
| HALF_TIME_FULL_TIME        |       1 171 / 1 171 |     0,988 [0,895 ; 1,093] |     1,000 [0,896 ; 1,109] | —                                   |
| FIRST_HALF                 |           818 / 805 |     1,004 [0,919 ; 1,088] |     1,030 [0,951 ; 1,106] | +0,0014 → −0,0007                   |
| OVER_UNDER_HT              |       1 116 / 1 115 |     0,968 [0,923 ; 1,012] |     1,012 [0,977 ; 1,046] | +0,0034 → −0,0000                   |
| CORRECT_SCORE              |       5 500 / 5 500 |     0,946 [0,873 ; 1,016] |     1,051 [0,966 ; 1,126] | —                                   |
| DRAW (Famille D, inchangé) |       1 512 / 1 512 |                     0,995 |                     0,995 | 0,0000                              |
| **Tous**                   | **54 235 / 55 116** | **0,956 [0,942 ; 0,970]** | **1,005 [0,994 ; 1,017]** | **+0,0092 → +0,0005**               |

« — » signifie que Pinnacle ne cote pas ce marché : le canal n'est alors jugé que sur sa calibration. Sur les jambes à clôture, réalisé − Pinnacle reste nul pour les deux moteurs : −0,002 [−0,011 ; +0,007] pour l'actuel, +0,007 [−0,003 ; +0,019] pour la grille. **La grille ne bat pas le marché, elle cesse de sur-promettre.**

**Mouvement de ligne.** Calculée la veille à 17 h, la grille garde un ratio de 1,004 [0,992 ; 1,017], et son ΔBrier contre la clôture monte de +0,0005 à +0,0007 [+0,0004 ; +0,0012]. Le mouvement entre la veille et la clôture coûte donc 0,0002 de Brier, environ 2 % de l'écart du moteur actuel. L'écart moyen par issue entre la grille à T − 1 h et la clôture vaut 0,009.

**Produits** (septembre à novembre, grille plus repli) :

- **Plafond `MAX_LEG_EDGE`.** La part des jambes au-dessus du plafond passe de 2 à 23 % selon le canal (DOMINANT 22,7 %, DRAW_NO_BET 13 %) à 0 à 0,5 %. Le plafond ne coupe presque plus rien : c'est la surconfiance qu'il coupait.
- **Volumes.** Ils restent du même ordre (DOMINANT 596 → 685, DOUBLE_CHANCE 2 509 → 2 112, WIN_TO_NIL 2 755 → 3 134).
- **Jours exploitables.** La part des jours avec au moins deux matchs de vivier entre 1,20 et 1,50 reste à 98,4 % (médiane 33 → 36 matchs par jour).

**Critères** : C1 96,7 % ✓. C2 0,994 ✓. C3 −0,0087 [−0,0113 ; −0,0065] ✓. C4 aucun canal dégradé ✓ (le plus défavorable est DRAW_NO_BET, à +0,017 [−0,008 ; +0,033]). C5 98,4 % contre 98,4 % ✓. **Expédié.**

## 4. Ce qui change en prod

- **Source des probabilités.** `analyzeFixture` appelle `computeMarketGrid` sur `findMarketGridRows` (lignes PREMATCH captées avant l'instant). Quand la grille est disponible, ses probabilités et λ remplacent ceux du moteur-stats, `predictionSource = MARKET_GRID`. Sinon, `POISSON_MAIN`.
- **Ce que garde le moteur-stats.** Il reste calculé, quelle que soit la source : il donne le score déterministe et la décision BET / NO_BET, le repli, et il alimente les **garde-fous « Données suspectes »** (cohérence 1X2 et plus/moins avec le marché : alerte `calibration_alert`, exclusion des coupons, AVOID). Ces garde-fous servent à attraper une entrée corrompue (team_stats, λ) ; comparés à la grille, qui est le prix Pinnacle sans marge, à une médiane qui contient Pinnacle, ils ne se déclencheraient presque plus. `features.statsProbabilities` et `statsLambdaHome/Away` gardent sa sortie quand la grille s'applique (null sinon).
- **Trace.** `features.market_grid` garde le book, les prix lus, λ, l'erreur d'ajustement, ou la raison pour laquelle la grille n'a pas servi. `resolveProbabilitySource()` décide la source en un seul endroit : sous la grille, `h2h_correction_applied`, `h2h_market_signals_applied` et `congestion_correction_applied` valent false (les signaux restent dans `shadow_*`), `rawPoissonProbability` est le Poisson de la grille avant son 1X2 sans marge, et la trace λ de la fiche ne marque aucune étape du moteur-stats.
- **Pas de drapeau.** Le repli est dans `computeMarketGrid` lui-même ; le retour arrière est un revert.
- **Inchangé.** Les canaux, leurs seuils, les plafonds et les coupons ne changent pas.
- **Corrections du moteur-stats.** Sous la grille, H2H, congestion, blend et shrinkage ne s'appliquent plus : le prix les contient déjà, ou ils ne lui ajoutaient rien (journal du 16/09).

## 5. Limites

- **Fenêtre du juge.** Le jugement contre la clôture repose surtout sur octobre (1 701 clôtures sur 2 379), et la grille à T − 1 h se nourrit presque de son juge. La lecture qui ne dépend pas de la clôture est le ratio réalisé ÷ annoncé sur 55 116 jambes, de mars à novembre.
- **Ratios au-dessus de 1.** DRAW_NO_BET (1,027) et WIN_EITHER_HALF (1,023) restent un peu au-dessus de 1. C'est une sous-annonce, sans danger pour la promesse. À relire avec ML-2 (mi-temps et dépendance).
- **Prix du pari.** Le prix de pari rejoué est celui du book le mieux classé (Pinnacle), pas celui de 1xBet. La bande 1,20–1,50 chez 1xBet est donc approchée.
- **Matchs sans team_stats.** Ils ne sont toujours pas analysés, même avec un prix. Les analyser serait un changement de périmètre, pas fait ici.
- **Seuils des canaux.** Ils ont été réglés sur un moteur sur-confiant et restent tels quels. On ne les relit pas sur ce rejeu.
