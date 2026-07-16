---
title: "L'edge et l'EV : pourquoi un pari n'est intéressant qu'au-delà d'un seuil"
category: bases
difficulty: beginner
order: 3
slug: ev-probabilites-cotes
summary: "L'EV et l'edge sont les deux chiffres qui décident si un pick mérite d'être misé. Comprenez leur calcul, leur seuil, et pourquoi trier par EV brut peut être trompeur."
updatedAt: "2026-07-16"
related: ["cotes-probabilites-implicites", "comment-lire-un-pick"]
---

## Deux façons de mesurer le même avantage

La leçon précédente a posé la base : un pari n'a d'intérêt que si la probabilité calibrée dépasse la probabilité implicite de la cote. EVCore traduit cet écart en deux chiffres, tous deux affichés sur chaque pick.

### L'edge

```
edge = probabilité calibrée − probabilité implicite
```

L'écart brut, en points de pourcentage. Un edge de +10 points signifie que le modèle estime la probabilité 10 points au-dessus de ce qu'affiche le marché.

### L'EV (Expected Value)

```
EV = (probabilité calibrée × cote) − 1
```

Même avantage, exprimé cette fois en rendement attendu par unité misée. Un EV de +8% veut dire qu'en moyenne, sur un grand nombre de paris similaires, chaque unité misée rapporte 0,08 unité — en moyenne sur la durée, jamais sur un pari isolé.

## Pourquoi un seuil, et pas n'importe quel EV positif

En théorie, un EV légèrement positif suffirait à justifier un pari. Dans les faits, EVCore n'affiche un pick VALUE qu'à partir d'un EV de 8% ou plus, pour deux raisons.

D'abord, le modèle n'est jamais parfait : une estimation de probabilité comporte toujours une marge d'erreur. Un EV de +2% peut disparaître entièrement si le modèle se trompe légèrement sur ce match précis — le bruit statistique mange l'avantage. Ensuite, plus l'edge affiché est faible, plus il devient difficile de distinguer une vraie lecture du match d'un simple artefact de calcul.

Un seuil élevé filtre mécaniquement les picks les plus fragiles. C'est un choix de discipline, pas une garantie de gain — le point suivant y revient.

## Pourquoi le tri par EV brut peut tromper

Voici le résultat le plus contre-intuitif de toute cette formation : classer les picks VALUE par EV brut décroissant n'est pas la meilleure stratégie. Sur les données réelles suivies par EVCore, le classement par edge calibré tient sur des données hors échantillon là où le tri par EV brut ou par probabilité brute s'effondre.

Un EV élevé peut venir de deux origines très différentes. Soit une vraie divergence d'analyse entre le modèle et le marché — le cas qu'on cherche à capter. Soit une cote anormalement généreuse sur un match à faible probabilité, où la moindre erreur du modèle se retrouve amplifiée par la cote elle-même. Le classement par edge calibré filtre mieux ce second cas. C'est pour ça que le Coupon Composer et la page Investir s'appuient sur des méthodes testées, pas sur l'intuition "plus l'EV est haut, mieux c'est".

## Ce que ce chiffre ne dit pas

Un EV positif ne garantit rien sur un pari donné — c'est une espérance statistique sur un grand nombre de paris, pas une prédiction individuelle. Un canal rentable en moyenne peut perdre plusieurs paris consécutifs sans que ça remette rien en cause : c'est la variance, pas un signe d'échec du modèle, et la leçon sur la bankroll y revient en détail. Enfin, aucune performance passée, même bien documentée, ne constitue une promesse pour l'avenir.

## À retenir

- Edge : écart de probabilité. EV : rendement attendu par unité misée. Deux angles du même avantage.
- Le seuil (≥8% pour VALUE) filtre les picks trop fragiles pour être fiables — il ne cherche pas à maximiser le nombre de picks affichés.
- Trier par edge calibré protège mieux contre les cotes trompeuses que trier par EV brut. Un résultat vérifié sur les données, pas une préférence esthétique.
