# Evaluation et integration du signal H2H

## Objectif

Determiner si l'historique des confrontations directes apporte une information
predictive supplementaire au modele EVCore avant de l'utiliser dans les
probabilites ou la selection des picks.

Le H2H doit rester un signal `shadow` tant qu'une amelioration hors echantillon
n'a pas ete demontree.

## Etat actuel

Le service `H2HService` recupere les 5 dernieres confrontations terminees entre
les deux equipes, anterieures au match analyse, domicile et exterieur confondus.

Le score actuel est :

```text
shadow_h2h = victoires du favori / confrontations trouvees
```

Le favori est l'equipe ayant la probabilite 1X2 la plus elevee selon le modele.
En cas d'egalite, l'equipe a domicile est retenue.

Ce score est stocke dans `ModelRun.features.shadow_h2h`, mais il ne modifie pas :

- les probabilites Poisson ;
- la probabilite BTTS ;
- l'EV du pick ;
- le classement des picks candidats ;
- la decision finale `BET` ou `NO_BET`.

Le flag `FEATURE_FLAGS.SCORING.H2H` est actuellement desactive. Son activation
ne suffit toutefois pas a integrer le signal : aucun calcul du moteur ne lit ce
flag pour corriger une probabilite.

## Limite du signal actuel

Le score actuel represente la frequence de victoire du favori. Il peut etre
pertinent pour un marche 1X2, mais il ne correspond pas directement aux autres
marches.

Par exemple, pour un pick BTTS, les victoires historiques du favori ne disent
pas combien de confrontations se sont terminees avec un but de chaque equipe.
Une equipe peut gagner souvent 1-0 et produire un `shadow_h2h` eleve tout en
ayant un taux BTTS faible.

Il ne faut donc pas appliquer le score actuel indistinctement a tous les picks.

## Signaux H2H par marche

Chaque signal doit etre calcule uniquement avec des matchs anterieurs a la
fixture analysee afin d'eviter toute fuite de donnees.

| Signal         | Calcul                                                 | Marche cible |
| -------------- | ------------------------------------------------------ | ------------ |
| `h2h_1x2`      | victoires de l'equipe selectionnee / matchs valides    | 1X2          |
| `h2h_draw`     | matchs nuls / matchs valides                           | DRAW         |
| `h2h_btts`     | matchs ou les deux equipes ont marque / matchs valides | BTTS         |
| `h2h_over_25`  | matchs avec au moins 3 buts / matchs valides           | OVER 2.5     |
| `h2h_under_25` | matchs avec au plus 2 buts / matchs valides            | UNDER 2.5    |

Exemple BTTS sur cinq confrontations :

```text
2-1  -> BTTS
0-0  -> NO BTTS
1-1  -> BTTS
3-0  -> NO BTTS
1-2  -> BTTS

h2h_btts = 3 / 5 = 0.60
```

Les matchs sans score complet doivent etre exclus du numerateur et du
denominateur.

## Taille et ponderation de l'historique

La baseline doit rester simple :

- maximum 5 confrontations recentes ;
- minimum 3 confrontations valides pour produire un signal ;
- `null` si l'historique est insuffisant ;
- aucune confrontation posterieure au match analyse ;
- domicile et exterieur confondus dans un premier temps.

Une variante ponderee par recence pourra ensuite etre testee :

```text
score = somme(resultat_i * poids_i) / somme(poids_i)
```

Exemple de poids du plus recent au plus ancien : `1.0`, `0.8`, `0.6`, `0.4`,
`0.2`.

La version ponderee ne doit etre retenue que si elle surpasse la moyenne simple
sur la periode de validation.

## Protocole d'evaluation

### 1. Collecte shadow

Enregistrer pour chaque fixture :

- le signal H2H adapte au marche ;
- le nombre de confrontations valides ;
- la probabilite baseline du modele ;
- la cote et la probabilite implicite du bookmaker ;
- le marche et le pick ;
- le resultat reel du pick ;
- la competition et la date du match.

Le signal doit etre collecte pour tous les matchs evaluables, pas uniquement
pour les paris effectivement places. Sinon, l'analyse subit un biais de
selection.

### 2. Separation chronologique

Le test doit respecter l'ordre temporel :

1. anciennes saisons pour le developpement et le calibrage ;
2. saison plus recente pour la validation ;
3. aucune modification des parametres apres observation de la validation.

Un split aleatoire est deconseille, car il mesure mal le comportement futur du
signal et augmente le risque de fuite temporelle.

### 3. Baselines a comparer

Pour chaque marche, comparer au minimum :

1. probabilite actuelle sans H2H ;
2. probabilite actuelle avec H2H simple ;
3. probabilite actuelle avec H2H pondere par recence ;
4. probabilite implicite du bookmaker comme reference externe.

### 4. Metriques

La decision ne doit pas reposer uniquement sur le hit rate ou le ROI.

Mesurer :

- Brier score ;
- log loss ;
- erreur de calibration ;
- ROI aux cotes disponibles ;
- hit rate ;
- couverture et nombre de picks ;
- resultats par marche, competition et taille d'historique.

Le ROI est une metrique secondaire : il est plus volatil et peut etre domine
par quelques paris a forte cote.

### 5. Test d'apport incremental

Une correlation positive entre le H2H et les resultats ne suffit pas. Le signal
doit apporter une information qui n'est pas deja contenue dans le modele ou les
cotes.

Tester une correction calibree de la forme :

```text
logit(P_corrigee) = logit(P_baseline) + beta_h2h * signal_h2h
```

Le coefficient `beta_h2h` doit etre appris sur la periode de developpement,
puis applique sans modification sur la periode de validation.

## Volume minimal

La correlation de Spearman actuelle peut servir d'alerte exploratoire apres 50
paris regles, mais ce volume est trop faible pour une activation fiable.

Seuils proposes :

| Etape               |                    Volume minimal | Usage                             |
| ------------------- | --------------------------------: | --------------------------------- |
| Exploration         |                   50 observations | detecter un signal potentiel      |
| Evaluation initiale |       200 observations par marche | comparer les metriques            |
| Activation limitee  |       500 observations par marche | shadow correction ou faible poids |
| Generalisation      | plusieurs saisons ou competitions | activation plus large             |

Si un marche n'atteint pas ces volumes, le H2H doit rester en observation.

## Criteres d'activation

Un signal H2H peut etre integre seulement si toutes les conditions suivantes
sont remplies :

- amelioration du Brier score ou du log loss hors echantillon ;
- calibration stable ou meilleure ;
- effet present sur plusieurs periodes, pas seulement une saison ;
- volume suffisant pour le marche concerne ;
- resultat non domine par quelques fixtures ;
- apport incremental apres prise en compte de la baseline et des cotes ;
- absence de degradation importante sur une competition majeure.

Une correlation de Spearman superieure a `0.15` ne doit donc pas declencher a
elle seule une activation automatique.

## Strategie d'integration progressive

### Phase 1 - Shadow par marche

Ajouter les signaux specialises dans `ModelRun.features` sans modifier la
decision :

```text
shadow_h2h_1x2
shadow_h2h_draw
shadow_h2h_btts
shadow_h2h_over_25
shadow_h2h_under_25
shadow_h2h_sample_size
```

### Phase 2 - Correction shadow

Calculer une probabilite corrigee et l'enregistrer sans l'utiliser :

```text
shadow_h2h_corrected_probability
shadow_h2h_probability_delta
```

Comparer ensuite la correction a la probabilite baseline sur les resultats
regles.

### Phase 3 - Activation limitee

Activer le signal uniquement pour le marche et les competitions valides, avec
un coefficient plafonne. Conserver un groupe de controle sans correction.

### Phase 4 - Activation generale ou abandon

Etendre l'utilisation seulement si le gain reste stable. Si l'amelioration
disparait hors echantillon, conserver le signal pour l'audit ou le retirer du
pipeline de decision.

## Recommandation pour BTTS

Pour BTTS, ne pas utiliser le `shadow_h2h` actuel. Implementer d'abord
`shadow_h2h_btts`, correspondant au taux historique de confrontations ou les
deux equipes ont marque.

Le premier test recommande est :

- 3 confrontations valides minimum ;
- 5 confrontations maximum ;
- moyenne simple comme baseline ;
- evaluation chronologique ;
- au moins 200 observations BTTS avant toute correction active ;
- comparaison Brier, log loss, calibration et ROI avec la baseline actuelle.

## Decision actuelle

Le H2H reste un signal experimental. Le score actuel ne doit pas etre branche
directement sur le moteur, car il n'est pas adapte a tous les marches et son
apport incremental n'a pas encore ete valide.

La prochaine etape est la collecte de signaux H2H specialises par marche, en
commencant par `shadow_h2h_btts`, puis leur evaluation hors echantillon.
