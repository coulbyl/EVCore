# VANTAGE : ce qui marche, ce qui ne marche pas, ce qui change (2026-10-13)

Mesures sur le dump de production du 2026-10-10 (base locale), vue
`channel_selection_deduped` (une ligne par pari réel), canal VANTAGE,
configuration `vantage-v3-context`, du 2026-08-28 au 2026-10-10.

## 1. Volume et disponibilité

| Semaine du         | Sélections | Réglées |  Réel | Annoncé | Cote moy. |
| ------------------ | ---------: | ------: | ----: | ------: | --------: |
| 2026-08-24         |        275 |     268 | 0,496 |   0,538 |         — |
| 2026-08-31         |      1 218 |   1 189 | 0,470 |   0,547 |      2,44 |
| 2026-09-07         |        871 |     864 | 0,516 |   0,562 |      2,24 |
| 2026-09-14         |        998 |     987 | 0,533 |   0,577 |      2,16 |
| 2026-09-21 → 10-04 |         20 |      20 |     — |       — |         — |
| 2026-10-05         |        144 |     135 | 0,489 |   0,619 |      1,96 |

Deux semaines à vingt lectures : la panne de fournisseur du 09-20 (402,
quota épuisé) puis la clé invalide du 10-09 (401), déjà corrigées par le
repli automatique sur les fournisseurs de secours. Le taux de « play » est
de **70 à 86 % des matchs** depuis septembre, contre un prompt qui dit que
« no_play » est la bonne réponse sur la majorité des matchs. Le modèle ne
suit pas cette consigne.

## 2. Calibration : où VANTAGE tient, où il ne tient pas

Par tranche de cote (2 894 sélections réglées avec cote) :

| Cote      |   n | Annoncé |  Réel |    Ratio |
| --------- | --: | ------: | ----: | -------: |
| < 1,50    | 581 |   0,710 | 0,697 | **0,98** |
| 1,50–1,80 | 892 |   0,606 | 0,567 | **0,94** |
| 1,80–2,20 | 617 |   0,584 | 0,498 |     0,85 |
| 2,20–3,00 | 326 |   0,513 | 0,417 |     0,81 |
| > 3,00    | 478 |   0,341 | 0,232 |     0,68 |

Sous 1,80 (1 555 sélections) VANTAGE réalise **0,956** de ce qu'il annonce ;
au-dessus (1 339), **0,790**. C'est la même frontière que partout dans le
dépôt (CLAUDE.md). Les marchés qui paraissaient mal calibrés — 1X2 à 0,79,
score exact 0,73, clean sheet extérieur 0,75 — sont des marchés à cote
longue : à l'intérieur du plafond, 1X2 lit **1,02** (n = 112), les deux
équipes marquent 1,02 (n = 647), plus/moins de buts 0,90, gagner une
mi-temps 0,94. Restent faibles sous le plafond : totaux d'équipe (0,79 et
0,82) et double chance (0,84, n = 131).

Par probabilité annoncée : juste de 0,2 à 0,6, surconfiant au-delà (ratio
0,85–0,88 entre 0,6 et 0,8, 0,80 au-dessus) — ce qui est attendu si la
surconfiance vient des cotes longues que le modèle juge « probables ».

Les sélections que VANTAGE invente seul (sans qu'un autre canal ait le
même pick) réalisent 0,87 de l'annoncé ; celles qui copient un canal 0,90.
Les sélections sans cote connue (569, 16 %) : 0,91 — ni mieux ni pire.

## 3. Le texte lu par le joueur

Sur 8 189 verdicts « play », **36 %** des textes contiennent un code de
marché, le mot « canal » ou un ratio de calibration brut ; **24 %** sur les
173 plus récents, après le durcissement du prompt du 09-07. Échantillon du
10-10 : « le canal qui a sélectionné « pas de BTTS » est historiquement
sur-confiant », « le signal proche du seuil indique… ». Le prompt interdit
tout cela en toutes lettres : l'interdiction n'est pas suivie à 100 %, et ne
le sera jamais.

## 4. Un trou de coût : les refus non persistés

Un « play » refusé par un garde-fou (cote sous 1,20, calibration d'un
canal) n'écrivait rien en base. Le balayage (toutes les cinq minutes)
cherche les matchs sans décision VANTAGE sur la dernière analyse : le même
match était donc renvoyé au modèle à chaque passage jusqu'au coup d'envoi,
avec le même refus à l'arrivée. Invisible dans la timeline, qui ne connaît
que SELECTED et REJECTED.

## 5. Ce qui change (`vantage-v4-gated`)

1. **Plafond de cote à 1,80** sur tout « play » dont la cote est connue —
   le seul réglage qui supprime la mauvaise calibration mesurée, sans
   toucher aux marchés.
2. **Auto-calibration par marché** : VANTAGE est mesuré contre lui-même
   (90 jours glissants, sous le plafond) ; un marché où il réalise moins de
   0,70 de l'annoncé sur au moins 100 sélections lui est fermé, et le prompt
   le lui dit avant qu'il choisisse. Aujourd'hui aucun marché n'est fermé
   par ce seuil ; c'est le filet qui ferme un marché qui dérive sans
   changement de code.
3. **Refus persistés** comme décisions REJECTED (`VANTAGE_GATED_ODDS`,
   `VANTAGE_GATED_MARKET`) avec le texte du modèle précédé de la raison en
   clair : plus de relance en boucle, et la timeline montre le refus.
4. **Nettoyage déterministe du texte** (`sanitize-reason.ts`) avant
   écriture : codes de marché et de pick traduits, « canal X » et ratios de
   calibration remplacés par du langage courant. Le verdict n'est jamais
   touché ; la forme est corrigée au lieu de rejeter la réponse.
5. **Champ `basis`** (`tension` / `near_threshold` / `raw_stats`) demandé au
   modèle et persisté dans `reasonDetails` : dans un mois, on saura laquelle
   des trois bases tient réellement, au lieu de deviner.
6. **Prompt système réécrit en règles numérotées** : budget explicite (« sur
   dix matchs, tu en joues au plus trois »), contraintes dures annoncées
   avant les chiffres (plafond, marchés fermés), les mêmes interdictions de
   forme, en moitié moins de mots.

Non changé, volontairement : la recherche web (hors périmètre), la
probabilité annoncée du modèle (on ne la recalibre pas en silence, la
pastille de confiance la juge), les lectures de contexte.

## 6. Ce qu'il faudra lire dans un mois

- Taux de « play » sous v4 (cible : moins de 40 %), part des refus par
  plafond et par marché.
- Ratio réel/annoncé de v4 seul (jamais mélangé à v3), par tranche de cote
  et par `basis`.
- Part de textes contenant encore un code ou le mot « canal » après
  nettoyage (cible : 0).

## 7. Le générateur de coupon LLM, recentré (ajout du 2026-10-13)

Jambes réglées du coupon LLM (source `LLM`, cible 5–15, depuis le 01-09) :

| Cote de jambe |   n | Annoncé |  Réel | Ratio |
| ------------- | --: | ------: | ----: | ----: |
| < 1,30        |  91 |   0,861 | 0,736 |  0,86 |
| 1,30–1,50     | 221 |   0,805 | 0,670 |  0,83 |
| 1,50–1,80     | 305 |   0,732 | 0,620 |  0,85 |
| > 1,80        | 769 |   0,561 | 0,406 |  0,72 |

Même en cote courte, le LLM choisit des jambes qui réalisent 0,83–0,86 de
l'annoncé, là où les sélections mises en avant par Décisions, dans la même
bande, font 0,97–0,99 (§5 du rapport Décisions / Coupons). Par canal, ses
jambes venaient d'abord de VALUE (504, ratio 0,78) et SAFE (371, 0,78),
deux canaux retirés de l'écran depuis le 3 septembre ; la consigne
« mélanger des ancres et des jambes de valeur » le poussait vers les picks
les plus surestimés — l'EV est un détecteur de surestimation (CLAUDE.md),
et le prompt lui demandait d'en chercher.

Décision : le coupon 5–15 du LLM n'est plus produit. Le pipeline LLM
compose désormais un **combiné du jour « Analyse IA »** (classe `COMBO`,
source `LLM`) sur **le même vivier et les mêmes règles d'éligibilité que le
combiné du moteur** (sélection mise en avant de chaque match, canal calibré
sur la compétition, cote sous 1,50, une par match, hors VANTAGE et score
exact), dans lequel le modèle choisit trois jambes sur trois championnats
différents, **sans voir ni cote ni probabilité**. La validation reste
déterministe (trois numéros valides, trois matchs, trois championnats,
cote combinée dans la bande). Les jambes annoncent la probabilité du canal,
comme celles du moteur : les deux combinés se comparent jambe à jambe,
LLM contre « les moins chères d'abord ». Il reste sur la page Coupons,
pas sur l'accueil (un pari sûr et un combiné, pas deux).

Si dans un mois les jambes choisies par le LLM ne font pas mieux que les
moins chères, le pipeline LLM de coupon n'a plus de raison d'exister.
