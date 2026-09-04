---
title: "Comment lire une fiche EVCore"
category: bases
difficulty: beginner
order: 4
slug: comment-lire-un-pick
summary: "Canal, cote, probabilité, badge de fiabilité : ce que chaque élément d'un pronostic veut dire, et pourquoi certains matchs n'ont volontairement aucun pick."
updatedAt: "2026-09-04"
related: ["cotes-probabilites-implicites", "ev-probabilites-cotes"]
---

## Un pick n'est jamais juste "un conseil"

Une fiche EVCore n'est pas un tip isolé. C'est la sortie d'un calcul, et chaque élément affiché existe pour une raison précise. Savoir la lire, c'est comprendre pourquoi le pick existe — pas seulement ce qu'il recommande.

## Le canal : quel type de décision

Chaque pick appartient à un canal. Son nom n'apparaît pas en badge à côté de chaque pronostic sur la vue Match : la plupart des canaux portent le nom de leur propre marché cible — Score exact cherche un score exact, Remboursé si nul cherche exactement ce marché — donc l'ajouter reviendrait à répéter le même mot deux fois. Le nom du marché, seul, suffit à distinguer deux pronostics qui se ressemblent (deux « Domicile » venant de marchés différents, par exemple, sur la même fiche).

Pour voir _quel_ canal a produit un pronostic précis, ou pour naviguer canal par canal plutôt que match par match, utilisez le sélecteur en haut de la page Decisions (« Match » ou le nom d'un canal). Le canal indique quelle question le moteur a posée au match, pas seulement quelle réponse il a trouvée :

| Famille de canaux                     | Ce qu'ils cherchent                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Issue du match**                    | Qui gagne, ou le nul : victoire affirmée, double chance, remboursé si match nul, gagne sans encaisser |
| **Buts**                              | Plus ou moins de buts, les deux équipes marquent, buts d'une seule équipe, cage inviolée              |
| **Mi-temps**                          | Les mêmes questions sur la première période seule, plus le couple mi-temps / fin de match             |
| **Composites**                        | Deux conditions à la fois — issue et total de buts, issue et « Les deux équipes marquent »            |
| **Filtres** (Valeur, Sécurité)        | Ne cherchent rien eux-mêmes : ils re-sélectionnent parmi les décisions ci-dessus                      |
| **Garde-fous** (Attention, Consensus) | N'émettent pas de pick : ils qualifient ou écartent une décision                                      |

Dix-neuf canaux de marché produisent une décision, répartis dans ces familles — un canal indépendant, Arbitrage, s'y ajoute sur sa propre page. Presque tous sont affichés normalement, y compris ceux dont les résultats mesurés sont mauvais : un canal qui perd n'est pas retiré, il est montré tel quel, avec son badge de fiabilité. Seuls Valeur et Sécurité ne s'affichent pas comme des picks actionnables.

La page Historique vérifiable affiche le résultat mesuré de chaque canal, y compris quand il est mauvais — c'est cette même mesure qui alimente le badge de fiabilité affiché sur chaque pick (voir plus bas).

Une fiche affiche au plus quatre pronostics d'un coup, triés par probabilité décroissante — « Voir N autres marchés » déplie le reste. Au-delà, la fiche deviendrait une liste de données plutôt qu'une lecture.

## Deux labels qui ne sont pas des picks : Consensus, Attention

Ces deux-là n'émettent pas de pari. Ce sont des façons dont le moteur qualifie ou encadre une décision prise ailleurs — rien à voir avec un pronostic misable, même prudent.

Consensus signale que plusieurs canaux indépendants sont arrivés à la même conclusion sur un match. Un badge l'affiche, avec la liste des canaux qui convergent — jamais de marché, de pick ou de probabilité qui lui soient propres. La probabilité d'un consensus serait le **maximum** de celles des canaux d'accord, et le maximum de plusieurs estimations bruitées est optimiste par construction, même si chaque estimation est honnête. L'accord entre canaux est une information réelle ; un pourcentage à côté ne le serait pas.

Le canal Attention est un garde-fou, pas un pick. Il prend deux formes sur la fiche. Un bandeau **Attention**, au-dessus de l'en-tête, quand un canal précis a été écarté à cause d'un écart jugé trop important entre le modèle et le marché — l'écart en points s'affiche à côté. Et un bandeau **Données suspectes**, plus large, quand le désaccord est jugé si extrême que le moteur exclut automatiquement toutes les décisions du match, pas seulement un canal.

Ne traitez pas ces bandeaux comme des erreurs à ignorer. Ils font exactement ce pour quoi ils existent : vous éviter un pick sur un match où le modèle lui-même n'a pas confiance dans ses données.

## Un pick à part : Score exact

Contrairement à Consensus et Attention, Score exact affiche un vrai pick sur la fiche — un score exact (« 1:1 », par exemple), avec sa propre probabilité et sa propre cote, comme n'importe quel autre canal. Ce qui le distingue, ce n'est pas l'absence de pick : c'est qu'il n'a jamais été misé. C'est le canal le plus faible du système sur les résultats réglés — une information sur la façon dont le modèle voit le match, pas une recommandation à suivre.

Sa prudence est d'une autre nature que celle des canaux Les deux équipes marquent ou Buts, qui restent affichés et actionnables malgré des résultats mesurés négatifs sur un historique conséquent. Score exact, lui, est simplement trop récent pour être jugé sur un historique solide : considérez ses picks comme une information, pas comme une recommandation.

## Les chiffres à lire ensemble

Sur chaque pronostic figurent la cote et une probabilité — jamais l'une sans l'autre. Une cote seule se lit comme une promesse.

- **La cote** : le prix affiché par le bookmaker.
- **La probabilité** : ce que le moteur estime, indépendamment du marché. C'est la sortie brute du modèle, sans retouche, la même pour tous les canaux — y compris ceux qu'on ne joue pas.
- **Le badge de fiabilité** (Fiable / À surveiller / Peu fiable) : la mesure historique de ce canal, sur cette compétition précise — sa réussite réelle comparée à ce qu'il annonçait, sur les paris déjà réglés. Un tap ou un survol du badge affiche le détail en une phrase.

Un edge élevé (l'écart entre cote et probabilité) n'est pas un bon signe. Il indique surtout que le modèle et le bookmaker sont en désaccord, et le bookmaker a raison la plupart du temps. La fiabilité mesurée sur l'historique réel du canal est l'indicateur à retenir ; c'est la probabilité qui classe les pronostics dans toute l'app, jamais l'écart.

## Pourquoi certains matchs n'ont aucun pick

La majorité des matchs analysés ne produisent aucun pick misable, sur aucun canal — un point volontairement peu visible mais essentiel de la discipline EVCore. Ce n'est ni un bug ni un manque de données : c'est le résultat attendu d'un seuil qui filtre plus qu'il ne propose. Les raisons les plus courantes, quand elles s'affichent :

- **Score sous le seuil** — le modèle n'a pas assez de conviction sur ce match
- **Aucun pick viable** — aucune issue ne dépasse le seuil d'edge ou d'EV
- **Mouvement de cote défavorable** — la cote a bougé contre le pick entre l'analyse et l'affichage
- **Marge insuffisante** — l'écart existe mais reste trop fin pour être fiable
- **Divergence extrême** — l'écart est si large qu'une erreur de données est jugée plus probable qu'une vraie opportunité (canal Attention)

Un jour sans pick sur un match qui vous intéresse n'est pas un manque de service. C'est le filtre qui fonctionne. Le nombre de picks n'a jamais été l'objectif — leur qualité l'est.

## À retenir

- Le canal dit quelle question a été posée au match, pas seulement la réponse trouvée ; son nom n'apparaît pas en badge sur chaque pronostic, le nom du marché suffit à les distinguer.
- La cote ne se lit jamais sans sa probabilité : c'est la sortie brute du modèle, sans retouche.
- Le badge de fiabilité (Fiable / À surveiller / Peu fiable) est la mesure réelle du canal sur cette compétition — pas une estimation.
- Consensus signale un accord et Attention protège — ni l'un ni l'autre n'émet de pari. Score exact, lui, émet un vrai pick ; il n'est simplement jamais misé.
- L'absence de pick est un résultat normal du filtre, pas un défaut.
