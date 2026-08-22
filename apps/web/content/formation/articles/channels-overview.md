---
title: "Les canaux EVCore : une carte, pas un catalogue"
category: channels
difficulty: intermediate
order: 1
slug: channels-overview
summary: "Dix-neuf canaux calculent, deux sont assumés. Cette leçon explique comment se lit cette hiérarchie, où trouver le chiffre à jour de chaque canal, et pourquoi la façon dont on croyait la construire était fausse."
updatedAt: "2026-08-22"
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

EVCore fait tourner dix-neuf canaux de prédiction. Le plus simple serait de les présenter comme dix-neuf variantes équivalentes du même produit — dix-neuf façons de gagner. Ce ne serait pas honnête, et ce n'est pas ce que l'app fait.

Deux canaux seulement sont présentés comme assumés à ce jour. Les dix-sept autres sont calculés, réglés, affichés — et rangés en observation. Cette leçon explique comment cette hiérarchie est construite, et surtout **comment elle se lit dans l'app** plutôt que dans un tableau figé ici.

## Où sont les chiffres

Vous ne trouverez pas de tableau de ROI par canal dans cette leçon, ni dans les leçons dédiées à chaque canal. C'est délibéré, et c'est une correction.

Les versions précédentes de ces pages affichaient des ROI datés, canal par canal. Presque tous se sont révélés faux quelques mois plus tard, et systématiquement dans le même sens : les chiffres positifs se sont érodés ou inversés, le seul qui a tenu était négatif. La raison est simple et elle est instructive — chaque chiffre avait été retenu parce qu'il était bon, sur la période et la formule où il l'était. Une leçon qui gèle un bon résultat enseigne surtout comment on se raconte des histoires.

Les chiffres vivants sont dans l'app, à trois endroits :

- **Track Record** — le ROI et le taux de réussite de chaque canal, sur l'historique complet.
- **Investir, vue « En observation »** — chaque pick porte le ROI mesuré de son canal, ramené vers la moyenne selon le volume qui le soutient.
- **Abonnements** — les canaux y sont groupés en « assumés » et « en observation », avec leur chiffre.

Ces trois surfaces se recalculent. Cette leçon, non. C'est pour ça qu'elle ne contient plus de nombres.

## Comment un canal devient « assumé »

Sur le ROI **corrigé du bruit**, jamais sur le ROI brut.

Un canal qui affiche +28% sur 121 sélections n'a rien démontré : à ce volume, une bonne série suffit à produire ce chiffre. Un canal à −4% sur 17 000 sélections, lui, a dit quelque chose. Le système ramène donc chaque canal vers la moyenne générale, d'autant plus fort que son échantillon est mince — un canal fin garde peu de son écart apparent, un canal massif le garde presque entier.

Ce qui reste après cette correction est ce sur quoi on s'appuie. Aujourd'hui, deux canaux passent au-dessus de zéro. Ce nombre n'est pas une cible : si un troisième y arrive, il rejoint la liste sans que personne n'intervienne ; si l'un des deux repasse dessous, il en sort de la même façon.

## Ce que nous avons cru, et qui était faux

Cette formation a longtemps répété une idée : _le classement compte plus que le canal_. L'argument semblait solide — un canal perdant dans son ensemble redevenait rentable si on ne gardait que ses 5 meilleurs picks du jour.

Cinq de ces règles de classement ont été testées correctement en août 2026, en comparant le top-5 à la liste entière **le même jour** plutôt que sur des périodes différentes. **Aucune n'est ressortie significative.** Les deux qui s'approchaient le plus du seuil étaient négatives : sur DRAW, le meilleur canal du système, le plafond coûtait plusieurs points par jour.

Ce qui s'était passé est un piège classique. En testant cinq règles et en gardant celle qui paraît marcher, on ne sélectionne pas une méthode : on sélectionne du bruit. Le meilleur de cinq essais a l'air bon même quand aucun ne vaut rien.

Toutes ces règles de classement ont été supprimées. Il n'y a plus de « top 5 » nulle part dans l'app.

## Ce qui compte vraiment

Trois régularités ont survécu à la mesure, et elles valent mieux que n'importe quelle liste de canaux.

**La fiabilité s'effondre avec la cote.** Le modèle est bien calibré là où le marché est d'accord avec lui, et catastrophique là où il le contredit. Un canal qui annonce 57% sur une cote au-delà de 3.50 en réalise 20.

**L'avantage revendiqué est anti-prédictif.** Plus le modèle annonce un gros écart avec le marché, moins le pari passe. La leçon sur l'edge et l'EV détaille cette mesure, qui est la plus lourde de conséquences de tout le système.

**La marge du bookmaker domine.** Environ 5 points par pari. C'est l'adversaire réel, et aucun classement ne le fait disparaître.

## Ce que cette carte n'est pas

Elle ne garantit aucun résultat futur, sur aucun canal. Elle ne dit pas non plus qu'un canal en observation est inutile : il nourrit d'autres décisions en coulisse, et un pick individuel venant d'un canal en moyenne perdant peut rester un choix défendable — c'est vous qui tranchez, avec le chiffre du canal sous les yeux.

## À retenir

- Dix-neuf canaux calculent, deux sont assumés. La hiérarchie est visible partout dans l'app, elle n'est figée nulle part.
- Un canal est jugé sur son ROI corrigé du bruit d'échantillonnage, jamais sur son ROI brut.
- « Le classement compte plus que le canal » était faux : cinq règles testées, aucune significative. Elles ont toutes été retirées.
- Ce qui tient : la cote courte, la calibration par canal, et le refus. Pas la curation.
