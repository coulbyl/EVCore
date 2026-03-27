# ETL_PLAYBOOK.md — Référence des endpoints ETL

Backend : `http://localhost:3001`
Swagger : `http://localhost:3001/api`

---

## Monitoring

```
GET /etl/status
```

Retourne les compteurs BullMQ (active / waiting / completed / failed / delayed) par queue.
À consulter après chaque déclenchement manuel pour vérifier que les jobs n'ont pas échoué.

```
GET /health
GET /health/novu
```

---

## Pipeline initial — nouvelle compétition

À exécuter dans cet ordre strict quand on ajoute une compétition (ex : WCQE, UNL, FRI).
Chaque étape dépend de la précédente.

```
1. POST /etl/sync/fixtures/:competitionCode     ← importe les fixtures de la saison
2. POST /etl/sync/stats/:competitionCode        ← importe xG / stats (2s/fixture — prévoir ~10min pour 200 fixtures)
3. POST /etl/sync/rolling-stats/:competitionCode/:season   ← recalcule les TeamStats
4. POST /etl/sync/odds-prematch                 ← récupère les cotes pré-match
```

> Si `expected_goals` est `null` dans l'API (cas WCQE, FRI, UNL), le worker applique
> automatiquement le proxy `shots_on_target × 0.35`. Ne pas marquer `xgUnavailable` tant
> que l'API retourne au moins les `Shots on Goal`.

---

## Pipeline quotidien (routine)

Ordre recommandé pour une journée normale :

```
POST /etl/sync/fixtures              ← today + tomorrow UTC (toutes ligues actives)
POST /etl/sync/settlement            ← settle les bets/coupons en attente
POST /etl/sync/injuries              ← shadow scoring blessures (fenêtre today+tomorrow)
POST /etl/sync/odds-prematch         ← cotes J+1 (body optionnel : { "date": "YYYY-MM-DD" })
POST /coupon/generate-tomorrow       ← génère le coupon du lendemain (après odds-prematch)
```

> **Raccourci** : `POST /etl/sync/full` enchaîne fixtures → settlement → stats → injuries → odds-csv → odds-prematch.

---

## Stats sync

### Toutes les ligues actives

```
POST /etl/sync/stats
```

### Une ligue spécifique (backfill ou nouvelle compétition)

```
POST /etl/sync/stats/:competitionCode
```

Exemples : `WCQE`, `FRI`, `UNL`, `PL`, `SA`, `BL1`

> Rate limit : 2s par fixture. Pour 200 fixtures WCQE : ~7 minutes.

---

## Rolling stats

### Recalcul incrémental (normal)

```
POST /etl/sync/rolling-stats/:competitionCode/:season
```

Par défaut `mode=refresh` (idempotent). Exemple : `/etl/sync/rolling-stats/WCQE/2024`

### Reconstruction forcée

```
POST /etl/sync/rolling-stats/:competitionCode/:season
Body: { "mode": "rebuild" }
```

À utiliser uniquement si les TeamStats sont corrompus ou après un reset xG.

### Backfill toutes ligues

```
POST /rolling-stats/backfill-all
```

---

## Odds

### Odds pré-match J+1 (cotes live API-Football)

```
POST /etl/sync/odds-prematch
POST /etl/sync/odds-prematch        Body: { "date": "YYYY-MM-DD" }
```

Bookmakers prioritaires : Pinnacle (id=4) → Bet365 (id=8), marché Match Winner (id=1).

### Odds historiques CSV (football-data.co.uk)

```
POST /etl/sync/odds-csv                                          ← toutes ligues actives
POST /etl/sync/odds-csv/:competitionCode/backfill?seasons=2022,2023,2024   ← backfill ciblé
```

### Nettoyage des snapshots anciens

```
POST /etl/sync/odds-retention
POST /etl/sync/odds-retention       Body: { "retentionDays": 30 }
```

---

## Backtest

```
POST /etl/sync/backtest              ← toutes les saisons incluses
POST /etl/sync/backtest/:seasonId    ← une saison ciblée
GET  /backtest/validation-report     ← Brier Score / Calibration / ROI
```

Seuils MVP de référence : Brier < 0.65 / Calibration ≤ 5% / ROI ≥ -5%
Résultats de référence (EPL, 3 saisons) : Brier 0.592 / Calibration 2.5% / ROI +2.28%

---

## Coupon

```
POST /coupon/generate-tomorrow       ← génère le coupon du lendemain
```

Si `NO_BET` : vérifier que les fixtures J+1 ont des odds (`GET /etl/status` + relancer `odds-prematch`).

---

## Settlement / apprentissage

```
POST /etl/sync/settlement            ← settle les bets pending + déclenche la calibration si ≥ 50 bets
GET  /adjustment                     ← liste les AdjustmentProposals
POST /adjustment/:id/rollback        ← rollback un proposal APPLIED (confirmation humaine requise)
```

La calibration auto-apply se déclenche si : `brierScore > 0.25` ET `betCount ≥ 50` ET pas d'apply dans les 7 derniers jours.

---

## Diagnostics

```
pnpm --filter @evcore/db db:audit:fixtures YYYY-MM-DD    ← rapport des sélections d'une journée
pnpm --filter @evcore/db db:stats                        ← état global du système
pnpm --filter @evcore/db db:reset-zero-xg --codes=XX    ← audit des xG=0 écrits à tort (sans --apply)
pnpm --filter @evcore/db db:reset-zero-xg --apply --codes=XX   ← remet homeXg/awayXg à null
```

Après un reset xG, toujours relancer :

```
POST /etl/sync/stats/:competitionCode
POST /etl/sync/rolling-stats/:competitionCode/:season
```

---

## Compétitions internationales — cas particuliers

| Code | leagueId | apiSeasonOverride | xG dispo | Notes |
|------|----------|-------------------|----------|-------|
| WCQE | 32 | 2024 | Non (proxy shots) | Pas de `expected_goals` dans l'API |
| FRI | 10 | 2026 | Non (proxy shots) | Idem |
| UNL | 5 | 2024 | Non (proxy shots) | Idem |

Pour ces compétitions, `expected_goals` est toujours `null` dans l'API Football.
Le worker applique le proxy `shots_on_target × 0.35` (constante `XG_SHOTS_PROXY_FACTOR`).
Les TeamStats doivent être recalculés après le stats sync.
