---
title: "Canal NUL : prédire les matchs nuls"
category: bases
difficulty: intermediate
order: 8
readTime: 4
slug: canal-draw
summary: "Le Canal NUL cible les matchs nuls. Il est actuellement peu actif en raison d'une limite du modèle Poisson — voici pourquoi et ce que ça change pour toi."
updatedAt: "2026-05-03"
related: ["canal-btts", "canal-confiance", "les-3-canaux"]
---

## Ce que le Canal NUL prédit

Le Canal NUL cible les matchs dont l'issue la plus probable est un match nul. Quand la probabilité de nul estimée par le moteur dépasse le seuil calibré pour la ligue, un signal NUL est émis.

Le pick affiche :

- le **marché** — 1N2, issue Nul
- la **probabilité estimée** — ex. 34 %
- un **indicateur de résultat** une fois le match terminé

## Pourquoi le badge NUL est rare

Le modèle Poisson utilisé par EVCore a une limite structurelle sur les nuls.

Pour des équipes avec des statistiques offensives typiques (1.2 à 1.8 buts par match), la probabilité de nul calculée par Poisson ne dépasse jamais 0.30–0.32. Autrement dit, le modèle ne produit jamais de match "très probablement nul" — il dit juste que certains matchs ont 27 % ou 29 % de probabilité de nul.

Le problème : quand on sélectionne les matchs à 29 % de probabilité de nul et qu'on vérifie les résultats, on obtient ~27 % de nuls réels. Le signal ne fait pas mieux que la moyenne de la ligue.

**Ce que Poisson ignore** :

- Les nuls tactiques (équipe qui gère un résultat d'aller-retour)
- La sur-représentation statistique des scores 0-0 et 1-1 par rapport au modèle de base
- L'historique entre les deux équipes (certains duels ont un taux de nul systématiquement élevé)
- Les cotes bookmaker, qui intègrent ces informations contextuelles

Ce n'est pas un problème de calibration — baisser ou monter le seuil ne change pas le hit rate. C'est une limite du modèle lui-même.

## Ce que ça veut dire pour toi

Sur la plupart des ligues, le badge NUL n'apparaîtra pas ou apparaîtra très rarement. Ce n'est pas un bug — c'est le moteur qui ne produit pas de signal faute de conviction suffisante.

Si tu cherches à jouer les nuls, les canaux EV et SV peuvent déjà produire des picks sur le marché 1N2 avec l'issue Nul quand il existe une valeur dans la cote. La différence : EV/SV comparent la probabilité estimée à la cote, le Canal NUL ne regarde que la probabilité.

## Évolution prévue

Le Canal NUL sera amélioré dans une prochaine version. Les pistes envisagées :

- **Correction Dixon-Coles** — Un paramètre de correction qui sur-pondère les scores 0-0 et 1-1 dans le modèle de probabilité, corrigeant la limite Poisson pour les faibles scores
- **Signal bookmaker** — Quand la cote de nul chez plusieurs bookmakers est inférieure à 3.20, le marché intègre un signal tactique que le modèle statistique seul ne voit pas
- **Historique H2H** — Le taux de nul historique sur les affrontements entre deux équipes spécifiques

En attendant, le Canal NUL reste en veille sur la majorité des ligues.

## Erreurs fréquentes

**Penser que les nuls sont rares** — Les nuls représentent environ 25–30 % des résultats dans la plupart des championnats. Ils sont fréquents ; le problème est que le modèle n'arrive pas à les isoler a priori mieux que le hasard.

**Croire qu'un seuil bas suffit** — Baisser le seuil de détection à 0.20 ou 0.22 inclut presque tous les matchs de la ligue. Le hit rate ne monte pas : on sélectionne plus de matchs avec le même taux de nul que la moyenne générale.

**Attendre le badge NUL sur toutes les ligues** — Le canal est actif uniquement sur les ligues où un signal validé existe. La plupart des ligues n'ont pas de seuil actif pour ce canal.

## À retenir

- Canal NUL = probabilité de nul dépasse le seuil calibré pour la ligue
- Rarement actif — limite structurelle du modèle Poisson pour les nuls
- Pas un bug : le moteur préfère ne rien produire plutôt que de produire un signal non fiable
- Le canal EV/SV peut déjà inclure des picks Nul quand la cote est sous-évaluée
- Une amélioration Dixon-Coles est prévue pour rendre ce canal plus fiable

## Pour aller plus loin

- Découvrir les autres canaux : `les-3-canaux`
- Le Canal BB (But-But) : `canal-btts`
- Le Canal Confiance pour V1/V2 : `canal-confiance`
