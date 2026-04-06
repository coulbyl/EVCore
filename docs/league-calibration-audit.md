# Guide d'audit de calibration d'une ligue

Ce guide documente la méthode complète pour diagnostiquer et corriger la miscalibration du moteur EVCore sur une ligue donnée. Basé sur les audits réels : ERD (avril 2026), I2 (avril 2026).

---

## Vue d'ensemble du pipeline d'analyse

```
1. Détection (db-stats / backtest results)
        ↓
2. Isolation du problème (ndjson → raison d'exclusion)
        ↓
3. Diagnostic DB (lambda, home advantage, xG coverage)
        ↓
4. Hypothèse + recherche externe (contexte réel de la ligue)
        ↓
5. Correction dans ev.constants.ts + betting-engine.service.ts
        ↓
6. Validation backtest
```

---

## Étape 1 — Détecter qu'une ligue a un problème

### Signal dans les résultats backtest

```json
{
  "competitionCode": "I2",
  "totalBets": 0, // ← zéro bets = signe d'exclusion totale
  "aggregateRoi": "-0.42" // ← ROI catastrophique si des bets ont été placés
}
```

Cas à investiguer :

- `totalBets = 0` malgré des fixtures analysées
- ROI < -15% avec N >= 10 bets (statistiquement significatif)
- Win rate réel << probabilité modélisée (gap > 10pp)

### Signal dans db-stats

```
CODE  ACTIVE  FIXTURES  FINISHED  xG (done/fin)   ODDS   STATS
I2    ✓           1160      1099  1099/1099 (100%)    49   2198
J1    ✓           1076      1076  1076/1076 (100%)     0   2152
```

- `ODDS = 0` → pas de cotes → aucun bet possible (problème de données, pas de calibration)
- xG < 80% → proxy shots_on_target × 0.35 actif → probabilités moins fiables

---

## Étape 2 — Isoler la raison d'exclusion (ndjson)

Le fichier `apps/backend/logs/backtest-analysis.latest.ndjson` contient une ligne par fixture. Chaque ligne a un champ `reason`.

### Lire la distribution des raisons

```python
import json
from collections import Counter

reasons = Counter()
with open('apps/backend/logs/backtest-analysis.latest.ndjson') as f:
    for line in f:
        d = json.loads(line)
        if d.get('competitionCode') == 'I2':
            reasons[d.get('reason', 'none')] += 1

print(dict(reasons))
```

### Raisons possibles et leur signification

| Reason                        | Signification                                   | Action                         |
| ----------------------------- | ----------------------------------------------- | ------------------------------ |
| `MISSING_TEAM_STATS`          | Cold-start — équipe < 5 fixtures historiques    | Normal en début de saison      |
| `MISSING_ODDS`                | Pas de snapshot odds pour ce bookmaker          | Vérifier ETL odds              |
| `BELOW_MODEL_SCORE_THRESHOLD` | Score déterministe < seuil ligue                | Vérifier lambda, features      |
| `NO_VIABLE_PICK`              | Score OK mais aucun pick passe les filtres      | Vérifier EV, probability gates |
| `BET_PLACED`                  | Bet sélectionné (chercher `result` et `profit`) | Analyser la performance        |

### Si BELOW_MODEL_SCORE_THRESHOLD domine

```python
# Distribution des scores pour comprendre l'écart avec le seuil
import statistics

scores = []
thresholds = set()
with open('apps/backend/logs/backtest-analysis.latest.ndjson') as f:
    for line in f:
        d = json.loads(line)
        if d.get('competitionCode') == 'I2' and d.get('deterministicScore'):
            scores.append(float(d['deterministicScore']))
            if d.get('modelScoreThreshold'):
                thresholds.add(float(d['modelScoreThreshold']))

print(f"Threshold appliqué: {thresholds}")
print(f"Score min={min(scores):.3f} max={max(scores):.3f} avg={statistics.mean(scores):.3f}")
```

Si `max(scores) < threshold` : le seuil est trop haut **ou** les scores sont structurellement bas (lambda mal calibré).

---

## Étape 3 — Diagnostic DB

### 3a. Calculer le lambda réel de la ligue

```sql
SELECT
  ROUND(AVG(ts."xgFor"), 4)  AS avg_xg_for,
  ROUND(AVG(ts."xgAgainst"), 4) AS avg_xg_against,
  ROUND(AVG(ts."xgFor" + ts."xgAgainst") / 2, 4) AS avg_lambda,
  COUNT(*) AS n
FROM team_stats ts
JOIN fixture f ON ts."afterFixtureId" = f.id
JOIN season s ON f."seasonId" = s.id
JOIN competition c ON s."competitionId" = c.id
WHERE c.code = 'I2' AND ts."xgFor" > 0;
```

Comparer avec `LEAGUE_MEAN_LAMBDA_MAP` dans [ev.constants.ts](../apps/backend/src/modules/betting-engine/ev.constants.ts).  
Si la ligue est absente de la map → le défaut `1.4` est utilisé.

**Écart critique :** si lambda réel > 1.5 et défaut = 1.4 → sous-estimation → scores bas → seuil bloque tout.

### 3b. Vérifier la couverture xG par saison

```sql
SELECT
  s.name AS season,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE f."homeXg" IS NOT NULL) AS with_xg,
  COUNT(*) FILTER (WHERE f."xgUnavailable" = true) AS xg_unavailable
FROM fixture f
JOIN season s ON f."seasonId" = s.id
JOIN competition c ON s."competitionId" = c.id
WHERE c.code = 'I2' AND f.status = 'FINISHED'
GROUP BY s.name ORDER BY s.name;
```

Si une saison entière a 0 xG → supprimer cette saison ou la marquer (les probabilités Poisson seront faussées par le proxy).

### 3c. Analyser les bets placés (si ROI négatif)

```python
bets = []
with open('apps/backend/logs/backtest-analysis.latest.ndjson') as f:
    for line in f:
        d = json.loads(line)
        if d.get('competitionCode') == 'I2' and d.get('reason') == 'BET_PLACED':
            bets.append(d)

# Par pick
from collections import defaultdict
by_pick = defaultdict(lambda: {'n': 0, 'wins': 0, 'profit': 0.0, 'evs': []})
for b in bets:
    key = f"{b.get('market')}|{b.get('pick')}"
    by_pick[key]['n'] += 1
    if b.get('result') == 'WON':
        by_pick[key]['wins'] += 1
        by_pick[key]['profit'] += float(b.get('profit', 0))
    elif b.get('result') == 'LOST':
        by_pick[key]['profit'] -= 1
    if b.get('ev'):
        by_pick[key]['evs'].append(float(b['ev']))

for k, v in sorted(by_pick.items()):
    n = v['n']
    roi = v['profit'] / n if n > 0 else 0
    avg_ev = sum(v['evs']) / len(v['evs']) if v['evs'] else 0
    print(f"{k}: n={n} wins={v['wins']} ROI={roi:+.1%} avg_ev={avg_ev:.3f}")
```

**Signal critique :** un seul pick (ex: HOME) représente 100% des bets → miscalibration directionnelle.

> **Piège :** si 100% des bets sont HOME, suspendre HOME via probability gate ou floor ne fera pas apparaître AWAY/DRAW — la ligue ne génère tout simplement pas de signal EV suffisant sur ces picks. Vérifier d'abord si AWAY/DRAW ont déjà produit des candidats rejetés (`topRejectedCandidates`) avant de choisir la stratégie de correction.

### 3d. Calculer la probabilité modélisée implicite

```python
# P(home) implicite depuis les bets placés
# P_model = (EV + 1) / odds
probs = []
for b in bets:
    if b.get('ev') and b.get('odds') and b.get('pick') == 'HOME':
        p = (float(b['ev']) + 1) / float(b['odds'])
        probs.append(p)

win_rate = sum(1 for b in bets if b.get('result') == 'WON') / len(bets)
avg_model_prob = sum(probs) / len(probs)

print(f"P(home) modélisée moyenne : {avg_model_prob:.1%}")
print(f"Win rate réel             : {win_rate:.1%}")
print(f"Gap d'overestimation      : {(avg_model_prob - win_rate):.1%}")
```

Gap > 10pp → miscalibration structurelle. Gap > 20pp → cause racine probable = home advantage factor ou lambda.

---

## Étape 4 — Identifier la cause racine

### Arbre de décision

```
Score trop bas (BELOW_THRESHOLD) ?
├── lambda manquant dans LEAGUE_MEAN_LAMBDA_MAP ?
│   └── OUI → ajouter le lambda calculé en DB → relancer backtest
└── lambda correct mais scores toujours bas ?
    └── Investiguer features (xG proxy, recentForm, domExtPerf)

ROI très négatif (< -20%) sur un seul pick ?
├── P(home) modélisée >> win rate réel ?
│   ├── HOME_ADVANTAGE_LAMBDA_FACTOR trop élevé pour cette ligue ?
│   │   └── Ligue paritaire (> 18 équipes, forte relégation) → réduire HA factor
│   └── lambda anchor trop bas → surestime les λ extrêmes
└── EV élevé mais bets perdants (inverse correlation) ?
    └── Model surconfident → ajouter EV soft cap
```

### Contexte réel de la ligue (recherche externe)

Questions à répondre avant de toucher la config :

1. **Taux de victoire à domicile** (source : footystats.org, soccerstats.com)
   - Top 5 européen : ~50-52%
   - Divisions 2 paritaires : ~42-46%
   - Si < 46% → `HOME_ADVANTAGE_LAMBDA_FACTOR` doit être < 1.05

2. **Nombre d'équipes dans la ligue**
   - 16-18 équipes → gap investissement important → home advantage élevé
   - 20-22 équipes → plus de parité → home advantage modéré

3. **Variance tactique / style de jeu**
   - Haute intensité / beaucoup de buts → lambda réel élevé (vérifier DB)
   - Tactique / défensif → lambda plus bas

4. **Sources de données fiables**
   - [footystats.org](https://footystats.org) → home advantage table par ligue
   - [soccerstats.com](https://www.soccerstats.com) → résultats HA/AA

---

## Étape 5 — Corrections dans le code

### Fichier principal : `ev.constants.ts`

#### Ajouter le lambda moyen

```typescript
const LEAGUE_MEAN_LAMBDA_MAP: Record<string, number> = {
  // ... ligues existantes ...
  XX: 1.56, // Liga XX: lambda calculé depuis team_stats (n=2197, avril 2026)
};
```

#### Corriger le home advantage factor

```typescript
const LEAGUE_HOME_ADVANTAGE_MAP: Record<string, [number, number]> = {
  // [homeAdvFactor, awayDisadvFactor]
  // Symmetric: homeAdv × awayDisadv ≈ 1
  XX: [1.02, 0.98], // Ligue paritaire ~44% home win rate
};
```

#### Ajuster le MODEL_SCORE_THRESHOLD

```typescript
const MODEL_SCORE_THRESHOLD_MAP: Record<string, Decimal> = {
  // Tier A (top leagues, marché efficient) : 0.55-0.60
  // Tier B (divisions 2/3, marché moins efficient) : 0.50-0.62
  // Tier C (compétitions européennes) : 0.45-0.50
  // Tier D (international, sparse data) : 0.60
  XX: new Decimal("0.58"),
};
```

#### Filtres directionnels (si un pick spécifique est toxique)

```typescript
// Probabilité minimale pour accepter le pick
'XX|ONE_X_TWO|HOME': new Decimal('0.50'),  // > défaut 0.45

// Cap EV pour éviter la surconfiance
'XX|ONE_X_TWO|HOME': new Decimal('0.35'),  // si EV > 0.35 → 0% win rate observé

// Floor EV pour un pick marginalement profitable
'XX|ONE_X_TWO|DRAW': new Decimal('0.20'),  // si EV < 0.20 → pertes systématiques
```

#### Floor de sélection par pick

```typescript
// Odds minimum par pick (si segment mid-range est toxique)
if (competitionCode === "XX" && market === "ONE_X_TWO" && pick === "HOME") {
  return Decimal.max(leagueFloor, new Decimal("3.00"));
}
```

#### Floor vs gate : quand utiliser quoi

| Situation                                      | Outil                          | Raison                                                                   |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Segment de cotes toxique (ex: 2.0-2.49)        | **Floor odds**                 | Précis, documenté, ne bloque que le sous-segment                         |
| Pick trop confiant sur toute la plage de cotes | **Probability gate**           | Bloque quelle que soit la cote                                           |
| 100% des bets sur un seul pick                 | **Floor ou gate = même effet** | Tester les deux est inutile si AWAY/DRAW ne génèrent jamais de candidats |

> Avant de choisir, vérifier dans le ndjson si les picks alternatifs ont déjà des `topRejectedCandidates` — si non, la ligue ne génère que ce pick et les deux outils auront le même résultat (0 bets).

### Fichier secondaire : `betting-engine.service.ts`

Si `getLeagueHomeAwayFactors()` a été ajouté dans `ev.constants.ts`, s'assurer qu'il est importé et utilisé dans `deriveLambdas()` :

```typescript
// Import
import { getLeagueHomeAwayFactors } from "./ev.constants";

// Dans deriveLambdas()
const [homeAdvFactor, awayDisadvFactor] =
  getLeagueHomeAwayFactors(competitionCode);
return {
  home: clamp(rawHome * homeAdvFactor, 0.05, 5),
  away: clamp(rawAway * awayDisadvFactor, 0.05, 5),
};
```

---

## Étape 6 — Validation backtest

### Checklist avant de lancer

- [ ] `pnpm --filter backend typecheck` passe (hors erreurs pré-existantes)
- [ ] Commentaire d'audit dans `ev.constants.ts` avec date, données observées, action prise
- [ ] Seuil justifié par des données (DB ou backtest), pas par intuition

### Interpréter les résultats

| Signal                                | Interprétation                                            |
| ------------------------------------- | --------------------------------------------------------- |
| Bets = 0 encore                       | Threshold trop haut **ou** lambda toujours sous-estimé    |
| ROI s'améliore mais encore négatif    | Cause partiellement corrigée, chercher filtre additionnel |
| Win rate réel ≈ P(home) modélisée     | Calibration réussie                                       |
| Volume de bets explose mais ROI chute | Threshold trop bas — remonter                             |
| ROI positif mais N < 20               | Ne pas conclure, attendre plus de données live            |

### Référence des résultats de calibration

```
Backtest de référence EVCore (avril 2026, 15 238 fixtures, 17 ligues) :
- Brier Score  : 0.613 (seuil PASS < 0.65)
- Calibration  : 3.28% (seuil PASS ≤ 5%)
- ROI global   : +15.46% (417 bets, +64.49u)
```

Toute modification ne doit pas faire chuter le ROI global en dessous de +8% ni le Brier Score au-dessus de 0.640.

---

## Cas réels documentés

### ERD — Eredivisie (audit 2026-04-04)

**Problème :** 67 picks rejetés `ev_above_hard_cap` AWAY (avg EV 1.63) — EV impossible contre Pinnacle.  
**Cause :** lambda défaut 1.4 vs Eredivisie ~3.3 buts/match → Poisson produisait des EV aberrants.  
**Fix :** `ERD: 1.75` dans `LEAGUE_MEAN_LAMBDA_MAP`.  
**Résultat :** EV redevenu cohérent, bets dans la fenêtre normale.

### I2 — Serie B (audit 2026-04-05)

**Problème initial :** threshold 0.75 (suspension) → 0 bets. Scores max 0.7509.  
**Cause 1 :** lambda manquant (défaut 1.4 vs réel 1.56 calculé en DB).  
**Fix lambda seul :** 26 bets HOME, 7/26 wins (-41.8% ROI, -10.88u). Insuffisant.

**Cause 2 (principale) :** `HOME_ADVANTAGE_LAMBDA_FACTOR = 1.05` trop élevé — Serie B a 22 équipes, ~44% home win rate réel vs 56% modélisé (gap 29pp).  
**Fix HA + filtres :** 10 bets HOME, 2/10 wins (-54.6% ROI, -5.46u). Toujours négatif.

**Cause 3 :** 100% des bets HOME à avg cote 2.152 (bucket [2.0-2.49]). Segment de cotes courts où le modèle est structurellement surconfiant.  
**Fix final :** floor HOME à 2.50 → 0 bets, profit = 0. Testé aussi via gate 0.99 (option 2) : **résultat identique** — I2 ne génère que des picks HOME, suspendre HOME = 0 bets dans les deux cas.

**Config finale :**

- `I2: 1.56` dans `LEAGUE_MEAN_LAMBDA_MAP`
- `I2: [1.02, 0.98]` dans `LEAGUE_HOME_ADVANTAGE_MAP`
- `I2: 0.60` MODEL_SCORE_THRESHOLD
- `'I2|ONE_X_TWO|HOME': 0.50` probability gate
- `'I2|ONE_X_TWO|HOME': 0.35` EV soft cap
- floor HOME 2.50 via `getPickMinSelectionOdds()`

**Impact global :** +70.54u profit (+14.91% ROI) — meilleur résultat absolu de la session. I2 contribue 0u mais ne dégrade pas le système. La ligue reste active pour le live si un HOME > 2.50 émerge.

**Leçon :** quand 100% des bets sont sur un seul pick, floor et gate produisent le même effet. Choisir le floor (explicite) plutôt que la gate (hack).

### J1 — J1 League (audit 2026-04-05)

**Problème :** 0 bets — toutes fixtures en `MISSING_ODDS`.  
**Cause :** pas de snapshot odds J1 dans la DB (ETL non lancé pour cette ligue).  
**Fix :** synchro odds → 56 bets, +10.8% ROI après correction.

---

## Anti-patterns à éviter

- **Suspendre une ligue sans chercher la cause** → perte d'opportunités, masque le bug
- **Baisser le threshold sans corriger le lambda** → augmente le volume de mauvais bets
- **Baser une correction sur N < 10 bets** → variance trop haute, signal non significatif
- **Modifier le home advantage global** → impact sur toutes les ligues, toujours passer par `LEAGUE_HOME_ADVANTAGE_MAP`
- **Hardcoder des valeurs numériques dans le service** → toujours passer par les fonctions `get*` de `ev.constants.ts`
