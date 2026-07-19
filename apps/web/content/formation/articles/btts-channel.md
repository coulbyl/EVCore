---
title: "BTTS (BB) et GOALS (Buts) : des signaux d'exploration, pas un edge prouvé"
category: channels
difficulty: intermediate
order: 6
slug: btts-channel
summary: "Ces deux canaux à fort volume ne sont rentables sur aucun classement testé à ce jour. Ce n'est pas caché, et ce n'est pas anodin : voici ce qu'ils sont réellement, et pourquoi EVCore refuse de les vendre comme un edge."
updatedAt: "2026-07-16"
related: ["channels-overview", "value-channel", "dominant-channel"]
---

## Ce que ces canaux cherchent

BTTS (Both Teams To Score) identifie les matchs où le modèle juge probable que les deux équipes marquent. GOALS identifie une direction sur le total de buts, plus ou moins une ligne donnée. Deux marchés à très fort volume dans le secteur des paris sportifs, calculés à chaque match analysé.

## Le chiffre, sans détour

Contrairement à VALUE, DOMINANT ou DRAW, aucune méthode de classement testée à ce jour ne rend BTTS ou GOALS rentables :

| Canal | ROI du canal complet |
| ----- | -------------------- |
| BTTS  | **−37.22%**          |
| GOALS | **−26.05%**          |

Ces chiffres ne sont pas des résultats provisoires en attente d'une meilleure formule de tri. Aucun classement testé jusqu'ici — par probabilité, par edge, ou autre — n'a permis de reproduire sur BTTS ou GOALS l'effet observé sur DOMINANT (canal brut négatif, top classé positif). Ils restent négatifs, quelle que soit la méthode essayée.

## Pourquoi EVCore les garde quand même

Un canal non rentable n'est pas forcément inutile. BTTS et GOALS servent aujourd'hui à deux choses, toutes deux différentes de "vous recommander de miser dessus". D'abord comme signal d'exploration : ils font partie des données que le moteur continue de calibrer, et une future méthode de classement pourrait un jour en extraire un edge — comme cela a fini par arriver pour DRAW. Ensuite comme garde-fou pour d'autres canaux : la page Investir exclut par exemple certains picks GOALS qui contredisent l'estimation de buts du reste du moteur, le lambda Poisson utilisé pour modéliser le nombre de buts attendu. Un signal GOALS peut donc être utile pour écarter un pick ailleurs, même s'il n'est jamais recommandé pour lui-même.

## Ce qu'EVCore ne fera jamais avec ces deux canaux

Vendre BTTS ou GOALS comme des "canaux premium" ou des "signaux à edge démontré" serait factuellement faux au regard de ces chiffres — une pratique commerciale trompeuse, pas un simple excès marketing. Tant qu'aucun classement ne les rend rentables sur des données hors échantillon, ils resteront présentés exactement comme dans cette leçon : des signaux à fort volume, pas des canaux à edge prouvé.

## À retenir

- BTTS (−37.22% ROI) et GOALS (−26.05% ROI) ne sont rentables sur aucun classement testé — l'état réel du signal, pas un détail.
- Ils restent utiles en coulisse (exploration, exclusion de picks contradictoires), mais jamais vendus comme un produit de mise autonome.
- Si un classement les rend rentables un jour, comme pour DRAW, cette leçon sera mise à jour avec les chiffres — pas avant.
