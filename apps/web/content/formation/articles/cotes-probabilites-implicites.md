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

Quand un bookmaker affiche une cote de 2.00 sur une victoire, il ne vous dit pas "ça a une chance sur deux d'arriver". Il vous dit "voici le prix auquel j'accepte de prendre le pari en face". Ces deux choses se ressemblent, mais elles ne sont pas identiques — et toute la discipline d'EVCore part de cette distinction.

Pour transformer une cote en probabilité, la formule est simple :

```
probabilité implicite = 1 / cote
```

Une cote de 2.00 correspond donc à une probabilité implicite de 50%. Une cote de 1.50 correspond à 66.7%. Plus la cote est basse, plus le marché considère l'issue comme probable.

## Pourquoi la somme dépasse toujours 100%

Prenez un match à deux issues simples (par exemple, un pari "l'équipe A marque" vs "l'équipe A ne marque pas"). Si le marché était parfaitement équilibré, les deux probabilités implicites devraient faire exactement 100% ensemble. En pratique, elles font presque toujours un peu plus — 104%, 106%, parfois plus sur des marchés moins liquides.

Cet excédent s'appelle la **marge du bookmaker** (ou overround). C'est la commission structurelle du marché : peu importe l'issue, le bookmaker garde un avantage mathématique intégré dans les cotes. Ce n'est pas une erreur de calcul de sa part, c'est le prix de faire tourner l'activité.

Concrètement, cela veut dire qu'une cote "juste" n'existe pas au sens strict — chaque cote intègre déjà une petite pénalité pour le parieur, avant même de parler de la vraie probabilité de l'événement.

## Ce qu'EVCore fait différemment : la probabilité calibrée

La probabilité implicite est une lecture du marché. Ce n'est pas ce qu'EVCore vous montre en premier lieu. Le moteur calcule sa **propre estimation de probabilité** à partir de données historiques (forme des équipes, statistiques xG, historique de confrontations, contexte de la rencontre) — indépendamment de ce que dit la cote.

Cette estimation s'appelle la probabilité calibrée. "Calibrée" signifie qu'elle a été confrontée à des résultats réels : si le modèle annonce 70% de probabilité sur un ensemble de picks, ces picks doivent effectivement se réaliser environ 70% du temps sur un grand nombre d'observations. Une probabilité qui n'est pas calibrée peut sembler précise sans être fiable — c'est toute la différence entre un chiffre qui a l'air sérieux et un chiffre qui tient ses promesses dans la durée.

## Pourquoi cette différence est la seule chose qui compte

Voici le point central de toute la méthode EVCore : **on ne mise jamais sur une probabilité implicite**, on mise sur l'écart entre ce que le modèle estime et ce que le marché affiche. Un exemple simplifié :

|         | Cote affichée | Probabilité implicite | Probabilité calibrée EVCore | Écart     |
| ------- | ------------- | --------------------- | --------------------------- | --------- |
| Match A | 2.20          | 45.5%                 | 45.0%                       | quasi nul |
| Match B | 2.20          | 45.5%                 | 58.0%                       | +12.5 pts |

Sur le Match A, le modèle est d'accord avec le marché : il n'y a rien à exploiter, même si la cote semble intéressante en apparence. Sur le Match B, le modèle estime la probabilité réelle nettement plus haute que ce que la cote implique — c'est cet écart, et seulement lui, qui constitue une opportunité. Ce mécanisme (l'écart entre probabilité calibrée et probabilité implicite) s'appelle l'**edge**, et c'est le sujet de la prochaine leçon.

## À retenir

- Une cote se convertit en probabilité implicite avec `1 / cote`, mais cette probabilité inclut toujours la marge du bookmaker.
- La probabilité calibrée est l'estimation propre du moteur EVCore, confrontée à des résultats réels dans le temps.
- Ce n'est jamais la cote seule, ni la probabilité seule, qui compte — c'est l'écart entre les deux.
