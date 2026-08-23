---
title: "Le canal VALUE (Valeur) : quand le filtre coûte plus qu'il ne rapporte"
category: channels
difficulty: intermediate
order: 2
slug: value-channel
summary: "VALUE a longtemps été présenté comme le canal le plus solide d'EVCore. La mesure a montré autre chose : il reprend surtout les décisions des autres, et l'acte de re-sélectionner dégrade la calibration. Voici ce qu'on en a appris."
updatedAt: "2026-08-22"
related: ["channels-overview", "ev-probabilites-cotes", "safe-channel"]
---

## Ce que le canal cherche

VALUE identifie les picks où la probabilité calibrée du moteur dépasse nettement la probabilité implicite de la cote — un edge d'au moins 10 points. C'est l'application directe de la leçon sur l'edge et l'EV.

Un point de vocabulaire important : depuis août 2026, VALUE n'est plus un canal qui explore les marchés par lui-même. C'est un **filtre**. Les canaux spécialisés décident d'abord, chacun sur son marché ; VALUE regarde ensuite leurs décisions et retient celles qui présentent le plus gros écart avec le marché.

## Ce que la mesure a trouvé

Deux résultats, qui vont ensemble.

**VALUE produit très peu de choses qui lui soient propres.** 92% de ses sélections reprennent exactement un pick déjà émis par un canal spécialisé — même match, même marché, même pick, même probabilité. Sous un second nom.

**Et re-sélectionner dégrade la calibration.** C'est le résultat contre-intuitif. En prenant le même vivier de picks et en comparant ceux que VALUE reprend à ceux qu'il laisse, les picks repris réalisent une part nettement plus faible de ce qu'ils annoncent. Le filtre ne rend pas les picks meilleurs. Il les rend moins fiables.

Le mécanisme est visible : VALUE choisit les probabilités annoncées les plus hautes, et c'est précisément là que le modèle se trompe le plus.

## La nuance qui empêche de conclure trop vite

Les 8% de picks réellement propres à VALUE — ceux qu'aucun autre canal n'a émis — se comportent différemment : mieux calibrés, et rentables sur l'échantillon disponible.

C'est le seul endroit du système où une couche de sélection **ajoute** quelque chose plutôt que d'en retirer. Mais l'échantillon est trop mince pour trancher, et le système entier a été refondu parce qu'on avait pris trop de décisions sur des échantillons de cette taille. Rien n'a donc été changé : la piste est documentée, elle attend une validation sérieuse.

## Pourquoi ses picks apparaissent dans « Écarté »

VALUE sélectionne les picks dont l'edge dépasse 10 points. Le garde-fou d'Investir écarte les picks dont l'edge dépasse 10 points. Les deux règles sont exactement complémentaires, donc la plupart des picks VALUE atterrissent dans la vue « Écarté ».

C'est déroutant et c'est assumé. Le garde-fou repose sur une mesure solide (51 860 sélections) ; le canal repose sur une intuition d'origine que cette mesure contredit. Tant que le remplacement du canal n'est pas validé, la contradiction reste visible plutôt que masquée.

## Ce que cette leçon remplace

Les versions précédentes de cette page annonçaient VALUE comme « le seul canal démontré positif hors échantillon », sur la foi d'un top 5 classé par edge. Ce classement a été retesté correctement en août 2026 — comparé à la liste entière le même jour — et n'est pas ressorti significatif. Le chiffre qui l'accompagnait s'est érodé depuis.

## À retenir

- VALUE est un filtre, pas un explorateur : il choisit parmi les décisions des autres canaux.
- 92% de ses sélections sont des doublons, et l'acte de re-sélectionner dégrade la calibration.
- Le seul segment prometteur est celui de ses picks propres — trop mince pour décider, documenté en attendant.
- Le chiffre à jour du canal est dans Track Record, pas ici.
