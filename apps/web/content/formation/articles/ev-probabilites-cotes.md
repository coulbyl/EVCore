---
title: "L'EV (Expected Value) : la valeur attendue d'un pari"
category: bases
difficulty: beginner
order: 3
readTime: 5
slug: ev-probabilites-cotes
summary: "Ce que mesure l'EV, comment la calculer, et pourquoi une EV positive ne garantit pas de gagner ce soir."
updatedAt: "2026-05-02"
related: ["cotes-probabilites-implicites", "canal-ev", "erreurs-frequentes"]
---

## Pourquoi l'EV et pas "la cote la plus haute" ?

Une cote élevée ne suffit pas — elle peut simplement refléter une issue peu probable. Ce qui compte, c'est l'**écart** entre la probabilité que tu estimes et la probabilité que la cote suppose.

L'EV (Expected Value, ou valeur attendue) mesure cet écart. Si tu pouvais rejouer un pari un grand nombre de fois dans des conditions identiques, l'EV prédit le gain ou la perte **par unité misée, en moyenne**.

## La formule

```
EV = (probabilité estimée × cote) − 1
```

- **Probabilité estimée** : ce que le modèle EVCore calcule (entre 0 et 1).
- **Cote** : le multiplicateur du bookmaker (format décimal).
- **−1** : on soustrait la mise, qui est toujours de 1 unité.

## Exemple

Le modèle estime à 62 % la probabilité d'un résultat. La cote bookmaker est 2.10.

```
EV = (0,62 × 2,10) − 1 = 1,302 − 1 = +0,302
```

EV de **+30,2 %**. Sur 100 paris identiques, tu gagnerais en théorie 30,2 unités de plus que tu n'en mises.

Pour comparaison : si la cote était 1.50 pour la même probabilité estimée à 62 % :

```
EV = (0,62 × 1,50) − 1 = 0,93 − 1 = −0,07
```

EV de **−7 %**. Même si l'issue est probable, le prix est mauvais — le pari est perdant à long terme.

## EV positive ≠ gagner ce soir

C'est le point le plus important.

Un pari avec EV +25 % et probabilité estimée à 55 % **perd 45 % du temps**. Sur 10 paris, tu peux parfaitement en perdre 5 ou 6 — et être statistiquement en bonne voie.

L'EV est une loi des grands nombres. Elle ne prédit pas le résultat du prochain match. Elle dit qu'en jouant des paris EV positifs de façon répétée, le rendement converge vers la valeur attendue sur le long terme.

> Résultat = variance. EV = signal. Les confondre, c'est la principale source de mauvaises décisions.

## Le seuil EVCore

EVCore ne retient un signal que si l'EV est supérieure ou égale à **8 %** (`EV ≥ 0,08`). En dessous, l'écart entre probabilité estimée et cote est trop faible pour être statistiquement fiable après prise en compte des marges et de l'incertitude du modèle.

## Prochaine étape

Maintenant que tu comprends l'EV, tu peux lire comment EVCore l'applique dans chaque canal : `canal-ev`.
