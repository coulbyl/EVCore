# EVCore — Guide de calibration du moteur de paris

> Auteur : session Claude 2026-04-19  
> Usage : référence pour toute future session de calibration (Claude, Codex, ou revue manuelle)  
> Pré-requis : lire [EVCORE.md](EVCORE.md) et [CLAUDE.md](CLAUDE.md) avant toute modification

---

## 0. Contexte système

### Ce que le moteur fait

Pour chaque fixture avec odds disponibles, le moteur :

1. Calcule les lambdas Poisson (xG pondéré + shrinkage bayésien)
2. Calcule les probabilités par outcome (HOME / DRAW / AWAY / OVER / BTTS / etc.)
3. Compare aux odds bookmaker (Pinnacle prioritaire) → calcule l'EV
4. Applique les filtres de sélection (score, EV, probabilité, cotes, qualityScore)
5. Sélectionne le meilleur pick éligible → `ModelRun` + `Bet` en DB

### Combos (désactivés depuis 2026-04-19)

Les combos (accumulateurs multi-jambes) étaient classés sous le **marché primaire** dans le backtest — impossible de distinguer un single d'un combo dans les stats. Ils sont désactivés via `COMBOS_ENABLED = false` dans `ev.constants.ts` pour la phase de calibration. Ne pas réactiver avant d'avoir :

- Ajouté un market key `COMBO` séparé dans le backtest
- Calibré tous les singles proprement

---

## 1. Lancer un backtest

```
POST /backtest/:competitionCode
```

Paramètres optionnels :

- `seasonId` : filtrer sur une saison
- Sans filtre → 3 saisons complètes

Résultat : JSON structuré (voir section 2).  
Fichier ndjson : `apps/backend/logs/backtest-analysis.latest.ndjson` (une ligne par fixture analysée).

---

## 2. Lire le JSON backtest

### Structure clé

```
{
  totalBets: N,
  aggregateRoi: X,
  overallVerdict: "PASS" | "FAIL",
  brierScore: { value, threshold: 0.65, verdict },
  calibrationError: { value, threshold: 0.05, verdict },
  roi: { value, threshold: -0.05, verdict },
  marketPerformance: [...],   // agrégé 3 saisons
  byMarket: [...],            // même données + verdict par marché
  seasons: [...]              // détail par saison
}
```

### Seuils de validation

| Métrique                   | PASS   | FAIL                     |
| -------------------------- | ------ | ------------------------ |
| Brier Score                | < 0.65 | ≥ 0.65                   |
| Calibration Error          | ≤ 5%   | > 5%                     |
| ROI simulé                 | ≥ -5%  | < -5%                    |
| Bets minimum (ROI signif.) | ≥ 20   | < 20 → INSUFFICIENT_DATA |

### Comment lire `marketPerformance`

Chaque entrée contient :

- `pickBreakdown` : performance par direction (HOME / DRAW / AWAY / YES / NO / OVER / UNDER)
- `oddsBuckets` : performance par tranche de cotes ([2.0-2.99], [3.0-4.99], [≥5.0])

**Lecture prioritaire :** toujours regarder `pickBreakdown` d'abord, puis `oddsBuckets` pour identifier le sous-segment profitable ou toxique.

### Vérification saison par saison

Dans `seasons[]`, vérifier que le signal est **cohérent sur les 3 saisons** :

- Si une saison est +50% et deux autres sont -20% → variance, pas un signal
- Si les 3 saisons montrent le même pattern → signal structurel, actionnable

---

## 3. Lire le ndjson diagnostic

Fichier : `apps/backend/logs/backtest-analysis.latest.ndjson`  
Une ligne JSON par fixture. Champs utiles :

```jsonc
{
  "fixtureId": "...",
  "decision": "BET" | "NO_BET",
  "reasonCounts": {                    // pourquoi les picks ont été rejetés
    "ev_below_threshold": 12,
    "odds_above_cap": 8,
    "probability_too_low": 5,
    "ev_above_hard_cap": 2,
    "score_below_threshold": 45,
    "quality_score_too_low": 3
  },
  "rejectionSummary": [                // top raisons de rejet
    { "reason": "odds_above_cap", "count": 8 }
  ],
  "topRejectedCandidates": [           // les picks bloqués les plus proches du seuil
    {
      "market": "ONE_X_TWO",
      "pick": "DRAW",
      "comboMarket": null,
      "comboPick": null,
      "odds": "7.50",
      "ev": "0.18",
      "qualityScore": "0.11"
    }
  ]
}
```

### Raisons de rejet — interprétation

| Raison                  | Ce que ça signifie                                  | Action possible                                                     |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `odds_above_cap`        | Pick profitable bloqué par plafond de cotes         | Analyser le bucket [cap, cap+X] — si profitable → lever le cap      |
| `probability_too_low`   | Pick bloqué par seuil de probabilité directionnelle | Analyser le bucket par odds — si bon winrate → baisser le threshold |
| `ev_below_threshold`    | EV trop faible — bruit normal                       | Pas d'action sauf si massif                                         |
| `score_below_threshold` | Fixture sous le seuil de qualité                    | Vérifier si le threshold est trop haut (ERD cas typique)            |
| `ev_above_hard_cap`     | EV > 0.90 = anomalie modèle                         | Corriger la lambda, pas le cap                                      |
| `quality_score_too_low` | EV × score × longshotPenalty < 0.06                 | Pas d'action — filtre voulu                                         |

### Utilisation pratique du ndjson

Pour analyser les picks bloqués par `odds_above_cap` sur un marché spécifique :

1. Agréger tous les `topRejectedCandidates` où market=X et pick=Y et reason=odds_above_cap
2. Grouper par bucket d'odds : [cap, cap+0.5], [cap+0.5, cap+1], etc.
3. Simuler le résultat (fixture terminée = on sait qui a gagné) pour chaque bucket
4. Si un bucket est profitable → lever le cap jusqu'à ce bucket inclus

**Exemple réel (PL DRAW, 2026-04-19) :**

- Cap était à 5.50. ndjson montre 51 picks bloqués par `odds_above_cap`
- Analyse par bucket : [5.5-6.0] +43%, [6.0-7.0] +174%, [7.0-8.0] +111%, [8.0+] -100%
- Décision : lever le cap à 7.99 (tous les buckets ≤8.0 sont profitables)

---

## 4. Les constantes de calibration (`ev.constants.ts`)

### Vue d'ensemble des mécanismes

```
ev.constants.ts
├── COMBOS_ENABLED                    → activer/désactiver les combos globalement
├── MODEL_SCORE_THRESHOLD_MAP         → threshold de score par ligue
├── LEAGUE_MIN_SELECTION_ODDS_MAP     → cote minimum par ligue
├── LEAGUE_MEAN_LAMBDA_MAP            → ancre de shrinkage Poisson par ligue
├── LEAGUE_HOME_ADVANTAGE_MAP         → facteurs HA/DA par ligue
├── LEAGUE_EV_THRESHOLD_MAP           → EV minimum par ligue (override du 0.08 global)
│
├── getPickMinSelectionOdds()         → cote minimum par (ligue, marché, pick)
├── PICK_MAX_SELECTION_ODDS_MAP       → cote maximum par (ligue, marché, pick)
├── PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP → P_direction minimum par (ligue, marché, pick)
├── PICK_EV_FLOOR_MAP                 → EV minimum par (ligue, marché, pick) — 0.99 = élimination
└── PICK_EV_SOFT_CAP_MAP              → EV maximum par (ligue, marché, pick)
```

### Clés des maps per-pick

Format : `"${competitionCode}|${market}|${pick}"`

Exemples :

- `'PL|ONE_X_TWO|DRAW'` → DRAW de la Premier League
- `'BL1|FIRST_HALF_WINNER|HOME'` → FHW HOME de la Bundesliga
- `'BL1|BTTS|NO'` → BTTS NO de la Bundesliga

### Outil d'élimination : `PICK_EV_FLOOR_MAP` à 0.99

Mettre `new Decimal('0.99')` dans `PICK_EV_FLOOR_MAP` pour une clé = élimination effective.
L'EV max réel est 0.90 (hard cap) → un floor à 0.99 est toujours supérieur = jamais sélectionné.

---

## 5. Méthodologie de calibration par ligue

### Étape 1 : lancer le backtest brut

```
POST /backtest/:code
```

Vérifier le verdict global. Si PASS → analyser les marchés. Si FAIL → identifier la cause racine (Brier fail = miscalibration lambda, ROI fail = picks toxiques).

### Étape 2 : analyser `marketPerformance` par marché

Pour chaque marché (ONE_X_TWO, BTTS, FIRST_HALF_WINNER, OVER_UNDER, OVER_UNDER_HT) :

1. **Volume** : < 20 bets → INSUFFICIENT_DATA, pas d'action
2. **ROI global** : < -5% → signal toxique, investiguer
3. **`pickBreakdown`** : identifier quelle direction est profitable vs toxique
4. **`oddsBuckets`** : identifier dans quelle tranche de cotes le signal existe

### Étape 3 : identifier le pattern

| Pattern                            | Signature                                    | Fix                                   |
| ---------------------------------- | -------------------------------------------- | ------------------------------------- |
| Direction structurellement toxique | ROI < -20% sur 3 saisons, toutes tranches    | `PICK_EV_FLOOR_MAP` → 0.99            |
| Cotes trop courtes toxiques        | [2.0-2.99] négatif, [3.0+] positif           | `getPickMinSelectionOdds` → floor 3.0 |
| Cotes trop longues toxiques        | [≥5.0] négatif, [2.0-4.99] positif           | `PICK_MAX_SELECTION_ODDS_MAP` → cap   |
| Picks bloqués profitables          | ndjson : `odds_above_cap` sur bon bucket     | Lever le cap                          |
| Picks bloqués par proba            | ndjson : `probability_too_low` sur bons odds | Baisser le threshold directionnel     |
| Ligue sur-confiante globalement    | Brier > 0.65, odds surestimées               | Corriger `LEAGUE_MEAN_LAMBDA_MAP`     |
| HOME advantage mal calibré         | P(home) >> win_rate, gap > 15pp              | Réduire `LEAGUE_HOME_ADVANTAGE_MAP`   |

### Étape 4 : appliquer le fix et re-backtester

**Ordre de priorité des fixes :**

1. Éliminer les directions structurellement toxiques (floor 0.99)
2. Ajuster les fenêtres de cotes (min/max)
3. Ajuster les seuils de probabilité directionnelle
4. Lever les caps qui bloquent des segments profitables (ndjson)

Appliquer **un fix à la fois**, re-backtester, vérifier l'effet. Plusieurs fixes simultanés rendent impossible l'attribution de cause.

### Étape 5 : décider d'agir ou pas

**Agir :** signal cohérent sur ≥2 saisons, volume ≥ 15 bets dans le segment, logique économique claire
**Ne pas agir :** variance inter-saison (S1 +50%, S2 -20%, S3 +30%), volume < 10 bets dans le segment

---

## 6. Patterns récurrents identifiés (2026-04-19)

### HOME longshots toxiques (BL1, CH, D2, PL, SA)

- Modèle surestrime P(home) sur les fixtures équilibrées → picks HOME à cotes moyennes [2.5-4.0] systématiquement perdants
- Fix systématique : `getPickMinSelectionOdds` → floor 5.00 (ou élimination via floor 0.99)

### FIRST_HALF_WINNER HOME universellement toxique

- Pattern observé sur PL (-22%) et BL1 (-71.6%)
- Le modèle surestrime P(home win first half) — le scoring de mi-temps suit des dynamiques différentes
- Fix : `PICK_EV_FLOOR_MAP` → 0.99 sur FHW HOME

### BTTS NO toxique dans les ligues à haut scoring

- PL (~2.83 buts/match) : BTTS NO éliminé complètement (floor 0.99)
- BL1 (3.39 buts/match) : BTTS NO éliminé à cotes courtes [2.0-2.99], floor 3.0

### DRAW longshots en PL — signal principal

- DRAW [5.0-7.99] est le meilleur signal du système sur 3 saisons
- Le modèle Poisson capture les matchs très équilibrés que le marché sur-cote en favori
- Ne pas toucher sans raison forte

### ONE_X_TWO HOME ≥5.0 = probablement des combos

- Quand des HOME bets apparaissent à cotes très élevées dans le backtest → souvent des combos (HOME 3.0 × BTTS_YES 1.9 = 5.7)
- **Vérifier après toute analyse** : si combos désactivés et HOME ≥5.0 disparaissent → c'était des combos

---

## 7. Mise à jour de `league-bet-indication.md`

Ce fichier est le guide de référence des picks par ligue. Mettre à jour après chaque backtest finalisé.

**Structure d'une section ligue :**

```markdown
## Nom de la ligue (CODE) ✅/❌/⚠️ PASS/FAIL — +X% ROI (N bets, date)

**Profil :** description en 1 phrase

| Pick   | Cotes window | ROI backtest | Statut                          |
| ------ | ------------ | ------------ | ------------------------------- |
| 🟢 ... | ...          | ...          | Signal validé                   |
| ⚠️ ... | ...          | ...          | INSUFFICIENT_DATA ou surveiller |
| 🔴 ... | ...          | ...          | Éliminé ou hors fenêtre         |

> **Lecture :** instruction pratique
```

**Règles de mise à jour :**

- Toujours indiquer la date et le nombre de bets dans le titre
- Préciser si c'est une baseline propre (sans combos) ou avec combos
- 🟢 = signal validé sur ≥2 saisons, volume suffisant
- ⚠️ = INSUFFICIENT_DATA ou borderline (-5% < ROI < 0%)
- 🔴 = éliminé par floor/cap ou toxique confirmé

---

## 8. Checklist après chaque session de calibration

```bash
# 1. Lint
pnpm --filter backend lint

# 2. TypeScript
pnpm --filter backend typecheck

# 3. Tests (363 tests, aucun doit échouer)
pnpm --filter backend test
```

Si un test échoue sur une valeur de constante : mettre à jour le test pour refléter la nouvelle valeur + documenter la raison dans le commentaire du test.

---

## 9. État des ligues au 2026-04-19

### Backtestées et calibrées (baseline propre sans combos)

| Ligue   | ROI    | Bets | Fixes appliqués                                                                                                              |
| ------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| **PL**  | +69.9% | 114  | FHW all élim, BTTS NO élim, DRAW cap 7.99, AWAY threshold 0.30 + cap 6.99                                                    |
| **L1**  | +31.9% | 25   | HOME [2.0-2.99] retenu. BTTS YES gardé avec floor 2.10. BTTS NO, FHW, OU, OU_HT éliminés.                                    |
| **POR** | +65.4% | 19   | Threshold score abaissé à 0.58. DRAW ouvert sur [3.0-4.99] avec floor EV 0.02 + cap 4.99. HOME limité à [2.0-2.99].          |
| **BL1** | +23.4% | 87   | FHW HOME élim, BTTS NO floor 3.0                                                                                             |
| **SA**  | +59.4% | 39   | Signals: BTTS YES [2-3] + FHW DRAW [3-5]. AWAY probability_too_low actif. Signal latent DRAW [5-6] (sous-estimation lambda). |
| **SP2** | +27.8% | 32   | HOME [<2.0] + OVER 2.5 [2-3], AWAY éliminé. Brier marginal FAIL non résolu par lambda/HA globaux.                            |
| **D2**  | +49.7% | 12   | AWAY [2.0-2.99] retenu. UNDER éliminé, FHW AWAY éliminé, HT OVER_1_5 éliminé. Brier FAIL non résolu.                         |

| **CH** | +38.4% | 70 | FHW AWAY/DRAW/HOME HOME floor 5.00, DRAW 1X2 élim, BTTS YES élim |

Les autres ligues ont été retirées de cet état de synthèse tant qu'elles n'ont pas été re-backtestées récemment sur la baseline sans combos.

---

## 10. TODOs ouverts (hérités de sessions précédentes)

### J1 League

- J1-1 : réduire HOME_ADVANTAGE (modèle surévalue massivement P(home))
- J1-2 : relever threshold HOME à 0.58
- J1-3 : activer OVER_UNDER_HT OVER_1_5
- J1-4 : re-backtester après corrections

### Liga MX

- MX1-1 : relever threshold global
- MX1-2 : désactiver AWAY (0W backtest)
- MX1-3 : corriger HOME_ADVANTAGE (structure Apertura/Clausura très différente)
- MX1-4 à MX1-5 : autres ajustements à définir

### Championship ✅ CLÔTURÉ (2026-04-19, +38.4% ROI, 70 bets)

- CH-1 : ~~désactiver DRAW 1X2~~ → floor 0.99 appliqué (1W/8L, -56.9%)
- CH-2 : ~~limiter AWAY~~ → FHW AWAY + FHW DRAW floor 0.99 (AWAY 1W/21L -86.8%)
- CH-3 : volume HT OVER_1_5 — INSUFFICIENT_DATA (4 bets, -21.75%), surveiller

### Global

- GLOBAL-1 : ajouter tracking COMBO séparé dans le backtest (préalable à la réactivation des combos)
- GLOBAL-2 : facteurs HA per-league à affiner sur plus de données
- GLOBAL-3 : re-vérifier toutes les ligues "avec combos" avec la baseline propre
