# CLV par sélection de canal

Régénérable : `pnpm --filter @evcore/backtest-core report:selection-clv`.

Le CLV d'une sélection est sa cote × la probabilité de clôture sans marge
− 1, chez le book qui a servi la cote quand il est connu. Positif, le prix
pris battait ce que le marché a fini par estimer. « Book connu » est la part
des sélections dont la provenance du prix est enregistrée (aucune avant le
2026-10-08) ; « Avec clôture » celle qui a trouvé un groupe d'issues complet
à moins de 90 min du coup d'envoi. Tant que cette part est basse, la
colonne CLV porte sur un échantillon qui n'est pas la population.

| Canal               | Marché              | Sélections | Book connu | Avec clôture | CLV moyen (± ET) | Taux de réussite | P(clôture) moyenne | Cote prise | Cote de clôture |
| ------------------- | ------------------- | ---------- | ---------- | ------------ | ---------------- | ---------------- | ------------------ | ---------- | --------------- |
| VALUE               | **tous**            | 1201       | 0 %        | 190 (16 %)   | -7.05 ± 0.4 %    | 33.2 %           | 38.0 %             | 3.39       | 3.63            |
| VALUE               | ONE_X_TWO           | 68         | 0 %        | 10 (15 %)    | -5.03 ± 0.4 %    | 38.2 %           | 52.8 %             | 2.40       | 1.82            |
| VALUE               | OVER_UNDER          | 129        | 0 %        | 27 (21 %)    | -4.08 ± 1.2 %    | 39.5 %           | 43.0 %             | 2.30       | 2.29            |
| VALUE               | BTTS                | 30         | 0 %        | 3 (10 %)     | -4.70 ± 5.9 %    | 43.3 %           | 44.0 %             | 2.39       | 2.12            |
| VALUE               | DOUBLE_CHANCE       | 95         | 0 %        | 9 (9 %)      | -6.58 ± 1.7 %    | 46.3 %           | 61.5 %             | 2.46       | 1.57            |
| VALUE               | HALF_TIME_FULL_TIME | 19         | 0 %        | 4 (21 %)     | -18.20 ± 2.4 %   | 36.8 %           | 24.7 %             | 3.58       | 3.78            |
| VALUE               | OVER_UNDER_HT       | 9          | 0 %        | 1 (11 %)     | -4.63 %          | 33.3 %           | 51.8 %             | 2.51       | 1.84            |
| VALUE               | DRAW_NO_BET         | 85         | 0 %        | 13 (15 %)    | -7.49 ± 1.3 %    | 36.4 %           | 48.1 %             | 2.54       | 2.00            |
| VALUE               | TEAM_TOTAL_HOME     | 277        | 0 %        | 40 (14 %)    | -4.62 ± 0.8 %    | 40.1 %           | 46.5 %             | 2.48       | 2.21            |
| VALUE               | TEAM_TOTAL_AWAY     | 99         | 0 %        | 16 (16 %)    | -3.69 ± 1.0 %    | 39.4 %           | 55.7 %             | 2.51       | 1.78            |
| VALUE               | CLEAN_SHEET_HOME    | 56         | 0 %        | 4 (7 %)      | -7.56 ± 0.8 %    | 32.1 %           | 37.8 %             | 2.96       | 2.58            |
| VALUE               | CLEAN_SHEET_AWAY    | 9          | 0 %        | 1 (11 %)     | -5.19 %          | 11.1 %           | 14.6 %             | 3.81       | 6.50            |
| VALUE               | WIN_TO_NIL_HOME     | 23         | 0 %        | 1 (4 %)      | -5.89 %          | 26.1 %           | 21.4 %             | 2.98       | 4.30            |
| VALUE               | WIN_TO_NIL_AWAY     | 1          | 0 %        | 0 (0 %)      | —                | 0.0 %            | —                  | 5.45       | —               |
| VALUE               | TO_WIN_EITHER_HALF  | 20         | 0 %        | 0 (0 %)      | —                | 25.0 %           | —                  | 2.85       | —               |
| VALUE               | RESULT_TOTAL_GOALS  | 34         | 0 %        | 0 (0 %)      | —                | 20.6 %           | —                  | 3.23       | —               |
| VALUE               | RESULT_BTTS         | 247        | 0 %        | 61 (25 %)    | -10.58 ± 0.8 %   | 15.4 %           | 18.5 %             | 6.54       | 6.70            |
| SAFE                | **tous**            | 821        | 0 %        | 158 (19 %)   | -4.76 ± 0.3 %    | 68.6 %           | 67.1 %             | 1.43       | 1.44            |
| SAFE                | ONE_X_TWO           | 51         | 0 %        | 4 (8 %)      | -1.89 ± 0.7 %    | 56.9 %           | 67.0 %             | 1.56       | 1.42            |
| SAFE                | OVER_UNDER          | 311        | 0 %        | 30 (10 %)    | -4.37 ± 0.5 %    | 68.5 %           | 64.1 %             | 1.41       | 1.52            |
| SAFE                | BTTS                | 13         | 0 %        | 3 (23 %)     | -2.98 ± 4.0 %    | 61.5 %           | 63.0 %             | 1.62       | 1.52            |
| SAFE                | DOUBLE_CHANCE       | 147        | 0 %        | 46 (31 %)    | -5.36 ± 0.4 %    | 70.7 %           | 69.1 %             | 1.36       | 1.39            |
| SAFE                | OVER_UNDER_HT       | 63         | 0 %        | 1 (2 %)      | -4.91 %          | 68.3 %           | 64.3 %             | 1.48       | 1.48            |
| SAFE                | DRAW_NO_BET         | 47         | 0 %        | 12 (26 %)    | -5.32 ± 0.9 %    | 74.3 %           | 70.4 %             | 1.38       | 1.35            |
| SAFE                | TEAM_TOTAL_HOME     | 49         | 0 %        | 19 (39 %)    | -3.60 ± 1.0 %    | 71.4 %           | 71.5 %             | 1.41       | 1.34            |
| SAFE                | TEAM_TOTAL_AWAY     | 131        | 0 %        | 43 (33 %)    | -5.14 ± 0.6 %    | 70.2 %           | 64.7 %             | 1.46       | 1.50            |
| SAFE                | CLEAN_SHEET_HOME    | 1          | 0 %        | 0 (0 %)      | —                | 0.0 %            | —                  | 1.91       | —               |
| SAFE                | TO_WIN_EITHER_HALF  | 8          | 0 %        | 0 (0 %)      | —                | 62.5 %           | —                  | 1.36       | —               |
| DOMINANT            | **tous**            | 877        | 0 %        | 140 (16 %)   | -4.21 ± 0.2 %    | 52.6 %           | 55.5 %             | 2.06       | 1.94            |
| DOMINANT            | ONE_X_TWO           | 877        | 0 %        | 140 (16 %)   | -4.21 ± 0.2 %    | 52.6 %           | 55.5 %             | 2.06       | 1.94            |
| BTTS                | **tous**            | 1707       | 0 %        | 476 (28 %)   | -7.02 ± 0.1 %    | 56.1 %           | 56.6 %             | 1.69       | 1.68            |
| BTTS                | BTTS                | 1707       | 0 %        | 476 (28 %)   | -7.02 ± 0.1 %    | 56.1 %           | 56.6 %             | 1.69       | 1.68            |
| DRAW                | **tous**            | 1723       | 0 %        | 380 (22 %)   | -5.39 ± 0.2 %    | 28.3 %           | 27.8 %             | 3.39       | 3.46            |
| DRAW                | ONE_X_TWO           | 1723       | 0 %        | 380 (22 %)   | -5.39 ± 0.2 %    | 28.3 %           | 27.8 %             | 3.39       | 3.46            |
| GOALS               | **tous**            | 5040       | 0 %        | 1086 (22 %)  | -4.27 ± 0.1 %    | 59.9 %           | 62.2 %             | 1.70       | 1.62            |
| GOALS               | OVER_UNDER          | 5040       | 0 %        | 1086 (22 %)  | -4.27 ± 0.1 %    | 59.9 %           | 62.2 %             | 1.70       | 1.62            |
| FIRST_HALF          | **tous**            | 327        | 0 %        | 94 (29 %)    | -3.75 ± 0.1 %    | 44.6 %           | 41.8 %             | 2.34       | 2.38            |
| FIRST_HALF          | FIRST_HALF_WINNER   | 327        | 0 %        | 94 (29 %)    | -3.75 ± 0.1 %    | 44.6 %           | 41.8 %             | 2.34       | 2.38            |
| DOUBLE_CHANCE       | **tous**            | 1957       | 0 %        | 685 (35 %)   | -5.63 ± 0.1 %    | 76.3 %           | 76.0 %             | 1.28       | 1.27            |
| DOUBLE_CHANCE       | DOUBLE_CHANCE       | 1957       | 0 %        | 685 (35 %)   | -5.63 ± 0.1 %    | 76.3 %           | 76.0 %             | 1.28       | 1.27            |
| CONSENSUS           | **tous**            | 51         | 0 %        | 0 (0 %)      | —                | 37.3 %           | —                  | 2.06       | —               |
| CONSENSUS           | ONE_X_TWO           | 51         | 0 %        | 0 (0 %)      | —                | 37.3 %           | —                  | 2.06       | —               |
| CORRECT_SCORE       | **tous**            | 4945       | 0 %        | 0 (0 %)      | —                | 10.8 %           | —                  | 8.50       | —               |
| CORRECT_SCORE       | CORRECT_SCORE       | 4945       | 0 %        | 0 (0 %)      | —                | 10.8 %           | —                  | 8.50       | —               |
| CLEAN_SHEET         | **tous**            | 3838       | 0 %        | 834 (22 %)   | -6.55 ± 0.1 %    | 32.5 %           | 32.8 %             | 3.17       | 3.16            |
| CLEAN_SHEET         | CLEAN_SHEET_HOME    | 2708       | 0 %        | 605 (22 %)   | -6.58 ± 0.1 %    | 34.3 %           | 34.2 %             | 2.98       | 3.01            |
| CLEAN_SHEET         | CLEAN_SHEET_AWAY    | 1130       | 0 %        | 229 (20 %)   | -6.48 ± 0.2 %    | 28.1 %           | 29.0 %             | 3.63       | 3.57            |
| TEAM_TOTAL          | **tous**            | 5135       | 0 %        | 1279 (25 %)  | -4.56 ± 0.1 %    | 61.1 %           | 63.6 %             | 1.69       | 1.60            |
| TEAM_TOTAL          | TEAM_TOTAL_HOME     | 2778       | 0 %        | 659 (24 %)   | -4.51 ± 0.1 %    | 59.1 %           | 62.8 %             | 1.76       | 1.63            |
| TEAM_TOTAL          | TEAM_TOTAL_AWAY     | 2357       | 0 %        | 620 (26 %)   | -4.61 ± 0.1 %    | 63.5 %           | 64.4 %             | 1.59       | 1.56            |
| WIN_EITHER_HALF     | **tous**            | 3423       | 0 %        | 0 (0 %)      | —                | 61.6 %           | —                  | 1.63       | —               |
| WIN_EITHER_HALF     | TO_WIN_EITHER_HALF  | 3423       | 0 %        | 0 (0 %)      | —                | 61.6 %           | —                  | 1.63       | —               |
| RESULT_TOTAL_GOALS  | **tous**            | 2207       | 0 %        | 797 (36 %)   | -12.87 ± 0.2 %   | 20.4 %           | 19.1 %             | 5.60       | 6.17            |
| RESULT_TOTAL_GOALS  | RESULT_TOTAL_GOALS  | 2207       | 0 %        | 797 (36 %)   | -12.87 ± 0.2 %   | 20.4 %           | 19.1 %             | 5.60       | 6.17            |
| OVER_UNDER_HT       | **tous**            | 417        | 0 %        | 119 (29 %)   | -4.88 ± 0.1 %    | 66.7 %           | 66.0 %             | 1.46       | 1.46            |
| OVER_UNDER_HT       | OVER_UNDER_HT       | 417        | 0 %        | 119 (29 %)   | -4.88 ± 0.1 %    | 66.7 %           | 66.0 %             | 1.46       | 1.46            |
| RESULT_BTTS         | **tous**            | 3260       | 0 %        | 1191 (37 %)  | -11.63 ± 0.2 %   | 15.7 %           | 17.2 %             | 7.79       | 7.18            |
| RESULT_BTTS         | RESULT_BTTS         | 3260       | 0 %        | 1191 (37 %)  | -11.63 ± 0.2 %   | 15.7 %           | 17.2 %             | 7.79       | 7.18            |
| DRAW_NO_BET         | **tous**            | 2292       | 0 %        | 783 (34 %)   | -6.60 ± 0.1 %    | 66.5 %           | 64.2 %             | 1.62       | 1.63            |
| DRAW_NO_BET         | DRAW_NO_BET         | 2292       | 0 %        | 783 (34 %)   | -6.60 ± 0.1 %    | 66.5 %           | 64.2 %             | 1.62       | 1.63            |
| WIN_TO_NIL          | **tous**            | 2532       | 0 %        | 848 (33 %)   | -8.07 ± 0.1 %    | 24.6 %           | 26.8 %             | 3.91       | 3.87            |
| WIN_TO_NIL          | WIN_TO_NIL_HOME     | 1820       | 0 %        | 613 (34 %)   | -8.18 ± 0.1 %    | 25.7 %           | 27.9 %             | 3.70       | 3.66            |
| WIN_TO_NIL          | WIN_TO_NIL_AWAY     | 712        | 0 %        | 235 (33 %)   | -7.79 ± 0.2 %    | 21.9 %           | 23.7 %             | 4.47       | 4.40            |
| HALF_TIME_FULL_TIME | **tous**            | 416        | 0 %        | 121 (29 %)   | -16.37 ± 0.1 %   | 28.1 %           | 26.7 %             | 3.81       | 3.57            |
| HALF_TIME_FULL_TIME | HALF_TIME_FULL_TIME | 416        | 0 %        | 121 (29 %)   | -16.37 ± 0.1 %   | 28.1 %           | 26.7 %             | 3.81       | 3.57            |
| VANTAGE             | **tous**            | 2923       | 0 %        | 1016 (35 %)  | -5.77 ± 0.1 %    | 50.6 %           | 52.4 %             | 2.27       | 2.02            |
| VANTAGE             | ONE_X_TWO           | 545        | 0 %        | 155 (28 %)   | -4.03 ± 0.4 %    | 39.1 %           | 42.7 %             | 2.86       | 2.61            |
| VANTAGE             | OVER_UNDER          | 512        | 0 %        | 201 (39 %)   | -4.30 ± 0.3 %    | 52.1 %           | 55.5 %             | 1.81       | 1.81            |
| VANTAGE             | BTTS                | 911        | 0 %        | 412 (45 %)   | -6.79 ± 0.1 %    | 57.1 %           | 54.8 %             | 1.72       | 1.74            |
| VANTAGE             | DOUBLE_CHANCE       | 133        | 0 %        | 45 (34 %)    | -5.87 ± 0.3 %    | 67.7 %           | 71.7 %             | 1.33       | 1.32            |
| VANTAGE             | HALF_TIME_FULL_TIME | 7          | 0 %        | 2 (29 %)     | -19.50 ± 2.3 %   | 28.6 %           | 26.4 %             | 4.05       | 4.28            |
| VANTAGE             | OVER_UNDER_HT       | 23         | 0 %        | 8 (35 %)     | -6.49 ± 0.5 %    | 56.5 %           | 66.4 %             | 1.44       | 1.45            |
| VANTAGE             | FIRST_HALF_WINNER   | 18         | 0 %        | 6 (33 %)     | -3.48 ± 1.0 %    | 27.8 %           | 37.5 %             | 2.41       | 2.60            |
| VANTAGE             | CORRECT_SCORE       | 85         | 0 %        | 0 (0 %)      | —                | 12.9 %           | —                  | 8.48       | —               |
| VANTAGE             | DRAW_NO_BET         | 105        | 0 %        | 34 (32 %)    | -5.44 ± 0.7 %    | 80.3 %           | 59.0 %             | 1.62       | 1.68            |
| VANTAGE             | TEAM_TOTAL_HOME     | 70         | 0 %        | 27 (39 %)    | -5.29 ± 1.0 %    | 52.9 %           | 52.2 %             | 1.99       | 1.97            |
| VANTAGE             | TEAM_TOTAL_AWAY     | 102        | 0 %        | 49 (48 %)    | -4.84 ± 0.4 %    | 62.7 %           | 63.1 %             | 1.58       | 1.55            |
| VANTAGE             | CLEAN_SHEET_HOME    | 64         | 0 %        | 28 (44 %)    | -7.18 ± 0.7 %    | 39.1 %           | 38.3 %             | 2.57       | 2.55            |
| VANTAGE             | CLEAN_SHEET_AWAY    | 44         | 0 %        | 20 (45 %)    | -6.68 ± 1.2 %    | 25.0 %           | 29.3 %             | 3.56       | 3.40            |
| VANTAGE             | WIN_TO_NIL_HOME     | 27         | 0 %        | 8 (30 %)     | -8.47 ± 1.2 %    | 51.9 %           | 33.2 %             | 3.38       | 2.93            |
| VANTAGE             | WIN_TO_NIL_AWAY     | 25         | 0 %        | 7 (28 %)     | -8.18 ± 1.3 %    | 20.0 %           | 21.5 %             | 4.27       | 5.07            |
| VANTAGE             | TO_WIN_EITHER_HALF  | 216        | 0 %        | 0 (0 %)      | —                | 55.1 %           | —                  | 1.62       | —               |
| VANTAGE             | RESULT_TOTAL_GOALS  | 19         | 0 %        | 3 (16 %)     | -13.33 ± 1.0 %   | 15.8 %           | 7.8 %              | 6.52       | 11.67           |
| VANTAGE             | RESULT_BTTS         | 17         | 0 %        | 11 (65 %)    | -12.18 ± 1.5 %   | 29.4 %           | 22.1 %             | 5.79       | 4.33            |

**0 canal sur 20** atteint la couverture
cible de 80 % (acceptation de E-2).
