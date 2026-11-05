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
| LLM | **toutes** | 1460 | 199 (14 %) | -4.28 ± 0.1 % | -4.47 % | 0.18 ± 0.10 pt | 52.7 % | 54.6 % | 2.03 | 1.88 |
| LLM | ONE_X_TWO | 310 | 35 (11 %) | -3.99 ± 0.1 % | -3.99 % | 0.00 ± 0.00 pt | 54.5 % | 51.1 % | 2.00 | 1.96 |
| LLM | OVER_UNDER | 233 | 37 (16 %) | -4.89 ± 0.3 % | -5.13 % | 0.25 ± 0.24 pt | 55.8 % | 57.7 % | 1.75 | 1.73 |
| LLM | BTTS | 212 | 70 (33 %) | -3.78 ± 0.1 % | -3.89 % | 0.12 ± 0.10 pt | 50.5 % | 47.4 % | 2.17 | 2.07 |
| LLM | DOUBLE_CHANCE | 104 | 12 (12 %) | -3.69 ± 0.8 % | -4.84 % | 1.15 ± 0.45 pt | 75.7 % | 79.7 % | 2.03 | 1.20 |
| LLM | HALF_TIME_FULL_TIME | 10 | 0 (0 %) | — | — | — | 10.0 % | — | 3.27 | — |
| LLM | OVER_UNDER_HT | 114 | 7 (6 %) | -3.94 ± 0.5 % | -3.75 % | -0.18 ± 0.18 pt | 56.1 % | 55.3 % | 1.83 | 1.78 |
| LLM | FIRST_HALF_WINNER | 46 | 12 (26 %) | -3.84 ± 0.0 % | -3.84 % | 0.00 ± 0.00 pt | 26.1 % | 33.6 % | 2.75 | 2.93 |
| LLM | DRAW_NO_BET | 110 | 2 (2 %) | -7.69 ± 0.2 % | -8.63 % | 0.94 ± 0.94 pt | 58.0 % | 60.8 % | 1.96 | 1.50 |
| LLM | TEAM_TOTAL_HOME | 96 | 16 (17 %) | -5.37 ± 0.7 % | -6.01 % | 0.64 ± 0.68 pt | 38.5 % | 76.7 % | 1.98 | 1.23 |
| LLM | TEAM_TOTAL_AWAY | 79 | 8 (10 %) | -6.10 ± 1.3 % | -5.38 % | -0.72 ± 1.47 pt | 57.0 % | 67.2 % | 1.91 | 1.43 |
| LLM | CLEAN_SHEET_HOME | 14 | 0 (0 %) | — | — | — | 35.7 % | — | 3.01 | — |
| LLM | CLEAN_SHEET_AWAY | 8 | 0 (0 %) | — | — | — | 25.0 % | — | 3.51 | — |
| LLM | WIN_TO_NIL_HOME | 4 | 0 (0 %) | — | — | — | 25.0 % | — | 2.89 | — |
| LLM | TO_WIN_EITHER_HALF | 77 | 0 (0 %) | — | — | — | 51.9 % | — | 1.85 | — |
| LLM | RESULT_TOTAL_GOALS | 34 | 0 (0 %) | — | — | — | 41.2 % | — | 2.67 | — |
| LLM | RESULT_BTTS | 9 | 0 (0 %) | — | — | — | 11.1 % | — | 3.65 | — |
| PRICE_COMPOSER | **toutes** | 143 | 128 (90 %) | -6.10 ± 0.5 % | -4.58 % | -1.52 ± 0.48 pt | 51.0 % | 47.4 % | 2.24 | 2.31 |
| PRICE_COMPOSER | ONE_X_TWO | 42 | 40 (95 %) | -7.05 ± 1.1 % | -4.26 % | -2.78 ± 1.04 pt | 59.5 % | 52.7 % | 2.34 | 2.48 |
| PRICE_COMPOSER | OVER_UNDER | 11 | 11 (100 %) | -2.59 ± 2.5 % | -3.91 % | 1.33 ± 2.69 pt | 45.5 % | 47.3 % | 2.15 | 2.13 |
| PRICE_COMPOSER | BTTS | 8 | 7 (88 %) | -6.13 ± 1.8 % | -6.46 % | 0.33 ± 1.83 pt | 25.0 % | 58.9 % | 1.62 | 1.59 |
| PRICE_COMPOSER | DOUBLE_CHANCE | 5 | 5 (100 %) | -7.80 ± 0.7 % | -5.73 % | -2.08 ± 0.64 pt | 100.0 % | 75.7 % | 1.22 | 1.25 |
| PRICE_COMPOSER | FIRST_HALF_WINNER | 66 | 60 (91 %) | -5.84 ± 0.5 % | -4.61 % | -1.23 ± 0.49 pt | 43.9 % | 38.6 % | 2.45 | 2.48 |
| PRICE_COMPOSER | TEAM_TOTAL_HOME | 1 | 1 (100 %) | -8.22 % | -3.63 % | -4.59 pt | 0.0 % | 57.4 % | 1.60 | 1.68 |
| PRICE_COMPOSER | TEAM_TOTAL_AWAY | 4 | 4 (100 %) | -7.49 ± 1.2 % | -4.78 % | -2.71 ± 1.24 pt | 75.0 % | 69.6 % | 1.34 | 1.38 |
| PRICE_COMPOSER | CORNERS | 6 | 0 (0 %) | — | — | — | 66.7 % | — | 1.80 | — |
| ENGINE | **toutes** | 101 | 83 (82 %) | -4.83 ± 0.4 % | -5.29 % | 0.45 ± 0.44 pt | 74.0 % | 72.0 % | 1.64 | 1.35 |
| ENGINE | ONE_X_TWO | 1 | 1 (100 %) | -7.24 % | -5.10 % | -2.14 pt | 100.0 % | 53.6 % | 1.73 | 1.77 |
| ENGINE | OVER_UNDER | 19 | 19 (100 %) | -3.78 ± 0.6 % | -4.21 % | 0.43 ± 0.66 pt | 73.7 % | 70.5 % | 1.39 | 1.38 |
| ENGINE | BTTS | 7 | 7 (100 %) | -7.03 ± 1.4 % | -6.34 % | -0.69 ± 1.64 pt | 85.7 % | 58.0 % | 1.62 | 1.64 |
| ENGINE | DOUBLE_CHANCE | 13 | 11 (85 %) | -4.79 ± 0.8 % | -5.95 % | 1.16 ± 0.96 pt | 92.3 % | 78.1 % | 1.21 | 1.22 |
| ENGINE | CORRECT_SCORE | 7 | 0 (0 %) | — | — | — | 14.3 % | — | 5.70 | — |
| ENGINE | DRAW_NO_BET | 6 | 6 (100 %) | -5.94 ± 0.6 % | -5.94 % | 0.00 ± 0.00 pt | 40.0 % | 71.3 % | 1.40 | 1.40 |
| ENGINE | TEAM_TOTAL_HOME | 19 | 19 (100 %) | -3.97 ± 0.9 % | -5.41 % | 1.44 ± 0.84 pt | 84.2 % | 76.4 % | 1.27 | 1.25 |
| ENGINE | TEAM_TOTAL_AWAY | 20 | 19 (95 %) | -5.38 ± 1.4 % | -5.18 % | -0.19 ± 1.41 pt | 70.0 % | 72.5 % | 1.34 | 1.35 |
| ENGINE | CLEAN_SHEET_HOME | 1 | 1 (100 %) | -6.87 % | -6.87 % | 0.00 pt | 100.0 % | 60.9 % | 1.53 | 1.53 |
| ENGINE | TO_WIN_EITHER_HALF | 8 | 0 (0 %) | — | — | — | 87.5 % | — | 1.22 | — |

**2 sources sur 3** atteint la couverture
cible de 80 % (acceptation de E-2).

## Au prix 1xBet

Le prix que paie le joueur, connu à la publication du coupon. Le CLV de la
première table est au prix de référence (la colonne stockée) ; celui-ci est
le même relevé de clôture rapporté à la cote 1xBet jouée. Les sources se
comparent jambe à jambe à ce même prix : le réalisé face à la fréquence du
marché sans marge, et le résultat d'une mise fixe sur chaque jambe.

| Source | Jambes cotées 1xBet | Cote 1xBet | Marge 1xBet | CLV au prix 1xBet (± ET) | Marché (sans marge) | Réalisé | Écart au marché | À mise fixe au prix 1xBet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LLM | 48 (3 %) | 1.27 | 8.3 % | -7.54 ± 0.5 % | 73.9 % | 75.0 % | 1.1 pt | -9.0 % |
| PRICE_COMPOSER | 135 (94 %) | 2.16 | 7.6 % | -7.77 ± 0.5 % | 48.1 % | 51.1 % | 3.0 pt | 0.1 % |
| ENGINE | 81 (80 %) | 1.67 | 8.4 % | -7.17 ± 0.5 % | 71.9 % | 78.4 % | 6.4 pt | -0.3 % |
