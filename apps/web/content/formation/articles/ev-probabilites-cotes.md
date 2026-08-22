---
title: "L'edge et l'EV : deux chiffres utiles, et un piège"
category: bases
difficulty: beginner
order: 3
slug: ev-probabilites-cotes
summary: "L'edge et l'EV mesurent l'avantage que le modèle croit avoir. Mesuré sur 51 860 sélections, cet avantage revendiqué ne prédit pas le résultat — il mesure l'erreur du modèle. Voici pourquoi, et ce qu'EVCore en a fait."
updatedAt: "2026-08-22"
related: ["cotes-probabilites-implicites", "comment-lire-un-pick"]
---

## Deux façons de mesurer la même chose

La leçon précédente a posé la base : la cote contient une probabilité implicite, et le modèle produit sa propre probabilité. L'écart entre les deux se dit de deux façons.

### L'edge

```
edge = probabilité calibrée − probabilité implicite
```

L'écart brut, en points de pourcentage. Un edge de +10 points signifie que le modèle estime la probabilité 10 points au-dessus de ce qu'affiche le marché.

### L'EV (Expected Value)

```
EV = (probabilité calibrée × cote) − 1
```

Le même écart, exprimé en rendement attendu par unité misée. Un EV de +8% veut dire qu'en moyenne, sur un grand nombre de paris similaires, chaque unité misée rapporterait 0,08 unité.

Notez le conditionnel. Il porte tout le reste de cette leçon.

## Le résultat qui a tout changé

Pendant longtemps, EVCore a traité l'edge comme un critère de sélection : plus il était élevé, plus le pick était censé être intéressant. C'était l'intuition évidente, et elle est fausse.

L'audit du 2026-08-22 a rangé 51 860 sélections réglées par tranche d'edge revendiqué, et comparé ce que chaque tranche annonçait à ce qu'elle a réellement réalisé :

| edge revendiqué | annoncé | réel      | réalisé / annoncé |
| --------------- | ------- | --------- | ----------------- |
| négatif         | 0.481   | **0.511** | **1.062**         |
| 0 à 5 points    | 0.463   | 0.421     | 0.910             |
| 5 à 10 points   | 0.550   | 0.447     | 0.814             |
| 10 à 15 points  | 0.597   | 0.452     | 0.758             |
| 15 à 25 points  | 0.637   | 0.435     | 0.683             |
| plus de 25      | 0.699   | **0.375** | **0.537**         |

Lisez la colonne « réel » de haut en bas : elle **descend**. De 51% à 37%. Pendant que la colonne « annoncé » monte de 48% à 70%.

Autrement dit : plus le modèle annonce un gros avantage, moins le pari passe. L'edge revendiqué ne porte aucune information sur le résultat — il mesure uniquement **l'ampleur de l'erreur du modèle** sur ce match. Et là où le modèle price *en dessous* du marché (edge négatif), il est même trop prudent : ces picks réalisent 6% de plus qu'annoncé.

## Pourquoi c'est logique, après coup

Un gros edge peut avoir deux origines.

Soit le modèle a vu quelque chose que le marché a raté. C'est le cas qu'on cherche, et il existe — mais il est rare.

Soit le modèle s'est trompé. Et le marché, lui, a raison la plupart du temps : c'est son métier, il intègre des milliers de mises et des informations que le modèle n'a pas.

Quand on trie par edge décroissant, on ne trie pas par « qualité de la lecture ». On trie par **distance au marché**. Or la deuxième explication est bien plus fréquente que la première. On remonte donc mécaniquement les matchs où le modèle se trompe le plus.

## Ce qu'EVCore en a fait

Le renversement est complet, et il est visible dans l'app.

**L'edge est devenu un plafond, plus un seuil.** Un pick dont l'edge dépasse 10 points est écarté — vous le trouvez dans la vue « Écarté » d'Investir, avec le motif « edge revendiqué trop élevé ». C'est l'inverse exact de ce que le système faisait avant.

**Le classement se fait sur la probabilité calibrée**, jamais sur l'EV ni sur l'edge. Mesuré au niveau coupon : le tri par EV perd contre le tri par probabilité dans 13 configurations appariées sur 16.

**L'EV reste affiché**, parce qu'il décrit correctement ce qu'un pari rapporterait *si* la probabilité était juste. C'est une information sur le rendement, pas un critère de tri.

## Une tension que nous n'avons pas encore résolue

Le canal VALUE sélectionne, par définition, les picks dont l'edge dépasse 10 points — c'est-à-dire précisément la zone que le plafond écarte. Ses picks atterrissent donc massivement dans « Écarté ».

Ce n'est pas un bug, c'est un constat en cours de traitement. La piste mesurée est que VALUE n'apporte quelque chose que sur les picks qui lui sont *propres* — ceux qu'aucun autre canal n'a émis — et rien sur les 92% qu'il reprend ailleurs. Tant que ce n'est pas validé sur un échantillon suffisant, rien n'est changé, et la tension reste affichée telle quelle plutôt que maquillée.

## À retenir

- Edge et EV mesurent l'avantage que le modèle **croit** avoir, pas celui qu'il a.
- Mesuré sur 51 860 sélections : plus l'edge annoncé est gros, moins le pari passe. La quantité est anti-prédictive.
- EVCore s'en sert désormais comme d'un plafond d'exclusion, et classe sur la probabilité calibrée.
- Un chiffre affiché sur un pick n'est pas forcément un critère de décision. Celui-ci a mis trois ans à être démasqué.
