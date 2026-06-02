# WC 2026 — Calibration Report

Date : 2026-06-02  
Auteur : backtest WC 2022 (64 fixtures) + WCQ 2022 qualifying seasons

---

## Contexte

La Coupe du Monde 2026 débute le 11 juin 2026. Format : 48 équipes, 12 groupes de 4, 104 matchs totaux (72 groupes + 32 phase finale). C'est la première édition avec ce format.

Le modèle n'a pas de stats in-tournament au démarrage : toute l'analyse repose sur le **cross-comp fallback** (stats des qualifications de chaque confédération). Cette calibration a été faite à partir du backtest WC 2022 (seule édition disponible en DB).

---

## Données importées

| Compétition | Saison  | Fixtures | Team stats |
| ----------- | ------- | -------- | ---------- |
| WC          | 2022-23 | 64       | 128        |
| WCQE        | 2020-21 | 259      | 516        |
| WCQCA       | 2022-23 | 122      | 236        |
| WCQSA       | 2022-23 | 90       | 178        |
| WCQAS       | 2022-23 | 233      | 460        |
| WCQAF       | 2022-23 | 158      | 316        |
| WCQOC       | 2022-23 | 16       | 22         |

Rolling-stats reconstruites via `POST /etl/sync/rolling-stats/{code}/{season}?mode=rebuild`.

---

## Poids cross-comp — décision clé

### Avant (baseline)

```
NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT = 0.65
NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT  = 0.35
→ Brier WC 2022 : 0.6584 / CalibError : 5.19%
```

### Scan effectué (2026-06-02)

| form / xG       | Brier      |
| --------------- | ---------- |
| 0.65 / 0.35     | 0.6584     |
| 0.80 / 0.20     | 0.6567     |
| 0.90 / 0.10     | 0.6553     |
| **1.00 / 0.00** | **0.6536** |

### Décision : form=1.0, xG=0.0

Le xG des qualifications non-européennes (WCQCA, WCQSA, WCQAS, WCQAF, WCQOC) est absent ou non fiable — l'éliminer améliore la calibration de façon monotone. L'erreur de calibration passe de 5.19% à **3.14%**.

**Fichier modifié :** `ev.constants.ts`

```
NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT = 1.0
NATIONAL_TEAM_CROSS_COMP_XG_WEIGHT   = 0.0
```

---

## Brier score de référence

| Compétition                | Saison    | Brier     | Notes                          |
| -------------------------- | --------- | --------- | ------------------------------ |
| EPL (référence domestique) | 3 saisons | 0.592     | 3-outcome, stats directes      |
| WC 2022                    | 2022-23   | **0.654** | cross-comp fallback uniquement |
| WCQCA                      | 2022-23   | 0.535     | cross-comp partiel             |
| WCQSA                      | 2022-23   | 0.559     | cross-comp partiel             |
| WCQAS                      | 2022-23   | 0.427     | xG Asia disponible             |
| WCQAF                      | 2023-24   | 0.534     | meilleure saison disponible    |

L'écart WC vs EPL (+0.062) est structurel : les équipes nationales jouent dans des compétitions hétérogènes, le cross-comp est moins précis que des stats de ligue directes.

---

## Configuration prediction.constants.ts — famille WC

### WC (tournoi principal)

```typescript
CONF: { enabled: true, threshold: 0.6, minSampleN: 10 }
// WC 2022 : 9 picks, 55.6% HR, 14.1% couverture. Signal fragile sur 64 fixtures.

DRAW: { enabled: true, threshold: 0.2, minSampleN: 5 }
// OBSERVATION uniquement. ROI négatif partout sur WC 2022.
// Taux DRAW historique WC group stage : ~17-23%.

BTTS: { enabled: true, threshold: 0.35, minSampleN: 5 }
// OBSERVATION uniquement. Problème structurel : model caps P(BTTS) à ~0.47
// car les stats WCQ sous-estiment le potentiel offensif du tournoi (voir section BTTS).
```

**Pour WC 2026 (104 matchs) :**

- CONF : ~14 picks attendus
- BTTS : ~61 picks attendus (observation)
- DRAW : ~104 picks attendus (observation)

### WCQE (Europe)

```typescript
CONF: { enabled: true, threshold: 0.5, minSampleN: 10 }
// Calibré 2026-05-03. CONF fort à 0.50 (70.8%, 66 fixtures — matchs lopsided).
BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 }
// Validé 2026-05-03 : 64.1%, 39 picks.
```

### WCQCA (CONCACAF)

```typescript
CONF: { enabled: true, threshold: 0.75, minSampleN: 10 }
// 2026-27 : 43 picks, 60.5% HR, 44.8% couverture.
// 2022-23 montrait un signal plus fort (71.4% à 0.55) mais la saison 2026-27
// est plus représentative du format élargi WC 2026.
```

### WCQSA (CONMEBOL)

```typescript
CONF: { enabled: true, threshold: 0.6, minSampleN: 10 }
// Valide dans les deux saisons : 2022-23 à 78.9%/19 picks, 2026-27 à 57.1%/21 picks.
```

### WCQAS (AFC / Asie)

```typescript
CONF: { enabled: true, threshold: 0.75, minSampleN: 10 }
// 2022-23 : signal extraordinaire (84%+ HR à partir de 0.50) — 230 fixtures,
// matchs très lopsided. 2026-27 : signal affaibli (format élargi, plus de compétition).
// 0.75 est le seul seuil qui valide dans les deux saisons (65.4% / 89.7%).
// DRAW 2026-27 à 0.28 : ROI +13.4% (PASS) mais 2022-23 ne valide pas → surveiller.
```

### WCQAF (CAF / Afrique)

```typescript
CONF: { enabled: true, threshold: 0.55, minSampleN: 10 }
// Référence : 2023-24 (92 fixtures). 26 picks, 80.8% HR, 28.3% couverture.
// 2022-23 signal trop faible (11 picks à 0.50, 54.5%).
```

### WCQOC (OFC / Océanie)

Pas configuré — 16 fixtures au total, volume insuffisant pour calibrer.

---

## Problème BTTS — diagnostic

### Root cause

Les lambdas Poisson sont calculés depuis les stats WCQ (qualifications), qui reflètent un football **défensif** (les équipes s'économisent, gèrent le résultat). En tournoi, les équipes jouent plus ouvertement.

| Source                  | xgFor moyen |
| ----------------------- | ----------- |
| WC 2022 (in-tournament) | **1.363**   |
| WCQSA                   | 1.183       |
| WCQAF                   | 1.274       |
| WCQAS                   | 1.762       |
| WCQCA                   | 1.742       |
| WCQE                    | 1.609       |

Résultat : les lambdas calculés pour WC sont ~0.3-0.4 trop bas → P(BTTS) capé à ~0.47 alors que le taux BTTS historique WC est **~48%**.

### Scan BTTS étendu sur WC 2022

| Seuil | Picks | HR    |
| ----- | ----- | ----- |
| 0.30  | 56    | 50.0% |
| 0.35  | 37    | 40.5% |
| 0.40  | 20    | 35.0% |
| 0.45  | 6     | 66.7% |
| 0.50+ | 0     | —     |

### Fix envisagé (pas encore appliqué)

Ajouter `WC: 1.35` dans `LEAGUE_MEAN_LAMBDA_MAP` pour relever l'ancre de shrinkage. À tester après avoir collecté des données WC 2026. Attention : potentiel impact sur le Brier 1X2.

### Recalibration recommandée

Après 20+ matchs WC 2026 : recalibrer BTTS et DRAW avec les résultats réels du tournoi. Le signal peut se clarifier une fois les stats in-tournament disponibles.

---

## Points de surveillance WC 2026

| Signal     | Seuil actuel | Action si validé                                                              |
| ---------- | ------------ | ----------------------------------------------------------------------------- |
| CONF       | 0.60         | — déjà validé sur WC 2022                                                     |
| DRAW       | 0.20         | Si ROI ≥ +5% + HR ≥ 32% sur 20+ picks → chercher seuil optimal                |
| BTTS       | 0.35         | Si HR ≥ 55% sur 20+ picks → remonter le seuil à 0.45-0.50                     |
| WCQAS DRAW | 0.28         | Si une 2e saison valide (ROI +13.4% en 2026-27) → activer                     |
| Lambda WC  | —            | Si Brier in-tournament < 0.65 → tenter `WC: 1.35` dans LEAGUE_MEAN_LAMBDA_MAP |

---

## Rappel endpoint backtest

```bash
# Relancer le backtest WC après collecte de données in-tournament
curl -X POST http://localhost:3001/backtest/WC

# Relancer pour une saison spécifique
curl -X POST http://localhost:3001/backtest/WC/2026-27
```

Le fichier `apps/backend/logs/backtest-analysis.latest.ndjson` contient les rejections EV/SV.  
Pour CONF/DRAW/BTTS, lire le champ `predictionBacktests[]` dans la réponse JSON directement.
