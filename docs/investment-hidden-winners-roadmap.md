# Investment: hidden winners and new market channels

## Constat

Le filtre `investment` a ete ajoute pour sortir les meilleurs picks du jour par canal.

Mais le comportement observe est paradoxal:

- `/picks` contient souvent plusieurs picks gagnants sur les jours actifs.
- `investment` selectionne parfois les mauvais picks.
- Les meilleurs picks gagnants restent donc visibles dans `/picks`, mais ne remontent pas dans `investment`.

L'intuition actuelle est que, tous canaux confondus, chaque jour actif contient souvent plus de 5 picks gagnants. Le vrai probleme n'est donc pas seulement le volume, mais la capacite a identifier les bons picks dans le pool.

## Ce que fait le code aujourd'hui

`investment` ne fait pas une analyse exhaustive de tous les marches possibles du match.

Il prend les picks deja produits par les canaux existants:

- `EV`
- `SV`
- `BB`
- `NUL`
- `CONF`

Puis il les re-classe avec des scores historiques:

- performance recente du canal;
- performance du canal par ligue;
- facteur jour de semaine;
- score calibre du signal.

Donc `investment` peut favoriser un canal statistiquement bon, tout en selectionnant les mauvais cas individuels du jour.

C'est probablement la raison pour laquelle il peut laisser les vrais gagnants dans `/picks`.

## Point important

Les marches `OVER/UNDER` existent deja dans le moteur backend.

Le moteur evalue deja notamment:

- `OVER_1_5`
- `UNDER_1_5`
- `OVER` / `UNDER` pour le 2.5
- `OVER_3_5`
- `UNDER_3_5`
- `OVER_4_5`
- `UNDER_4_5`

Mais ces marches ne sont pas exposes comme canaux autonomes dans `investment`.

Aujourd'hui, ils peuvent seulement apparaitre indirectement via `EV` ou `SV`, si le moteur les retient comme meilleur pick ou safe pick.

## Nouvelle direction proposee

Avant d'ajouter directement des nouveaux canaux dans l'UI ou dans Prisma, il faut construire un replay d'analyse.

Objectif du replay:

- rejouer chaque jour actif;
- lister tous les picks evalues par le moteur;
- identifier tous les picks gagnants disponibles ce jour-la;
- comparer ce que `/picks` a selectionne;
- comparer ce que `investment` a selectionne;
- detecter les marches gagnants ignores;
- mesurer les segments gagnants par marche, ligue, cote, probabilite et canal.

Ce replay doit repondre a une question simple:

> Est-ce qu'il existait vraiment 5 a 10 picks gagnants detectables chaque jour actif, et quels signaux les rendaient detectables avant match ?

## Canaux candidats

Si le replay confirme des signaux solides, on pourra creer de nouveaux canaux ou pseudo-canaux investment, par exemple:

- `OVER15`
- `UNDER15`
- `OVER25`
- `UNDER25`
- `OVER35`
- `UNDER35`
- eventuellement des canaux mi-temps plus tard, comme `OVER_HT` ou `UNDER_HT`

Mais il vaut mieux commencer par des canaux virtuels dans le replay/backtest.

On ne les ajoute dans Prisma, l'API et l'UI qu'apres validation statistique.

## Garde-fou

Le reve est clair: arriver a 5 ou 10 picks tres fiables chaque jour actif.

Mais il faut eviter de viser artificiellement le 100% quotidien. Le football reste bruite, et un systeme qui promet 100% risque souvent d'etre sur-ajuste.

La bonne cible est plutot:

- maximiser le nombre de gagnants detectables;
- reduire les faux positifs;
- mesurer la stabilite hors echantillon;
- ne promouvoir un nouveau canal que s'il tient au backtest et au replay recent.

## Prochaine etape

Construire un rapport `hidden-winners replay` qui sortira, par jour:

- nombre total de picks evalues;
- nombre total de picks gagnants;
- picks selectionnes par `/picks`;
- picks selectionnes par `investment`;
- gagnants ignores;
- top marches gagnants ignores;
- performance par marche et seuil (`OVER/UNDER 1.5`, `2.5`, `3.5`, etc.).

Ensuite, utiliser ce rapport pour decider quels nouveaux canaux meritent vraiment d'etre ajoutes.

## Resultats du premier replay

Rapports generes:

- `docs/investment-virtual-channels-report.md`
- `apps/backend/reports/investment-vs-picks-analysis.txt`
- `apps/backend/reports/hidden-winner-segments.txt`
- `apps/backend/reports/virtual-investment-channels.txt`
- `apps/backend/reports/virtual-channel-loss-audit.txt`

Sur la fenetre `2026-04-02 -> 2026-06-01`, les meilleurs segments caches etaient:

- `BTTS/YES`
- `OVER_UNDER/UNDER_3_5`
- `OVER_UNDER_HT/OVER_0_5`
- `OVER_UNDER/OVER_1_5`
- `OVER_UNDER/UNDER_4_5`

Ces segments ont ete ajoutes comme canaux virtuels `investment`:

- `BTTS_YES`
- `SAFE_UNDER35`
- `SAFE_HT_OVER05`
- `SAFE_OVER15`
- `SAFE_UNDER45`

Baseline virtuelle avant garde-fous:

- top 5 quotidien: `106W / 28L`, hit rate `79.1%`
- top 10 quotidien: `138W / 43L`, hit rate `76.2%`

## Garde-fous ajoutes

L'audit des pertes a montre des zones faibles recurrentes:

- `SAFE_UNDER35` perdait trop en `MX1` et dans la tranche de probabilite `75-79%`.
- `BTTS_YES` perdait trop en `ERD` et dans la tranche `65-69%`.
- `SAFE_OVER15` etait fragile quand la marge EV etait trop fine.
- `SAFE_HT_OVER05` etait moins propre sous `75%` de probabilite.
- `SAFE_UNDER45` a ete garde, avec exclusion prudente de `NOR2` et `TUR1` apres pertes extremes.

Apres garde-fous:

- top 5 quotidien: `92W / 14L`, hit rate `86.8%`
- top 10 quotidien: `112W / 21L`, hit rate `84.2%`

Le systeme est donc plus selectif: moins de picks, mais deux fois moins de pertes en top 5.

## Etat actuel

Les canaux virtuels sont exposes dans l'API `investment` et dans l'UI sous la section `Canaux virtuels`.

La prochaine iteration doit chercher a reduire les `14` pertes restantes du top 5 guarded sans vider les jours actifs. Les zones a surveiller sont:

- `SAFE_OVER15` dans `EL1` et `UECL`;
- `SAFE_HT_OVER05` dans `EL1`, `EL2` et certains matchs `J1`;
- `BTTS_YES` en `SP2` sous `65%`;
- `SAFE_UNDER35` quand la marge EV est trop fine ou trop large.
