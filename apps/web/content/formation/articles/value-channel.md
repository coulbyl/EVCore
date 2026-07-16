---
title: "Le canal VALUE (Valeur) : ce qui tient vraiment hors échantillon"
category: channels
difficulty: intermediate
order: 2
slug: value-channel
summary: "VALUE est le seul canal qui reste positif sur des données jamais vues par le modèle — mais seulement classé correctement. Voici les chiffres, et pourquoi le classement change tout."
updatedAt: "2026-07-16"
related: ["channels-overview", "ev-probabilites-cotes", "dominant-channel"]
---

## Ce que le canal cherche

VALUE (Valeur) identifie des cotes à valeur attendue positive : des matchs où la probabilité calibrée du moteur dépasse suffisamment la probabilité implicite de la cote (edge et EV définis dans la leçon "L'edge et l'EV"). C'est le canal de mise réelle principal d'EVCore — celui sur lequel l'essentiel de la discipline du produit est construit.

## Les chiffres, datés au 2026-07-16

Deux façons de classer les picks VALUE ont été testées : par edge calibré (l'écart de probabilité), et par probabilité brute. Les résultats divergent radicalement une fois confrontés à des données que le modèle n'a jamais vues à l'entraînement ("hors échantillon", concrètement l'année 2026 dans les tests actuels) :

| Classement                  | ROI tout historique | ROI 2026 (hors échantillon) |
| --------------------------- | ------------------- | --------------------------- |
| **Top 5 par edge calibré**  | +14.98% (295 picks) | **+2.27%**                  |
| Top 5 par probabilité brute | —                   | **−12.70%**                 |

Le classement par edge calibré est, à ce jour, le **seul** classement testé sur l'ensemble des canaux EVCore qui reste positif sur des données hors échantillon. Le classement par probabilité brute, qui semble intuitivement raisonnable ("miser sur ce dont le modèle est le plus sûr"), s'effondre une fois confronté à des données neuves.

## Pourquoi cet écart est si important à comprendre

Ce résultat n'est pas un détail technique — c'est la démonstration concrète de ce qui a été dit dans la leçon sur l'EV : un edge élevé n'a de valeur que s'il reflète une vraie divergence d'analyse, pas juste une cote généreuse sur un match où le modèle est en réalité peu fiable. Le classement par probabilité brute favorise justement les cas où le modèle affiche une grande confiance — y compris quand cette confiance est mal placée. Le classement par edge calibré, lui, filtre mieux ces cas.

C'est pour cette raison que le Coupon Composer et la page Investir n'exposent jamais VALUE "brut" : ils appliquent ce classement testé, pas une intuition de tri.

## Ce que ces chiffres ne disent pas

- 295 picks sur tout l'historique n'est pas un échantillon massif — un chiffre positif sur cette taille reste à confirmer dans la durée, pas déjà acquis pour toujours.
- +2.27% sur 2026 forward est un résultat mesuré, daté, sur une période encore courte à l'échelle d'une saison complète — ce n'est ni négligeable, ni une certitude statistique définitive.
- Aucun de ces chiffres ne prédit le prochain pari. Ce sont des moyennes sur un ensemble, pas des garanties individuelles — voir la leçon sur la bankroll et la variance.

## À retenir

- VALUE bien classé (par edge calibré) est aujourd'hui le seul canal EVCore démontré positif hors échantillon.
- Le classement par probabilité brute, qui semble pourtant logique, échoue sur les mêmes données — la méthode de tri compte autant que le signal lui-même.
- Ce résultat reste un historique daté, jamais une promesse — à réévaluer à chaque nouvel audit.
