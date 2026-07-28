---
title: "Le canal GOALS (Buts) : un signal d'exploration, pas un edge prouvé"
category: channels
difficulty: intermediate
order: 7
slug: goals-channel
summary: "Ce canal à fort volume n'est rentable sur aucun classement testé à ce jour — et l'audit du 2026-07-28, sur un échantillon bien plus large qu'avant, le confirme plus nettement encore."
updatedAt: "2026-07-28"
related: ["channels-overview", "btts-channel", "dominant-channel"]
---

## Ce que ce canal cherche

GOALS identifie une direction sur le total de buts d'un match, plus ou moins une ligne donnée (1.5, 2.5, 3.5, 4.5). C'est un marché à très fort volume, calculé à chaque match analysé.

## Le chiffre, sans détour

L'audit du 2026-07-28, sur l'historique complet (15 685 sélections réglées — de loin le plus gros échantillon de tous les canaux d'EVCore), confirme un ROI négatif :

| Canal | Volume (n) | ROI mesuré  |
| ----- | ---------- | ----------- |
| GOALS | 15 685     | **−5.39%**  |

Ce chiffre mérite une mise en garde particulière : sur une fenêtre plus courte et récente, GOALS peut apparaître ponctuellement positif (+1.5% a été observé sur une fenêtre de 90 jours, par exemple) — une série favorable, statistiquement possible même sur un canal négatif en moyenne. C'est exactement le piège que la leçon sur la variance décrit : juger un canal sur une fenêtre récente plutôt que sur son historique complet aurait conduit à l'activer à tort. L'audit complet, avec un échantillon quinze fois plus grand, tranche dans l'autre sens.

## Pourquoi EVCore le garde quand même

Un canal non rentable n'est pas forcément inutile. GOALS sert aujourd'hui à deux choses, toutes deux différentes de "vous recommander de miser dessus". D'abord comme signal d'exploration : il fait partie des données que le moteur continue de calibrer, et une future méthode de classement ou un découpage par championnat (comme cela a fonctionné pour BTTS) pourrait un jour en extraire un edge. Ensuite comme garde-fou pour d'autres canaux : la page Investir exclut certains picks GOALS qui contredisent l'estimation de buts du reste du moteur, le lambda Poisson utilisé pour modéliser le nombre de buts attendu. Un signal GOALS peut donc être utile pour écarter un pick ailleurs, même s'il n'est jamais recommandé pour lui-même.

## Ce qu'EVCore ne fera jamais avec ce canal

Vendre GOALS comme un "canal premium" ou un "signal à edge démontré" serait factuellement faux au regard de ces chiffres — une pratique commerciale trompeuse, pas un simple excès marketing. Tant qu'aucun classement ni aucun découpage ne le rend rentable sur des données hors échantillon et sur un volume suffisant, il restera présenté exactement comme dans cette leçon : un signal à fort volume, pas un canal à edge prouvé.

## À retenir

- GOALS (−5.39% ROI sur 15 685 sélections réglées) n'est rentable sur aucun classement testé à ce jour — le plus gros échantillon d'EVCore, et le verdict le plus net.
- Une bonne performance sur une fenêtre récente et courte ne suffit jamais à renverser ce constat — c'est l'historique complet qui fait foi.
- Il reste utile en coulisse (exploration, exclusion de picks contradictoires), mais jamais vendu comme un produit de mise autonome. Si un classement ou un découpage le rend rentable un jour, comme pour BTTS, cette leçon sera mise à jour avec les chiffres — pas avant.
