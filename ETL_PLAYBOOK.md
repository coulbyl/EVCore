# ETL_PLAYBOOK.md

Backend : `http://localhost:3001`

---

## Préparer une compétition pour le coupon

Ordre strict. Chaque étape dépend de la précédente.

```
POST /etl/sync/fixtures/:code
POST /etl/sync/stats/:code
POST /etl/sync/rolling-stats/:code/:season
POST /etl/sync/odds-prematch
POST /coupon/generate-tomorrow
```

Remplacer `:code` par le code compétition (`WCQE`, `PL`, `UNL`, etc.) et `:season` par l'année de saison (`2024`, `2025`…).

---

## Vérifier l'état

```
GET /etl/status               ← jobs BullMQ en cours / failed
pnpm --filter @evcore/db db:stats          ← couverture xG, odds, fixtures scheduled
pnpm --filter @evcore/db db:audit:fixtures YYYY-MM-DD   ← sélections d'une journée
```

---

## Notes

- **stats sync** : 2s par fixture (200 fixtures WCQE ≈ 7 min)
- **WCQE / FRI / UNL** : pas de `expected_goals` dans l'API → proxy `shots_on_target × 0.35` appliqué automatiquement
- Si `generate-tomorrow` retourne `NO_BET` : vérifier que `odds-prematch` a bien tourné (`db:stats` → colonne ODDS)
