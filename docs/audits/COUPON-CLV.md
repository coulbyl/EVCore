# CLV par jambe de coupon

Régénérable : `pnpm --filter @evcore/backtest-core report:coupon-clv`.

Le CLV d'une jambe est la cote prise × la probabilité de clôture sans marge
− 1. Un pari pris exactement au prix de clôture vaut **moins la marge**, pas
zéro : la colonne « À la clôture » est cette barre, et « Écart » dit si le
prix pris la battait (positif) ou non. Il
ne dépend pas du résultat du match, donc son erreur type se compte en
dixièmes de point là où un ROI en demande des dizaines. « Avec clôture » est
la part des jambes qui ont trouvé un groupe d'issues complet à moins de
90 min du coup d'envoi ; tant qu'elle est basse, la colonne CLV porte sur un
échantillon qui n'est pas la population.

| Source | Marché | Jambes | Avec clôture | CLV moyen (± ET) | À la clôture | Écart (± ET) | Taux de réussite | P(clôture) moyenne | Cote prise | Cote de clôture |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LLM | **toutes** | 1442 | 183 (13 %) | -4.24 ± 0.1 % | -4.39 % | 0.14 ± 0.10 pt | 52.1 % | 52.6 % | 2.04 | 1.94 |
| LLM | ONE_X_TWO | 310 | 35 (11 %) | -3.99 ± 0.1 % | -3.99 % | 0.00 ± 0.00 pt | 54.5 % | 51.1 % | 2.00 | 1.96 |
| LLM | OVER_UNDER | 226 | 30 (13 %) | -5.18 ± 0.4 % | -5.26 % | 0.08 ± 0.23 pt | 54.4 % | 52.6 % | 1.76 | 1.85 |
| LLM | BTTS | 212 | 70 (33 %) | -3.78 ± 0.1 % | -3.89 % | 0.12 ± 0.10 pt | 50.5 % | 47.4 % | 2.17 | 2.07 |
| LLM | DOUBLE_CHANCE | 103 | 11 (11 %) | -3.95 ± 0.8 % | -4.97 % | 1.03 ± 0.47 pt | 75.5 % | 79.4 % | 2.03 | 1.20 |
| LLM | HALF_TIME_FULL_TIME | 10 | 0 (0 %) | — | — | — | 10.0 % | — | 3.27 | — |
| LLM | OVER_UNDER_HT | 114 | 7 (6 %) | -3.94 ± 0.5 % | -3.75 % | -0.18 ± 0.18 pt | 56.1 % | 55.3 % | 1.83 | 1.78 |
| LLM | FIRST_HALF_WINNER | 46 | 12 (26 %) | -3.84 ± 0.0 % | -3.84 % | 0.00 ± 0.00 pt | 26.1 % | 33.6 % | 2.75 | 2.93 |
| LLM | DRAW_NO_BET | 110 | 2 (2 %) | -7.69 ± 0.2 % | -8.63 % | 0.94 ± 0.94 pt | 58.0 % | 60.8 % | 1.96 | 1.50 |
| LLM | TEAM_TOTAL_HOME | 88 | 8 (9 %) | -4.49 ± 0.8 % | -5.69 % | 1.19 ± 0.93 pt | 33.0 % | 76.8 % | 2.05 | 1.23 |
| LLM | TEAM_TOTAL_AWAY | 79 | 8 (10 %) | -6.10 ± 1.3 % | -5.38 % | -0.72 ± 1.47 pt | 57.0 % | 67.2 % | 1.91 | 1.43 |
| LLM | CLEAN_SHEET_HOME | 14 | 0 (0 %) | — | — | — | 35.7 % | — | 3.01 | — |
| LLM | CLEAN_SHEET_AWAY | 8 | 0 (0 %) | — | — | — | 25.0 % | — | 3.51 | — |
| LLM | WIN_TO_NIL_HOME | 4 | 0 (0 %) | — | — | — | 25.0 % | — | 2.89 | — |
| LLM | TO_WIN_EITHER_HALF | 75 | 0 (0 %) | — | — | — | 50.7 % | — | 1.86 | — |
| LLM | RESULT_TOTAL_GOALS | 34 | 0 (0 %) | — | — | — | 41.2 % | — | 2.67 | — |
| LLM | RESULT_BTTS | 9 | 0 (0 %) | — | — | — | 11.1 % | — | 3.65 | — |
| PRICE_COMPOSER | **toutes** | 71 | 66 (93 %) | -6.61 ± 0.7 % | -4.74 % | -1.87 ± 0.70 pt | 47.1 % | 41.7 % | 2.48 | 2.58 |
| PRICE_COMPOSER | ONE_X_TWO | 15 | 14 (93 %) | -9.61 ± 1.4 % | -5.29 % | -4.32 ± 1.55 pt | 66.7 % | 52.0 % | 2.69 | 3.03 |
| PRICE_COMPOSER | OVER_UNDER | 4 | 4 (100 %) | -1.26 ± 7.3 % | -4.54 % | 3.28 ± 7.75 pt | 0.0 % | 42.3 % | 2.35 | 2.31 |
| PRICE_COMPOSER | FIRST_HALF_WINNER | 52 | 48 (92 %) | -6.18 ± 0.6 % | -4.59 % | -1.59 ± 0.58 pt | 45.1 % | 38.6 % | 2.44 | 2.48 |
| ENGINE | **toutes** | 37 | 29 (78 %) | -5.32 ± 0.9 % | -5.39 % | 0.07 ± 0.89 pt | 83.8 % | 73.2 % | 1.28 | 1.35 |
| ENGINE | OVER_UNDER | 6 | 6 (100 %) | -4.34 ± 1.0 % | -4.12 % | -0.22 ± 1.20 pt | 66.7 % | 70.3 % | 1.40 | 1.41 |
| ENGINE | BTTS | 5 | 5 (100 %) | -8.89 ± 1.0 % | -6.25 % | -2.64 ± 1.46 pt | 100.0 % | 55.9 % | 1.64 | 1.70 |
| ENGINE | DOUBLE_CHANCE | 7 | 5 (71 %) | -4.78 ± 0.9 % | -5.95 % | 1.18 ± 1.03 pt | 100.0 % | 84.5 % | 1.12 | 1.11 |
| ENGINE | DRAW_NO_BET | 4 | 4 (100 %) | -5.29 ± 0.7 % | -5.29 % | 0.00 ± 0.00 pt | 50.0 % | 80.1 % | 1.24 | 1.24 |
| ENGINE | TEAM_TOTAL_HOME | 4 | 4 (100 %) | -2.57 ± 1.7 % | -6.09 % | 3.52 ± 1.48 pt | 100.0 % | 81.2 % | 1.20 | 1.16 |
| ENGINE | TEAM_TOTAL_AWAY | 5 | 5 (100 %) | -5.71 ± 4.5 % | -5.02 % | -0.69 ± 4.55 pt | 60.0 % | 70.5 % | 1.38 | 1.41 |
| ENGINE | TO_WIN_EITHER_HALF | 6 | 0 (0 %) | — | — | — | 100.0 % | — | 1.07 | — |

**1 source sur 3** atteint la couverture
cible de 80 % (acceptation de E-2).

## Au prix 1xBet

Le prix que paie le joueur, connu à la publication du coupon. Les sources se
comparent jambe à jambe à ce même prix : le réalisé face à la fréquence du
marché sans marge, et le résultat d'une mise fixe sur chaque jambe.

| Source | Jambes cotées 1xBet | Cote 1xBet | Marge 1xBet | Marché (sans marge) | Réalisé | Écart au marché | À mise fixe au prix 1xBet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LLM | 33 (2 %) | 1.31 | 8.3 % | 72.0 % | 63.6 % | -8.3 pt | -21.5 % |
| PRICE_COMPOSER | 66 (93 %) | 2.36 | 8.6 % | 43.3 % | 49.2 % | 6.0 pt | 8.8 % |
| ENGINE | 26 (70 %) | 1.31 | 8.3 % | 72.9 % | 84.6 % | 11.7 pt | 7.6 % |
