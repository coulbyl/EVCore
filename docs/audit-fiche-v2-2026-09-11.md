# Audit fiche EVCore — préalable au schéma v2 (2026-09-11)

> Étape 1 de la mission « fiche v2 ». **Aucun code modifié.** Ce document
> répond aux 6 questions de l'audit, explique les 7 bugs constatés sur la
> fiche du 2026-09-11 → 2026-09-13, et chiffre l'effort d'exposition de
> chaque donnée manquante.
>
> **Limite de cet audit :** aucun accès base dans cet environnement
> (pas de démon Docker, donc pas de `docker exec evcore-postgres psql`).
> Tous les constats ci-dessous sont dérivés du **code** (requêtes, formules,
> constantes, feature flags) et non de comptages SQL. Partout où un chiffre
> de la fiche est expliqué (0.6666, `lineMovement` null 371/372, `h2h` null
> 139/372), l'explication est une **déduction mécanique vérifiable** — les
> comptages exacts restent à confirmer en local. Les requêtes de
> vérification sont données en §8.

---

## 1. Sources de données

| Fournisseur | Endpoint / fichier | Usage | Fréquence (cron UTC) |
| --- | --- | --- | --- |
| **API-FOOTBALL** `v3.football.api-sports.io` | `GET /fixtures?league&season` | calendrier, scores FT **et HT**, statut | `FIXTURES_SYNC` 02:00 quotidien, J+0→J+3 (`FIXTURES_ROUTINE_LOOKAHEAD_DAYS=3`) |
| | `GET /fixtures?id=` | règlement des paris en attente | `PENDING_BETS_SETTLEMENT` toutes les 30 min |
| | `GET /fixtures?id=` | réconciliation des fixtures passées restées SCHEDULED | `STALE_SCHEDULED_SYNC` 07:15 |
| | `GET /fixtures/statistics?fixture=` | **xG** (`expected_goals`) + stats de match | `STATS_SYNC` 04:00, délai 2 s/appel (`STATS_RATE_LIMIT_MS`) |
| | `GET /odds?fixture=` | cotes prématch, 5 bookmakers, 18 bet types | `ODDS_PREMATCH_SYNC` **06:00 + 18:00**, horizon **J+1→J+3** (`ODDS_PREMATCH_HORIZON_DAYS=3`) |
| | `GET /injuries?fixture=` | blessures (J et J+1 seulement) | `INJURIES_SYNC` 06:00 |
| | `GET /coachs?team=` | historique des entraîneurs (proxy `sameCoach` H2H) | `COACH_SYNC` 01:00 le dimanche |
| | `GET /predictions?fixture=` | 2ᵉ avis (shadow, jamais décisionnel) | à chaque analyse, si `SHADOW_PREDICTIONS_ENABLED !== 'false'` |
| | `GET /leagues?id=` | dates de saison | à la demande (`league-season-dates.ts`) |
| | `GET /status` | quota (alerte à 80 %) | après chaque job de sync |
| **The Odds API** `api.the-odds-api.com/v4` | historique de cotes | import one-shot backtest, **ligne 2.5 uniquement** | manuel (`ODDS_HISTORICAL_IMPORT`) |
| **football-data.co.uk** | CSV `mmz4281` | cotes de clôture Pinnacle + Bet365 (backtest) | `ODDS_CSV_IMPORT` 05:00 le lundi |
| **eloratings.net** | `World.tsv` | Elo pour le modèle FRI (matchs internationaux) | `ELO_SYNC` 03:00 |

Rate limit global API-Football : `API_FOOTBALL_RATE_LIMIT_MS = 6000` (plan Pro
7 500 req/j). Bookmakers prioritaires : Pinnacle (4), Bet365 (8), Unibet (16),
Marathonbet (2), Bwin (6).

Cadence d'analyse (donc de génération des `ModelRun`) :
`ROLLING_HORIZON` 17:00 (J+1→J+4), `BETTING_ENGINE_ANALYSIS` 20:00 (J+1),
`SAME_DAY_ANALYSIS` toutes les 30 min dans une fenêtre de 3 h avant le coup
d'envoi. Un fixture porte donc typiquement 2 à 6 `ModelRun`.

---

## 2. Données stockées

### 2.1 Équipes, matchs, scores, stats de match

| Modèle | Champs utiles |
| --- | --- |
| `Team` | `externalId`, `name`, `shortName`, `logoUrl`, `competitionId` |
| `CoachTenure` | `coachName`, `startDate`, `endDate` (par équipe) |
| `Fixture` | `externalId`, `seasonId`, `homeTeamId`, `awayTeamId`, `matchday`, `round`, `leg`, `aggregateHomeGoals/AwayGoals`, `scheduledAt`, `status`, **`homeScore`/`awayScore`**, **`homeHtScore`/`awayHtScore`**, `homeXg`/`awayXg`, `xgUnavailable` |
| `TeamStats` | 1 ligne par (équipe, fixture) : `recentForm` (scalaire), `xgFor`, `xgAgainst`, `homeWinRate`, `awayWinRate`, `drawRate`, `leagueVolatility` |
| `Competition` / `Season` | `code`, `name`, `country`, `isActive`, `seasonStartMonth`, `apiSeasonOverride` |

**Les scores à la mi-temps sont bien stockés** (`fixtures-sync.worker.ts:264`,
depuis `score.halftime`). Le taux « victoire en au moins une mi-temps » est
donc calculable sans source externe.

**Pas de stats de match détaillées** (tirs, possession, corners) : le worker
`stats-sync` n'extrait de `/fixtures/statistics` que `expected_goals` (et un
proxy tirs × 0.4 pour 2022-23). Rien d'autre n'est persisté.

### 2.2 xG

- Stockés par match sur `Fixture.homeXg` / `awayXg` (`Decimal(5,3)`),
  `xgUnavailable: boolean` quand l'API n'a rien renvoyé.
- Agrégés en rolling 10 matchs dans `TeamStats.xgFor` / `xgAgainst`.
- ⚠ **Imputation silencieuse existante** : `calculateRollingXg()`
  (`rolling-stats.utils.ts:32`) bascule sur `calculateRollingGoalsProxy()`
  — moyenne de **buts réels** — dès qu'aucun des matchs de la fenêtre n'a de
  xG, **sans poser aucun marqueur**. `TeamStats.xgFor` peut donc être une
  moyenne de buts sans que rien ne le dise. La fiche v2 doit calculer la
  couverture xG directement depuis `Fixture.homeXg/awayXg` (honnête et
  auditable) plutôt que de relayer `TeamStats.xgFor`.

### 2.3 H2H

**Aucune table H2H.** Le H2H est recalculé à la volée par
`H2HService.fetchLegs()` : `fixture WHERE status=FINISHED AND scheduledAt <
fixtureDate AND (paire d'équipes dans les deux sens) ORDER BY scheduledAt DESC
LIMIT 5`. Point-in-time-safe par construction. Seuls des **scalaires dérivés**
sont persistés, dans `ModelRun.features` : `shadow_h2h`,
`shadow_h2h_btts/over25/clean_sheet_home/clean_sheet_away/win_to_nil_home/win_to_nil_away`,
`shadow_h2h_sample_size`, `shadow_h2h_scoreline`,
`shadow_h2h_scoreline_confidence`. **Jamais la liste des confrontations.**

### 2.4 Classements

`Standing` existe au schéma (`rank`, `points`, `played`, `win/draw/lose`,
`goalsFor/Against/Diff`, `form`, `description`) mais **la table est morte** :
aucun worker ETL ne l'écrit, aucun service ne la lit. Seule référence dans tout
le repo : une routine de déduplication dans `packages/db/src/seed.ts`.
Elle serait de plus **non point-in-time** (contrainte unique
`(competitionId, seasonId, teamApiId)` + `syncedAt @updatedAt` → écrasée à
chaque sync), donc inutilisable sur un fixture passé sans fuite de données.

→ Le bloc `standing` de la fiche v2 doit être **recalculé point-in-time** depuis
les `Fixture` FINISHED de la saison antérieurs au coup d'envoi. Coût : une
requête agrégée par compétition/saison, mutualisable sur toute la plage.

### 2.5 Cotes

`OddsSnapshot` : `fixtureId`, `bookmaker`, `market`, `pick`, `homeOdds`,
`drawOdds`, `awayOdds`, `odds`, `source` (`PREMATCH` | `HISTORICAL`),
`snapshotAt`. Unique sur `(fixtureId, bookmaker, market, pick, snapshotAt)`
avec `NULLS NOT DISTINCT`.

- **Par bookmaker : oui**, 5 books prioritaires.
- **Historique des snapshots : oui**, mais borné par l'horizon de collecte :
  `ODDS_PREMATCH_SYNC` ne couvre que **J+1 → J+3** à raison de 2 passes/jour,
  soit **au mieux ~6 snapshots** par fixture, tous dans les 3 derniers jours.
- **Cote d'ouverture : pas de champ dédié**, mais récupérable comme
  `MIN(snapshotAt)` par `(fixtureId, market, pick, bookmaker)`. C'est la
  « première cote vue par EVCore », pas l'ouverture réelle du book — il faudra
  le nommer honnêtement (`firstSeenOdds`) et exposer `firstSeenAt`.
- Le moteur ne lit aujourd'hui que le **dernier** snapshot
  (`findLatestOddsSnapshot`, meilleur book par `bookmakerRank`). Aucune
  médiane multi-books n'est exposée ; elle n'est calculée que pour le gate de
  cohérence (`findLatestOneXTwoOddsPerBookmaker`, 1X2 et O/U seulement) et
  jamais écrite dans la fiche.

### 2.6 Blessures et compositions

- **Blessures** : aucune table. `injuries-sync` compte les joueurs et écrit
  `{home, away, total}` dans `features.shadow_injuries` du **dernier ModelRun**,
  en post-traitement. Uniquement pour les fixtures de J et J+1. Aucun nom de
  joueur, aucune distinction titulaire/remplaçant, **donc « blessés et
  suspendus clés » est hors de portée des données actuelles.**
  `FEATURE_FLAGS.SCORING.INJURIES = false` → jamais consommé par le scoring.
- **Compositions** : `features.shadow_lineups` est **écrit en dur à `null`** et
  aucun worker ne le remplit (`FEATURE_FLAGS.SCORING.LINEUPS = false`). Donnée
  inexistante.

---

## 3. Calcul du λ

### 3.1 Entrées

`deriveLambdas(homeStats, awayStats, buildLambdaConfig(competitionCode))`
(`analysis-core/probability/match-stats.ts:114`) ne consomme que **4 nombres** :
`homeStats.xgFor`, `homeStats.xgAgainst`, `awayStats.xgFor`,
`awayStats.xgAgainst` (rolling 10 matchs, cf. le piège d'imputation §2.2), plus
la config de ligue `{meanLambda, homeAdvFactor, awayDisadvFactor, lambdaScale?}`.

La forme (`recentForm`), la perf dom/ext et la volatilité de ligue **n'entrent
pas dans λ** : elles ne servent qu'au `deterministicScore`
(`buildMatchupFeatures` → `calculateDeterministicScore`), qui est un gate de
publication, pas un paramètre de la distribution.

### 3.2 Chaîne d'ajustements, dans l'ordre réel

```
leagueAvg = max(0.5, (hXgFor + aXgFor + hXgAgainst + aXgAgainst) / 4)

λ_raw_home = 0.7 × (hXgFor × aXgAgainst / leagueAvg) + 0.3 × meanLambda   # LAMBDA_SHRINKAGE_FACTOR = 0.7
λ_raw_away = 0.7 × (aXgFor × hXgAgainst / leagueAvg) + 0.3 × meanLambda

λ_base_home = clamp(λ_raw_home × homeAdvFactor   × lambdaScale, 0.05, 5)
λ_base_away = clamp(λ_raw_away × awayDisadvFactor × lambdaScale, 0.05, 5)

# (1) correction H2H sur λ — si FEATURE_FLAGS.SCORING.H2H et shadow_h2h ≠ null
signal  = shadow_h2h − 0.5
λ_final[favori]  = λ_base[favori]  × (1 + 0.2 × signal)     # H2H_GAMMA = 0.2
λ_final[outsider]= λ_base[outsider]× (1 − 0.2 × signal)
λ_final = clamp(…, LAMBDA_MIN, LAMBDA_MAX)
```

Le favori est déterminé **avant** correction (`baselineProbabilities.home >=
.away`), donc sans circularité.

`lambdaFloorHit = λ_final.home <= 0.05 || λ_final.away <= 0.05` est stocké dans
`features` mais **absent de la fiche**.

### 3.3 D'où vient `adjustmentDelta` — et pourquoi il atteint +0.25

`adjustmentDelta = probability − rawPoissonProbability` (par `(market, pick)`,
`analysis-sheet.render.ts:594`).

Or `features.rawPoissonProbability` est calculé depuis **λ_base** (retour de
`computeFromTeamStats`, ligne 208 : `rawProbabilities = computeProbabilities(λ_base)`),
tandis que `probability` sort de **5 couches cumulées**. `adjustmentDelta` est
donc un **agrégat opaque** de :

| # | Couche | Portée marchés | Paramètre |
| --- | --- | --- | --- |
| 1 | correction H2H sur λ (`adjustLambdaForH2H`) | **tous** (λ recalculé) | `H2H_GAMMA = 0.2` |
| 2 | blend empirique 1X2 (`rebalanceThreeWayProbabilities`) | 1X2 + dérivés DC/DNB | `getLeagueThreeWayEmpiricalBlendWeight(league)` |
| 3 | shrinkage O/U (`shrinkOverUnderProbabilities`) | O/U 1.5–4.5, BTTS, O/U HT, Team Total | `factor` + `baseRates` par ligue (pente de calibration mesurée, 0.22–0.28 en ligue pauvre) |
| 4 | signal H2H par marché (`applyH2HMarketSignalCorrection`) | **btts, over25, cleanSheet\*, winToNil\* uniquement** | `H2H_MARKET_SIGNAL_DELTAS` (0.35 à 0.6) |
| 5 | correction congestion (`applyCongestionSignalCorrection`) | over25, btts | — |

**Mura – Aluminij, Over 2.5 à +0.25** est donc attendu, pas anormal : c'est
(3) + (4) + (5) qui s'empilent sur la même ligne, en ligue pauvre en données
(shrinkage vers le taux de base de ligue = le plus gros contributeur).
Aucune de ces 5 couches n'est visible dans la fiche → point 2.3 de la mission.

⚠ Conséquence pour le design v2 : un `lambdaTrace` seul **ne suffit pas** à
reconstruire une probabilité — il ne couvre que l'étape (1). Il faut **deux**
traces : `lambdaTrace` (λ) et une trace de probabilité par pick
(`probabilityTrace`, couches 2→5). Note aussi que **Over 1.5 ne reçoit que la
couche (3)** : ni (4) ni (5) ne touchent `over15`.

---

## 4. Calcul de `dataCoverage` — et pourquoi 1/3 ou 2/3

`computeDataCoverage()` (`analysis-core/model-run/model-run-features.ts:118`) :

```ts
[shadowLineMovement, shadowH2h, shadowCongestion]
  .filter(s => s !== null).length / 3
```

3 composantes, poids égaux. État réel de chacune :

| Composante | Peut-elle être non-null ? | Pourquoi |
| --- | --- | --- |
| `shadow_lineMovement` | **pratiquement jamais** | voir §4.1 — bug structurel |
| `shadow_h2h` | oui, si ≥ 3 legs H2H historiques (`H2H_MIN_SAMPLE = 3`) | sinon `null` |
| `shadow_congestion` | **toujours** | `CongestionService.computeCongestionScore()` retourne `Promise<number>`, jamais `null` (score 0 quand pas de données) |

Donc la valeur ne peut valoir que :
- **2/3 = 0.6666…** quand le H2H a ≥ 3 legs,
- **1/3 = 0.3333…** sinon.

Elle **ne peut jamais atteindre 1**. Un filtre `≥ 0.67` élimine 100 % des
matchs par construction, pas par hasard — c'est exactement le bug #1 constaté.
Et « 139 matchs sur 372 avec `h2h` null » (37 %) est cohérent avec la part de
paires d'équipes ayant moins de 3 confrontations en base.

### 4.1 Pourquoi `lineMovement` est null sur 371 matchs / 372

Le calcul (`betting-engine.service.ts:808-838`) exige **quatre** conditions
simultanées :

1. `FEATURE_FLAGS.SCORING.LINE_MOVEMENT` — ✅ `true` ;
2. `latestOdds !== null` ;
3. **`valueBet !== null`** — il faut qu'au moins un pick ait passé *tous* les
   gates (`candidatePicks[0]`). Déjà très filtrant ;
4. **`findLatestOddsSnapshot(fixtureId, kickoff − 7 jours) !== null`** — il faut
   un snapshot de cotes **antérieur à J−7**.

La condition 4 est **structurellement impossible** : `ODDS_PREMATCH_SYNC` ne
collecte que sur l'horizon **J+1 → J+3** (`ODDS_PREMATCH_HORIZON_DAYS = 3`).
Aucun snapshot `PREMATCH` n'existe jamais avant J−3, *a fortiori* avant J−7.
La fenêtre de lecture (7 jours) et la fenêtre de collecte (3 jours) ne se
recouvrent pas.

→ `shadowLineMovement` reste `null`, `dataCoverage` plafonne à 2/3, et le filtre
« mouvement adverse > 10 % » (`LINE_MOVEMENT_THRESHOLD`) **n'a jamais été
appliqué en production**. Le 1 cas sur 372 est presque certainement un fixture
portant un snapshot `HISTORICAL` (import CSV/The Odds API) daté avant J−7.

**Correctif recommandé** : remplacer le *cutoff absolu à 7 jours* par le
**premier snapshot disponible** pour ce `(market, pick)` (`MIN(snapshotAt)`),
et exposer `firstSeenAt` / `firstSeenOdds` / `latestAt` / `latestOdds`. Le
mouvement devient réel et mesuré sur la fenêtre qui existe réellement (~48 h),
et cela fournit au passage la « cote d'ouverture » du point 2.2.
À noter : cela **réactive un filtre qui était dormant** — donc à livrer en
*shadow* (valeur exposée, gate non armé) pour ne pas changer les décisions dans
la même PR que l'enrichissement de la fiche.

---

## 5. Calcul de `shadowSignals.h2h`

`computeH2HScoreFromLegs(legs, favoriteTeamId)`
(`analysis-core/probability/h2h.ts:69`) :

```
legs = 5 dernières confrontations (les 2 sens), FINISHED, scheduledAt < kickoff
si legs.length < 3  →  null

poids_i      = 0.8^i          (i = 0 pour la plus récente ; H2H_DECAY = 0.8)
outcome_i    = 1    si le favori a gagné ce leg
             = 0.5  si nul                  (H2H_DRAW_SCORE)
             = 0    sinon

score = Σ(poids_i × outcome_i) / Σ(poids_i)
```

**Sens du scalaire** : taux de victoire du **favori du modèle** (défini avant
correction, sur les probabilités 1X2 de base) dans ce face-à-face, pondéré par
récence, les nuls comptant pour moitié. Domaine `[0, 1]`.
**0.5 = neutre** (c'est la valeur de référence soustraite dans
`adjustLambdaForH2H` : `signal = score − 0.5`).
**> 0.5** = le H2H confirme le favori → son λ est majoré jusqu'à +10 %
(`gamma × 0.5 = 0.1`) ; **< 0.5** = le H2H le contredit → λ minoré jusqu'à −10 %.

Trois choses à retenir : **le score n'a aucun sens sans savoir qui est le
favori** (il n'est pas orienté « domicile »), **il ignore le lieu** (un leg
joué à l'extérieur compte comme un leg à domicile), et **il ignore la
compétition** (un match de coupe pèse autant qu'un match de championnat). La
fiche v2 doit publier la formule, `sampleSize`, `favoriteTeamId` et la liste
des legs pour qu'il soit interprétable.

---

## 6. Écart entre stockage et export

### 6.1 Déjà dans `ModelRun.features` mais absent de la fiche

Exposition = pure lecture de JSON déjà écrit, **effort S** (quelques heures,
zéro requête supplémentaire) :

`probabilities` (les 17 marchés complets !), `lambdaFloorHit`, `fallbackReason`,
`shadow_h2h_btts/over25/clean_sheet_*/win_to_nil_*`, `shadow_h2h_sample_size`,
`shadow_h2h_scoreline(+confidence)`, `h2h_correction_applied`,
`congestion_correction_applied`, `shadow_injuries`, `shadow_ml_*`,
`homeDrawRate`, `awayDrawRate`, `recentForm`, `xg`, `performanceDomExt`,
`volatiliteLigue`, `candidatePicks`, `hasMarketOdds`, `hasPinnacleOdds`,
`hasHomeElo`, `hasAwayElo`.

### 6.2 Tableau de synthèse — demande par demande

Légende effort : **S** ≤ ½ j · **M** 1–2 j · **L** 3–5 j · **XL** > 5 j ou bloqué.

| Donnée | Stockée ? | Où | Exposée dans la fiche ? | Effort |
| --- | --- | --- | --- | --- |
| **2.1 `context.form`** — série W/D/L, pts, BP/BC sur 5 et 10 derniers, 5 derniers dom/ext, `sampleSize` | Dérivable | `Fixture` (scores + `scheduledAt`) ; `TeamStats.recentForm` n'est qu'un scalaire pondéré | ❌ | **M** (1 requête batch par équipe × plage + agrégation pure + tests) |
| **2.1 `context.goals`** — moyennes BP/BC dom/ext, taux O1.5/O2.5/BTTS, clean sheet, failed-to-score, saison N et N−1 | Dérivable | `Fixture` | ❌ | **M** (même requête que form, fenêtrage par saison) |
| **2.1 `context.goals.winEitherHalfRate`** | Dérivable | `Fixture.homeHtScore/awayHtScore` + scores FT | ❌ | **S** (réutilise la logique `tuning.metrics.ts:155-178`) |
| **2.1 `context.xg`** — xG pour/contre sur N derniers, N explicite, `matchesWithXg`, source | Oui, par match | `Fixture.homeXg/awayXg`, `xgUnavailable` | ❌ (seul l'agrégat `features.xg` existe, non exposé, et potentiellement un proxy buts silencieux) | **S** si calculé depuis `Fixture` (recommandé) |
| **2.1 `context.standing`** — rang, pts, joués, diff. de buts | ⚠ **Table `Standing` morte** (jamais écrite) et non point-in-time | — | ❌ | **M** (recalcul point-in-time depuis `Fixture`, 1 agrégat par (compétition, saison), mutualisé sur la plage) |
| **2.1 `context.schedule`** — jours de repos, coupe/Europe à ±4 j | Dérivable ; déjà lu par `CongestionService` mais non persisté | `Fixture.scheduledAt` + `status` (+ `Competition.code` pour distinguer UCL/UEL/UECL) | ❌ (seul le scalaire agrégé `shadow_congestion` sort) | **S** (les 2 requêtes existent déjà dans `CongestionService`) |
| **2.1 `context.availability`** — blessés/suspendus **clés** | ⚠ **Comptes seulement** (`{home, away, total}`), J et J+1 seulement, aucun nom de joueur, aucune suspension | `ModelRun.features.shadow_injuries` | ❌ | **S** pour exposer les comptes + `reason`. « Clés » = **XL / bloqué** (donnée absente : il faudrait persister le payload `/injuries` et un endpoint lineups) |
| **2.1 `h2h`** — 10 dernières confrontations (date, compétition, lieu, score FT, score HT) | ⚠ Pas de table ; recalculable, mais `fetchLegs` est limité à **5** legs et ne lit ni date, ni compétition, ni HT | `Fixture` (tout y est) | ❌ (seul le scalaire `shadow_h2h`) | **M** (requête élargie à 10 legs + colonnes date/compétition/HT ; ne pas toucher `fetchLegs` utilisé par le scoring) |
| **2.1 `h2h` agrégats** — V/N/D, moy. buts, taux O1.5/O2.5/BTTS | Dérivable des mêmes legs | `Fixture` | ❌ | **S** (sur la requête ci-dessus) |
| **2.1 formule `shadowSignals.h2h`** documentée | n/a | §5 de ce document | ❌ | **S** (bloc `meta.definitions`) |
| **2.2 `market` : meilleure cote + médiane + nb de books** | Oui | `OddsSnapshot` (5 books) | ❌ (un seul prix, meilleur book) | **M** (généraliser `findLatestOddsPerBookmaker` aux 7 marchés cibles — n'existe aujourd'hui que pour 1X2 et O/U) |
| **2.2 `market` : horodatage du snapshot** | Oui | `OddsSnapshot.snapshotAt` | ❌ | **S** |
| **2.2 `market` : proba implicite sans marge (consensus)** | Calculable | `OddsSnapshot` | ❌ (la médiane brute `1/odds` est calculée pour le gate, **sans** dé-margeage, volontairement) | **S** (dé-margeage proportionnel ou Shin ; méthode à nommer explicitement) |
| **2.2 `market` : cote d'ouverture + mouvement réel** | ⚠ Partiellement — `MIN(snapshotAt)` ≈ **J−3 au mieux**, pas l'ouverture du book | `OddsSnapshot` | ❌ / `lineMovement` null 371/372 | **M** (cf. §4.1 ; renommer en `firstSeenOdds`, livrer le gate en shadow) |
| **2.3 `lambdaTrace`** | Entrées oui, trace non | `TeamStats`, config ligue, `features.shadow_h2h` | ❌ | **M** (`deriveLambdas` doit retourner ses étapes intermédiaires, ou les reconstruire à l'export depuis les entrées persistées) |
| **2.3 trace de probabilité** (couches 2→5, cf. §3.3) | ⚠ Seuls les **bornes** sont stockées (`rawPoissonProbability` = λ_base, `probabilities` = final) | `ModelRun.features` | ❌ (`adjustmentDelta` agrégé, opaque) | **L** (rejouer chaque couche à l'export depuis les mêmes configs de ligue, ou les persister — rejouer est préférable : pas de migration, pas de rebuild) |
| **2.3 `dataCoverageDetail`** — composantes, présent/absent, poids | Oui | `features.shadow_*` | ❌ (seul le ratio) | **S** |
| **2.3 les 7 marchés cibles toujours dans `evaluatedPicks`** | ⚠ Non — `listEvaluatedPicks` **saute** un marché sans cote, et `evaluatedPicks` est vide si `latestOdds === null` | `features.evaluatedPicks` | partiellement | **M** (compléter à l'export avec `probability` depuis `features.probabilities` + `odds: null` + `reason`) |
| **2.3 `edge` (modèle − marché) par marché cible** | Calculable | `features.probabilities` + `OddsSnapshot` | ❌ | **S** |
| **2.3 seuils appliqués** (EV floor, odds floor, seuil de proba du canal) | Oui, dans le code | `ev.constants.ts`, `goals.config.ts`, … | ❌ | **S** (résoudre la config par (ligue, marché, pick) à l'export) |
| **2.4 `calibration`** — par marché × compétition : n, hit rate, ROI, Brier, proba moy. vs fréquence observée | Calculable | `channel_selection` (`probability`, `odds`, `result`, `settledAt`) jointe à `fixture`/`competition` | ❌ | **M** (1 requête agrégée ; briques `flatRoi`, `calibrationError` déjà dans `analysis-core/metrics`. **Mettre en cache** : scan de tout l'historique réglé) |
| **2.4 biais de λ par compétition** (buts prédits vs réels) | Calculable | `features.lambdaHome/lambdaAway` + `Fixture.homeScore/awayScore` | ❌ | **M** (scan `ModelRun` sur fixtures FINISHED ; même cache) |
| **2.5 `legPool`** | Calculable | tout ce qui précède | ❌ | **M** (projection à plat + filtres + `correlationGroup = fixtureId` + jointure `calibration`) |
| **2.6 filtres d'export** (plage, `status`, marchés, `excludeChannels`, mode `compact`) | n/a | `AnalysisSheetQueryDto` | ❌ (seuls `from`/`to`/`competitionCode`/`channel`/`format`) | **S** (DTO + filtrage ; le mode `compact` attaque directement les 13,6 Mo) |
| **2.6 `schemaVersion: "2.0"`** | n/a | — | ❌ | **S** |

### 6.3 Ce qui restera `null` + `reason` quoi qu'on fasse

À acter avant de coder — ce sont des **trous de données**, pas des trous
d'export :

1. `availability` détaillée (blessés/suspendus nommés, titulaires) — donnée
   jamais collectée. Exposable : les comptes, pour J et J+1 seulement.
2. Compositions (`shadow_lineups`) — écrit en dur à `null`.
3. Vraie cote d'ouverture — la collecte commence à J−3.
4. Historique de cotes au-delà de ~6 snapshots / 48 h.
5. Stats de match autres que xG (tirs, possession, corners).
6. xG sur les fixtures `xgUnavailable = true` et sur 2022-23 (proxy tirs × 0.4).

---

## 7. Les 7 bugs constatés

| # | Constat | Diagnostic | Action proposée |
| --- | --- | --- | --- |
| 1 | `dataCoverage = 0.6666…`, un filtre `≥ 0.67` élimine 100 % des matchs | **Confirmé et structurel.** 3 composantes à poids égaux dont une (`lineMovement`) toujours `null` (§4.1) et une (`congestion`) jamais `null` → la valeur ne peut valoir que 1/3 ou 2/3, jamais 1 | Ajouter `coverageLevel: 1|2|3` (entier) + `dataCoverageDetail` (composantes, présent/absent, poids). **Garder `dataCoverage` tel quel** (additif). Corriger `lineMovement` (§4.1) remet 3/3 à portée |
| 2 | `odds_below_floor` sur des cotes de **1.17 à 3.47**, souvent à EV élevé | **Ce n'est pas un bug — c'est un nom trompeur.** `pickMinSelectionOdds(league, market, pick)` est un plancher **par (ligue, marché, pick)** délibérément placé **haut** pour exclure des segments toxiques mesurés : p. ex. `CH\|ONE_X_TWO\|HOME → 5.00`, `BL1\|ONE_X_TWO\|HOME → 5.00`, `PL\|ONE_X_TWO\|DRAW → 5.00`, `BL1\|BTTS\|NO → 3.00`. Une cote à 3.47 sous un plancher à 5.00 est donc rejetée à juste titre. « EV élevé » est cohérent avec la raison d'être du plancher : l'edge annoncé est anti-prédictif (audit 2026-08-22) | **Ne pas renommer le code** (lu par `audit-fixtures.ts`, specs, et l'historique). Exposer dans la fiche `rejection: {code, threshold, actual, scope: "league|market|pick"}` — le seuil appliqué rend le rejet auto-explicatif. Optionnel : alias lisible `segment_odds_floor` dans `meta.definitions` |
| 3 | `adjustmentDelta` à +0.25 (Mura – Aluminij, Over 2.5) sans traçabilité | **Confirmé, et attendu.** `adjustmentDelta` agrège **5 couches** (§3.3), dont le shrinkage O/U vers le taux de base de ligue — le plus gros contributeur en ligue pauvre en données. `rawPoissonProbability` est par ailleurs calculé depuis **λ_base** (pré-H2H), donc le delta inclut aussi la correction H2H de λ | `lambdaTrace` (λ) **+** `probabilityTrace` par pick (couches 2→5, nom/delta/raison/paramètre). Les deux sont nécessaires : `lambdaTrace` seul ne couvre que l'étape 1 |
| 4 | Portée de `calibrationAlert (favorite_flip)` : calculé sur 1X2, doit-il bloquer les marchés de buts ? | Deux gates **distincts et indépendants** existent déjà : `CALIBRATION_GATE` (1X2 : `MAX_DIVERGENCE = 0.30`, `FAVORITE_FLIP_MIN_GAP = 0.15`, `MIN_BOOKMAKERS = 2`) et `OVER_UNDER_CALIBRATION_GATE` (par ligne 1.5/2.5/3.5/4.5 : `FAVORITE_FLIP_MIN_GAP = 0.10`, pas de `MAX_DIVERGENCE` — volume réel insuffisant pour le calibrer). **Mais au staking, un `calibration_alert` 1X2 exclut tout le fixture**, donc oui : il bloque aujourd'hui les marchés de buts, par décision de conception (« données modèle corrompues » est un signal fixture-level, pas marché-level) | Documenter la portée de **chaque** flag par famille de marchés dans `meta.definitions` : `scope: "fixture" | "market_family"`, famille touchée, seuil, nb de books. Ne rien changer au comportement dans cette PR |
| 5 | Divergences modèle/marché de +14 à +29 pts sans `avoidFlag` (Excelsior – Utrecht, dom 0.67 vs 0.40 = **+0.27**) | **Conforme aux seuils, et doublement explicable.** (a) `AVOID_CONFIG.maxEdge = 0.30` → +0.27 passe sous le seuil ; (b) AVOID n'inspecte que les picks **SELECTED** des canaux de phase 1 (`previousDecisions`) — un pick rejeté à l'évaluation n'est jamais offender, quelle que soit sa divergence. `CALIBRATION_GATE.MAX_DIVERGENCE` est aligné sur 0.30 et `FAVORITE_FLIP_MIN_GAP = 0.15` ne s'applique que si les favoris diffèrent | Exposer `edge` par marché cible dans `evaluatedPicks` **et** `avoidFlag.evaluatedMaxEdge` (le max sur **tous** les picks évalués, pas seulement les sélectionnés) + `threshold: 0.30`. La divergence devient visible même quand le gate ne se déclenche pas. Abaisser `maxEdge` est une décision produit séparée, à backtester |
| 6 | `shadowSignals.h2h` : scalaire non documenté, `null` sur 139/372 | `null` = `sampleSize < H2H_MIN_SAMPLE (3)`. Formule et sémantique en §5 | Bloc `h2h` complet (10 legs + agrégats) + `sampleSize` + `favoriteTeamId` + formule dans `meta.definitions` + `reason: "insufficient_h2h_sample"` quand null |
| 7 | « Le seuil d'EV du canal GOALS » rejette des Over 1.5 à EV positif et forte probabilité | **Ce n'est pas un seuil d'EV.** `decideGoals` rejette avec `reasonCode: "below_threshold"` quand `probability < config.threshold`, un seuil de **probabilité** par (ligue, ligne, côté) dans `GOALS_CONFIG` (p. ex. `ARG1 / 1.5 / OVER → 0.56`). L'EV n'intervient qu'ensuite, pour **classer** les candidats. Deuxième cause possible de rejet : `no_priced_line` (aucune cote prématch sur les lignes au-dessus du seuil). À noter : **GOALS n'est jamais misé** — canal en observation | Exposer `channelThresholds: {channel, kind: "probability"|"ev", line, side, threshold, actual}` par décision rejetée. Le `reasonDetails` porte déjà `{probability, threshold}` côté `below_threshold` : il suffit de le publier |

---

## 8. Requêtes de vérification (à lancer en local)

À exécuter avant de coder, pour confirmer les déductions de cet audit :

```bash
# 1) dataCoverage ne vaut jamais 1 — distribution des 3 signaux
docker exec evcore-postgres psql -U postgres -d evcore -c "
SELECT (features->>'shadow_lineMovement' IS NOT NULL) AS has_line,
       (features->>'shadow_h2h' IS NOT NULL)          AS has_h2h,
       (features->>'shadow_congestion' IS NOT NULL)   AS has_cong,
       count(*)
FROM model_run GROUP BY 1,2,3 ORDER BY 4 DESC;"

# 2) horizon réel de collecte des cotes (confirme le non-recouvrement 3j / 7j)
docker exec evcore-postgres psql -U postgres -d evcore -c "
SELECT o.source,
       percentile_disc(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (f.\"scheduledAt\" - o.\"snapshotAt\"))/86400) AS median_days_before,
       max(EXTRACT(EPOCH FROM (f.\"scheduledAt\" - o.\"snapshotAt\"))/86400)         AS max_days_before,
       count(*)
FROM odds_snapshot o JOIN fixture f ON f.id = o.\"fixtureId\"
GROUP BY 1;"

# 3) snapshots par fixture (combien de points pour un mouvement de ligne ?)
docker exec evcore-postgres psql -U postgres -d evcore -c "
SELECT n, count(*) FROM (
  SELECT \"fixtureId\", count(DISTINCT \"snapshotAt\") AS n
  FROM odds_snapshot GROUP BY 1) t GROUP BY 1 ORDER BY 1;"

# 4) la table standing est-elle vraiment vide ?
docker exec evcore-postgres psql -U postgres -d evcore -c "SELECT count(*) FROM standing;"

# 5) couverture xG réelle par compétition
docker exec evcore-postgres psql -U postgres -d evcore -c "
SELECT c.code,
       count(*) FILTER (WHERE f.\"homeXg\" IS NOT NULL) AS with_xg,
       count(*) FILTER (WHERE f.\"xgUnavailable\")       AS unavailable,
       count(*)                                          AS total
FROM fixture f JOIN season s ON s.id=f.\"seasonId\" JOIN competition c ON c.id=s.\"competitionId\"
WHERE f.status='FINISHED' GROUP BY 1 ORDER BY 4 DESC;"

# 6) distribution des raisons de rejet + cote observée (bug #2)
docker exec evcore-postgres psql -U postgres -d evcore -c "
SELECT cd.\"reasonCode\", count(*), round(min(cs.odds),2), round(max(cs.odds),2)
FROM channel_decision cd LEFT JOIN channel_selection cs ON cs.\"channelDecisionId\"=cd.id
WHERE cd.status <> 'SELECTED' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;"
```

---

## 9. Points à valider avant de coder

1. **Périmètre des 7 marchés cibles.** Mapping retenu :
   `ONE_X_TWO/HOME`, `ONE_X_TWO/AWAY`, `TO_WIN_EITHER_HALF/HOME`,
   `TO_WIN_EITHER_HALF/AWAY`, `BTTS/YES`, `OVER_UNDER/OVER_1_5`,
   `OVER_UNDER/OVER` (= la ligne 2.5, nom historique). Confirmer.
2. **Avertissement de fiabilité sur Win Either Half.** Ce marché dépend de la
   famille A' (mi-temps), dont le moteur est un `FIRST_HALF_GOAL_FRACTION = 0.44`
   **fixe, non calibré par ligue ni par équipe**
   (`docs/prediction-engine-families.md` §0.1 le qualifie de « faux moteur »).
   La fiche v2 devrait porter un `reliabilityWarning` explicite sur ce marché.
   Confirmer que c'est voulu plutôt que de l'exclure du `legPool`.
3. **Correctif `lineMovement` — shadow ou armé ?** Le corriger réactive un gate
   dormant depuis toujours (exclusion des picks à mouvement adverse > 10 %),
   ce qui **changerait les décisions**. Proposition : exposer la valeur,
   laisser le gate désarmé dans cette PR, backtester séparément.
4. **`calibration` : coût de calcul.** Scan de tout l'historique réglé à chaque
   appel. Proposition : calcul à la demande + cache mémoire TTL (p. ex. 1 h),
   et `calibration: null` + `reason` si `n < minSample` par cellule
   (marché × compétition) plutôt qu'un chiffre non significatif.
5. **`standing` point-in-time.** Recalcul depuis `Fixture` (zéro fuite, marche
   aussi sur les fixtures passées) plutôt que de ressusciter la table
   `Standing`. Confirmer.
6. **Budget de requêtes.** Les blocs `context`/`h2h`/`market` sur 372 fixtures
   ne doivent pas faire de N+1 : tout doit être batché par plage de dates
   (~6 requêtes agrégées au total, pas 372 × 6). C'est la principale
   contrainte de design de l'étape 2.
7. **Taille de sortie.** 13,6 Mo aujourd'hui **sans** `context`/`h2h`/`market`.
   Le mode `compact` et `excludeChannels` ne sont pas optionnels : ils doivent
   arriver **dans la même PR** que l'enrichissement, sinon la fiche v2 complète
   sera inexploitable.
