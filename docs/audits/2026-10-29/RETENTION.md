# Fidélisation : point de départ

_Lot 4, étape 1 (`docs/plan-lot-4-2026-10-29.md`). Copie de prod du 24/10. Les jours actifs du passé sont reconstruits par la migration `20261029120000_add_activity_and_retention` à partir des tables datées : vues et suivis de coupon, coupons déclarés, mouvements de bankroll, lectures, progression de formation, Eva, support, ouvertures de session. Admins exclus. Résultat : 308 jours actifs pour 96 joueurs, dernier jour le 23/10._

## Réponse courte

1. **Presque personne ne revient.** Sur 100 inscrits, 3 sont activés (au moins 3 jours actifs dans leurs 14 premiers jours). 5 reviennent à J7, 3 à J14 et 7 à J30. Les repères du plan du 23/10 avant toute offre payante sont loin : activation ≥ 40 %, J14 ≥ 30 %, sur au moins 300 inscrits.
2. **L'audience actuelle est minuscule** : 2 actifs la veille, 3 sur 7 jours, 6 sur 30 jours (au 24/10).
3. **Le pic d'août ne s'est pas transformé.** 73 inscriptions en août : 34 actifs la semaine du 24/08, puis 10, puis 2 dès la mi-septembre. 1 seul des 73 est activé.
4. **Ces chiffres sous-estiment l'activité passée** : une visite qui ne laissait aucune trace datée (lire l'Accueil, ouvrir un match) n'est pas comptée. À partir de ce lot, chaque requête authentifiée compte le jour (`user_activity_day`). Les chiffres de novembre seront les premiers complets.

## Par mois d'inscription

| Mois    | Inscrits | Jamais actifs | Activés |  J7 | J14 | J30 |
| ------- | -------: | ------------: | ------: | --: | --: | --: |
| 2026-04 |       12 |             0 |       2 |   4 |   2 |   3 |
| 2026-05 |        4 |             0 |       0 |   1 |   0 |   2 |
| 2026-06 |        1 |             0 |       0 |   0 |   0 |   0 |
| 2026-07 |        4 |             0 |       0 |   0 |   0 |   0 |
| 2026-08 |       73 |             5 |       1 |   0 |   1 |   2 |
| 2026-09 |        6 |             0 |       0 |   0 |   0 |   0 |
| Total   |      100 |             5 |       3 |   5 |   3 |   7 |

Jn = actif au moins un jour entre n et n + 6 jours après l'inscription. Tous les inscrits de la copie sont assez anciens pour J30.

## Joueurs actifs par semaine

| Semaine du | Actifs |
| ---------- | -----: |
| 03/08      |     14 |
| 10/08      |     12 |
| 17/08      |      5 |
| 24/08      |     34 |
| 31/08      |     32 |
| 07/09      |     10 |
| 14/09      |      2 |
| 21/09      |      2 |
| 28/09      |      1 |
| 05/10      |      1 |
| 12/10      |      4 |
| 19/10      |      3 |

## Ce que le lot en tire

- La matinée (résultats d'hier et coupons du jour) et le relevé du lundi sont les deux raisons de revenir que ce lot ajoute. Leur taux d'ouverture se lit sur la carte « Fidélisation » de l'accueil admin (`NOTIFICATION_OPENED`, arrivée par `?from=morning|weekly`).
- À relire vers le 10/12, sur des jours actifs mesurés en direct : activation et J14 des cohortes de novembre, et ouverture des deux notifications.
- Le sondage d'intention de payer attend 300 inscrits activables : on en est loin.
