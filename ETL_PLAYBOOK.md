# ETL_PLAYBOOK.md

Backend : `http://localhost:3001`

---

## Préparer une compétition pour la génération de picks

Ordre strict. Chaque étape dépend de la précédente.

```text
POST /etl/sync/fixtures/:code
POST /etl/sync/stats/:code
POST /etl/sync/rolling-stats/:code/:season
POST /etl/sync/odds-prematch
POST /betting-engine/run-tomorrow
```

Remplacer `:code` par le code compétition (`WCQE`, `PL`, `UNL`, etc.) et `:season` par l'année de saison (`2024`, `2025`…).

Important :

- `POST /etl/sync/fixtures/:code` cible la saison courante de la compétition
- `POST /etl/sync/stats/:code` cible aussi uniquement la saison courante
- pour l'historique, utiliser les routes `/backfill`

---

## Backfill historique

À utiliser quand une ligue a bien ses fixtures, mais pas encore ses `xG` historiques, ou quand on ajoute une nouvelle compétition.

```text
POST /etl/sync/fixtures/:code/backfill?seasons=2023,2024,2025
POST /etl/sync/stats/:code/backfill?seasons=2023,2024,2025
POST /etl/sync/odds-csv/:code/backfill?seasons=2023,2024,2025
POST /etl/sync/rolling-stats/:code/:season
```

Ordre recommandé :

```text
1. fixtures backfill
2. stats backfill
3. rolling-stats par saison
4. odds-csv backfill si la compétition a un csvDivisionCode
```

Exemple `J1` :

```bash
curl -X POST 'http://localhost:3001/etl/sync/fixtures/sa/backfill?seasons=2023,2024,2025'
curl -X POST 'http://localhost:3001/etl/sync/stats/J1/backfill?seasons=2023,2024,2025'
curl -X POST 'http://localhost:3001/etl/sync/rolling-stats/J1/2023'
curl -X POST 'http://localhost:3001/etl/sync/rolling-stats/J1/2024'
curl -X POST 'http://localhost:3001/etl/sync/rolling-stats/J1/2025'
```

---

## Vérifier l'état

```bash
curl 'http://localhost:3001/etl/status'
pnpm --filter @evcore/db db:stats
pnpm --filter @evcore/db db:audit:fixtures YYYY-MM-DD
```

Lecture rapide de `db:stats` :

- `xG (done/fin)` lit `fixture.homeXg IS NOT NULL`
- `STATS` lit `team_stats`
- donc `STATS > 0` ne veut pas dire que le vrai `xG` fixture est rempli
- une ligue peut avoir des `team_stats` via fallback sur les buts, tout en restant à `0/N` en `xG`

---

## Notes

- **stats sync** : 2s par fixture environ
- **WCQE / FRI / UNL** : pas de `expected_goals` dans l'API → proxy `shots_on_goal × 0.40` appliqué automatiquement
- **J1** : la routine seule ne suffit pas pour remplir l'historique; utiliser `POST /etl/sync/stats/J1/backfill?seasons=2023,2024,2025`
- Si `generate-tomorrow` retourne `NO_BET` : vérifier que `odds-prematch` a bien tourné (`db:stats` → colonne ODDS)
