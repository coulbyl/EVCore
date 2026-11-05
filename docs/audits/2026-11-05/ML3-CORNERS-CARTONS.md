# ML-3 — corners et cartons sur un modèle de comptage

Rejeu du 2026-11-05 sur la base locale (copie de prod jusqu'au 03/11). C'est le sous-modèle B de [ML-V2-PROPOSITION.md](../2026-10-29/ML-V2-PROPOSITION.md), mesuré avec la méthode de [ML2B-MI-TEMPS.md](ML2B-MI-TEMPS.md). Script : `pnpm --filter @evcore/backtest-core backtest:corners-cards`. Sortie complète : [ml3-corners-cartons.txt](ml3-corners-cartons.txt). Verdict : **neutre**, selon la règle fixée d'avance. Le module existe dans `analysis-core`, mais rien en prod ne le lit.

## 1. Ce qui était mesurable (vérifié avant le rejeu)

| Prix                        | Période       | Matchs réglables | Clôture ≤ 2 h |
| --------------------------- | ------------- | ---------------- | ------------- |
| Pinnacle CORNERS (7,5–11,5) | 16/09 – 03/11 | 2 321            | 2 196         |
| Pinnacle CARDS (2,5–5,5)    | 16/09 – 03/11 | 753              | 683           |
| 1xBet CORNERS (5,5–14,5)    | 27/10 – 03/11 | 511 (8 jours)    | —             |
| 1xBet CARDS                 | 03/11         | 8                | —             |

- **Corners.** Pinnacle et sa clôture sont mesurables. Contre 1xBet, en revanche, on n'a que 8 jours.
- **Cartons.** On ne peut pas les juger contre 1xBet. Ils sont donc mesurés, mais restaient neutres d'avance.
- **Le chasseur compose à 17 h la veille.** À cette heure-là, Pinnacle ne cote les corners que sur 44 % des matchs (1 017 sur 2 321), contre 92 % à T − 1 h.

## 2. Méthode (figée dans l'en-tête du script, commit 79dd2dda)

- **Modèle M.** Le total d'un match suit une binomiale négative NB(μ, r).
  - **μ** est ajusté sur l'échelle Pinnacle à l'instant : Shin par paire, puis moindres carrés sur P(plus). L'échelle est refusée si l'écart quadratique moyen dépasse 0,02. Code : `fitCountMean` et `selectCountLadder`, dans `count-market/`.
  - **r** est lu sur la forme des prix, jamais sur les résultats. Il est estimé sur les matchs jusqu'au 15/10 : **r = 50** pour les corners comme pour les cartons. Pour les corners, le Poisson donne un écart total 3 fois plus grand.
  - **Contrôle sur les résultats.** Pour les corners, la variance réalisée vaut 1,003 × celle de NB(50), contre 1,204 × celle d'un Poisson : la binomiale négative est la bonne loi. Pour les cartons, le rapport est de 0,81 : ils sont moins dispersés.
- **Repli S.** Moyennes pour/contre des 20 derniers matchs de chaque équipe, rétrécies vers le championnat.
- **Bases de comparaison.**
  - **B**, le chasseur actuel : la paire Pinnacle de la même ligne, marge retirée de façon proportionnelle, sinon la paire 1xBet.
  - **B2**, la feuille de match : la paire 1xBet par Shin, sinon Pinnacle.
- **Juge.** La clôture Pinnacle à 2 h ou moins. Les IC sont tirés par bootstrap en blocs de jours.

## 3. Résultats

| Critère                                                 | Veille 17 h (chasseur, contre B)  | T − 1 h (feuille, contre B2)      |
| ------------------------------------------------------- | --------------------------------- | --------------------------------- |
| H1 réalisé ÷ annoncé, côté plus                         | 0,993 [0,949 ; 1,051] ✗           | 1,002 [0,973 ; 1,035]             |
| H1 réalisé ÷ annoncé, côté moins                        | 1,007 [0,950 ; 1,050] ✗           | 0,998 [0,965 ; 1,026] ✗           |
| H2a écart² à la clôture, lignes Pinnacle                | +0,00001 [0,00000 ; 0,00001] ✗    | −0,00001 [−0,00005 ; +0,00002] ✓  |
| H2b écart², lignes 1xBet que Pinnacle ne cote pas       | 14 matchs (< 100) ✗               | −0,00031, 20 matchs (< 100) ✗     |
| H3 log-perte, mêmes lignes, issue réelle                | −0,0056 [−0,0092 ; +0,0021] ✓     | **−0,0028 [−0,0048 ; −0,0007]** ✓ |
| H4 côtés du chasseur (1,70–2,10), 601 côtés sur 5 jours | 0,995 [0,948 ; 1,010] ✓ (B 0,995) | —                                 |
| H5 repli S contre 1xBet, matchs sans Pinnacle           | +0,0103 [+0,0051 ; +0,0230] ✗     | —                                 |

- **H1 échoue faute de puissance, pas de calibration.** La base fait exactement pareil (0,995 et 1,005 la veille, 1,003 et 0,997 à T − 1 h). Le marché des corners est calibré, et M le recopie.
- **Le chasseur rejoué ne change aucune jambe** sur 5 jours. La bande 1,70–2,10 tombe sur les lignes que Pinnacle cote déjà.
- **Les cartons** sont calibrés à T − 1 h (0,983 et 1,018). Mais M s'écarte un peu plus de la clôture que la paire Pinnacle elle-même : H2a vaut +0,00007 [+0,00005 ; +0,00008]. Avec 4 lignes par match, le lissage coûte plus qu'il ne rapporte.
- **Extrapolation (description).** On retire la ligne extrême de l'échelle Pinnacle et on la prédit avec les autres. L'écart² à la clôture vaut alors 0,00019, contre 0,00013 pour le prix direct. L'extrapolation est donc proche du prix, sans le valoir.

## 4. Ce que ça veut dire

- **Là où Pinnacle cote, M recopie Pinnacle.** Il ne change ni la calibration ni le choix du chasseur, et il n'apporte aucun avantage.
- **Le seul usage du modèle** est de chiffrer les lignes que 1xBet ajoute (5,5–7,5 et 12,5–14,5). Sur ces lignes, M fait mieux que la paire 1xBet elle-même à T − 1 h : −0,0028 de log-perte. C'est attendu, car Shin ne corrige pas le biais des extrêmes d'une paire chère. Mais ce n'est mesuré que sur 8 jours, et le critère jugé contre la clôture (H2b) ne porte que sur 20 matchs. La règle demandait 100 matchs : **non expédié**.
- **Le repli par les stats d'équipe est pire que le prix 1xBet.** Il n'est pas expédié, ce qui confirme une fois de plus que le moteur est derrière le marché.
- **Rien ne change en prod.** Le chasseur et la feuille gardent la fréquence du marché.

## 5. Suite

- **Vers le 10/12**, relancer le même script, qui contiendra 6 semaines de 1xBet. Si H2b atteint 100 matchs et que H1 a la puissance suffisante, brancher M sur la feuille, pour les lignes 1xBet hors Pinnacle seulement. Le chasseur n'a rien à y gagner tant que sa bande reste 1,70–2,10.
- **Cartons** : pas de chasseur. 1xBet ne les cote presque pas (8 matchs).
- **Limites.**
  - Le juge corners repose sur 7 semaines de clôture Pinnacle.
  - r est global et non par championnat.
  - Les cartons ne sont réglés que si les deux décomptes du rouge s'accordent.
