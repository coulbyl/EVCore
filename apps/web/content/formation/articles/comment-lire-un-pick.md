---
title: "Comment lire une fiche EVCore"
category: bases
difficulty: beginner
order: 4
slug: comment-lire-un-pick
summary: "Canal, cote, probabilité, raison de décision : ce que chaque élément d'un pronostic veut dire, pourquoi le même pronostic n'affiche pas le même pourcentage sur Decisions et sur Investir, et pourquoi certains matchs n'ont volontairement aucun pick."
updatedAt: "2026-08-22"
related: ["cotes-probabilites-implicites", "ev-probabilites-cotes"]
---

## Un pick n'est jamais juste "un conseil"

Une fiche EVCore n'est pas un tip isolé. C'est la sortie d'un calcul, et chaque élément affiché existe pour une raison précise. Savoir la lire, c'est comprendre pourquoi le pick existe — pas seulement ce qu'il recommande.

## Le canal : quel type de décision

Chaque pick appartient à un canal, affiché en badge. Le canal indique quelle question le moteur a posée au match, pas seulement quelle réponse il a trouvée :

| Famille de canaux                     | Ce qu'ils cherchent                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Issue du match**                    | Qui gagne, ou le nul : victoire affirmée, double chance, remboursé si nul, gagne sans encaisser |
| **Buts**                              | Plus ou moins de buts, les deux équipes marquent, buts d'une seule équipe, cage inviolée        |
| **Mi-temps**                          | Les mêmes questions sur la première période seule, plus le couple mi-temps / fin de match       |
| **Composites**                        | Deux conditions à la fois — issue et total de buts, issue et « les deux marquent »              |
| **Filtres** (Valeur, Sécurité)        | Ne cherchent rien eux-mêmes : ils re-sélectionnent parmi les décisions ci-dessus                |
| **Garde-fous** (Attention, Consensus) | N'émettent pas de pick : ils qualifient ou écartent une décision                                |

Dix-neuf canaux produisent une décision, répartis dans ces familles. **Deux seulement sont assumés à ce jour** — ceux dont l'avantage résiste au bruit d'échantillonnage. Les autres sont calculés, réglés, affichés, et rangés en observation.

Cette hiérarchie n'est jamais maquillée : dans la vue « En observation » d'Investir, chaque pick porte le résultat mesuré de son canal, y compris quand il est mauvais. La leçon dédiée aux canaux explique comment elle se construit.

## Trois labels qui ne sont pas des picks : CONSENSUS, AVOID, CORRECT_SCORE

Ces trois-là n'émettent pas de pari. Ce sont des façons dont le moteur qualifie ou encadre une décision prise ailleurs.

CONSENSUS signale que plusieurs canaux indépendants sont arrivés à la même conclusion sur un match. Un badge l'affiche, avec la liste des canaux qui convergent.

Une précision qui vaut d'être connue : CONSENSUS publiait autrefois son propre pick, avec sa propre probabilité. Il a cessé, pour une raison instructive. Sa probabilité était le **maximum** de celles des canaux d'accord — et le maximum de plusieurs estimations bruitées est optimiste par construction, même si chaque estimation est honnête. Il annonçait donc systématiquement plus qu'il ne réalisait, davantage que les canaux qu'il agrégeait. L'accord entre canaux est une information réelle ; le chiffre qu'on y accrochait ne l'était pas.

AVOID est un garde-fou, pas un pick. Il prend deux formes sur la fiche. Un bandeau **Attention**, au-dessus de l'en-tête, quand un canal précis a été écarté à cause d'un écart jugé trop important entre le modèle et le marché — l'écart en points s'affiche à côté. Et un bandeau **Données suspectes**, plus large, quand le désaccord est jugé si extrême que le moteur exclut automatiquement toutes les décisions du match, pas seulement un canal.

Ne traitez pas ces bandeaux comme des erreurs à ignorer. Ils font exactement ce pour quoi ils existent : vous éviter un pick sur un match où le modèle lui-même n'a pas confiance dans ses données.

CORRECT_SCORE, enfin, affiche le score exact jugé le plus probable. C'est le canal le plus faible du système sur les résultats réglés, et il n'a jamais été misé : une information sur la façon dont le modèle voit le match, pas une recommandation.

Sa prudence n'a pourtant rien à voir avec celle de BTTS ou GOALS. Ces deux-là restent en observation parce que leurs chiffres, testés sur un historique conséquent, sont négatifs. CORRECT_SCORE, lui, est simplement trop récent pour être jugé : le canal existe depuis le 1er juillet 2026, contre plusieurs mois pour VALUE, SAFE, DRAW et BTTS. Ses premiers chiffres sont même prometteurs, mais deux semaines sur une seule compétition ne font pas un historique. Il sera réévalué avec du recul, comme DRAW l'a été avant lui.

## Les chiffres à lire ensemble

Sur chaque pronostic figurent la cote et une probabilité — jamais l'une sans l'autre. Une cote seule se lit comme une promesse.

- **La cote** : le prix affiché par le bookmaker.
- **La probabilité** : ce que le moteur estime, indépendamment du marché.
- **L'edge ou l'EV** : l'écart entre les deux. Affiché à titre indicatif, il ne classe rien — la leçon précédente explique pourquoi.

Contrairement à ce que l'intuition suggère, un gros écart avec le marché n'est pas un bon signe. Il indique surtout que le modèle et le bookmaker sont en désaccord, et le bookmaker a raison la plupart du temps. C'est la probabilité qui classe les pronostics dans toute l'app, jamais l'écart.

### Pourquoi le même pronostic n'affiche pas le même pourcentage partout

Ce n'est pas un bug, et c'est utile à comprendre.

**Decisions** montre la **sortie brute du modèle**. C'est la page « qu'a décidé chaque canal » : elle affiche ce que le moteur a calculé, sans retouche, y compris pour les canaux qu'on ne joue pas.

**Investir** montre la **probabilité calibrée**. Chaque canal a une tendance mesurée à sur-estimer ou sous-estimer ses chances, mesurée sur son historique réglé, et cette correction est appliquée avant affichage. Quand l'écart avec le brut dépasse deux points, Investir affiche aussi la valeur d'origine, étiquetée « Modèle brut ».

Sur les canaux les plus sur-confiants, l'écart entre les deux pages peut atteindre plusieurs points. **C'est la valeur d'Investir qu'il faut retenir pour décider** : c'est celle qui a été confrontée aux résultats réels.

## Pourquoi certains matchs n'ont aucun pick

La majorité des matchs analysés ne produisent aucun pick misable, sur aucun canal — un point volontairement peu visible mais essentiel de la discipline EVCore. Ce n'est ni un bug ni un manque de données : c'est le résultat attendu d'un seuil qui filtre plus qu'il ne propose. Les raisons les plus courantes, quand elles s'affichent :

- **Score sous le seuil** — le modèle n'a pas assez de conviction sur ce match
- **Aucun pick viable** — aucune issue ne dépasse le seuil d'edge ou d'EV
- **Mouvement de cote défavorable** — la cote a bougé contre le pick entre l'analyse et l'affichage
- **Marge insuffisante** — l'écart existe mais reste trop fin pour être fiable
- **Divergence extrême** — l'écart est si large qu'une erreur de données est jugée plus probable qu'une vraie opportunité (canal Attention)

Un jour sans pick sur un match qui vous intéresse n'est pas un manque de service. C'est le filtre qui fonctionne. Le nombre de picks n'a jamais été l'objectif — leur qualité l'est.

## À retenir

- Le canal dit quelle question a été posée au match, pas seulement la réponse trouvée.
- La cote ne se lit jamais sans sa probabilité. Decisions affiche le modèle brut, Investir la valeur calibrée — c'est cette dernière qui sert à décider.
- CONSENSUS signale un accord, AVOID protège, CORRECT_SCORE informe — aucun des trois n'émet de pari.
- L'absence de pick est un résultat normal du filtre, pas un défaut.
