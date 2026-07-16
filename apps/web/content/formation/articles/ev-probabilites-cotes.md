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

La leçon précédente a posé la base : un pari n'a d'intérêt que si la probabilité calibrée du modèle dépasse la probabilité implicite de la cote. EVCore traduit cet écart en deux chiffres complémentaires, que vous verrez sur chaque pick.

### L'edge

```
edge = probabilité calibrée − probabilité implicite
```

C'est l'écart brut, en points de pourcentage. Un edge de +10 points veut dire que le modèle estime la probabilité 10 points au-dessus de ce que le marché affiche.

### L'EV (Expected Value)

```
EV = (probabilité calibrée × cote) − 1
```

L'EV exprime le même avantage, mais en rendement attendu par unité misée. Un EV de +8% signifie que, si le modèle a raison en moyenne sur un grand nombre de paris similaires, chaque unité misée rapporte 0.08 unité en espérance — **en moyenne sur la durée, pas sur un pari isolé**.

## Pourquoi il existe un seuil, et pas "n'importe quel EV positif"

En théorie, un EV légèrement positif suffirait à justifier un pari. En pratique, EVCore n'affiche un pick en canal VALUE qu'à partir d'un EV ≥ 8%. Deux raisons à ce choix :

1. **Le modèle n'est jamais parfait.** Une estimation de probabilité comporte toujours une marge d'erreur. Un EV de +2% peut disparaître entièrement si le modèle est simplement légèrement optimiste sur ce match précis — le bruit statistique mange l'avantage.
2. **Le coût de la marge du bookmaker n'est pas symétrique.** Plus l'edge affiché est faible, plus la part de l'avantage apparent qui vient réellement d'une meilleure lecture du match (plutôt que d'un bruit de calcul) devient incertaine.

Un seuil élevé filtre mécaniquement les picks les plus fragiles. C'est un choix de discipline, pas une garantie de gain — voir la dernière section.

## Pourquoi trier par EV brut peut être trompeur

C'est le point le plus contre-intuitif, et le plus documenté dans l'historique d'EVCore : classer les picks du canal VALUE par EV brut décroissant n'est **pas** la meilleure stratégie. Sur les données réelles suivies par EVCore, le classement par **edge calibré** (l'écart de probabilité, pas le rendement brut) tient sur des données hors échantillon là où le tri par EV brut ou par probabilité brute s'effondre.

Pourquoi ? Un EV élevé peut venir de deux origines très différentes :

- une vraie divergence d'analyse entre le modèle et le marché (le cas qu'on veut capter), ou
- une cote anormalement généreuse sur un match à faible probabilité, où la moindre erreur de calibration du modèle est amplifiée par la cote elle-même.

Le classement par edge calibré filtre mieux le deuxième cas. C'est une des raisons pour lesquelles EVCore construit ses classements (Coupon Composer, page Investir) sur des méthodes validées par testing, pas sur l'intuition "plus l'EV est haut, mieux c'est".

## Ce que ce chiffre ne dit pas

- Un EV positif ne garantit pas un gain sur un pari donné — c'est une espérance statistique sur un grand nombre de paris, pas une prédiction individuelle.
- Un canal ou une formule de tri peut rester rentable en moyenne tout en perdant plusieurs paris consécutifs. C'est attendu, pas un signe d'échec du modèle — la leçon sur la bankroll et la variance y revient en détail.
- Aucune performance passée, même documentée, ne constitue une promesse de performance future.

## À retenir

- Edge = écart de probabilité ; EV = rendement attendu par unité misée. Deux angles du même avantage.
- Le seuil (≥8% côté EV pour VALUE) existe pour filtrer les picks trop fragiles pour être fiables, pas pour maximiser le nombre de picks affichés.
- Trier par edge calibré protège mieux contre les cotes trompeuses que trier par EV brut — c'est un choix validé par les données, pas une préférence esthétique.
