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

VALUE identifie des cotes à valeur attendue positive : des matchs où la probabilité calibrée du moteur dépasse suffisamment la probabilité implicite de la cote. L'edge et l'EV sont définis dans la leçon "L'edge et l'EV" — VALUE en est l'application directe. C'est le canal de mise réelle principal d'EVCore, celui qui porte l'essentiel de la discipline du produit.

## Les chiffres, datés au 2026-07-16

Deux classements ont été testés sur les picks VALUE : par edge calibré (l'écart de probabilité) et par probabilité brute. Les résultats divergent radicalement une fois confrontés à des données que le modèle n'a jamais vues à l'entraînement — l'année 2026 dans les tests actuels :

| Classement | ROI tout historique | ROI 2026 (hors échantillon) |
| ---------- | -------------------- | ----------------------------- |
| **Top 5 par edge calibré** | +14.98% (295 picks) | **+2.27%** |
| Top 5 par probabilité brute | — | **−12.70%** |

À ce jour, le classement par edge calibré est le seul, sur l'ensemble des canaux EVCore, qui reste positif sur des données hors échantillon.

## Pourquoi cet écart est aussi parlant

Un edge élevé n'a de valeur que s'il reflète une vraie divergence d'analyse — pas une simple cote généreuse sur un match où le modèle se trompe. Le classement par probabilité brute favorise justement les cas où le modèle affiche une grande confiance, y compris mal placée. Celui par edge calibré filtre mieux ces cas. Le Coupon Composer et la page Investir appliquent donc toujours ce classement testé, jamais une intuition de tri.

## Ce que ces chiffres ne disent pas

295 picks sur tout l'historique, ce n'est pas un échantillon massif — un résultat positif à cette échelle mérite d'être confirmé dans la durée, pas déjà considéré comme acquis. Et +2.27% sur 2026 forward reste une période courte à l'échelle d'une saison complète : ni négligeable, ni une certitude statistique définitive. Aucun de ces chiffres ne prédit le prochain pari — ce sont des moyennes sur un ensemble, pas des garanties individuelles.

## À retenir

- VALUE bien classé, par edge calibré, est aujourd'hui le seul canal EVCore démontré positif hors échantillon.
- Le classement par probabilité brute, pourtant intuitif, échoue sur les mêmes données — la méthode de tri compte autant que le signal.
- Un historique daté, jamais une promesse — à réévaluer à chaque nouvel audit.
