---
title: "Les canaux EVCore : une carte, pas un catalogue"
category: channels
difficulty: intermediate
order: 1
slug: channels-overview
summary: "Tous les canaux ne se valent pas, et EVCore ne le cache jamais. Voici l'état réel de chaque canal — ce qui tient sur des données jamais vues par le modèle, et ce qui reste à l'état de signal."
updatedAt: "2026-07-16"
related:
  [
    "value-channel",
    "safe-channel",
    "dominant-channel",
    "draw-channel",
    "btts-channel",
  ]
---

## Pourquoi cette leçon existe

EVCore produit des picks sur plusieurs canaux : VALUE (Valeur), SAFE (Sécurité), DOMINANT (Victoire), DRAW (Nul), BTTS (BB), GOALS (Buts). Il serait facile de les présenter comme six variantes équivalentes d'un même produit — six façons de gagner. Ce ne serait pas honnête, et ce n'est pas ce qu'EVCore fait.

Chaque canal a été confronté à des données qu'il n'a jamais vues à l'entraînement (des paris "hors échantillon", c'est-à-dire postérieurs aux données utilisées pour calibrer le modèle). Certains canaux tiennent cette épreuve. D'autres non — pas encore, ou pas sur toutes les méthodes de classement testées. Cette leçon est la carte honnête de qui fait quoi, avant de rentrer dans le détail de chaque canal.

## L'état réel, au dernier audit (2026-07-16)

| Canal        | Ce qu'il cherche                                  | Statut réel                                                                                                       |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **VALUE** (Valeur)    | Cotes à valeur attendue positive                  | Le seul canal qui reste positif hors échantillon, à condition d'utiliser le bon classement (voir la leçon dédiée) |
| **SAFE** (Sécurité)     | Sélections prudentes, rendement régulier          | Prometteur, mais échantillon encore trop fin pour figer une formule                                               |
| **DOMINANT** (Victoire) | Angle le plus affirmé sur l'issue du match        | Le canal brut perd de l'argent — mais bien classé, une partie redevient rentable                                  |
| **DRAW** (Nul)     | Match nul, via la probabilité implicite du marché | En amélioration réelle et mesurable, pas encore au niveau de VALUE                                                |
| **BTTS** (BB)     | Les deux équipes marquent                         | Pas rentable sur aucun classement testé à ce jour                                                                 |
| **GOALS** (Buts)    | Plus ou moins de buts                             | Pas rentable sur aucun classement testé à ce jour                                                                 |

Cette table sera revue à chaque nouvel audit de calibration — un canal peut progresser (comme DRAW l'a fait) ou régresser si le marché change. Aucune ligne de ce tableau n'est une promesse pour l'avenir : c'est une photographie datée, pas un contrat.

## Le point le plus important de toute cette formation

**Le classement compte souvent plus que le canal lui-même.** DOMINANT en est la preuve la plus nette : le canal complet perd de l'argent sur la période testée, mais ses 5 meilleurs picks par probabilité, chaque jour, redeviennent rentables. Ce n'est pas une coïncidence ni un tour de passe-passe statistique — c'est le principe même du Coupon Composer et de la page Investir : ne pas montrer tout ce que le modèle produit, mais sélectionner ce qui a démontré tenir la route.

C'est pour cette raison qu'EVCore ne vend jamais un "accès à un canal" comme un produit fini. Ce qui est vendu, c'est le résultat d'un classement testé — la curation — pas le flux brut derrière.

## Ce que cette carte n'est pas

- Elle ne garantit aucun résultat futur, sur aucun canal, y compris VALUE.
- Elle ne signifie pas que BTTS et GOALS sont inutiles — ce sont des signaux qui nourrissent parfois d'autres décisions (par exemple, la page Investir exclut certains picks GOALS qui contredisent le reste du modèle). Ils ne sont simplement pas vendus comme un edge démontré, parce qu'ils ne le sont pas.
- Elle change avec le temps. Un canal comme DRAW était nettement moins solide il y a deux ans qu'aujourd'hui. La discipline consiste à suivre ces chiffres dans la durée, pas à les figer une fois pour toutes.

## À retenir

- Tous les canaux EVCore ne sont pas au même niveau de preuve — la fiche ne le cache jamais, la formation non plus.
- VALUE (bien classé) est aujourd'hui le seul canal démontré hors échantillon ; DOMINANT et DRAW progressent ; BTTS et GOALS restent des signaux, pas des canaux à edge prouvé.
- Le classement (comment on choisit _lesquels_ picks montrer) est souvent ce qui fait la différence entre un canal qui perd et un canal qui tient — pas le signal brut seul.
