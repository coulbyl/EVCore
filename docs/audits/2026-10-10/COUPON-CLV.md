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

| Source         | Marché              | Jambes | Avec clôture | CLV moyen (± ET) | À la clôture | Écart (± ET)    | Taux de réussite | P(clôture) moyenne | Cote prise | Cote de clôture |
| -------------- | ------------------- | ------ | ------------ | ---------------- | ------------ | --------------- | ---------------- | ------------------ | ---------- | --------------- |
| LLM            | **toutes**          | 1416   | 159 (11 %)   | -4.20 ± 0.1 %    | -4.24 %      | 0.04 ± 0.10 pt  | 51.7 %           | 49.0 %             | 2.06       | 2.04            |
| LLM            | ONE_X_TWO           | 310    | 35 (11 %)    | -3.99 ± 0.1 %    | -3.99 %      | 0.00 ± 0.00 pt  | 54.5 %           | 51.1 %             | 2.00       | 1.96            |
| LLM            | OVER_UNDER          | 223    | 27 (12 %)    | -5.45 ± 0.3 %    | -5.29 %      | -0.16 ± 0.16 pt | 54.3 %           | 50.2 %             | 1.77       | 1.92            |
| LLM            | BTTS                | 212    | 70 (33 %)    | -3.78 ± 0.1 %    | -3.89 %      | 0.12 ± 0.10 pt  | 50.5 %           | 47.4 %             | 2.17       | 2.07            |
| LLM            | DOUBLE_CHANCE       | 95     | 3 (3 %)      | -3.51 ± 2.6 %    | -5.70 %      | 2.18 ± 1.28 pt  | 74.5 %           | 71.6 %             | 2.11       | 1.32            |
| LLM            | HALF_TIME_FULL_TIME | 10     | 0 (0 %)      | —                | —            | —               | 10.0 %           | —                  | 3.27       | —               |
| LLM            | OVER_UNDER_HT       | 114    | 7 (6 %)      | -3.94 ± 0.5 %    | -3.75 %      | -0.18 ± 0.18 pt | 56.1 %           | 55.3 %             | 1.83       | 1.78            |
| LLM            | FIRST_HALF_WINNER   | 46     | 12 (26 %)    | -3.84 ± 0.0 %    | -3.84 %      | 0.00 ± 0.00 pt  | 26.1 %           | 33.6 %             | 2.75       | 2.93            |
| LLM            | DRAW_NO_BET         | 109    | 1 (1 %)      | -7.84 %          | -9.72 %      | 1.88 pt         | 57.5 %           | 62.7 %             | 1.96       | 1.44            |
| LLM            | TEAM_TOTAL_HOME     | 80     | 1 (1 %)      | 0.43 %           | -6.74 %      | 7.17 pt         | 28.7 %           | 71.7 %             | 2.13       | 1.30            |
| LLM            | TEAM_TOTAL_AWAY     | 74     | 3 (4 %)      | -8.56 ± 3.2 %    | -4.43 %      | -4.13 ± 2.78 pt | 58.1 %           | 61.1 %             | 1.94       | 1.57            |
| LLM            | CLEAN_SHEET_HOME    | 14     | 0 (0 %)      | —                | —            | —               | 35.7 %           | —                  | 3.01       | —               |
| LLM            | CLEAN_SHEET_AWAY    | 8      | 0 (0 %)      | —                | —            | —               | 25.0 %           | —                  | 3.51       | —               |
| LLM            | WIN_TO_NIL_HOME     | 4      | 0 (0 %)      | —                | —            | —               | 25.0 %           | —                  | 2.89       | —               |
| LLM            | TO_WIN_EITHER_HALF  | 74     | 0 (0 %)      | —                | —            | —               | 50.0 %           | —                  | 1.87       | —               |
| LLM            | RESULT_TOTAL_GOALS  | 34     | 0 (0 %)      | —                | —            | —               | 41.2 %           | —                  | 2.67       | —               |
| LLM            | RESULT_BTTS         | 9      | 0 (0 %)      | —                | —            | —               | 11.1 %           | —                  | 3.65       | —               |
| PRICE_COMPOSER | **toutes**          | 35     | 35 (100 %)   | -7.06 ± 1.2 %    | -4.67 %      | -2.40 ± 1.24 pt | 45.7 %           | 36.0 %             | 2.82       | 2.94            |
| PRICE_COMPOSER | ONE_X_TWO           | 6      | 6 (100 %)    | -13.53 ± 2.2 %   | -5.16 %      | -8.37 ± 2.58 pt | 33.3 %           | 18.4 %             | 4.91       | 5.43            |
| PRICE_COMPOSER | OVER_UNDER          | 4      | 4 (100 %)    | -1.26 ± 7.3 %    | -4.54 %      | 3.28 ± 7.75 pt  | 0.0 %            | 42.3 %             | 2.35       | 2.31            |
| PRICE_COMPOSER | FIRST_HALF_WINNER   | 25     | 25 (100 %)   | -6.44 ± 1.0 %    | -4.57 %      | -1.87 ± 0.98 pt | 56.0 %           | 39.2 %             | 2.39       | 2.44            |

**1 source sur 2** atteint la couverture
cible de 80 % (acceptation de E-2).
