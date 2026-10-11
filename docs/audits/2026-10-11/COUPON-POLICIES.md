# Politiques de coupon, par jambe

Régénérable : `pnpm --filter @evcore/backtest-core report:coupon-policies`.

Une jambe = une sélection de canal misée au meilleur prix du moment. Le ROI
par jambe a une erreur type de l'ordre de 1,2 / √n ; un ROI de coupon n'a
aucune puissance à nos volumes et n'apparaît pas ici. « CLV misé » est la cote
misée × la probabilité de clôture sans marge − 1 ; « À la clôture » la même
valeur pour un pari pris au prix de clôture, c'est-à-dire la marge payée : la
barre est la marge, jamais zéro. Les ombres ne sont jamais publiées ; la
relance de 21:15 est dédoublonnée (première tentative par jour et politique).

| Politique                 | Jambes | Réglées | Réussite | Annoncé | Cote misée | 1 / cote | ROI / jambe (± ET) | Avec clôture | CLV misé | À la clôture | Période                 |
| ------------------------- | ------ | ------- | -------- | ------- | ---------- | -------- | ------------------ | ------------ | -------- | ------------ | ----------------------- |
| deterministic-5-7-v1      | 52     | 46      | 43.5 %   | 58.6 %  | 2.14       | 53.9 %   | -20.0 ± 16.0 %     | 41           | -3.60 %  | -6.55 %      | 2026-09-16 → 2026-10-11 |
| published:legacy          | 1400   | 1370    | 51.6 %   | 65.7 %  | 2.06       | 53.1 %   | -1.9 ± 2.8 %       | 0            | —        | —            | 2023-04-15 → 2026-09-11 |
| published:unified-5-15-v1 | 18     | 16      | 56.3 %   | 72.1 %  | 1.49       | 67.9 %   | -19.8 ± 18.3 %     | 13           | -5.66 %  | -5.76 %      | 2026-09-18 → 2026-10-09 |
| unified-5-15-v2-shadow    | 8      | 8       | 75.0 %   | 65.5 %  | 1.51       | 67.2 %   | 18.5 ± 26.3 %      | 7            | -5.75 %  | -5.56 %      | 2026-10-07 → 2026-10-08 |
