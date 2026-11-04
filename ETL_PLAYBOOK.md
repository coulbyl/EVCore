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
POST /betting-engine/analyze/date/YYYY-MM-DD
```

Remplacer `:code` par le code compétition (`WCQE`, `PL`, `UNL`, etc.) et `:season` par l'année de saison (`2024`, `2025`…). Pour analyser plusieurs jours d'un coup (J+1..J+4 par défaut, cotes puis analyse) : `POST /etl/sync/analysis-horizon`, le pendant manuel du cron d'horizon glissant.

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

Depuis le 2026-10-28, les routes `/etl/*` exigent une session admin ou le jeton de service : exporte `ADMIN_API_TOKEN` (même valeur que dans le `.env` du backend) avant de lancer ces commandes.

Exemple `J1` :

```bash
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" 'http://localhost:3001/etl/sync/fixtures/J1/backfill?seasons=2023,2024,2025'
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" 'http://localhost:3001/etl/sync/stats/J1/backfill?seasons=2023,2024,2025'
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" 'http://localhost:3001/etl/sync/rolling-stats/J1/2023'
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" 'http://localhost:3001/etl/sync/rolling-stats/J1/2024'
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" 'http://localhost:3001/etl/sync/rolling-stats/J1/2025'
```

---

## Vérifier l'état

Il n'y a pas de route `/etl/status`. L'état des files et des passes se lit dans l'admin (session admin, le jeton de service ne suffit pas) : **Admin › Exploitation** (`GET /console/queues` : échecs des dernières 24 h, en cours, dernière et prochaine exécution ; `GET /console/passes` : les passes du jour) et l'accueil admin (`GET /console/status` : les trois voyants et « À faire »).

```bash
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
- Si l'analyse (`POST /betting-engine/analyze/date/:date`) donne `NO_BET` : vérifier que `odds-prematch` a bien tourné (`db:stats` → colonne ODDS)

---

## Ajouter de nouvelles ligues (backfill complet)

Runbook des 19 compétitions ajoutées à `seed.ts` (+ KOR1/UNL), suite de [docs/archive/new-leagues.md](docs/archive/new-leagues.md). Prérequis : le seed doit avoir tourné, sinon le `competitionCode` n'existe pas en base et les routes renvoient une erreur.

Séquence par ligue :

1. **Fixtures backfill**, toujours en premier : `POST /etl/sync/fixtures/:code/backfill?seasons=2022,2023,2024,2025`
2. **Stats backfill** (xG), sur les fixtures déjà importées : `POST /etl/sync/stats/:code/backfill?seasons=...`
3. **Rolling-stats** par saison : `POST /etl/sync/rolling-stats/:code/:season`
4. **Cotes historiques**, selon la source :
   - `csvDivisionCode` défini → `POST /etl/sync/odds-csv/:code/backfill?seasons=...` (gratuit, football-data.co.uk)
   - sinon, une entrée dans `THE_ODDS_API_SPORT_KEYS` (`apps/backend/src/config/etl.constants.ts`) → `POST /etl/sync/odds-historical/:code/backfill?seasons=...` (**payant en crédits The Odds API**, saison par saison pour contrôler le coût)
   - sinon (groupe B) → pas de cotes historiques : fixtures + stats suffisent au moteur, pas de backtest.

Ensuite, passer la compétition à `isActive: true` en base (hors seed) : elle entre dans les syncs quotidiennes (`fixtures`/`stats`/`injuries`/`odds-prematch`) et dans le rebuild (`POST /etl/rebuild/betting-engine`). Rien d'autre à lancer pour le suivi courant.

| Groupe | Source des cotes                                     | Codes                                                                        |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| A      | `odds-csv` (gratuit)                                 | `ARG1`, `AUT1`, `DEN1`, `IRL1`, `SCO1`, `BEL1`, `GRE1`, `RUS1`               |
| A      | `odds-historical` (payant)                           | `KSA1`, `AUS1`, `CHI1`, `D3`, `BRA2` (seasonStartMonth=3, aligner si besoin) |
| Fix    | `odds-historical` seul (fixtures/stats déjà en sync) | `KOR1`, `UNL`                                                                |
| B      | aucune, observation seule                            | `ARG2`, `CHI2`, `KOR2`, `CHN2`, `FIN2`, `USA2`                               |

Exemple complet pour `ARG1` (remplacer le code ; pour le groupe B, s'arrêter après les stats et les rolling-stats) :

```bash
BASE_URL=http://localhost:3001
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" "$BASE_URL/etl/sync/fixtures/ARG1/backfill?seasons=2022,2023,2024,2025"
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" "$BASE_URL/etl/sync/stats/ARG1/backfill?seasons=2022,2023,2024,2025"
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" "$BASE_URL/etl/sync/odds-csv/ARG1/backfill?seasons=2022,2023,2024,2025"
```

Notes :

- `2022` est le plancher du worker `odds-historical-import` (`ETL_CONSTANTS.EUROPEAN_ODDS_HISTORY_SEASON_FROM = 2022`) : une saison antérieure est refusée.
- Ligues à calendrier civil (Argentine, Chili, Irlande…) : `seasonYear` = l'année de la saison API-Football (`2025` pour la saison jouée en 2025) ; vérifier le premier fixture importé en cas de doute.
- **`UNL`** : compétition internationale avec `apiSeasonOverride: 2024` (saisons multi-années). Avant le backfill de cotes, vérifier le `seasonYear` des fixtures déjà importées en base plutôt que de le deviner.
- `odds-historical` met une seconde entre chaque saison (`delay: i * 1000`) : inutile d'espacer les `curl`, mais suivre la file `odds-historical-import` dans Admin › Exploitation avant de lancer la ligue suivante.
