# Fraîcheur des cotes par book

Régénérable : `pnpm --filter @evcore/backtest-core report:freshness`.
Fenêtre : 30 derniers jours.

« Ligne de clôture » est la part des rencontres dont le dernier relevé tombe
dans le dernier quart d'heure avant le coup d'envoi. C'est la mesure de succès
du balayage de clôture : sans elle, le CLV — le seul indicateur qui dise à
l'avance si un pari a de la valeur — ne peut pas être calculé, et comparer
deux books relevés à des heures différentes ne mesure que du décalage
temporel.

| Book | Rencontres | Relevés / rencontre | Dernier relevé (h, médiane) | p10 | p90 | Ligne de clôture | Relevé < 90 min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bet365 | 2028 | 5.4 | 23.7 | 8.5 | 30.0 | 0.0 % | 0.2 % |
| Pinnacle | 2029 | 5.4 | 24.2 | 17.5 | 30.1 | 0.0 % | 0.0 % |
| Marathonbet | 2062 | 5.6 | 24.2 | 17.6 | 30.1 | 0.0 % | 0.0 % |
| Unibet | 1832 | 4.4 | 26.3 | 18.4 | 75.5 | 0.0 % | 0.0 % |

**0 book sur 4** atteint la cible de
70.0 % de lignes de clôture.
