---
title: "BTTS et GOALS : des signaux d'exploration, pas un edge prouvé"
category: channels
difficulty: intermediate
order: 6
slug: btts-channel
summary: "Ces deux canaux à fort volume ne sont rentables sur aucun classement testé à ce jour. Ce n'est pas caché, et ce n'est pas anodin : voici ce qu'ils sont réellement, et pourquoi EVCore refuse de les vendre comme un edge."
updatedAt: "2026-07-16"
related: ["channels-overview", "value-channel", "dominant-channel"]
---

## Ce que ces canaux cherchent

**BTTS** (Both Teams To Score) identifie les matchs où le modèle juge probable que les deux équipes marquent. **GOALS** identifie une direction sur le total de buts (plus ou moins qu'une ligne donnée — Over/Under). Ce sont deux marchés à très fort volume dans le secteur des paris sportifs, et deux signaux qu'EVCore calcule à chaque match analysé.

## Le chiffre, sans détour

Contrairement à VALUE, DOMINANT ou DRAW, **aucune méthode de classement testée à ce jour ne rend BTTS ou GOALS rentables** :

| Canal | ROI du canal complet |
| ----- | -------------------- |
| BTTS  | **−37.22%**          |
| GOALS | **−26.05%**          |

Ces chiffres ne sont pas des résultats intermédiaires en attente d'une meilleure formule de tri — à ce jour, aucun classement testé (par probabilité, par edge, ou autre) n'a permis de reproduire sur BTTS/GOALS l'effet observé sur DOMINANT (canal brut négatif, top classé positif). Ils restent négatifs, sous toutes les méthodes essayées jusqu'ici.

## Pourquoi EVCore les garde quand même

Un canal non rentable n'est pas nécessairement un canal inutile. BTTS et GOALS servent aujourd'hui à deux choses précises, toutes deux différentes de "vous recommander de miser dessus" :

1. **Signal d'exploration** — ils font partie des données que le moteur continue de calibrer ; une future méthode de classement pourrait un jour en extraire un edge, comme cela a fini par arriver pour DRAW.
2. **Garde-fou pour d'autres canaux** — la page Investir, par exemple, **exclut** certains picks GOALS qui contredisent l'estimation de buts du reste du moteur (le lambda Poisson utilisé pour modéliser le nombre de buts attendu). Autrement dit, un signal GOALS peut être utile pour _écarter_ un pick ailleurs, même s'il n'est jamais recommandé pour lui-même.

## Ce qu'EVCore ne fera jamais avec ces deux canaux

Vendre BTTS ou GOALS comme des "canaux premium" ou des "signaux à edge démontré" serait factuellement faux au regard de ces chiffres — et constituerait une pratique commerciale trompeuse, pas seulement un excès marketing. Tant qu'aucun classement ne les rend rentables sur des données hors échantillon, ils resteront présentés exactement comme ils le sont dans cette leçon : des signaux à fort volume, pas des canaux à edge prouvé.

## À retenir

- BTTS (−37.22% ROI) et GOALS (−26.05% ROI) ne sont rentables sur aucun classement testé à ce jour — ce n'est pas un détail, c'est l'état réel du signal.
- Ils restent utiles en coulisse (exploration, exclusion de picks contradictoires ailleurs), mais ne sont jamais vendus comme un produit de mise autonome.
- Si un jour un classement les rend rentables hors échantillon (comme cela a fini par arriver pour DRAW), cette leçon sera mise à jour avec les chiffres — pas avant.
