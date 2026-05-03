---
title: "Lire une cote : probabilité implicite et marge bookmaker"
category: bases
difficulty: beginner
order: 2
readTime: 5
slug: cotes-probabilites-implicites
summary: "Ce qu'une cote exprime vraiment, comment calculer la probabilité cachée derrière, et pourquoi la marge bookmaker biaise tout."
updatedAt: "2026-05-02"
related: ["ev-probabilites-cotes", "canal-ev", "erreurs-frequentes"]
---

## Une cote n'est pas une vérité

Une cote décrit un **prix**, pas une probabilité objective. Le bookmaker la fixe pour attirer les mises de deux côtés tout en gardant une marge — pas pour refléter fidèlement ce qui va se passer.

EVCore compare en permanence ce que **le modèle pense** (probabilité estimée) avec ce que **le marché paie** (probabilité implicite de la cote). Comprendre cette conversion est indispensable pour lire un pick.

## La cote décimale, simplement

En format décimal (celui utilisé par EVCore) :

- Cote `2.00` : si tu mises 1 et que tu gagnes, tu récupères 2 en tout — soit un gain net de 1.
- Cote `1.50` : tu récupères 1.50 — gain net de 0.50.
- Cote `3.00` : tu récupères 3 — gain net de 2.

## La probabilité implicite

La probabilité implicite est la probabilité que la cote suppose pour être "neutre" (ni gagnante ni perdante pour le bookmaker, avant marge).

```
probabilité implicite = 1 ÷ cote
```

Exemples :

| Cote | Probabilité implicite |
| ---- | --------------------- |
| 2.00 | 50 %                  |
| 2.50 | 40 %                  |
| 1.80 | 55,6 %                |
| 4.00 | 25 %                  |

## La marge bookmaker (la "vig")

Sur un marché 1N2 (domicile / nul / extérieur), la somme des probabilités implicites dépasse toujours 100 %. L'excédent, c'est la marge.

Exemple réel :

| Issue     | Cote | Probabilité implicite |
| --------- | ---- | --------------------- |
| Domicile  | 2.10 | 47,6 %                |
| Nul       | 3.40 | 29,4 %                |
| Extérieur | 3.60 | 27,8 %                |
| **Total** |      | **104,8 %**           |

La marge est ici de **4,8 %**. C'est la part que le bookmaker prélève en moyenne sur chaque euro misé.

Conséquence directe : la probabilité implicite **sur-estime** légèrement la probabilité réelle de chaque issue. Pour qu'un pari soit rentable à long terme, ton estimation doit dépasser cette probabilité implicite d'une marge suffisante — c'est exactement ce que mesure l'EV.

## Ce qu'il faut retenir

- Une cote = un prix, pas une certitude.
- `1 ÷ cote` donne la probabilité implicite.
- La somme des probabilités implicites d'un marché est toujours supérieure à 100 % : c'est la marge.
- Battre le bookmaker, c'est trouver des cotes dont la probabilité implicite est inférieure à la probabilité réelle.

## Prochaine étape

Maintenant que tu sais lire une cote, tu peux comprendre ce qu'EVCore calcule : `ev-probabilites-cotes`.
