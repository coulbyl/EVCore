---
title: "Canal BB : les deux équipes marquent"
category: bases
difficulty: beginner
order: 7
readTime: 4
slug: canal-btts
summary: "Le Canal BB prédit les matchs où les deux équipes vont marquer. Un signal indépendant du résultat final, calibré ligue par ligue."
updatedAt: "2026-05-03"
related:
  ["canal-confiance", "canal-draw", "les-3-canaux", "comment-lire-un-pick"]
---

## Ce que le Canal BB prédit

BB signifie **But-But** (les deux équipes marquent). Pour chaque match analysé, le moteur calcule la probabilité que les deux équipes inscrivent au moins un but. Quand cette probabilité dépasse le seuil calibré pour la ligue, un signal BB est émis.

Le pick affiche :

- le **marché** — BB Oui
- la **probabilité estimée** — ex. 62 %
- un **indicateur de résultat** une fois le match terminé

## Pourquoi c'est un signal indépendant

Le Canal BB ne regarde pas qui gagne. Il répond à une seule question : "Les deux équipes vont-elles marquer ?"

Ce signal coexiste avec les autres canaux. Un match peut avoir simultanément un pick CONF (V1 probable) et un pick BB — les deux sont valides en même temps et répondent à des questions différentes.

C'est aussi un signal qui fonctionne sans cote. Le moteur n'a pas besoin de comparer une probabilité estimée à un prix bookmaker : il signale dès que la probabilité BB dépasse le seuil.

## Comment le moteur calcule la probabilité BB

Le moteur s'appuie sur un modèle Poisson. À partir des statistiques offensives et défensives récentes de chaque équipe, il calcule deux distributions de buts indépendantes (domicile et extérieur) puis en déduit la probabilité que **les deux valeurs soient supérieures à zéro**.

En pratique, les ligues très offensives ont des probabilités BB naturellement élevées (55–70 %), tandis que les ligues défensives restent autour de 45–55 %.

## Pourquoi le seuil varie selon la ligue

Le seuil BB est calibré indépendamment pour chaque ligue par backtest. Un seuil de 0.62 en MLS ou NOR1 n'a pas la même signification qu'un seuil de 0.52 en Série A — les niveaux offensifs de base sont différents.

**Conséquence pratique** : le badge BB n'apparaît que sur les ligues validées. Sur une ligue sans calibration BB, le moteur ne produit pas de signal, même si la probabilité estimée est élevée.

## Lire le signal BB dans l'app

Le pick BB apparaît avec un badge orange `BB`. Comme les autres picks, il est placeable depuis la page **Picks du jour** ou la page **Matchs**.

## Erreurs fréquentes

**Confondre BB Oui avec "match ouvert"** — Un match peut finir 1-0 avec BB Oui validé (1 équipe a marqué, mais pas les deux). Le signal prédit spécifiquement que les deux équipes marquent, pas que le match sera prolifique.

**Supposer que BB = score élevé** — Un score 1-1 valide le BB Oui. Un score 3-0 ne le valide pas. Le canal répond à une question binaire : chaque équipe a-t-elle au moins un but ?

**Ignorer la ligue** — Le canal BB n'est pas actif sur toutes les ligues. Si le badge BB n'apparaît pas dans tes filtres, c'est que la ligue n'a pas de seuil validé.

## À retenir

- BB = les deux équipes marquent au moins un but
- Signal indépendant du résultat et de la cote
- Seuil calibré par ligue — ne fonctionne que sur les ligues validées
- Peut coexister avec un signal CONF ou EV sur le même match
- Chercher le badge orange `BB` dans la page Picks du jour

## Pour aller plus loin

- Découvrir les autres canaux : `les-3-canaux`
- Comprendre le Canal Confiance : `canal-confiance`
- Lire un pick dans l'app : `comment-lire-un-pick`
