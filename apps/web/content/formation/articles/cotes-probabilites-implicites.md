---
title: "Cote, probabilité implicite, probabilité calibrée"
category: bases
difficulty: beginner
order: 2
slug: cotes-probabilites-implicites
summary: "La distinction qui change tout : ce que le bookmaker affiche n'est pas une prédiction, c'est un prix. Apprenez à lire une cote comme une probabilité, et à voir la différence entre le marché et le modèle."
updatedAt: "2026-07-16"
related: ["ev-probabilites-cotes", "comment-lire-un-pick"]
---

## Une cote n'est pas une prédiction, c'est un prix

Quand un bookmaker affiche 2.00 sur une victoire, il ne prédit rien. Il fixe un prix : le tarif auquel il accepte de prendre le pari en face de vous. La nuance semble petite. Elle change pourtant toute la façon de lire une cote — et c'est le point de départ de la méthode EVCore.

Convertir une cote en probabilité tient en une formule :

```
probabilité implicite = 1 / cote
```

2.00 donne 50%. 1.50 donne 66,7%. Plus la cote descend, plus le marché juge l'issue probable.

## Pourquoi le total dépasse toujours 100%

Prenez un marché à deux issues, par exemple "l'équipe A marque" contre "elle ne marque pas". Sur un marché parfaitement équilibré, les deux probabilités implicites s'additionneraient à 100%. En pratique, elles dépassent presque toujours ce seuil — 104%, 106%, parfois davantage sur les marchés moins liquides.

Cet excédent a un nom : la marge du bookmaker, ou overround. C'est sa commission, intégrée directement dans les cotes plutôt que facturée à part. Rien d'anormal là-dedans, c'est simplement le coût de faire tourner l'activité.

Conséquence concrète : une cote "juste" n'existe pas vraiment. Chaque cote embarque déjà une petite pénalité pour le parieur, avant même de parler de la probabilité réelle de l'événement.

## Ce qu'EVCore ajoute : la probabilité calibrée

La probabilité implicite ne dit qu'une chose : ce que pense le marché. EVCore va chercher autre chose. Le moteur calcule sa propre estimation à partir de données historiques — forme des équipes, xG, confrontations passées, contexte du match — sans se soucier de ce qu'affiche la cote.

On appelle ça la probabilité calibrée. Calibrée veut dire une chose précise : testée contre des résultats réels. Si le modèle annonce 70% sur un ensemble de picks, ces picks doivent se vérifier environ 70% du temps sur un grand nombre d'observations. Une probabilité non calibrée peut sonner juste sans l'être. La calibration, c'est ce qui sépare un chiffre qui a l'air sérieux d'un chiffre qui tient sa parole.

## Le seul écart qui compte

Voici l'idée centrale de la méthode : on ne mise jamais sur une probabilité implicite. On mise sur l'écart entre ce que le modèle estime et ce que le marché affiche. Un exemple simplifié :

|         | Cote affichée | Probabilité implicite | Probabilité calibrée EVCore | Écart     |
| ------- | ------------- | --------------------- | --------------------------- | --------- |
| Match A | 2.20          | 45.5%                 | 45.0%                       | quasi nul |
| Match B | 2.20          | 45.5%                 | 58.0%                       | +12.5 pts |

Sur le Match A, le modèle rejoint l'avis du marché : rien à exploiter, même si la cote paraît attirante. Sur le Match B, il voit une probabilité nettement supérieure à ce que la cote implique. C'est cet écart-là, et lui seul, qui constitue une opportunité. On l'appelle l'edge — sujet de la prochaine leçon.

## À retenir

- `1 / cote` donne la probabilité implicite, mais elle inclut toujours la marge du bookmaker — jamais une lecture neutre du marché.
- La probabilité calibrée est l'estimation propre d'EVCore, vérifiée contre des résultats réels dans la durée.
- Seul l'écart entre les deux compte. Ni la cote seule, ni la probabilité seule.
