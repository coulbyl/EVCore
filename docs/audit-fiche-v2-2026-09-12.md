# Audit fiche EVCore — préalable au schéma v2 (2026-09-12)

Étape 1 du cahier des charges `prompt_evcore_fiche_v2.md`. **Aucun code modifié.**
Vérifications faites sur le code (`main` @ 008cb007) et sur la base de prod synchronisée
(`evcore-postgres`), fenêtre de référence **2026-09-11 → 2026-09-13** (373 SCHEDULED,
52 FINISHED, 1 IN_PROGRESS ; 2 620 ModelRun).

La « fiche » est produite par `GET /analysis-sheet?format=json`
([analysis-sheet.render.ts](../apps/backend/src/modules/analysis-sheet/analysis-sheet.render.ts)),
service [analysis-sheet.service.ts](../apps/backend/src/modules/analysis-sheet/analysis-sheet.service.ts).
Filtres actuels : `from`, `to`, `competitionCode`, `channel`, `format`. Plage max 90 jours.

---

## 1. Sources de données

| Fournisseur | Usage | Endpoints | Fréquence | Rate limit |
|---|---|---|---|---|
| **API-Football v3** (`v3.football.api-sports.io`) | fournisseur unique du temps réel | `/fixtures`, `/fixtures/statistics` (xG), `/odds` (prematch), `/injuries`, `/predictions`, `/coachs`, `/leagues`, `/status` | voir crons ci-dessous | 6 000 ms entre jobs saison, 2 000 ms entre appels `/fixtures/statistics` ; quota plan Pro 7 500 req/j, alerte à 80 % |
| **football-data.co.uk** (CSV) | cotes de clôture historiques (Pinnacle + Bet365) pour backtest | `mmz4281/<saison>/<div>.csv` | lundi 05:00 UTC | aucun (gratuit) |
| **The Odds API v4** | cotes historiques des compétitions UEFA | `/historical/...` | import one-shot manuel | 500 ms |
| **eloratings.net** | Elo équipes nationales (modèle de repli FRI) | `World.tsv` | 03:00 UTC quotidien | — |

Crons ETL ([etl.constants.ts:265](../apps/backend/src/config/etl.constants.ts#L265)) :

| Job | Cron UTC | Portée |
|---|---|---|
| `FIXTURES_SYNC` | `0 2 * * *` | J+0 → J+3 (forward-only) |
| `ELO_SYNC` | `0 3 * * *` | — |
| `STATS_SYNC` (xG) | `0 4 * * *` | matchs terminés sans xG |
| `ODDS_CSV_IMPORT` | `0 5 * * 1` | historique |
| `INJURIES_SYNC` | `0 6 * * *` | matchs à venir |
| **`ODDS_PREMATCH_SYNC`** | **`0 6,18 * * *`** | **J+1 → J+3 seulement** |
| `ROLLING_HORIZON` | `0 17 * * *` | analyse tiède J+1..J+4 |
| `BETTING_ENGINE_ANALYSIS` | `0 20 * * *` | J+1 (autoritaire) |
| `SAME_DAY_ANALYSIS` | `*/30 * * * *` | coup d'envoi < 3 h |
| `PENDING_BETS_SETTLEMENT` | `*/30 * * * *` | règlement |
| `STALE_SCHEDULED_SYNC` | `15 7 * * *` | réconciliation |
| `COACH_SYNC` | `0 1 * * 0` | hebdo |
| `SEASON_ROLLOVER_SYNC` | `45 1 * * *` | re-dérive la saison courante |

**Conséquence structurelle** (cause de plusieurs bugs plus bas) : l'horizon de collecte des
cotes est de **3 jours**, pas 7.

---

## 2. Données stockées

Schéma : [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma).

### 2.1 Équipes, matchs, scores, stats de match

| Champ | Table | Disponibilité mesurée |
|---|---|---|
| `Team.externalId/name/shortName/logoUrl/competitionId` | `team` | complète |
| `CoachTenure.coachName/startDate/endDate` | `coach_tenure` | sync hebdo |
| `Fixture.homeScore/awayScore` | `fixture` | complète sur FINISHED |
| **`Fixture.homeHtScore/awayHtScore`** | `fixture` | **17 984 / 17 998 (99,9 %)** sur 365 j — le taux « victoire en au moins une mi-temps » demandé en 2.1 est calculable |
| `Fixture.matchday/round/leg/aggregateHome(Away)Goals` | `fixture` | présent |
| `Fixture.status`, `scheduledAt` | `fixture` | complète |
| Stats de match détaillées (tirs, possession, corners…) | **aucune table** | `/fixtures/statistics` est appelé mais seul le xG (et le proxy tirs cadrés) est conservé |

### 2.2 xG

| Champ | Table | Disponibilité |
|---|---|---|
| `Fixture.homeXg/awayXg` `Decimal(5,3)` | `fixture` | **13 961 / 17 998 = 77,6 %** sur 365 j |
| `Fixture.xgUnavailable` | `fixture` | 3 910 marqués indisponibles |
| `TeamStats.xgFor/xgAgainst` (roulant 10 matchs) | `team_stats` | une ligne par (équipe, match joué) |

⚠ **Deux imputations silencieuses, non tracées :**

1. `calculateRollingXg` ([rolling-stats.utils.ts:31](../apps/backend/src/modules/rolling-stats/rolling-stats.utils.ts#L31)) : si aucun des 10 derniers matchs n'a de xG, il bascule sur `calculateRollingGoalsProxy` — **des buts bruts écrits dans la colonne `xgFor`**, sans drapeau.
2. `stats-sync.worker.ts:207` : si `expected_goals` est absent de la réponse API, `Fixture.homeXg` reçoit `tirs cadrés × 0.4` (`XG_SHOTS_PROXY_FACTOR`) — **même colonne, aucun marqueur**.

Le bloc `xg` du v2 exige « nombre de matchs avec xG et source ». Aujourd'hui la source n'est
récupérable ni depuis `team_stats` ni depuis `fixture`. C'est le plus gros trou de fiabilité
de l'audit : λ repose sur `xgFor/xgAgainst`, dont on ne sait pas si c'est du xG, un proxy de
tirs, ou des buts.

### 2.3 H2H

Aucune table. Les confrontations sont recalculées à la volée par
[h2h.service.ts](../apps/backend/src/modules/betting-engine/h2h.service.ts) :
requête `fixture` sur `status=FINISHED AND scheduledAt < fixtureDate`, croisement des deux
`teamId` dans les deux sens, `ORDER BY scheduledAt DESC LIMIT 5`. Point-in-time-safe par
construction. **`limit: 5` en dur à l'appel** ; les 10 confrontations demandées en 2.1
nécessitent seulement de passer `limit: 10` dans une requête dédiée à l'export (le stockage
permet déjà tout : date, score final, `homeHtScore/awayHtScore`, compétition via `seasonId`).

### 2.4 Classements

`Standing` existe (rank, points, played, win/draw/lose, goalsFor/Against/Diff, form,
description). **Mais la table est morte :**

```
 rows | comps |        last_sync
   48 |     1 | 2026-07-19 01:00:00
```

Aucun worker ne l'écrit — `grep` ne trouve qu'un nettoyage dans `packages/db/src/seed.ts`.
Le bloc `standing` du v2 n'a **aucune source aujourd'hui** : il faut soit un worker
`standings-sync` (API-Football `/standings`), soit le dériver des `fixture` terminées.

### 2.5 Cotes

| Champ | Table | État |
|---|---|---|
| `OddsSnapshot.bookmaker/market/pick/odds/homeOdds/drawOdds/awayOdds` | `odds_snapshot` | par bookmaker ✔ |
| `snapshotAt`, `source` (`PREMATCH`/…) | `odds_snapshot` | historique des snapshots ✔ |
| Cote d'ouverture | — | **non matérialisée** ; dérivable comme `MIN(snapshotAt)` mais bornée par l'horizon J+3 |

Bookmakers présents sur la fenêtre : **4 seulement** — Bet365 (16 marchés), Marathonbet (13),
Unibet (11), Pinnacle (7). Couverture par marché cible :

| Marché | Bookmakers | Matchs |
|---|---|---|
| `ONE_X_TWO` | 4 | 416 |
| `OVER_UNDER` (1.5 / 2.5) | 4 | 416 |
| `BTTS` | 3 | 416 |
| **`TO_WIN_EITHER_HALF`** | **1** | 405 |

Répartition des snapshots par avance sur le coup d'envoi :

```
 jours avant KO | snapshots
       64 / 63  |  1 119   (backfill ponctuel)
       11       |    290
        7       |    523
        6       | 20 798
        5       | 24 902
        4       | 45 751
        3       | 83 141
        2       |212 108
        1       |146 729
        0       |  2 249
```

Aucune profondeur > 7 jours en régime normal. **Il n'y a pas de « cote d'ouverture » au sens
marché** : la première cote observée est ~3 jours avant le coup d'envoi.

### 2.6 Blessures et compositions

| Donnée | Stockage | Disponibilité |
|---|---|---|
| Blessures | `ModelRun.features.shadow_injuries` = `{home: n, away: n, total: n}` — **des compteurs, pas de noms de joueurs** | **1 761 / 9 094 ModelRun (19 %)** sur 14 j |
| Compositions | `ModelRun.features.shadow_lineups` | **`null` sur 100 % des lignes** (0 / 9 094) |

Le bloc `availability` du v2 (« blessés et suspendus **clés** ») est donc **non réalisable**
à partir du stockage actuel : ni identité, ni poste, ni distinction blessure/suspension.

---

## 3. Calcul du λ

Chaîne complète, dans l'ordre
([betting-engine.service.ts:632-740](../apps/backend/src/modules/betting-engine/betting-engine.service.ts#L632)) :

**Entrées** : `TeamStats.xgFor`, `TeamStats.xgAgainst` des deux équipes, résolues sur la
saison en cours avec fusion cross-saison en début de saison (`blendTeamStats`,
`DOMESTIC_SEASON_ROLLOVER_FORM_WEIGHT/XG_WEIGHT`).

**λ de base** — `deriveLambdas` ([match-stats.ts:114](../packages/analysis-core/src/probability/match-stats.ts#L114)) :

```
leagueAvg = max(0.5, (xgF_home + xgF_away + xgA_home + xgA_away) / 4)
rawHome   = S · (xgF_home · xgA_away / leagueAvg) + (1 − S) · meanLambda      [S = LAMBDA_SHRINKAGE_FACTOR]
rawAway   = S · (xgF_away · xgA_home / leagueAvg) + (1 − S) · meanLambda
λ_home    = clamp(rawHome · homeAdvFactor  · lambdaScale, 0.05, 5)
λ_away    = clamp(rawAway · awayDisadvFactor · lambdaScale, 0.05, 5)
```

`meanLambda`, `homeAdvFactor`, `awayDisadvFactor`, `lambdaScale` viennent de
`buildLambdaConfig(competitionCode)` — table par ligue.

**Ajustements successifs** (tous actifs en prod, `feature-flags.constants.ts`) :

| # | Étape | Agit sur | Flag | Condition |
|---|---|---|---|---|
| 1 | `adjustLambdaForH2H(gamma = H2H_GAMMA)` | **λ lui-même** | `SCORING.H2H` | `shadow_h2h ≠ null` (n ≥ 3 confrontations) |
| 2 | `rebalanceThreeWayProbabilities` — blend empirique 1X2 vers `homeWinRate/awayWinRate/drawRate` | probabilités 1X2 | — | `blendWeight > 0` par ligue |
| 3 | `shrinkOverUnderProbabilities` — shrinkage O/U vers le taux de base ligue | probabilités O/U | — | config par ligue |
| 4 | `applyH2HMarketSignalCorrection` — logit-shift par marché (BTTS, O2.5, clean sheet, win-to-nil) | probabilités | `SCORING.H2H_MARKET_SIGNALS` | signaux H2H disponibles |
| 5 | `applyCongestionSignalCorrection` — logit-shift O2.5/BTTS | probabilités | `SCORING.CONGESTION` | toujours |

**D'où vient `adjustmentDelta`** : `probability − features.rawPoissonProbability`, où
`rawPoissonProbability` est la sortie Poisson brute calculée **sur le λ de base, avant
l'étape 1**. C'est donc la somme agrégée des **cinq** étapes ci-dessus, écrasées en un seul
scalaire. Un `+0.25` est parfaitement atteignable (étape 1 déplace λ, puis 2→5 déplacent
encore la probabilité) mais **rien dans la fiche ne permet de savoir quelle étape a
contribué quoi** — c'est exactement le manque que `lambdaTrace` doit combler.

---

## 4. Calcul de `dataCoverage`

[model-run-features.ts:117](../packages/analysis-core/src/model-run/model-run-features.ts#L117) :

```ts
dataCoverage = [shadowLineMovement, shadowH2h, shadowCongestion]
  .filter(s => s !== null).length / 3
```

Trois composantes, **poids égaux, aucune pondération**. Mesuré sur la fenêtre (2 620 ModelRun) :

| Composante | Non nulle | Taux |
|---|---|---|
| `shadow_congestion` | 2 620 | **100 %** |
| `shadow_h2h` | 1 617 | **61,7 %** |
| `shadow_lineMovement` | **13** | **0,5 %** |

D'où la valeur observée : **2/3 quand le H2H existe (n ≥ 3), 1/3 sinon**, et jamais 3/3 en
pratique. Ce n'est pas un arrondi : c'est un ratio de trois entiers, et une des trois
composantes est structurellement morte (voir §Bugs 1 et 2).

---

## 5. Calcul de `shadowSignals.h2h`

[h2h.ts:69](../packages/analysis-core/src/probability/h2h.ts#L69), `computeH2HScoreFromLegs` :

```
legs = 5 dernières confrontations directes terminées, antérieures au coup d'envoi, ordre récent → ancien
si legs.length < 3 → null

outcome(leg) = 1   si le vainqueur est le FAVORI
             = 0.5 si nul
             = 0   sinon
weight(i)    = 0.8^i          (i = 0 pour la plus récente)

h2h = Σ weight(i)·outcome(i) / Σ weight(i)
```

**Signification** : taux de victoire du favori dans cette confrontation, pondéré par
récence, nuls comptés pour un demi. **0.5 = neutre**, > 0.5 = l'historique confirme le
favori, < 0.5 = l'historique le contredit.

Le « favori » est défini à partir des probabilités 1X2 **avant** correction
(`baselineProbabilities.home ≥ baselineProbabilities.away`) — pas de circularité. Le score
alimente ensuite `adjustLambdaForH2H` (étape 1 du §3).

`null` sur 38,3 % des matchs = moins de 3 confrontations en base (`H2H_MIN_SAMPLE = 3`), ce
qui est attendu sur des équipes qui ne se sont jamais croisées ou sur un historique court.

---

## 6. Écart stockage ↔ export

Effort : **S** ≤ 0,5 j · **M** 1–2 j · **L** ≥ 3 j.

| Donnée (bloc v2) | Stockée ? | Où | Dans la fiche ? | Effort | Note |
|---|---|---|---|---|---|
| `context.form` — série W/D/L, points, BM/BE sur 5 et 10 matchs | ⚠ dérivable | `fixture` (scores) | ✗ | **M** | Rien n'est stocké tel quel ; `TeamStats.recentForm` est un **scalaire normalisé**. Requête d'agrégation à écrire. |
| `context.form` — 5 derniers à domicile / extérieur | ⚠ dérivable | `fixture` | ✗ | **S** (avec le point précédent) | même requête, filtre côté |
| `context.form.sampleSize` | ⚠ dérivable | `fixture` | ✗ | **S** | |
| `context.goals` — moyennes BM/BE dom/ext, saison N et N−1 | ⚠ dérivable | `fixture` + `season` | ✗ | **M** | 2 saisons = jointure `season` |
| `context.goals` — taux O1.5 / O2.5 / BTTS | ⚠ dérivable | `fixture` | ✗ | **S** | |
| `context.goals` — clean sheet / failed to score | ⚠ dérivable | `fixture` | ✗ | **S** | |
| `context.goals` — taux « victoire ≥ 1 mi-temps » | ⚠ dérivable | `fixture.homeHtScore/awayHtScore` (99,9 %) | ✗ | **M** | logique 1ère MT = HT, 2ème MT = FT−HT |
| `context.xg` — xG pour/contre sur N matchs | ✔ partiel | `team_stats.xgFor/xgAgainst` (N=10) | ✗ | **S** | |
| `context.xg.matchesWithXg` + **`source`** | ✗ | — | ✗ | **M** | **Bloquant qualité** : la colonne mélange xG réel / proxy tirs×0.4 / buts bruts sans marqueur. Exige une migration (colonne `xgSource`) ou un recalcul à l'export depuis `fixture`. |
| `context.standing` | ✗ (table morte) | `standing` — 48 lignes, 1 ligue, 2026-07-19 | ✗ | **M** | Worker `standings-sync` à créer, **ou** dériver des `fixture` FINISHED de la saison |
| `context.schedule` — jours de repos | ⚠ calculé, non conservé | `CongestionService.fetchTeamCongestionInputs` | ✗ (seul le scalaire `shadow_congestion`) | **S** | valeurs déjà calculées à chaque run, il suffit de les persister dans `features` |
| `context.schedule` — match européen/coupe ±4 j | ⚠ partiel | `fixture` (239 équipes ont ≥ 2 compétitions sur 120 j) | ✗ | **M** | dépend de la couverture des compétitions de coupe |
| `context.availability` — blessés/suspendus **clés** | ✗ | `shadow_injuries` = **compteurs seulement**, 19 % des runs ; `shadow_lineups` **toujours null** | ✗ | **L** | nécessite de stocker le détail joueur d'`/injuries` (nouvelle table) ; les suspensions ne sont pas fournies |
| `h2h` — 10 dernières confrontations détaillées + score MT | ⚠ dérivable | `fixture` | ✗ (seul le scalaire) | **S** | `H2HService.fetchLegs` avec `limit: 10` + champs supplémentaires |
| `h2h` — agrégats (V/N/D, moy. buts, O1.5/O2.5/BTTS) | ⚠ partiel | `computeH2HMarketSignalsFromLegs` calcule déjà BTTS/O2.5 (n=5, pondéré) | ✗ | **S** | |
| `h2h` — formule documentée de `shadowSignals.h2h` | ✔ (code) | §5 ci-dessus | ✗ | **S** | `meta.definitions` |
| `market` — meilleure cote + médiane + nb bookmakers | ✔ | `odds_snapshot` ; `findLatestOneXTwoOddsPerBookmaker`, `findLatestOverUnderOddsPerBookmaker`, `findBestPricesBatch` existent | ✗ | **S** (1X2/O/U) · **M** (5 autres marchés) | les loaders par bookmaker n'existent que pour 1X2 et O/U |
| `market` — `snapshotAt` | ✔ | `odds_snapshot.snapshotAt` | ✗ | **S** | |
| `market` — proba implicite **sans marge** | ✗ | — | ✗ | **M** | **Aucun de-vig n'existe dans le repo.** `computeMedianImpliedProbabilities` utilise volontairement `1/cote` brut pour rester aligné sur `AVOID_CONFIG.maxEdge`. Ajouter un de-vig = nouveau calcul + méthode à documenter ; ne pas l'injecter dans les gates existants. |
| `market` — cote d'ouverture vs actuelle | ⚠ dégradé | `MIN(snapshotAt)` par (fixture, bookmaker, marché, pick) | ✗ | **S** (+**M** si on veut une vraie ouverture) | horizon 3 j ⇒ ce n'est pas une ouverture de marché ; à nommer `firstObservedOdds` |
| `lambdaTrace` | ✗ | λ base non conservé séparément ; seuls `lambdaHome/Away` finaux + `rawPoissonProbability` | ✗ | **M** | instrumenter les 5 étapes du §3 dans `features` |
| `dataCoverageDetail` | ⚠ | les 3 composantes sont dans `features` | ✗ (seul le ratio) | **S** | |
| 7 marchés cibles toujours présents dans `evaluatedPicks` | ⚠ partiel | `features.evaluatedPicks` ne liste que les picks **évalués** | partiel | **M** | `TO_WIN_EITHER_HALF` n'a qu'**1 bookmaker** ⇒ pick absent quand non coté ; prévoir une entrée `null` + `reason` |
| `edge` (proba modèle − proba marché) par marché cible | ⚠ | recalculable depuis `probability` et `odds` | ✗ (implicite) | **S** | ⚠ rappel CLAUDE.md : l'edge est **anti-prédictif**, à exposer comme diagnostic, jamais comme critère de tri |
| `calibration` — par marché × compétition | ⚠ dérivable | `channel_selection` : **195 251 réglés** (`WON` 95 058 / `LOST` 100 193), dont O/U 53 356, 1X2 22 375, BTTS 16 001, TO_WIN_EITHER_HALF 13 913 | ✗ | **M** | volume largement suffisant ; agrégat coûteux ⇒ vue matérialisée ou cache |
| `calibration` — biais λ par compétition | ⚠ dérivable | `features.lambdaHome/Away` + `fixture.homeScore/awayScore` | ✗ | **M** | |
| `legPool` | ✗ | — | ✗ | **M** | assemblage des blocs ci-dessus ; `correlationGroup = fixtureId` trivial |
| Filtres export (dates/status/marchés/`excludeChannels`) | — | — | partiel (`from/to/competitionCode/channel`) | **S** | |
| Mode `compact` | — | — | ✗ | **S** | |
| `schemaVersion` | — | — | ✗ (**absent du repo entier**) | **S** | |

---

## 7. Les 7 bugs signalés

### 1. `dataCoverage = 0.6666…` — **confirmé, ce n'est pas un problème d'arrondi**

C'est `2/3` exact (§4). Un filtre `≥ 0.67` élimine 100 % des matchs parce que **3/3 est
inatteignable** : `shadow_lineMovement` est renseigné sur 0,5 % des runs.
→ Exposer `coverageLevel: 1|2|3` **et** `dataCoverageDetail` (composante, présent/absent,
poids). Le vrai correctif est le bug 2.

### 2. `lineMovement` null sur 371/372 — **confirmé, cause structurelle**

Le flag `SCORING.LINE_MOVEMENT` est bien à `true`. Le signal exige un snapshot **antérieur à
KO − 7 jours** (`cutoff7d`, [betting-engine.service.ts:814](../apps/backend/src/modules/betting-engine/betting-engine.service.ts#L814)),
mais `ODDS_PREMATCH_HORIZON_DAYS = 3`. **On ne collecte jamais de cotes 7 jours avant le
coup d'envoi.** Les 13 exceptions viennent d'un backfill ponctuel (snapshots à 63–64 j).

Trois correctifs possibles, par ordre de coût :
- **(a)** comparer au **premier snapshot disponible** (typiquement KO−3 j) au lieu d'un
  cutoff fixe, en exposant l'ancrage réel (`baselineSnapshotAt`, `baselineHoursBeforeKickoff`). Effort **S**.
- **(b)** porter `ODDS_PREMATCH_HORIZON_DAYS` à 7 — mais ×2,3 sur le quota API-Football
  (déjà alerté à 80 %), donc à chiffrer avant.
- **(c)** conserver le seuil 7 j et assumer que la composante est absente → alors la retirer
  du dénominateur de `dataCoverage`.

⚠ Effet de bord à ne pas manquer : `LINE_MOVEMENT_THRESHOLD` **exclut un pick** quand le
mouvement est défavorable. Le rendre enfin actif change la sélection sur ~100 % des matchs.
À valider en shadow avant activation.

### 3. `adjustmentDelta` jusqu'à +0.25 sans traçabilité — **confirmé**

Voir §3 : c'est l'agrégat de 5 étapes (correction λ H2H, blend empirique 1X2, shrinkage O/U,
logit-shift H2H par marché, logit-shift congestion). `lambdaTrace` + un
`probabilityAdjustments[]` (nom, delta, raison) par marché répondent exactement au besoin.

### 4. Portée de `calibrationAlert` — **le flag est déjà à deux portées distinctes**

| Clé `features` | Marchés couverts | Seuils |
|---|---|---|
| `calibration_alert` | **1X2 uniquement** | `MAX_DIVERGENCE = 0.30`, `FAVORITE_FLIP_MIN_GAP = 0.15`, `MIN_BOOKMAKERS = 2` |
| `calibration_alert_over_under` | **OVER_UNDER**, par ligne (1.5/2.5/3.5/4.5) | `FAVORITE_FLIP_MIN_GAP = 0.10`, pas de `MAX_DIVERGENCE` (volume insuffisant, n=10 au-delà de 0.30) |

Réponse à la question posée : **`favorite_flip` calculé sur le 1X2 ne bloque pas les marchés
de buts** — ceux-ci ont leur propre gate. En revanche `hasCalibrationAlert()` retourne `true`
si **l'une ou l'autre** clé est présente, et c'est ce booléen que le coupon lit
(`coupon-pool.service.ts`) : au niveau staking, la portée est donc bien **tout le match**.
C'est un écart réel entre la granularité du calcul et celle de l'application. À documenter
dans `meta.definitions` (portée par famille de marchés), et à trancher séparément.

### 5. Divergences +14 à +29 pts sans `avoidFlag` — **comportement nominal, pas un bug**

`AVOID_CONFIG.maxEdge = 0.30`, **global, toutes ligues**
([avoid.config.ts](../packages/analysis-core/src/strategies/avoid.config.ts)). Un edge de
0.14 à 0.29 est donc en dessous du seuil par construction. Le seuil est justifié par une
validation 2026-06-23 sur 3 saisons : ROI `[0.20, 0.30)` = +10,9 % vs `≥ 0.30` = −20,4 %.

Deux limites de portée, elles bien réelles :
- AVOID ne parcourt que les picks **`SELECTED`** des autres canaux
  ([avoid.strategy.ts:39](../packages/analysis-core/src/strategies/avoid.strategy.ts#L39)) —
  un pick rejeté à edge 0.45 ne déclenche rien.
- L'exemple cité (Excelsior – Utrecht, 0.67 vs 0.40) donne edge = **0.27** : sous le seuil.

⚠ À croiser avec `MAX_LEG_EDGE = 0.10` (plafond au staking, CLAUDE.md) : un edge de 0.27
est déjà écarté à la composition du coupon. Le v2 doit exposer l'edge **et** les deux
plafonds pour que ce soit lisible.

### 6. `shadowSignals.h2h` non documenté, null sur 139/372 — **confirmé**

Formule en §5. Le `null` est nominal (`H2H_MIN_SAMPLE = 3`), mesuré à 38,3 % sur la fenêtre.
→ `meta.definitions.h2hScore` + `h2h.sampleSize` + `reason: "insufficient_h2h_sample"`.

### 7. Seuil d'EV du canal GOALS — **la prémisse est inexacte**

GOALS n'a **pas** de seuil d'EV : il a un seuil de **probabilité** par
(ligue × ligne × side) dans `GOALS_CONFIG`, puis classe les candidats restants par EV
([goals.strategy.ts:83](../packages/analysis-core/src/strategies/goals.strategy.ts#L83)).
Sur la fenêtre, GOALS ne rejette que pour `no_priced_line` (123) — jamais pour l'EV.

Les Over 1.5 sont écartés **ailleurs**, par le gate de sélection générique
(`getPickRejectionReason`) :

| `OVER_UNDER / OVER_1_5` | n | cotes |
|---|---|---|
| `ev_below_threshold` | **2 436** | 1.04 – 1.75 |
| `probability_too_low` | 29 | 1.14 – 1.64 |
| `odds_below_floor` | 15 | 1.17 – 1.54 |
| `quality_score_below_threshold` | 7 | 1.28 – 1.41 |
| **viable** | **0** | — |

Autrement dit : **aucun Over 1.5 n'est jamais viable**, la quasi-totalité étant coupée par le
plancher d'EV (`EV_THRESHOLD` / `getLeagueEvThreshold` / `getPickEvFloor`). Or Over 1.5 est
un des 7 marchés cibles du combiné. C'est la conséquence la plus lourde de l'audit pour
l'objectif produit. → Exposer `evFloorApplied` et `evFloorSource` par pick.

### Bonus — `odds_below_floor` (point 2 du cahier des charges)

**Mal nommé, la logique est correcte.** Ce n'est pas un plancher de cote absolu : c'est un
**plancher par (ligue × marché × pick)** issu des backtests ROI
([ev.constants.ts:171-360](../apps/backend/src/modules/betting-engine/ev.constants.ts#L171)).
Défaut 2.00, avec surcharges : `LL`/`SA` 1.80, `FRI` 1.40, `SP2|1X2|HOME` 1.50,
`CH|1X2|HOME` **5.00**, `PL|1X2|DRAW` **5.00**, `BL1|1X2|HOME` **5.00**, `J1|1X2|HOME` **5.00**…

Il exclut délibérément les **favoris courts à EV élevé**, parce que ces segments ont perdu de
l'argent en backtest. D'où les deux observations du cahier des charges — cote 1.17 (< 2.00)
et cote 3.47 (< 5.00 pour `CH|HOME`), toutes deux correctes. Mesuré sur la fenêtre :
`ONE_X_TWO|HOME` rejeté pour ce motif sur 117 picks, cotes 1.21 → **3.50**.

→ Renommer `odds_below_league_segment_floor` et exposer dans la fiche la valeur du plancher
appliqué + sa source. (Renommage = **changement de contrat** sur `rejectionReason` : à faire
en additif — nouveau champ `rejectionReasonDetail` — pour ne pas casser tes scripts.)

---

## 8. Points à trancher avant l'étape 2

1. **`lineMovement`** : correctif (a), (b) ou (c) du bug 2 ? (a) est le meilleur rapport
   coût/valeur mais change la sémantique du signal ; (b) coûte du quota API.
2. **`standing`** : nouveau worker `standings-sync`, ou dérivation depuis `fixture` ?
3. **`context.availability`** : on accepte les compteurs `shadow_injuries` (19 % de
   couverture, sans noms), ou on ouvre le chantier « détail joueur » (effort L) ?
4. **Source xG** : on ajoute une colonne `xgSource` sur `fixture` (migration, à lancer par
   toi) ou on recalcule la provenance à l'export ?
5. **De-vig** : quelle méthode ? (proportionnelle / Shin / logarithmique). À exposer en
   parallèle de `1/cote`, sans toucher aux gates existants.
6. **Over 1.5** : le plancher d'EV le rend structurellement invisible. On l'expose quand même
   dans `evaluatedPicks` avec son motif de rejet (fiche = diagnostic), ou on ouvre un
   chantier de calibration séparé ?
7. **Volumétrie** : les blocs `context` + `h2h` détaillé vont **augmenter** la taille, alors
   que la fiche pèse déjà 13,6 Mo. Le mode `compact` et les filtres doivent atterrir dans la
   même PR, pas après.

---

*Étape 2 non démarrée — en attente de validation.*
