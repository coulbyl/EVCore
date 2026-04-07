# Glossaire EVCore

> Référence éditoriale du vocabulaire métier, statistique et produit utilisé dans `EVCore`.

## Sommaire

- [Objectif](#objectif)
- [Paris sportifs et cotes](#paris-sportifs-et-cotes)
- [Modélisation et statistiques](#modélisation-et-statistiques)
- [Décision betting et performance](#décision-betting-et-performance)
- [Data, ETL et pipeline](#data-etl-et-pipeline)
- [Formules importantes](#formules-importantes)
- [Sigles utiles](#sigles-utiles)
- [Résumé express](#résumé-express)

## Objectif

Ce document sert de **lexique de référence** pour comprendre les termes techniques du projet `EVCore`.

Il couvre quatre familles de notions :

- les **cotes** et les **bookmakers**
- la **modélisation statistique**
- la **décision betting**
- le **pipeline data / ETL**

L’objectif n’est pas d’être académique à tout prix, mais d’être :

- **juste**
- **lisible**
- **utile pour lire le repo**

---

## Paris sportifs et cotes

### `odds`

Les **cotes** proposées par un bookmaker.

En cote décimale :

- une cote de `2.00` signifie qu’un pari gagnant de `1` retourne `2` au total
- le gain net est donc `2 - 1 = 1`

### `bookmaker`

L’opérateur de pari, par exemple `Pinnacle`, `Bet365`, `Unibet`.

Dans `EVCore`, tous les bookmakers ne servent pas au même usage :

- certains servent surtout de **référence probabiliste**
- d’autres servent plutôt de **prix à battre**

### `market`

Le **type de pari**.

Exemples :

- `ONE_X_TWO` : victoire domicile / nul / victoire extérieur
- `OVER_UNDER` : plus ou moins d’un seuil de buts
- `BTTS` : les deux équipes marquent
- `HT/FT` : résultat mi-temps / fin de match

### `ONE_X_TWO`

Marché `1N2`.

Interprétation :

- `1` = domicile
- `X` = nul
- `2` = extérieur

### `OVER_UNDER`

Pari sur le **total de buts**.

Exemple :

- `OVER 2.5` = au moins 3 buts
- `UNDER 2.5` = 0, 1 ou 2 buts

### `BTTS`

`Both Teams To Score`.

Exemple :

- `YES` = les deux équipes marquent
- `NO` = au moins une des deux ne marque pas

### `closing odds`

Les **dernières cotes disponibles avant le coup d’envoi**.

Elles sont souvent utilisées comme référence car elles condensent une grande partie de l’information de marché.

### `snapshot`

Une **photo des cotes à un instant donné**.

Exemple :

- `snapshotAt = 2026-04-05T18:16:30`

### `implied probability`

La **probabilité implicite** contenue dans une cote.

Formule simple :

```text
probabilité implicite = 1 / cote
```

Exemple :

```text
cote 2.50 -> 1 / 2.50 = 0.40 = 40 %
```

### `margin`

La **marge bookmaker**.

C’est la commission implicite contenue dans les cotes. Plus elle est élevée, plus les prix sont “écrasés”.

### `overround`

Autre nom de la marge.

Sur un marché `1X2`, on additionne les probabilités implicites :

```text
overround = (1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds)
marge = overround - 1
```

Si la somme vaut `1.04`, alors la marge est de `4 %`.

### `vig`

Autre nom courant de la marge bookmaker.

### `de-vig`

Retirer la marge bookmaker pour retrouver une estimation de probabilités plus propre.

Dans `EVCore`, sur un `1X2` :

```text
invHome = 1 / homeOdds
invDraw = 1 / drawOdds
invAway = 1 / awayOdds
sum = invHome + invDraw + invAway

pHome = invHome / sum
pDraw = invDraw / sum
pAway = invAway / sum
```

### `sharp bookmaker`

Bookmaker considéré comme plus informatif et plus proche du “vrai” marché.

Dans ce projet, `Pinnacle` joue souvent ce rôle de référence.

### `soft bookmaker`

Bookmaker plus orienté grand public, souvent plus margé et donc moins utile comme estimateur de probabilité de marché.

### `price to beat`

Le **prix contre lequel on compare le modèle**.

Exemple :

- la probabilité vient du modèle `Poisson` ou d’un `de-vig`
- la cote à battre est celle proposée par `Bet365`

### `line movement`

Le **mouvement de cote dans le temps**.

Si une cote baisse ou monte fortement avant le match, cela signifie que le marché a réévalué l’événement.

### `market efficiency`

Idée selon laquelle certaines cotes incorporent mieux l’information disponible que d’autres.

Plus un marché est efficace :

- moins il laisse de prix aberrants
- plus il est difficile à battre

---

## Modélisation et statistiques

### `model`

Le moteur qui transforme des données en probabilités de match.

Dans `EVCore`, le cœur du système repose sur :

- des statistiques glissantes
- des métriques `xG`
- un modèle de `Poisson`

### `feature`

Variable d’entrée du modèle.

Exemples présents dans le repo :

- `recentForm`
- `xg`
- `domExtPerf`
- `leagueVolat`

### `feature weight`

Le poids attribué à une `feature` dans un score composite.

Si une feature a un poids plus élevé, elle influence davantage la décision finale.

### `deterministicScore`

Score composite dérivé de plusieurs features.

Dans `EVCore` :

```text
deterministicScore =
  recentForm * w_recentForm +
  xg * w_xg +
  domExtPerf * w_domExtPerf +
  leagueVolat * w_leagueVolat
```

Ce score n’est **pas une probabilité**. Il sert surtout de **filtre de qualité** avant de valider un pick.

### `xG`

`Expected Goals`.

Mesure de la **qualité des occasions** créées ou concédées.

Un match avec peu de tirs mais des occasions très franches peut produire un `xG` élevé.

### `xgFor`

Le volume moyen de `xG` produit par une équipe.

### `xgAgainst`

Le volume moyen de `xG` concédé par une équipe.

### `recent form`

La forme récente d’une équipe, calculée sur une fenêtre glissante de matchs.

### `rolling stats`

Des statistiques calculées sur les **derniers matchs**, plutôt que sur toute l’historique.

### `league volatility`

Mesure de volatilité de la ligue.

Elle reflète le degré de stabilité ou de chaos des matchs dans une compétition donnée.

### `lambda`

Dans un modèle de `Poisson`, `lambda` représente le **nombre moyen de buts attendus**.

Dans `EVCore` :

- `lambdaHome` = buts attendus domicile
- `lambdaAway` = buts attendus extérieur

Intuition :

- `lambdaHome = 1.60` signifie qu’on attend en moyenne `1.6` but côté domicile

### `league mean lambda`

Le **niveau moyen de buts attendu pour une ligue**.

Exemple d’usage :

- championnat ouvert -> `lambda` moyen plus haut
- championnat plus fermé -> `lambda` moyen plus bas

### `home advantage`

Correction appliquée au domicile pour refléter l’avantage terrain.

Dans `EVCore`, cette correction est appliquée aux `lambda` avant le calcul des probabilités.

### `Bayesian shrinkage`

Mécanisme qui rapproche une estimation extrême vers une moyenne de ligue plus stable.

L’idée :

- conserver le signal spécifique à l’équipe
- éviter des `lambda` irréalistes

### `Poisson model`

Modèle probabiliste classique en football pour transformer les buts attendus en probabilités de scores.

Hypothèse standard :

- buts domicile et extérieur modélisés séparément
- chaque côté suit une loi de `Poisson`

### `distribution`

Répartition de probabilités.

Exemple :

- probabilité de marquer 0 but
- probabilité de marquer 1 but
- probabilité de marquer 2 buts
- etc.

### `joint probability`

Probabilité conjointe de deux événements.

Dans les combos, c’est essentiel, car deux sélections sur le même match ne sont généralement **pas indépendantes**.

### `independence assumption`

Hypothèse selon laquelle deux événements ne s’influencent pas.

Exemple souvent faux en football :

- `HOME`
- `OVER 2.5`

Ces deux événements sont souvent corrélés.

### `calibration`

Mesure de la cohérence entre les probabilités prédites et la réalité observée.

Exemple :

- si le modèle annonce souvent `60 %`
- l’événement devrait arriver environ `60 %` du temps

### `Brier score`

Mesure de qualité des probabilités.

Plus le score est **bas**, meilleur est le modèle.

### `ECE`

`Expected Calibration Error`.

Mesure d’erreur de calibration par paquets de probabilités.

### `baseline`

Point de comparaison simple.

Exemples :

- classifieur aléatoire
- marché de référence
- modèle simplifié

### `signal`

Information utile et prédictive contenue dans une variable.

### `noise`

Variation aléatoire ou peu informative qui dégrade la qualité du modèle.

### `cold start`

Situation où l’on manque encore de données fiables, par exemple en début de saison.

### `proxy`

Variable de remplacement utilisée quand la vraie donnée manque.

Exemple :

- utiliser une approximation de `xG` si le fournisseur n’expose pas `expected_goals`

---

## Décision betting et performance

### `EV`

`Expected Value`, ou **valeur espérée**.

C’est la mesure centrale de rentabilité théorique d’un pari.

Formule utilisée dans `EVCore` :

```text
EV = (probabilité estimée * cote décimale) - 1
```

Interprétation :

- `EV > 0` : pari théoriquement rentable
- `EV = 0` : pari neutre
- `EV < 0` : pari négatif

Exemple :

```text
p = 0.40
odds = 2.80
EV = (0.40 * 2.80) - 1 = 0.12
```

Donc `+12 %` de valeur théorique.

### `edge`

L’avantage théorique du modèle sur le bookmaker.

En pratique, c’est généralement cet écart qui produit un `EV` positif.

### `ROI`

`Return On Investment`.

Mesure de rentabilité observée sur un ensemble de paris réellement joués.

Formule simple :

```text
ROI = profit net / mise totale
```

### `qualityScore`

Score combiné utilisé dans `EVCore` pour prioriser les picks.

Dans les types du projet :

```text
qualityScore = EV * deterministicScore
```

Ce n’est pas une probabilité. C’est un **score de classement**.

### `stake sizing`

Le choix de la taille de mise.

### `Kelly`

Formule classique de sizing basée sur l’avantage théorique et la cote.

Dans `EVCore` :

```text
K = (p * odds - 1) / (odds - 1)
stakePct = fraction * K
```

Avec des gardes supplémentaires :

- si `odds <= 1`, retour `0`
- si `K <= 0`, retour `0`
- le résultat final est plafonné par `maxStake`

### `fractional Kelly`

Version prudente du `Kelly`.

Au lieu d’appliquer `100 %` de la taille recommandée, on n’en applique qu’une fraction.

### `longshot`

Sélection à grosse cote.

Ces paris sont risqués car une petite surestimation de probabilité peut gonfler artificiellement l’`EV`.

### `hard cap`

Plafond strict.

Exemple :

- cote trop haute
- `EV` trop élevé pour être crédible
- pick rejeté

### `soft cap`

Plafond plus souple qu’un `hard cap`, utilisé comme garde-fou intermédiaire.

### `suspension threshold`

Seuil à partir duquel un marché, une ligue ou un comportement modèle peut être temporairement suspendu.

---

## Data, ETL et pipeline

### `ETL`

`Extract, Transform, Load`.

Concrètement :

- récupérer des données
- les transformer
- les charger en base

### `sync`

Opération de synchronisation entre une source externe et la base locale.

### `worker`

Processus ou job en tâche de fond qui exécute un traitement ciblé.

Exemples :

- sync de fixtures
- import de cotes
- settlement des paris

### `one-shot import`

Import ponctuel massif, non continu.

Exemple :

- import historique de plusieurs saisons d’un seul coup

### `fallback`

Solution de secours quand la source ou la logique principale n’est pas disponible.

Exemple :

- `Pinnacle` absent
- repli sur `Bet365`

### `schema`

Structure attendue des données.

Le schéma sert à valider qu’une réponse source ressemble bien à ce que le système attend.

### `validation`

Vérification du format et de la cohérence des données entrantes.

### `mapping`

Correspondance entre deux représentations.

Exemples :

- nom d’équipe source A vers équipe locale
- code compétition externe vers code interne

### `coverage`

Taux de couverture d’une donnée.

Exemple :

- `xG coverage = 90 %`

Cela signifie que `90 %` des matchs attendus disposent d’une valeur `xG`.

### `fixture`

Un match.

Selon le contexte :

- programmé
- en cours
- terminé

### `competition`

Une compétition sportive.

Exemples :

- `PL`
- `L1`
- `UCL`

### `season`

Une saison sportive.

Exemple :

- `2024-2025`

### `coupon`

Un ticket ou un groupe de sélections généré pour une journée ou une fenêtre donnée.

### `settled bet`

Pari résolu. Le résultat final est connu.

### `pending bet`

Pari encore ouvert, non résolu.

### `audit`

Contrôle de qualité ou diagnostic approfondi.

Exemples :

- vérifier les `lambda`
- vérifier les anomalies de calibration
- vérifier la couverture `odds`

### `pipeline`

La chaîne complète de traitement, depuis la collecte de données jusqu’à la décision produit.

---

## Formules importantes

Cette section résume les formules les plus utiles pour lire le repo.

### Probabilité implicite

```text
probabilité implicite = 1 / cote
```

Exemple :

```text
odds = 2.20
prob = 1 / 2.20 = 0.4545 = 45.45 %
```

### Overround / marge bookmaker

Sur un `1X2` :

```text
overround = (1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds)
marge = overround - 1
```

Exemple :

```text
home = 2.50
draw = 3.40
away = 2.90

overround = 1/2.50 + 1/3.40 + 1/2.90
          = 0.4000 + 0.2941 + 0.3448
          = 1.0389

marge = 3.89 %
```

### De-vig simple sur `1X2`

```text
invHome = 1 / homeOdds
invDraw = 1 / drawOdds
invAway = 1 / awayOdds

sum = invHome + invDraw + invAway

pHome = invHome / sum
pDraw = invDraw / sum
pAway = invAway / sum
```

Exemple :

```text
2.50 / 3.40 / 2.90

invHome = 0.4000
invDraw = 0.2941
invAway = 0.3448
sum = 1.0389

pHome = 0.4000 / 1.0389 = 38.5 %
pDraw = 0.2941 / 1.0389 = 28.3 %
pAway = 0.3448 / 1.0389 = 33.2 %
```

### EV

Formule canonique du projet :

```text
EV = (p * odds) - 1
```

Exemple :

```text
p = 0.36
odds = 2.90

EV = (0.36 * 2.90) - 1
   = 1.044 - 1
   = 0.044
```

Donc :

```text
EV = +4.4 %
```

### Kelly

Formule utilisée par le moteur :

```text
K = (p * odds - 1) / (odds - 1)
stakePct = fraction * K
```

Puis :

- si `K <= 0`, mise `0`
- si `stakePct > maxStake`, on coupe à `maxStake`

Exemple :

```text
p = 0.40
odds = 2.80

K = (0.40 * 2.80 - 1) / (2.80 - 1)
  = (1.12 - 1) / 1.80
  = 0.12 / 1.80
  = 0.0667
```

Soit environ `6.67 %` de bankroll en `Kelly` plein.

### Score déterministe

Forme générale :

```text
deterministicScore =
  recentForm * w1 +
  xg * w2 +
  domExtPerf * w3 +
  leagueVolat * w4
```

Ce score n’est pas une probabilité.

Il sert à vérifier qu’un pick n’est pas seulement “EV positif sur le papier”, mais soutenu par un contexte statistique suffisant.

### Lambda Poisson

Interprétation :

```text
lambdaHome = moyenne attendue de buts domicile
lambdaAway = moyenne attendue de buts extérieur
```

Exemple :

```text
lambdaHome = 1.6
lambdaAway = 1.1
```

Lecture :

- domicile : `1.6` but attendu
- extérieur : `1.1` but attendu

### Construction des lambdas dans EVCore

Forme actuelle du projet :

```text
leagueAvg = max(0.5, (homeXgFor + awayXgFor + homeXgAgainst + awayXgAgainst) / 4)

rawHome =
  alpha * ((homeXgFor * awayXgAgainst) / leagueAvg) +
  (1 - alpha) * anchor

rawAway =
  alpha * ((awayXgFor * homeXgAgainst) / leagueAvg) +
  (1 - alpha) * anchor
```

Puis correction domicile / extérieur :

```text
lambdaHome = clamp(rawHome * homeAdvFactor, 0.05, 5)
lambdaAway = clamp(rawAway * awayDisadvFactor, 0.05, 5)
```

Dans le repo :

- `alpha = 0.70`
- `anchor = league mean lambda`

Intuition :

- `xgFor * xgAgainst / leagueAvg` produit le signal équipe contre équipe
- `anchor` ramène ce signal vers une moyenne de ligue
- `homeAdvFactor` / `awayDisadvFactor` corrigent l’avantage terrain
- `clamp` empêche les valeurs aberrantes

### Loi de Poisson

Formule de masse utilisée :

```text
P(X = k) = exp(-lambda) * lambda^k / k!
```

Interprétation :

- `X` = nombre de buts
- `k` = 0, 1, 2, 3, ...
- `lambda` = moyenne attendue

### Probabilités `1X2` via distributions de scores

Une fois qu’on a :

- la distribution des buts domicile
- la distribution des buts extérieur

on additionne tous les cas :

- `HOME` quand `h > a`
- `DRAW` quand `h = a`
- `AWAY` quand `h < a`

### `UNDER 2.5`

Dans `EVCore`, c’est la somme des probabilités de scores dont le total de buts est inférieur ou égal à `2`.

```text
UNDER 2.5 = somme des P(h, a) tels que h + a <= 2
OVER 2.5 = 1 - UNDER 2.5
```

### `BTTS`

Approximation utilisée dans le moteur à partir des distributions :

```text
BTTS_YES = (1 - P(home=0)) * (1 - P(away=0))
BTTS_NO = 1 - BTTS_YES
```

### Probabilité jointe combo

Pour deux sélections sur le même match, `EVCore` cherche une probabilité jointe au lieu de multiplier aveuglément deux probabilités comme si elles étaient indépendantes.

Idée :

```text
P(A et B) != P(A) * P(B) en général
```

C’est particulièrement important pour des combos comme :

- `HOME + OVER 2.5`
- `DRAW + UNDER 2.5`

### Brier score multiclasses `1X2`

Formule du repo :

```text
Brier =
  moyenne de [
    (pHome - oHome)^2 +
    (pDraw - oDraw)^2 +
    (pAway - oAway)^2
  ]
```

avec :

- `oHome = 1` si le résultat réel est `HOME`, sinon `0`
- `oDraw = 1` si le résultat réel est `DRAW`, sinon `0`
- `oAway = 1` si le résultat réel est `AWAY`, sinon `0`

Plus le score est bas, meilleur est le modèle.

### Calibration error `ECE`

Le projet utilise une erreur de calibration par `buckets` :

```text
ECE = somme sur les buckets de
      poids_du_bucket * |proba_moyenne - fréquence_observée|
```

Plus `ECE` est faible, plus les probabilités du modèle sont crédibles.

---

## Sigles utiles

Cette section reprend les **codes de compétitions réellement seedés** dans la base du projet.

### `FRI`

International friendlies, c’est-à-dire matchs amicaux internationaux.

### `BL1`

Bundesliga.

### `CH`

Championship.

### `D2`

2. Bundesliga.

### `EL1`

League One.

### `EL2`

League Two.

### `ERD`

Eredivisie.

### `F2`

Ligue 2.

### `I2`

Serie B.

### `J1`

J1 League.

### `L1`

Ligue 1.

### `LL`

La Liga.

### `MX1`

Liga MX.

### `PL`

Premier League.

### `POR`

Primeira Liga.

### `SA`

Serie A.

### `SP2`

Segunda División.

### `UCL`

UEFA Champions League.

### `UEL`

UEFA Europa League.

### `UECL`

UEFA Europa Conference League.

### `UNL`

UEFA Nations League.

### `WCQE`

World Cup Qualification - Europe.

### Codes CSV utiles

Certains codes de compétitions sont reliés à des codes `football-data.co.uk` dans le seed :

- `PL -> E0`
- `CH -> E1`
- `EL1 -> E2`
- `EL2 -> E3`
- `SA -> I1`
- `I2 -> I2`
- `LL -> SP1`
- `SP2 -> SP2`
- `BL1 -> D1`
- `D2 -> D2`
- `L1 -> F1`
- `F2 -> F2`
- `ERD -> N1`
- `POR -> P1`
- `J1 -> JPN`
- `MX1 -> MEX`

---

## Résumé express

Si tu ne devais retenir que dix notions :

1. `odds` = la cote
2. `implied probability` = `1 / cote`
3. `margin` = la commission implicite du bookmaker
4. `de-vig` = le retrait de cette marge
5. `EV` = la rentabilité théorique du pari
6. `xG` = la qualité attendue des occasions
7. `lambda` = les buts attendus
8. `Poisson` = le modèle qui transforme les lambdas en probabilités
9. `calibration` = la crédibilité empirique des probabilités du modèle
10. `backtest` = le test du modèle sur le passé
