---
title: "Les canaux EVCore : une carte, pas un catalogue"
category: channels
difficulty: intermediate
order: 1
slug: channels-overview
summary: "Tous les canaux ne se valent pas, et EVCore ne le cache jamais. Voici l'état réel de chaque canal — ce qui tient sur des données jamais vues par le modèle, et ce qui reste à l'état de signal."
updatedAt: "2026-07-28"
related:
  [
    "value-channel",
    "safe-channel",
    "dominant-channel",
    "draw-channel",
    "btts-channel",
    "team-total-channel",
    "goals-channel",
  ]
---

## Pourquoi cette leçon existe

EVCore produit des picks sur sept canaux : VALUE (Valeur), SAFE (Sécurité), DOMINANT (Victoire), DRAW (Nul), BTTS (BB), TEAM_TOTAL, GOALS (Buts). Le plus simple serait de les présenter comme sept variantes équivalentes du même produit — sept façons de gagner. Ce ne serait pas honnête, et ce n'est pas ce qu'EVCore fait.

Chaque canal a été confronté à des données qu'il n'a jamais vues à l'entraînement — des paris "hors échantillon", postérieurs à la période utilisée pour calibrer le modèle. Certains tiennent cette épreuve. D'autres pas encore, ou pas sur toutes les méthodes de classement testées, ou seulement sur une partie des championnats. Cette leçon sert de carte avant d'entrer dans le détail canal par canal.

## L'état réel, au dernier audit (2026-07-28)

| Canal                   | Ce qu'il cherche                                  | Statut réel                                                                                                                 |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **VALUE** (Valeur)      | Cotes à valeur attendue positive                  | Le canal le plus solide hors échantillon : +9.71% ROI sur 1 333 sélections réglées                                          |
| **DRAW** (Nul)          | Match nul, via la probabilité implicite du marché | Rentable et confirmé sur gros volume : +5.35% ROI sur 4 110 sélections                                                      |
| **TEAM_TOTAL**          | Buts d'une seule équipe, plus ou moins une ligne  | Signal net (+3.40% ROI, hit 62.1%) mais tout juste activé — seulement 9 jours d'historique, à surveiller de près            |
| **BTTS** (BB)           | Les deux équipes marquent                         | Rentable, mais seulement sur Premier League/Bundesliga/Serie A (+2.6% à +5.2%) — négatif sur les autres championnats testés |
| **SAFE** (Sécurité)     | Sélections prudentes, rendement régulier          | Quasi neutre (+0.23% ROI) — sert de stabilisateur plus que de moteur de gain                                                |
| **DOMINANT** (Victoire) | Angle le plus affirmé sur l'issue du match        | Le canal brut reste légèrement négatif (−1.38%) — mais bien classé (top 5 du jour), une partie redevient rentable           |
| **GOALS** (Buts)        | Plus ou moins de buts                             | Pas rentable sur aucun classement testé à ce jour — −5.39% ROI sur 15 685 sélections, le plus gros échantillon d'EVCore     |

Un canal peut progresser, comme DRAW et BTTS l'ont fait, ou régresser si le marché change. Cette table sera revue à chaque nouvel audit. Aucune ligne n'est une promesse pour l'avenir — juste une photographie datée.

## Ce que cette formation répète le plus : le classement compte plus que le canal

DOMINANT en est la preuve la plus nette. Sur la période testée, le canal complet perd de l'argent. Mais ses 5 meilleurs picks du jour, classés par probabilité, redeviennent rentables — jour après jour. Ni coïncidence, ni tour de passe-passe statistique : c'est exactement le principe du Coupon Composer et de la page Investir. Ne pas montrer tout ce que le modèle produit. Sélectionner ce qui a démontré tenir la route.

TEAM_TOTAL illustre la même idée sous un autre angle : trié par probabilité brute, il serait négatif ; trié par edge calibré, il devient fortement positif. Et BTTS montre qu'un bon découpage géographique peut avoir le même effet qu'un bon classement — voir la leçon dédiée à chacun de ces deux canaux.

C'est pour ça qu'EVCore ne vend jamais un "accès à un canal" comme produit fini. Ce qui a de la valeur, c'est le résultat d'un classement (et, pour BTTS, d'un découpage) testé — la curation — pas le flux brut derrière.

## Ce que cette carte n'est pas

Elle ne garantit aucun résultat futur, sur aucun canal, VALUE compris. Elle ne dit pas non plus que GOALS est inutile : ce signal nourrit d'autres décisions en coulisse — la page Investir, par exemple, exclut certains picks GOALS qui contredisent le reste du modèle. Simplement, on ne le vend pas comme un edge démontré, parce qu'il ne l'est pas.

Et elle change avec le temps. DRAW était nettement plus faible il y a deux ans qu'aujourd'hui, et BTTS n'était pas misé du tout avant le 2026-07-28. La discipline, c'est suivre ces chiffres dans la durée — pas les figer une fois pour toutes.

## À retenir

- Tous les canaux n'ont pas le même niveau de preuve, et la formation ne le cache jamais.
- VALUE et DRAW sont les canaux les plus solides aujourd'hui ; TEAM_TOTAL et BTTS viennent d'être promus (le second avec une restriction géographique) ; GOALS reste un signal, pas un edge.
- Le classement — ou, pour BTTS, le découpage par championnat — fait souvent plus la différence que le signal brut.
