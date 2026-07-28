---
title: "Répartir son capital entre les canaux, et savoir quand miser dans la saison"
category: bankroll
difficulty: intermediate
order: 3
slug: allocation-et-timing
summary: "L'unité de mise règle le combien. Cette leçon règle le où et le quand : comment répartir un capital entre des canaux qui n'ont pas tous le même niveau de preuve, et pourquoi le calendrier des championnats change la donne."
updatedAt: "2026-07-28"
related: ["unite-de-mise", "variance-et-patience", "channels-overview"]
---

## Ce que cette leçon ajoute aux deux précédentes

La leçon sur l'unité de mise répond à "combien miser par pari". Celle sur la variance répond à "pourquoi un edge réel peut quand même perdre". Il reste une question sans réponse : parmi des canaux qui n'ont clairement pas le même niveau de preuve (voir la carte des canaux), comment répartir un capital entre eux — et le moment de la saison change-t-il quelque chose ?

## Tous les canaux ne méritent pas la même part du capital

La carte des canaux distingue déjà des niveaux de preuve différents. Ça doit se refléter dans la répartition, pas seulement dans le discours :

- **VALUE et DRAW** sont les deux canaux les plus solides aujourd'hui (+9.71% et +5.35% ROI, sur respectivement 1 333 et 4 110 sélections réglées) — ils méritent la part la plus large du capital consacré à la mise.
- **SAFE** est quasi neutre (+0.23%) : il ne fait pas gagner beaucoup à lui seul, mais son taux de réussite élevé (66.1%) en fait un stabilisateur utile pour lisser les séries de pertes des deux canaux précédents.
- **TEAM_TOTAL et BTTS** sont des canaux satellites — récemment promus, avec des réserves documentées dans leurs leçons respectives (historique de 9 jours pour l'un, restriction à trois championnats pour l'autre). Une part de capital plus réduite leur revient, pas parce que le signal est faible, mais parce que la preuve est plus jeune.
- **GOALS** ne mérite aucune part du capital de mise — ce n'est pas un désaccord d'opinion, c'est ce que montre son propre audit (−5.39% sur le plus gros échantillon d'EVCore).

Cette hiérarchie n'est pas figée : elle change avec chaque audit, exactement comme le montre la trajectoire de DRAW ou la promotion récente de BTTS et TEAM_TOTAL.

## Ce que dit l'historique des coupons déjà générés

Le Coupon Composer applique déjà cette logique de pondération par canal en coulisse. Sur 376 coupons réglés au dernier audit, le résultat global est un ROI de +32.2% à mise plate — mais ce chiffre demande deux nuances avant d'en tirer une conclusion :

|                           | Volume | Taux de réussite | ROI (mise plate) |
| ------------------------- | ------ | ---------------- | ---------------- |
| Coupon classé n°1 du jour | 171    | 32.2%            | **+45.3%**       |
| Coupon classé n°2 du jour | 116    | 30.2%            | +28.4%           |
| Coupon classé n°3 du jour | 89     | 28.1%            | +12.0%           |

D'abord, la cote combinée moyenne de ces coupons (4.36) explique le taux de réussite modeste : c'est un profil de combiné, où le profit vient de gains ponctuels qui compensent large — exactement le principe déjà couvert par la leçon sur la variance. Ensuite, le coupon classé n°1 du jour est nettement plus rentable que les suivants : à capital limité, le prioriser a plus de sens que de répartir également entre les trois.

Cet historique ne couvre pas encore de coupons avec des jambes TEAM_TOTAL ou BTTS — trop récents. Il sera revu une fois ces canaux réglés en volume.

## Le calendrier des championnats n'est pas neutre

Deux périodes méritent une attention particulière, pour des raisons différentes :

**La reprise des grands championnats (août pour Premier League, Bundesliga, Serie A)** est la période la plus favorable pour déployer du capital. C'est là que le volume de matchs à cotes liquides et fiables est le plus élevé, et c'est précisément le périmètre où BTTS est rentable — le canal reste inactif sur ces trois championnats tant qu'ils ne jouent pas.

**La fin de saison (avril-mai selon les championnats)** demande l'inverse : plus de prudence, pas d'arrêt brutal. Des matchs sans enjeu sportif réel (équipe déjà reléguée ou déjà titrée) rendent les résultats plus imprévisibles que d'habitude. Réduire la mise plutôt que l'augmenter est la bonne réaction dans cette fenêtre.

Les trêves internationales et les championnats à faible volume suivent la même logique que les championnats mineurs : l'échantillon disponible par ligue y est plus mince, donc l'incertitude plus grande — pas une raison d'arrêter, mais une raison de rester sur l'unité de mise standard plutôt que de l'augmenter.

## Ce que cette leçon ne dit pas

Elle ne donne pas de pourcentages d'allocation figés par canal — ce serait prétendre à une précision que les données actuelles ne permettent pas, surtout pour des canaux aussi jeunes que TEAM_TOTAL. Elle ne dit pas non plus que suivre cette répartition garantit un résultat sur une période donnée : la leçon sur la variance s'applique ici comme partout ailleurs.

## À retenir

- La répartition du capital doit refléter le niveau de preuve réel de chaque canal, pas une répartition égale par confort : VALUE et DRAW en premier, SAFE en stabilisateur, TEAM_TOTAL et BTTS en satellites, GOALS jamais.
- Le coupon classé n°1 du jour est historiquement le plus rentable des trois — le prioriser a du sens à capital limité.
- Le calendrier compte : la reprise des grands championnats en août est la période la plus favorable, la fin de saison appelle plus de prudence, pas un arrêt.
