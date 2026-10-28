# Mes coupons et Suivi de mise : un seul calcul, une réponse datée

_Suite du plan produit, branche `feat/produit-ux`, du 27/10/2026. Revue isolée : **Mes coupons 15/40, Suivi de mise 14/40**. Captures dans `captures/pages-restantes-avant` et `captures/mes-coupons-suivi-apres`, sorties des détecteurs dans `scripts/pr-avant-*` et `scripts/pr-apres-*`._

## Ce que la revue a trouvé

- **Un remboursement compté comme une perte, à l'écran et sur le solde.**
  - À l'écran, un combiné dont une jambe est remboursée affichait « Perdu », et un pari simple remboursé restait « En attente » pour toujours.
  - Sur le solde, ce combiné n'était jamais crédité. Un combiné entièrement remboursé ne rendait pas sa mise.
  - Le résultat à mise fixe de l'Accueil appliquait déjà la bonne règle (cote 1), ce qui faisait trois règles différentes pour le même cas.
- **Un « ROI net » qui n'était pas un ROI.** Il calculait (solde − dépôts) ÷ dépôts sur les 200 derniers mouvements, sans période. Il s'affichait « +1001420.00% ».
- **Un « ROI sur la période » faux.** Il comptait les mises en attente comme perdues : −48,67 % là où les paris réglés donnaient −23 %.
- **« Gain » pour un montant mise comprise.** Un « Gain potentiel » s'affichait en vert.
- **L'EV en vert**, avec un « + » forcé même devant une valeur négative. Un badge « Valeur » s'affichait par défaut sur chaque pari du joueur.
- **Aucune réponse datée à « suis-je en gain ou en perte, et depuis quand ? ».**
- **Des paris illisibles.**
  - Ils n'étaient pas écrits avec les équipes.
  - Un combiné apparaissait sous le nom de sa seule première jambe.
  - On lisait encore « #bs1 », « Leg combiné », « Perso », « Annulé », « portefeuille ».
  - La boîte de dépôt vouvoyait.
  - La visite guidée promettait des retraits qui n'existent pas.

## Ce qui est fait

| Commit     | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `056fb37e` | **Règlement** : une jambe remboursée compte pour une cote de 1, et un combiné entièrement remboursé rend sa mise. Le règlement réutilise la règle de l'Accueil (`combineLegs`). Tests ajoutés.                                                                                                                                                                                                                                                |
| `3c3dc20c` | **Un seul calcul, côté serveur.** Chaque coupon porte son `result` en francs (statut, misé, rendu, gain net, en jeu, retour possible), calculé par `slipMoney` avec la même règle que le solde. Le résumé du joueur ajoute `money` : coupons réglés, misé, rendu, net, date du premier coupon. `GET /bankroll/summary` additionne tous les dépôts. L'historique nomme le pari, et dit « Combiné · N sélections » pour un combiné.             |
| `dd0d4898` | **Composants partagés.** Libellés des tuiles et des filtres à 12 px. « Filtres » et « Réinitialiser » à 44 px sur téléphone. Graduations des graphiques à 12 px. Francs CFA sans centimes. Pagination nommée en français.                                                                                                                                                                                                                     |
| `ffd232ae` | **Les deux écrans.** Mes coupons : deux phrases datées (la période, puis tout l'historique), les paris écrits avec les équipes, « Rendu » et « Gain net » en couleur neutre, « Retour possible …, dont … de gain », « Remboursé ». Suivi de mise : solde déclaré, dépôts déclarés et résultat des paris, avec la phrase « un dépôt n'est pas un gain », puis « Déclarer un dépôt ». Plus d'EV, de badge de canal, de « ROI » ni de « Perso ». |

### Ce que lit le joueur

- Mes coupons : « Du 20 oct. au 27 oct. : 3 coupons réglés, 1 en cours. **Misé 4 000 F, rendu 4 198 F : +198 F.** 1 000 F encore en jeu. » Puis : « Depuis ton premier coupon, le 24 octobre 2026 : 3 coupons réglés, résultat +198 F. » Les totaux suivent le filtre Type.
- Le combiné « Victoire Real Madrid (1,33) + Lyon, remboursé si nul (1,57, nul) » est gagné : rendu 2 660 F pour 2 000 F. Le détail l'explique : « Une sélection remboursée compte pour une cote de 1 : le combiné est payé sur les autres. »
- Suivi de mise : « Résultat de tes paris depuis ton premier coupon, le 24 octobre 2026 : 3 coupons réglés, misé 4 000 F, rendu 4 198 F. Tout est déclaratif : un dépôt fait monter le solde, ce n'est pas un gain. »

## Mesures

| `impeccable`, éléments signalés | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------- | ---------: | --------: | ----------: | ---------: |
| Mes coupons                     |     11 → 5 |    10 → 4 |      14 → 3 |     15 → 4 |
| Suivi de mise                   |      7 → 8 |     6 → 7 |      10 → 7 |     11 → 8 |

| Détecteur maison           | Mes coupons 375 | Mes coupons 1280 | Suivi 375 | Suivi 1280 |
| -------------------------- | --------------: | ---------------: | --------: | ---------: |
| Textes sous 12 px          |           9 → 0 |           15 → 3 |    13 → 0 |     16 → 3 |
| Cibles sous 44 px          |           2 → 0 |          15 → 15 |   16 → 13 |    21 → 20 |
| Titres (`h1`, `h2`)        |           3 → 5 |            3 → 5 |     2 → 3 |      2 → 3 |
| Contrastes insuffisants \* |           0 → 0 |            0 → 0 |     1 → 1 |      1 → 1 |

Ce qui reste sur Suivi de mise :

- **Les cibles signalées** sont les montants touchables de l'historique (zone élargie à 44 px par un pseudo-élément que le détecteur ne mesure pas) et la pagination.
- **Le contraste signalé (\*)** est une graduation SVG du graphique, en sombre. Le détecteur lit sa couleur de texte au lieu de son remplissage. Elle est lisible sur la capture.
- **Les cartes imbriquées** viennent du tableau et du graphique posés dans des `TableCard`.
- Sur grand écran, ce qui reste vient de la barre latérale.

## Tests

- `bet-slips.spec.ts`, sur téléphone et ordinateur :
  - le résultat daté et sans centimes ;
  - le combiné à jambe remboursée, gagné, avec « Remboursé » dans le détail ;
  - aucun « EV », aucun « ROI » ;
  - « Déclarer un dépôt » ;
  - un combiné nommé dans l'historique.
- Backend : `slipMoney` (combiné gagné + remboursé, combiné tout remboursé, combiné en attente, simples mêlés) et règlement des combinés (produit des cotes, jambe remboursée, tout remboursé, perdu ou en attente).

## À faire côté utilisateur

**Régulariser le combiné jamais crédité.** Un seul cas sur la copie de prod : 400 000 F joués le 04/09, 1,33 gagné + 1,57 remboursé, soit 532 000 F jamais crédités. La requête `sql/repair-void-combo-credits.sql` est générale et rejouable : elle ignore un combiné déjà crédité. Rejouée à blanc sur la copie, elle écrit exactement cette ligne. À lancer après le déploiement du backend :

```bash
docker exec -i evcore-postgres psql -U postgres -d evcore < docs/audits/2026-10-27/sql/repair-void-combo-credits.sql
```

## Décisions prises sans attendre, réversibles

1. **Le solde déclaré reste.** La saisie d'un coupon est bloquée si le solde déclaré est insuffisant, donc le retirer est une décision produit. Il est présenté comme une déclaration : « Solde déclaré », « Déclarer un dépôt fait chez ton bookmaker », « un dépôt n'est pas un gain ».
2. **Les francs font foi sur ces deux écrans**, avec les mises déclarées. La mise fixe reste la mesure de l'Accueil, qui la nomme. Les deux utilisent la même règle pour une jambe remboursée.

## Restes

- Pas de type « retrait ». Un dépôt mal tapé reste définitif, et un coupon saisi par erreur ne se supprime pas (le contrôleur n'a que GET et POST).
- La cote d'un combiné à l'écran est arrondie à deux décimales. Le crédit, lui, utilise les cotes stockées à trois décimales : quelques francs d'écart sont possibles.
