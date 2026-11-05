# ML-2b — la mi-temps sur la grille de marché

Rejeu du 2026-11-05 sur la base locale (copie de prod jusqu'au 03/11). C'est le sous-modèle A du lot ML-2 de [ML-V2-PROPOSITION.md](../2026-10-29/ML-V2-PROPOSITION.md), mesuré avec la méthode de [ML1-GRILLE-MARCHE.md](../2026-11-04/ML1-GRILLE-MARCHE.md). Script : `pnpm --filter @evcore/backtest-core backtest:half-time`. Sortie complète : [ml2b-mi-temps.txt](ml2b-mi-temps.txt). Verdict : **expédié**, selon la règle fixée d'avance. Le gain est petit.

## 1. Point de départ

Sous la grille, les quatre canaux mi-temps (FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME, WIN_EITHER_HALF) lisaient λ_MT = E[buts] × 0,44 pour chaque équipe (`FIRST_HALF_GOAL_FRACTION`, `poisson.ts`), et λ × 0,56 pour la seconde période. Les deux périodes sont des Poisson indépendantes. Le prix de la mi-temps n'était pas lu.

**Ce que Pinnacle cote.** Pinnacle cote `FIRST_HALF_WINNER` (1X2 MT, picks HOME/DRAW/AWAY) et `OVER_UNDER_HT` (0,5 et 1,5) en PREMATCH depuis le 07/04, sur environ 8 400 matchs. La clôture à 2 h ou moins n'existe vraiment que de septembre à novembre, sur environ 2 500 matchs. Le résidu contre Pinnacle est donc mesurable. Bet365 cote aussi la mi-temps, HT/FT et « gagne une des deux mi-temps », mais aucun juge Pinnacle n'existe pour ces deux derniers.

## 2. Méthode (figée dans l'en-tête du script avant le rejeu, commit 27434c72)

- **Prix de mi-temps.** On prend le livre de la grille, et lui seul. Il faut son dernier 1X2 MT complet et au moins une ligne plus/moins MT complète, cotée à 60 min au plus de ce 1X2. La marge est retirée par Shin, groupe par groupe. λ_MT dom. et ext. sont ajustés par les moindres carrés de la grille : le même Levenberg-Marquardt, le 1X2 compté ×3, chaque ligne ×1. Le prix est refusé si l'écart dépasse 0,02, ou si λ_MT ≥ λ − 0,05. La seconde période reçoit λ − λ_MT. Code : `selectFirstHalfQuotes` et `computeMarketGrid`.
- **Sinon, une fraction par championnat.** Elle vaut Σ buts MT ÷ Σ buts sur les matchs terminés depuis 2018, rétrécie vers 0,44 avec K = 500, et reste à 0,44 sous 200 matchs. Elle est ajustée en walk-forward mensuel. Pas de ρ de mi-temps.
- **Rejeu.** Les mêmes matchs et le même instant que ML-1 et ML-2a : 2026, T − 1 h, la grille à ρ de prod. On compare trois moteurs : `base` (0,44, la prod), `frac` (la fraction seule) et `ht` (les prix, sinon la fraction : c'est le candidat). Les 20 stratégies tournent. Le juge est la clôture Pinnacle MT (≤ 2 h, Shin). Le résidu est aussi mesuré à 17 h la veille, parce qu'à T − 1 h la grille lit la mi-temps presque à la clôture. Les IC sont tirés par bootstrap en blocs de jours (1 000 tirages).
- **Règle.** `ht` est expédié si les six critères tiennent. **H1** : la borne basse du ratio réalisé ÷ annoncé des jambes mi-temps est d'au moins 0,97. **H2** : sur les matchs à clôture, l'IC de Σ[(p_ht − c)² − (p_base − c)²] est sous 0 à T − 1 h. **H3** : la même chose la veille à 17 h. **H4** : aucun canal mi-temps n'est dégradé. **H5** : les canaux plein-match sont identiques au bit près. **H6** : la log-perte du résultat MT n'est pas significativement pire. `frac` peut être expédié seul si `ht` échoue.

## 3. Résultats (7 435 matchs à grille, dont 6 926 à prix MT, soit 93 %)

| Critère                                    | `ht` − `base`                         | `frac` − `base`                  |
| ------------------------------------------ | ------------------------------------- | -------------------------------- |
| H1 ratio des jambes mi-temps               | 1,012 [0,993 ; 1,031], 7 877 jambes ✓ | 1,014 [0,995 ; 1,033] ✓          |
| H2 écart² à la clôture, T − 1 h (2 492 m.) | **−0,00014 [−0,00016 ; −0,00012]** ✓  | +0,00008 [+0,00004 ; +0,00011] ✗ |
| H3 écart² à la clôture, veille (2 424 m.)  | **−0,00015 [−0,00019 ; −0,00012]** ✓  | +0,00007 [+0,00003 ; +0,00010] ✗ |
| H4 canal mi-temps dégradé                  | aucun ✓                               | aucun ✓                          |
| H5 plein-match identique                   | 0 match différent, 49 742 jambes ✓    | idem ✓                           |
| H6 log-perte du résultat MT                | +0,00065 [−0,00025 ; +0,00153] ✓      | −0,00026 [−0,00107 ; +0,00060] ✓ |

**Canaux, réalisé ÷ annoncé (`base` → `ht`).** FIRST_HALF passe de 1,025 à 1,001, OVER_UNDER_HT de 1,012 à 1,008, HALF_TIME_FULL_TIME de 0,990 à 0,977 [0,880 ; 1,074], et WIN_EITHER_HALF reste à 1,019. Tous les écarts restent dans le bruit. Sur les jambes qui ont une clôture, le ΔBrier contre Pinnacle vaut +0,0001 [−0,0008 ; +0,0008] : nul.

**Les fractions** vont de 0,409 à 0,456, avec une médiane de 0,444. 0,44 était déjà la bonne moyenne.

## 4. Ce que ça veut dire

- **Le prix de la mi-temps rapproche la grille de Pinnacle**, et ce n'est pas mécanique : le gain est le même la veille à 17 h. Mais il est petit, 0,00014 d'écart² sur cinq issues, et ne se voit ni sur la calibration des canaux, déjà à 1,01, ni sur la log-perte du résultat réel. **Ce n'est pas un avantage sur le marché.** La mi-temps annoncée est désormais celle du prix quand il existe.
- **La fraction par championnat n'apporte rien.** Seule, elle éloigne un peu la grille de la clôture (H2 et H3 ratés), et les championnats ne s'écartent de 0,44 que de ±0,03. Elle reste le repli de `ht`, comme la règle le prévoyait, mais ne sert que sur 7 % des matchs (508 sans prix MT complets). **Proposition à décider** : remettre ce repli à 0,44 (vider `MARKET_GRID_FIRST_HALF_FRACTION`), puisque sa propre mesure est contre lui. Ce n'est pas fait, parce que ce choix viendrait après avoir vu les chiffres.

## 5. Ce qui change en prod

- `findMarketGridRows` lit aussi `FIRST_HALF_WINNER` et `OVER_UNDER_HT` des livres de la grille. `analyzeFixture` passe `firstHalfFraction: marketGridFirstHalfFraction(code)`.
- `features.market_grid.firstHalf` garde la source (`prices` ou `fraction`), les λ_MT ou la fraction, et la raison du repli.
- **Inchangé** : les canaux plein-match (H5), les seuils et les coupons. Le moteur-stats de repli (`POISSON_MAIN`) garde 0,44. Le retour arrière est un revert.

## 6. Limites

- **Le juge mi-temps** repose surtout sur octobre (septembre à novembre). HT/FT et « gagne une des deux mi-temps » ne sont jugés que sur leur calibration.
- **Les périodes restent indépendantes**, sans ρ de mi-temps. HT/FT à 0,977 reste dans le bruit (IC ±0,10), à relire si le volume grandit.
- **La fraction finale** est ajustée sur tout l'historique jusqu'au 03/11, comme la carte ρ de ML-2a. Le rejeu, lui, l'a mesurée en walk-forward.
