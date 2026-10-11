# Marge payée contre meilleure marge disponible

Régénérable : `pnpm --filter @evcore/backtest-core report:margin-paid`.
Fenêtre : 30 derniers jours, sélections dédupliquées.

La marge payée est la surcote du groupe d'issues complet chez le book qui a
servi la cote de la sélection ; la meilleure marge est la plus basse qu'un
book du relevé offrait sur ce groupe au même instant. L'écart est ce que le
choix du book coûte face au meilleur prix disponible.

| Marché              | Book      | Sélections | Avec marge | Marge payée | Meilleure marge | Écart (± ET) |
| ------------------- | --------- | ---------- | ---------- | ----------- | --------------- | ------------ |
| ONE_X_TWO           | —         | 1207       | 0 (0 %)    | —           | —               | —            |
| OVER_UNDER          | —         | 2399       | 0 (0 %)    | —           | —               | —            |
| BTTS                | —         | 1543       | 0 (0 %)    | —           | —               | —            |
| DOUBLE_CHANCE       | —         | 1442       | 0 (0 %)    | —           | —               | —            |
| HALF_TIME_FULL_TIME | —         | 251        | 0 (0 %)    | —           | —               | —            |
| OVER_UNDER_HT       | —         | 255        | 0 (0 %)    | —           | —               | —            |
| FIRST_HALF_WINNER   | —         | 186        | 0 (0 %)    | —           | —               | —            |
| CORRECT_SCORE       | —         | 1929       | 0 (0 %)    | —           | —               | —            |
| DRAW_NO_BET         | —         | 1529       | 0 (0 %)    | —           | —               | —            |
| TEAM_TOTAL_HOME     | —         | 1337       | 0 (0 %)    | —           | —               | —            |
| TEAM_TOTAL_AWAY     | —         | 1214       | 0 (0 %)    | —           | —               | —            |
| CLEAN_SHEET_HOME    | —         | 1132       | 0 (0 %)    | —           | —               | —            |
| CLEAN_SHEET_AWAY    | —         | 426        | 0 (0 %)    | —           | —               | —            |
| WIN_TO_NIL_HOME     | —         | 1153       | 0 (0 %)    | —           | —               | —            |
| WIN_TO_NIL_AWAY     | —         | 433        | 0 (0 %)    | —           | —               | —            |
| TO_WIN_EITHER_HALF  | —         | 1616       | 0 (0 %)    | —           | —               | —            |
| RESULT_TOTAL_GOALS  | —         | 1496       | 0 (0 %)    | —           | —               | —            |
| RESULT_BTTS         | —         | 2236       | 0 (0 %)    | —           | —               | —            |
| —                   | (inconnu) | 21784      | 0 (0 %)    | —           | —               | —            |
| **total**           | **tous**  | 21784      | 0 (0 %)    | —           | —               | —            |

Aucune sélection ne porte encore sa marge : les colonnes sont écrites par le moteur depuis le 2026-10-11.
