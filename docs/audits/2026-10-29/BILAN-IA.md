# Le bilan de l'IA, sur ses avis figés

_Lot 5 (`docs/plan-lot-5-2026-10-29.md`). Copie de prod du 24/10, après le règlement de l'historique (`POST /channel-decisions/settle-range?from=2026-09-08`) et la cotation 1xBet des jambes (`POST /coupons/settle-range?from=2026-09-13`)._

## Pourquoi le bilan était vide

La cohorte commune (`prematchCohortSql`) excluait VANTAGE, et c'était fondé. La ligne vivante d'un avis est réécrite par upsert : sur la copie, **128 avis ont été écrits après le coup d'envoi**. Ces avis tardifs ne valaient d'ailleurs pas mieux : 47,7 % de réussite pour 58,2 % annoncés.

Le bilan lit désormais `vantage_decision_history`, l'historique en ajout seul. Pour chaque match fini, on prend le dernier avis écrit avant le coup d'envoi, réglé sur le score final avec les mêmes résolveurs que les autres canaux. Cet historique existe depuis le 08/09 : le bilan commence là.

## Cohorte figée, par version (08/09 – 24/10)

| Version | Avis réglés | Réalisé | Annoncé | Prix payé (1/cote) | Écart au prix payé | À mise fixe | Cote moyenne |
| ------- | ----------: | ------: | ------: | -----------------: | -----------------: | ----------: | -----------: |
| v3      |         744 |  53,5 % |  58,5 % |             57,0 % |         −3,5 ± 3,4 |      −7,4 % |         2,01 |
| v4      |         207 |  65,7 % |  63,7 % |             67,6 % |         −1,9 ± 6,4 |      −2,6 % |         1,50 |
| Total   |         951 |  56,2 % |  59,7 % |             59,3 % |         −3,2 ± 3,0 |      −6,4 % |         1,90 |

« Prix payé » est la probabilité implicite de la cote, marge comprise. L'écart à la fréquence du marché sans marge, celui qu'affiche l'écran, est plus haut d'environ 3,5 à 4,5 points (la marge, rapportée à la probabilité). Il devient à peu près nul, et pour v4 il ne se distingue pas de zéro.

**Lecture.**

- v4 est bien calibrée : 65,7 % réalisés pour 63,7 % annoncés.
- Elle ne bat pas la cote : à mise fixe, on perd à peu près la marge.
- v3 était sur-confiante, de 5 points.

Rien ne permet de dire que l'IA bat le marché. La phrase de l'écran reste : « l'IA ne bat pas la cote du bookmaker ».

## Par tranche de cote (cohorte figée)

| Cote        | Avis | Réalisé | Annoncé | Prix payé | À mise fixe |
| ----------- | ---: | ------: | ------: | --------: | ----------: |
| sous 1,45   |  237 |  70,5 % |  70,2 % |    75,0 % |      −6,2 % |
| 1,45 – 1,80 |  415 |  59,3 % |  60,0 % |    62,2 % |      −4,6 % |
| 1,80 et +   |  299 |  40,5 % |  50,9 % |    42,9 % |      −8,9 % |

On retrouve le résultat de CLAUDE.md : la calibration s'effondre au-dessus de 1,80. Le plafond de v4 (`MAX_ODDS = 1,80`) supprime cette tranche.

## Jambes de coupon au prix 1xBet

Les jambes reçoivent leur cote 1xBet au règlement, au prix connu à la publication. Couverture sur la copie, depuis le 13/09 :

- PRICE : 69 jambes sur 74 ;
- IA : 33 sur 42 ;
- ENGINE : 28 sur 41.

Une jambe que 1xBet ne cotait pas reste vide.

| Source | Jambes réglées cotées 1xBet | Cote 1xBet | Marge 1xBet | Marché sans marge | Réalisé |    Écart | À mise fixe |
| ------ | --------------------------: | ---------: | ----------: | ----------------: | ------: | -------: | ----------: |
| IA     |                          33 |       1,31 |       8,3 % |            72,0 % |  63,6 % |  −8,3 pt |     −21,5 % |
| PRICE  |                          66 |       2,36 |       8,6 % |            43,3 % |  49,2 % |  +6,0 pt |      +8,8 % |
| ENGINE |                          26 |       1,31 |       8,3 % |            72,9 % |  84,6 % | +11,7 pt |      +7,6 % |

Avec 26 à 66 jambes par source, ces écarts sont dans le bruit (± 15 à 18 points). Le tableau est le point de départ de la comparaison jambe à jambe, pas un verdict. Il se régénère avec `pnpm --filter @evcore/backtest-core report:coupon-clv`.

## À faire en prod

1. La migration `20261030090000_add_vantage_history_settlement` s'applique au démarrage du backend.
2. Régler l'historique depuis le 08/09 : `POST /channel-decisions/settle-range?from=2026-09-08&to=<aujourd'hui>`, avec l'en-tête `x-admin-token`. Il re-règle aussi les sélections : environ 7 minutes sur la copie.
3. Coter les jambes depuis le 13/09 : `POST /coupons/settle-range?from=2026-09-13&to=<aujourd'hui>`, même jeton.

## À relire

- Vers le 10/11 : la cohorte v5 (`vantage-v5-no-tension`, depuis le 27/10), qui a sa propre ligne dans le bilan.
- Vers le 10/12 : la comparaison jambe à jambe au prix 1xBet, quand chaque source aura au moins 100 jambes.
