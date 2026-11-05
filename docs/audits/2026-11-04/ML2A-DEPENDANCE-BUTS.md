# ML-2a — la dépendance des buts (Dixon-Coles) sur la grille

Rejeu du 2026-11-04 sur la base locale (copie de prod jusqu'au 03/11). C'est le sous-modèle D du lot ML-2 de [ML-V2-PROPOSITION.md](../2026-10-29/ML-V2-PROPOSITION.md), mesuré avec la méthode de [ML1-GRILLE-MARCHE.md](ML1-GRILLE-MARCHE.md). Script : `pnpm --filter @evcore/backtest-core backtest:goal-dependence`. Sortie complète : [ml2a-dependance-buts.txt](ml2a-dependance-buts.txt). Verdict de l'agent : non expédié, le critère D2 (BTTS contre la clôture Pinnacle) ne pouvant pas être mesuré. **Décision de l'utilisateur le 04/11 : expédié** (voir § 5).

## 1. Le rejet du 30/06 tient-il encore ?

Dixon-Coles avait été rejeté le 30/06 (`poisson.ts`, `correct-score.config.ts`) : il n'apportait rien sur les marchés de buts et faisait moins bien sur le score exact. Mais il était alors posé sur les λ du moteur-stats, qui avaient 0,02 de Brier de retard sur le marché et sur-annonçaient. Une correction de second ordre sur les petits scores disparaissait sous l'erreur de premier ordre sur λ. La note de conception de l'époque (`docs/archive/coupon-module/DESIGN.md`) ajoutait que la couche ML corrigerait ce biais, et que le canal DRAW lisait déjà `1/drawOdds`.

Avec la grille, les λ viennent du prix. Le seul défaut qui reste est celui de la forme : des marges de Poisson indépendantes. **La raison du rejet ne tient donc plus.** Le rejeu le confirme : l'indépendance sous-estime le nul de 10 %, sur-estime 1-0 et 0-1 de 10 %, et sous-estime 1-1 de 9 % (tableau du § 3).

## 2. Méthode (figée dans l'en-tête du script avant le rejeu, commit 70ef2e30)

- **Modèle.** τ(h, a) de Dixon-Coles sur 0-0, 0-1, 1-0 et 1-1 (`probability/dixon-coles.ts`). Les deux marges sont préservées exactement : les totaux d'équipe, les clean sheets et la mi-temps ne bougent pas. λ sont ré-ajustés sous ρ (`fitMarketGridLambdas(targets, rho)`), de sorte que la grille reproduit toujours le 1X2 et les lignes. Le 1X2 donné aux canaux reste celui du book sans marge. ρ ne change que BTTS, les totaux bas, RESULT\_\*, WIN_TO_NIL et CORRECT_SCORE (qui lit la même matrice, `scoreDependenceRho`).
- **ρ par championnat.** Pour chaque match passé qui a une grille et chaque ρ de −0,30 à +0,10 (pas de 0,01), on calcule la log-vraisemblance du score réel, λ ré-ajustés. Le ρ global est l'argmax. Le ρ d'un championnat vaut (n·ρ̂ + 500·ρ global) / (n + 500), et le ρ global s'applique sous 200 matchs. Entraînement : 7 165 grilles Pinnacle de clôture de 2023 à 2025 (lignes HISTORICAL), puis les grilles point-in-time de 2026. **Walk-forward** : la carte d'un mois n'est ajustée que sur les mois qui précèdent.
- **Rejeu.** Mêmes matchs, instant et filtres que ML-1 : 12 704 matchs de 2026, décision à T − 1 h, 7 214 matchs ont les deux grilles. On compare la grille indépendante (la prod) et la grille à ρ, sur les 16 canaux de Phase 1. Les IC à 95 % viennent d'un bootstrap en blocs de jours (1 000 tirages).
- **Règle d'expédition.** Il faut les quatre critères. **D1** : l'IC de la log-perte du score exact (ρ − indépendant) est entièrement sous 0. **D2** : sur BTTS oui, l'IC de l'écart² à la clôture Pinnacle (ρ − indépendant) est entièrement sous 0. **D3** : la borne basse du ratio réalisé ÷ annoncé de toutes les jambes est d'au moins 0,97. **D4** : aucun canal à 100 jambes ou plus n'est dégradé.

## 3. Résultats

**ρ.** Le ρ global est stable de mois en mois, entre −0,04 et −0,05, et vaut **−0,05** sur tout l'historique (14 384 matchs). Les valeurs vont de −0,089 (POL1) et −0,078 (BL1) à −0,01 (CHI1), pour 35 championnats ajustés (carte complète dans la sortie).

**Petits scores, réalisé ÷ annoncé** (7 214 matchs) :

| Issue     | Réalisé | Indépendant           | ρ du championnat      |
| --------- | ------: | --------------------- | --------------------- |
| Nul       |   0,253 | 1,100 [1,055 ; 1,143] | 1,058 [1,014 ; 1,100] |
| 0-0       |   0,063 | 1,053 [0,958 ; 1,158] | 0,980 [0,892 ; 1,080] |
| 1-0 / 0-1 |   0,148 | 0,902 [0,860 ; 0,948] | 0,964 [0,919 ; 1,013] |
| 1-1       |   0,116 | 1,095 [1,025 ; 1,159] | 1,049 [0,983 ; 1,111] |
| BTTS oui  |   0,565 | 1,044 [1,022 ; 1,064] | 1,033 [1,011 ; 1,053] |
| Moins 2,5 |   0,438 | 0,969 [0,943 ; 0,995] | 0,972 [0,947 ; 0,998] |

ρ corrige environ la moitié du défaut sur chaque petit score. Il reste un nul sous-annoncé de 6 %.

**Contre Pinnacle.** Le nul interne de la grille (somme de la diagonale) était 0,0135 sous la clôture Pinnacle. Avec ρ, il n'en est plus qu'à 0,0038 (2 386 matchs, écart² −0,00018 [−0,00019 ; −0,00017]). **Pinnacle ne clôture pas BTTS dans notre flux de 2026** : ses 3 320 clôtures BTTS sont des lignes HISTORICAL, la dernière date du 04/05, et aucune ne recoupe un match rejoué. D2 porte donc sur 0 match.

**Canaux.** Les ratios ne bougent pas au-delà du bruit. CORRECT_SCORE passe de 1,051 [0,974 ; 1,132] à 1,029 [0,960 ; 1,101], WIN_TO_NIL de 0,984 à 0,996, RESULT_TOTAL_GOALS de 1,016 à 1,040 et RESULT_BTTS de 0,963 à 0,956. Les 16 canaux ensemble restent à 1,005, avec ou sans ρ. Sur les jambes qui ont une clôture, le résidu ρ − indépendant vaut −0,0000 [−0,0001 ; +0,0000].

**Critères.** D1 −0,00123 [−0,00195 ; −0,00042] ✓. D2 non mesurable ✗. D3 1,005 [0,995 ; 1,016] ✓. D4 aucun canal dégradé ✓. **Non expédié.**

## 4. Ce que ça veut dire

- **Ce que ρ apporte.** Le gain est réel : il améliore la forme de la grille, en log-perte du score exact et sur le nul contre Pinnacle. Mais il est petit, et ne se voit pas sur la calibration des canaux, qui était déjà à 1,00 grâce à la grille. **Ce n'est pas un avantage sur le marché**, c'est une forme plus juste.
- **Pourquoi on n'expédie pas.** La règle disait BTTS contre Pinnacle, et ce juge n'existe pas pour 2026. On n'en choisit pas un autre après avoir vu les données. Pour rouvrir, il faut une décision humaine : figer un D2 mesurable (le nul interne contre la clôture Pinnacle, ou BTTS sur les clôtures HISTORICAL de 2023 à mai 2026), puis rejouer.
- **Ce qui reste dans le code.** `computeMarketGrid(rows, cutoff, { rho })`, `marketGridRho`, `MARKET_GRID_RHO` (vide), le τ de `dixon-coles.ts` et `scoreDependenceRho` pour CORRECT_SCORE. ρ = 0 redonne la grille actuelle au bit près (test). Le backend n'est pas branché.
- **Limite du juge.** La clôture Pinnacle des plus/moins 2,5 est stockée sous les picks `OVER` et `UNDER`, sans ligne (`odds_closing_line`). Le juge `OVER_2_5` du script, et celui de ML-1, ne la trouve donc pas. À corriger dans l'ETL ou dans le juge, avant le prochain rejeu.

## 5. Décision du 04/11 : expédié

Les trois critères mesurables (D1, D3, D4) sont tenus, dont un gain significatif sur le score exact ; D2 n'est ni tenu ni raté, faute de clôture Pinnacle BTTS en 2026. L'utilisateur a choisi d'expédier, avec un garde-fou en direct à la place de D2 :

- `MARKET_GRID_RHO` reçoit la carte finale (14 384 grilles, global −0,05) ; ρ ne s'applique que quand la source est la grille.
- **Remplaçant de D2, suivi en production** : le nul réalisé contre la fréquence de la clôture Pinnacle sans marge (1X2), par mois, sur les matchs analysés par la grille (`features.market_grid.rho` non nul). Indicatif au rejeu : −0,0135 → −0,0038. Relu le 10/12 ; si le biais repasse sous −0,01 ou que DRAW se dégrade, retour à ρ = 0 (vider la carte), sans autre changement.
- Ce choix a été fait après avoir vu les chiffres : il n'a pas la valeur d'un critère figé d'avance, d'où le suivi en direct.
