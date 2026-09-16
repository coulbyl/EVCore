# Rapport par championnat — league-report-v1

Régénérable : `pnpm --filter @evcore/backtest-core report:league`.
Requêtes : `packages/backtest-core/scripts/league-report/*.sql`.

## Périmètre

- 68 championnats, 62457 matchs terminés.
- 33197 paris uniques du moteur, analysés avant le coup d'envoi et réglés.
- 296159 issues cotées sur les marchés à consensus (1X2, over/under, BTTS,
  mi-temps).
- 427739 issues cotées sur les marchés exotiques.
- Coupure de réplication : 2026-08-25 — période A avant, période B après.

Deux exclusions structurent tout le rapport :

1. Les rétro-analyses du 2026-06-30 sur des matchs déjà joués sont écartées :
   elles ont été produites après les résultats.
2. **Une rencontre est ré-analysée 5 à 7 fois avant son coup d'envoi**, et
   chaque analyse réécrit une ligne de `ChannelSelection`. Seule la dernière
   analyse avant le coup d'envoi est retenue. Sans cette déduplication le même
   pari compte six fois, les erreurs types sont divisées par ~2,4 et des blocs
   entièrement corrélés passent pour un échantillon.

## 1. Couverture

| Code  | Pays           | Saisons | Matchs | Mi-temps | Sélections live |
| ----- | -------------- | ------- | ------ | -------- | --------------- |
| ARG2  | Argentina      | 4       | 2564   | 100 %    | 1465            |
| CH    | England        | 4       | 1752   | 100 %    | 998             |
| EL2   | England        | 4       | 1743   | 100 %    | 668             |
| EL1   | England        | 4       | 1742   | 100 %    | 831             |
| ARG1  | Argentina      | 4       | 1650   | 100 %    | 1064            |
| PL    | England        | 5       | 1559   | 100 %    | 485             |
| USA2  | USA            | 4       | 1505   | 100 %    | 921             |
| UECL  | Europe         | 4       | 1493   | 100 %    | 1420            |
| SP2   | Spain          | 4       | 1457   | 100 %    | 505             |
| BRA2  | Brazil         | 4       | 1411   | 100 %    | 877             |
| J1    | Japan          | 5       | 1336   | 100 %    | 716             |
| MLS   | USA            | 3       | 1280   | 100 %    | 1153            |
| BRA1  | Brazil         | 4       | 1246   | 100 %    | 571             |
| I2    | Italy          | 4       | 1210   | 100 %    | 417             |
| D3    | Germany        | 4       | 1190   | 100 %    | 418             |
| LL    | Spain          | 4       | 1190   | 100 %    | 629             |
| SA    | Italy          | 4       | 1176   | 100 %    | 517             |
| TUR2  | Turkey         | 4       | 1149   | 100 %    | 632             |
| MX1   | Mexico         | 4       | 1075   | 100 %    | 444             |
| TUR1  | Turkey         | 4       | 1072   | 100 %    | 477             |
| F2    | France         | 4       | 1052   | 100 %    | 485             |
| ERD   | Netherlands    | 4       | 1008   | 100 %    | 465             |
| BEL1  | Belgium        | 4       | 1005   | 100 %    | 526             |
| POL2  | Poland         | 4       | 993    | 100 %    | 584             |
| KSA1  | Saudi-Arabia   | 4       | 981    | 100 %    | 622             |
| POL1  | Poland         | 4       | 981    | 100 %    | 473             |
| POR   | Portugal       | 4       | 974    | 100 %    | 446             |
| D2    | Germany        | 4       | 969    | 100 %    | 422             |
| L1    | France         | 4       | 961    | 100 %    | 438             |
| KOR2  | South-Korea    | 4       | 955    | 100 %    | 636             |
| BL1   | Germany        | 4       | 951    | 100 %    | 434             |
| SRB1  | Serbia         | 4       | 943    | 100 %    | 465             |
| CHN2  | China          | 4       | 900    | 100 %    | 640             |
| CHI1  | Chile          | 4       | 899    | 100 %    | 522             |
| UCL   | Europe         | 4       | 882    | 100 %    | 796             |
| CZE1  | Czech Republic | 4       | 879    | 100 %    | 510             |
| SWE2  | Sweden         | 4       | 862    | 100 %    | 642             |
| NOR2  | Norway         | 4       | 860    | 100 %    | 713             |
| SWE1  | Sweden         | 4       | 851    | 100 %    | 607             |
| NOR1  | Norway         | 4       | 836    | 100 %    | 458             |
| CSL   | China          | 4       | 823    | 100 %    | 547             |
| RUS1  | Russia         | 4       | 795    | 100 %    | 514             |
| UEL   | Europe         | 4       | 794    | 100 %    | 499             |
| KOR1  | South-Korea    | 4       | 779    | 100 %    | 522             |
| GRE1  | Greece         | 4       | 740    | 100 %    | 288             |
| SCO1  | Scotland       | 4       | 735    | 100 %    | 360             |
| SUI1  | Switzerland    | 4       | 733    | 100 %    | 396             |
| IRL1  | Ireland        | 4       | 692    | 100 %    | 203             |
| CHI2  | Chile          | 4       | 640    | 99 %     | 266             |
| DEN1  | Denmark        | 4       | 625    | 100 %    | 389             |
| AUT1  | Austria        | 4       | 621    | 100 %    | 283             |
| LAT1  | Latvia         | 4       | 621    | 100 %    | 353             |
| EST1  | Estonia        | 4       | 619    | 100 %    | 383             |
| FIN1  | Finland        | 4       | 614    | 100 %    | 495             |
| ISL1  | Iceland        | 4       | 578    | 100 %    | 504             |
| SUI2  | Switzerland    | 4       | 573    | 100 %    | 257             |
| SVN1  | Slovenia       | 4       | 560    | 100 %    | 331             |
| AUS1  | Australia      | 3       | 508    | 100 %    | 0               |
| WCQE  | World          | 2       | 462    | 100 %    | 0               |
| WCQAS | World          | 2       | 456    | 100 %    | 0               |
| WCQAF | World          | 2       | 421    | 99 %     | 0               |
| FIN2  | Finland        | 3       | 389    | 100 %    | 431             |
| FRI   | World          | 1       | 355    | 97 %     | 0               |
| WCQCA | World          | 2       | 218    | 100 %    | 0               |
| UNL   | World          | 1       | 188    | 99 %     | 0               |
| WCQSA | World          | 2       | 179    | 100 %    | 0               |
| WC    | World          | 2       | 168    | 100 %    | 84              |
| WCQOC | World          | 2       | 29     | 100 %    | 0               |

## 2. Signature de championnat (taux de base)

Issues où le championnat s'écarte du taux global, avec un écart stable d'une
saison à l'autre (chi-deux d'homogénéité p >= 0,05) et un intervalle de Wilson
qui exclut le taux global. Ces taux ne dépendent d'aucun modèle et reposent
sur toutes les saisons en base : ce sont les mesures les plus solides du
rapport.

| Ligue | Issue                    | Taux ligue | Taux global | Écart     | Écart max saison | n    |
| ----- | ------------------------ | ---------- | ----------- | --------- | ---------------- | ---- |
| ARG1  | OVER_2_5                 | 32.7 %     | 51.2 %      | -18.5 pts | 5.8 %            | 1650 |
| ARG1  | UNDER_2_5                | 67.3 %     | 48.8 %      | +18.5 pts | 5.8 %            | 1650 |
| ISL1  | OVER_3_5                 | 47.4 %     | 29.2 %      | +18.2 pts | 14.7 %           | 578  |
| ISL1  | UNDER_3_5                | 52.6 %     | 70.8 %      | -18.2 pts | 14.7 %           | 578  |
| ARG2  | TEAM_TOTAL_AWAY_OVER_1_5 | 16.9 %     | 33.4 %      | -16.5 pts | 4.2 %            | 2564 |
| ARG1  | OVER_3_5                 | 14.5 %     | 29.2 %      | -14.7 pts | 3.7 %            | 1650 |
| ARG1  | UNDER_3_5                | 85.5 %     | 70.8 %      | +14.7 pts | 3.7 %            | 1650 |
| ISL1  | TEAM_TOTAL_HOME_OVER_1_5 | 58.3 %     | 43.7 %      | +14.6 pts | 3.0 %            | 578  |
| BL1   | OVER_3_5                 | 42.7 %     | 29.2 %      | +13.5 pts | 1.9 %            | 951  |
| BL1   | UNDER_3_5                | 57.3 %     | 70.8 %      | -13.5 pts | 1.9 %            | 951  |
| ARG1  | OVER_1_5                 | 61.2 %     | 74.7 %      | -13.5 pts | 3.7 %            | 1650 |
| ISL1  | UNDER_2_5                | 35.6 %     | 48.8 %      | -13.2 pts | 6.9 %            | 578  |
| ISL1  | OVER_2_5                 | 64.4 %     | 51.2 %      | +13.2 pts | 6.9 %            | 578  |
| ISL1  | HT_UNDER_1_5             | 52.8 %     | 65.9 %      | -13.1 pts | 11.1 %           | 578  |
| ISL1  | HT_OVER_1_5              | 47.2 %     | 34.1 %      | +13.1 pts | 11.1 %           | 578  |
| ARG1  | TEAM_TOTAL_AWAY_OVER_1_5 | 20.7 %     | 33.4 %      | -12.7 pts | 5.0 %            | 1650 |
| BRA2  | UNDER_3_5                | 83.3 %     | 70.8 %      | +12.5 pts | 4.2 %            | 1411 |
| BRA2  | OVER_3_5                 | 16.7 %     | 29.2 %      | -12.5 pts | 4.2 %            | 1411 |
| BRA2  | OVER_2_5                 | 38.8 %     | 51.2 %      | -12.3 pts | 6.2 %            | 1411 |
| BRA2  | UNDER_2_5                | 61.2 %     | 48.8 %      | +12.3 pts | 6.2 %            | 1411 |
| ISL1  | BTTS_YES                 | 64.7 %     | 52.6 %      | +12.1 pts | 7.2 %            | 578  |
| ISL1  | BTTS_NO                  | 35.3 %     | 47.4 %      | -12.1 pts | 7.2 %            | 578  |
| ARG1  | HT_OVER_1_5              | 22.2 %     | 34.1 %      | -11.9 pts | 3.9 %            | 1650 |
| ARG1  | HT_UNDER_1_5             | 77.8 %     | 65.9 %      | +11.9 pts | 3.9 %            | 1650 |
| ARG1  | BTTS_NO                  | 59.3 %     | 47.4 %      | +11.9 pts | 7.5 %            | 1650 |
| ARG1  | BTTS_YES                 | 40.7 %     | 52.6 %      | -11.9 pts | 7.5 %            | 1650 |
| BL1   | UNDER_2_5                | 37.3 %     | 48.8 %      | -11.5 pts | 3.6 %            | 951  |
| BL1   | OVER_2_5                 | 62.7 %     | 51.2 %      | +11.5 pts | 3.6 %            | 951  |
| AUS1  | TEAM_TOTAL_AWAY_OVER_1_5 | 44.9 %     | 33.4 %      | +11.5 pts | 10.7 %           | 508  |
| ISL1  | OVER_1_5                 | 86.2 %     | 74.7 %      | +11.5 pts | 3.3 %            | 578  |
| ARG1  | CLEAN_SHEET_HOME         | 43.2 %     | 31.7 %      | +11.5 pts | 6.2 %            | 1650 |
| ARG1  | TEAM_TOTAL_AWAY_OVER_0_5 | 56.8 %     | 68.3 %      | -11.5 pts | 6.2 %            | 1650 |
| ARG2  | WIN_EITHER_HALF_AWAY     | 33.5 %     | 44.8 %      | -11.3 pts | 1.9 %            | 2564 |
| ARG1  | TEAM_TOTAL_HOME_OVER_1_5 | 32.7 %     | 43.7 %      | -11.0 pts | 5.4 %            | 1650 |
| BRA2  | TEAM_TOTAL_AWAY_OVER_1_5 | 22.7 %     | 33.4 %      | -10.7 pts | 4.8 %            | 1411 |
| ARG2  | HT_DRAW                  | 52.0 %     | 41.4 %      | +10.6 pts | 2.9 %            | 2564 |
| ISL1  | TEAM_TOTAL_AWAY_OVER_1_5 | 43.9 %     | 33.4 %      | +10.5 pts | 9.4 %            | 578  |
| BL1   | HT_UNDER_1_5             | 55.5 %     | 65.9 %      | -10.4 pts | 2.9 %            | 951  |
| BL1   | HT_OVER_1_5              | 44.5 %     | 34.1 %      | +10.4 pts | 2.9 %            | 951  |
| ERD   | OVER_1_5                 | 84.7 %     | 74.7 %      | +10.0 pts | 5.9 %            | 1008 |
| BRA2  | OVER_1_5                 | 64.8 %     | 74.7 %      | -9.9 pts  | 5.8 %            | 1411 |
| ARG1  | HT_OVER_0_5              | 60.3 %     | 70.0 %      | -9.7 pts  | 6.1 %            | 1650 |
| DEN1  | TEAM_TOTAL_AWAY_OVER_1_5 | 43.0 %     | 33.4 %      | +9.6 pts  | 4.7 %            | 625  |
| SUI1  | BTTS_NO                  | 37.8 %     | 47.4 %      | -9.6 pts  | 7.0 %            | 733  |
| SUI1  | BTTS_YES                 | 62.2 %     | 52.6 %      | +9.6 pts  | 7.0 %            | 733  |

## 3. Le marché price-t-il déjà ces tendances ?

Sur 255 cellules championnat x marché d'au moins
300 issues, comparées à la probabilité implicite
normalisée (marge retirée) :

- 127 la dépassent, soit
  49.8 % — le pile ou
  face attendu si le marché ne se trompe nulle part ;
- 6 le font significativement à 95 %, pour
  6.4 attendues par pur hasard ;
- l'écart moyen sur 220204 issues est de
  +0.0 pts.

Le consensus d'avant match est donc calibré au niveau championnat x marché.
Les tendances du paragraphe 2 sont réelles, mais déjà dans la cote. Les
cellules ci-dessous sont listées pour mémoire : leur nombre est celui du
hasard.

| Ligue | Marché         | Choix | n    | Réalisé | Implicite | Écart    | Cote |
| ----- | -------------- | ----- | ---- | ------- | --------- | -------- | ---- |
| UEL   | OVER_UNDER_2_5 | OVER  | 406  | 57.6 %  | 52.7 %    | +4.9 pts | 1.83 |
| TUR1  | OVER_UNDER_2_5 | UNDER | 590  | 52.5 %  | 48.5 %    | +4.1 pts | 1.99 |
| LL    | BTTS           | YES   | 1140 | 53.8 %  | 49.8 %    | +4.0 pts | 1.97 |
| CSL   | ONE_X_TWO      | DRAW  | 590  | 26.8 %  | 23.0 %    | +3.7 pts | 4.44 |
| SWE1  | ONE_X_TWO      | AWAY  | 820  | 34.5 %  | 30.9 %    | +3.6 pts | 4.01 |
| ERD   | ONE_X_TWO      | DRAW  | 895  | 25.6 %  | 22.2 %    | +3.4 pts | 4.70 |

## 4. Les marchés exotiques sont-ils moins bien price ?

Hypothèse testée : un marché secondaire, moins liquide, serait moins bien
tenu. La comparaison se fait ici contre la probabilité implicite **brute**
(1 / cote) : la question n'est pas la calibration mais la jouabilité. Le ROI
est celui d'une mise sur chaque choix coté, marge comprise.

| Marché              | Paris  | Cote  | Réalisé | Implicite brut | ROI     | Erreur type | ROI A   | ROI B   |
| ------------------- | ------ | ----- | ------- | -------------- | ------- | ----------- | ------- | ------- |
| DOUBLE_CHANCE       | 12691  | 1.71  | 65.7 %  | 68.5 %         | -2.1 %  | 0.7 %       | 0.9 %   | -7.1 %  |
| OVER_UNDER_HT       | 23678  | 2.14  | 50.0 %  | 53.7 %         | -8.0 %  | 0.7 %       | -8.1 %  | -7.9 %  |
| CLEAN_SHEET_HOME    | 6706   | 2.42  | 50.0 %  | 53.5 %         | -8.1 %  | 1.5 %       | -7.3 %  | -9.0 %  |
| TO_WIN_EITHER_HALF  | 6366   | 2.02  | 51.3 %  | 55.1 %         | -8.1 %  | 1.3 %       | -8.1 %  | -8.2 %  |
| CLEAN_SHEET_AWAY    | 6706   | 2.98  | 50.0 %  | 53.2 %         | -9.4 %  | 1.8 %       | -8.8 %  | -10.1 % |
| DRAW_NO_BET         | 5015   | 2.38  | 50.0 %  | 54.1 %         | -10.6 % | 1.7 %       | -10.7 % | -10.4 % |
| WIN_TO_NIL_HOME     | 6774   | 2.78  | 49.8 %  | 54.2 %         | -13.0 % | 1.7 %       | -12.0 % | -14.1 % |
| RESULT_BTTS         | 20292  | 7.12  | 16.7 %  | 19.1 %         | -14.1 % | 1.9 %       | -13.9 % | -14.4 % |
| WIN_TO_NIL_AWAY     | 6334   | 3.55  | 49.3 %  | 53.8 %         | -14.5 % | 2.2 %       | -12.8 % | -16.6 % |
| TEAM_TOTAL_AWAY     | 30704  | 7.15  | 46.3 %  | 49.5 %         | -16.1 % | 2.0 %       | -16.8 % | -15.3 % |
| RESULT_TOTAL_GOALS  | 68781  | 6.03  | 18.6 %  | 21.8 %         | -17.7 % | 0.9 %       | -17.7 % | -17.7 % |
| TEAM_TOTAL_HOME     | 35220  | 7.01  | 46.5 %  | 49.7 %         | -19.2 % | 1.9 %       | -20.4 % | -17.7 % |
| HALF_TIME_FULL_TIME | 50886  | 13.03 | 11.1 %  | 13.8 %         | -25.2 % | 1.8 %       | -25.5 % | -24.3 % |
| CORRECT_SCORE       | 147586 | 94.92 | 2.6 %   | 3.9 %          | -55.9 % | 3.9 %       | -55.7 % | -56.2 % |

C'est l'inverse de l'hypothèse. La marge croît avec l'exotisme du marché, et
le résultat se reproduit à l'identique sur les deux périodes : ce n'est pas du
bruit, c'est la grille tarifaire du bookmaker.

Balayage des 169 cellules championnat x marché x choix d'au moins
150 paris : 15 au ROI positif,
0 significatives à 95 % pour
4.2 attendues par hasard, dont
0 positives sur les deux périodes. Aucune cellule exotique
n'est jouable.

## 5. ROI au niveau jambe, par canal

Le seul niveau où l'échantillon a de la puissance, et sur paris dédupliqués.
Un canal doit battre la marge du paragraphe 6, soit environ
4.6 % par jambe, pour qu'un coupon composé de ses
jambes ait une espérance positive.

| Canal               | Jambes | ROI jambe | Erreur type | ROI période A | ROI période B | Cote | Réalisé | Annoncé |
| ------------------- | ------ | --------- | ----------- | ------------- | ------------- | ---- | ------- | ------- |
| FIRST_HALF          | 216    | 5.6 %     | 7.9 %       | n/a           | 5.1 %         | 2.34 | 45.2 %  | 46.3 %  |
| DRAW_NO_BET         | 1022   | -1.6 %    | 2.4 %       | n/a           | -1.7 %        | 1.62 | 66.3 %  | 67.1 %  |
| TEAM_TOTAL          | 3692   | -2.6 %    | 1.4 %       | -1.5 %        | -3.6 %        | 1.72 | 63.9 %  | 74.0 %  |
| GOALS               | 3805   | -3.0 %    | 1.4 %       | -1.4 %        | -5.1 %        | 1.73 | 59.5 %  | 65.9 %  |
| OVER_UNDER_HT       | 272    | -3.0 %    | 4.2 %       | n/a           | -3.3 %        | 1.47 | 66.8 %  | 71.3 %  |
| DRAW                | 1305   | -3.4 %    | 4.2 %       | -8.0 %        | 2.9 %         | 3.38 | 28.7 %  | 29.9 %  |
| DOUBLE_CHANCE       | 1166   | -3.4 %    | 1.6 %       | -1.5 %        | -3.6 %        | 1.28 | 76.8 %  | 80.8 %  |
| SAFE                | 628    | -4.2 %    | 2.6 %       | -5.8 %        | -2.8 %        | 1.42 | 68.6 %  | 80.5 %  |
| VANTAGE             | 1762   | -5.0 %    | 2.8 %       | n/a           | -5.0 %        | 2.35 | 49.0 %  | 55.2 %  |
| WIN_EITHER_HALF     | 2509   | -5.3 %    | 1.6 %       | -7.0 %        | -3.7 %        | 1.64 | 61.1 %  | 63.4 %  |
| BTTS                | 1158   | -5.9 %    | 2.5 %       | -7.4 %        | -4.9 %        | 1.69 | 56.5 %  | 59.6 %  |
| RESULT_TOTAL_GOALS  | 1238   | -7.7 %    | 6.3 %       | n/a           | -7.8 %        | 5.29 | 23.2 %  | 24.2 %  |
| CLEAN_SHEET         | 2887   | -8.4 %    | 2.8 %       | -2.9 %        | -14.4 %       | 3.18 | 32.5 %  | 37.9 %  |
| DOMINANT            | 719    | -9.0 %    | 3.9 %       | -8.6 %        | -9.7 %        | 2.09 | 51.1 %  | 64.7 %  |
| HALF_TIME_FULL_TIME | 272    | -9.0 %    | 10.9 %      | n/a           | -6.6 %        | 3.95 | 29.0 %  | 29.7 %  |
| VALUE               | 954    | -14.0 %   | 5.1 %       | -5.0 %        | -25.7 %       | 3.34 | 32.7 %  | 55.0 %  |
| CORRECT_SCORE       | 3771   | -15.7 %   | 4.4 %       | -15.8 %       | -15.7 %       | 8.60 | 10.9 %  | 13.8 %  |
| RESULT_BTTS         | 1921   | -16.5 %   | 6.8 %       | -13.0 %       | -16.8 %       | 8.05 | 16.6 %  | 24.5 %  |
| WIN_TO_NIL          | 1558   | -21.3 %   | 4.2 %       | -3.8 %        | -23.0 %       | 3.93 | 23.1 %  | 27.7 %  |

Aucun des 13 canaux mesurés sur les deux périodes ne tient un ROI par jambe positif. Le meilleur, TEAM_TOTAL, est à -2.6 % par
jambe pour une erreur type de 1.4 %, soit
2.6 % sous l'équilibre, face à une marge de marché de
4.6 %. Composé tel quel, ce ROI donne -5.1 % à deux
jambes, -9.9 % à quatre et -18.8 % à huit : la composition ne crée
pas d'espérance, elle multiplie celle des jambes. FIRST_HALF affiche 5.6 % par jambe (erreur type 7.9 %) sur une seule période : à surveiller, pas à conclure.

## 6. L'edge annoncé est-il prédictif ?

Paris dédupliqués, classés par edge annoncé (probabilité du moteur moins
probabilité implicite de la cote), du plus faible au plus fort.

| Décile | n    | Edge annoncé | Implicite | Annoncé | Réalisé | ROI jambe |
| ------ | ---- | ------------ | --------- | ------- | ------- | --------- |
| 1      | 2757 | -12.8 pts    | 64.4 %    | 51.6 %  | 62.5 %  | -2.8 %    |
| 2      | 2757 | -4.7 pts     | 47.5 %    | 42.8 %  | 44.4 %  | -10.4 %   |
| 3      | 2757 | -2.1 pts     | 44.1 %    | 42.1 %  | 41.3 %  | -9.2 %    |
| 4      | 2757 | -0.4 pts     | 39.7 %    | 39.3 %  | 38.3 %  | -6.0 %    |
| 5      | 2757 | +0.6 pts     | 39.3 %    | 39.9 %  | 37.4 %  | -10.0 %   |
| 6      | 2756 | +2.3 pts     | 40.2 %    | 42.6 %  | 36.5 %  | -12.2 %   |
| 7      | 2756 | +4.3 pts     | 41.9 %    | 46.2 %  | 39.4 %  | -10.5 %   |
| 8      | 2756 | +7.0 pts     | 43.3 %    | 50.4 %  | 42.4 %  | -3.2 %    |
| 9      | 2756 | +11.2 pts    | 45.2 %    | 56.5 %  | 42.8 %  | -7.1 %    |
| 10     | 2756 | +23.4 pts    | 40.5 %    | 63.9 %  | 37.8 %  | -8.1 %    |

Le taux réalisé suit la colonne implicite, pas la colonne annoncée. Le décile
qui perd le moins est celui où le moteur annonce **moins** que le marché. Ce
résultat reproduit sur données fraîches l'audit du 2026-08-22 : l'edge annoncé
n'est pas un signal de sélection.

## 7. Ce que la marge impose au coupon

| Marché            | Rencontres | Somme des implicites | Marge par jambe |
| ----------------- | ---------- | -------------------- | --------------- |
| OVER_UNDER_2_5    | 22777      | 1.0531               | 5.0 %           |
| ONE_X_TWO         | 19953      | 1.0449               | 4.3 %           |
| FIRST_HALF_WINNER | 10393      | 1.0398               | 3.8 %           |
| BTTS              | 10288      | 1.0395               | 3.8 %           |

| Jambes | Cote par jambe | Espérance sans edge | Edge requis par jambe |
| ------ | -------------- | ------------------- | --------------------- |
| 2      | 2.24           | -8.6 %              | 4.6 %                 |
| 3      | 1.71           | -12.6 %             | 4.6 %                 |
| 4      | 1.50           | -16.5 %             | 4.6 %                 |
| 5      | 1.38           | -20.2 %             | 4.6 %                 |
| 6      | 1.31           | -23.7 %             | 4.6 %                 |
| 7      | 1.26           | -27.1 %             | 4.6 %                 |
| 8      | 1.22           | -30.3 %             | 4.6 %                 |

À cote cible égale, chaque jambe supplémentaire paie la marge une fois de
plus. Un coupon de cote 5 construit en 8 jambes part de
-30.3 % d'espérance, contre
-8.6 % en 2 jambes. Le nombre de jambes est
le premier levier, avant tout choix de championnat ou de marché.

## 8. Ce que les données ne permettent pas encore de dire

Une fois les ré-analyses dédupliquées, la cellule médiane championnat x canal
x marché contient **7 paris**, et 27 cellules
seulement sur 1974 atteignent
100 paris. Il n'existe donc pas encore de trace par
championnat exploitable au niveau canal : toute table à ce grain listerait des
extrêmes de tirage. Les conclusions par championnat du présent rapport
viennent toutes du paragraphe 2 (taux de base, plusieurs saisons) et du
paragraphe 3 (cotes, plusieurs dizaines de milliers d'issues).

## Limites

- La trace du moteur ne couvre que juillet à septembre 2026 : une seule
  fenêtre, pas de saison complète, pas de cycle hiver/été.
- Les marchés exotiques ne sont cotés que depuis le 2026-07-19 pour la
  plupart, à l'exception d'OVER_UNDER_HT (2023) et HALF_TIME_FULL_TIME
  (2026-04).
- Le paragraphe 4 mesure la marge d'une mise sur chaque choix coté ; il
  démontre le coût d'entrée, pas l'impossibilité d'une stratégie sélective.
- Le paragraphe 7 suppose des jambes indépendantes, ce que des jambes du même
  match ou de la même journée ne sont pas.
