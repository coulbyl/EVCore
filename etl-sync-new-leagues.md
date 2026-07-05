# ETL — endpoints à lancer pour synchroniser les nouvelles ligues

Suite de [new-leagues.md](new-leagues.md). Ce document liste, **ligue par
ligue**, la séquence d'appels `POST /etl/...` à lancer pour peupler
fixtures/stats/cotes historiques des 19 compétitions ajoutées à `seed.ts`
(+ 2 fix rapides KOR1/UNL). `BASE_URL` = ton backend (`http://localhost:3000`
en local).

> ⚠️ **Prérequis** : la migration/seed doit avoir tourné (`pnpm --filter
@evcore/db ...` via ton CLI) avant de lancer quoi que ce soit ici — sinon
> `competitionCode` n'existe pas encore en DB et les endpoints renvoient une
> erreur.

## Séquence standard (3 étapes par ligue)

1. **Fixtures backfill** (historique) — obligatoire, toujours en premier :
   `POST /etl/sync/fixtures/:code/backfill?seasons=2022,2023,2024,2025`
2. **Stats backfill** (xG) — seulement pour les fixtures déjà importées :
   `POST /etl/sync/stats/:code/backfill?seasons=2022,2023,2024,2025`
3. **Cotes historiques** — la source dépend du groupe (voir tableau) :
   - `csvDivisionCode` défini → `POST /etl/sync/odds-csv/:code/backfill?seasons=...`
     (gratuit, football-data.co.uk)
   - Sinon, si une clé `THE_ODDS_API_SPORT_KEYS` existe → `POST
/etl/sync/odds-historical/:code/backfill?seasons=...` (**payant en
     crédits The Odds API** — snapshots par événement, à utiliser avec
     parcimonie, saison par saison si besoin de contrôler le coût)
   - Sinon (Groupe B) → pas d'endpoint, observation seule (fixtures + stats
     suffisent pour faire tourner le moteur Poisson/xG, pas de backtest ROI).

Après le backfill, la routine cron (`fixtures`/`stats`/`injuries`/
`odds-prematch` quotidiens) prend le relai automatiquement **une fois la
compétition passée à `isActive: true` en DB** (géré par toi, pas par le seed).
Rien d'autre à lancer manuellement pour le suivi courant.

---

## Groupe A — cotes via football-data.co.uk (gratuit, `odds-csv`)

| Ligue                         | Code   | Fixtures + Stats            | Cotes (odds-csv)                                                    |
| ----------------------------- | ------ | --------------------------- | ------------------------------------------------------------------- |
| Argentine — Primera División  | `ARG1` | seasons=2022,2023,2024,2025 | `POST /etl/sync/odds-csv/ARG1/backfill?seasons=2022,2023,2024,2025` |
| Autriche — Bundesliga         | `AUT1` | idem                        | `POST /etl/sync/odds-csv/AUT1/backfill?seasons=2022,2023,2024,2025` |
| Danemark — Superliga          | `DEN1` | idem                        | `POST /etl/sync/odds-csv/DEN1/backfill?seasons=2022,2023,2024,2025` |
| Irlande — Premier Division    | `IRL1` | idem                        | `POST /etl/sync/odds-csv/IRL1/backfill?seasons=2022,2023,2024,2025` |
| Écosse — Premiership          | `SCO1` | idem                        | `POST /etl/sync/odds-csv/SCO1/backfill?seasons=2022,2023,2024,2025` |
| Belgique — Jupiler Pro League | `BEL1` | idem                        | `POST /etl/sync/odds-csv/BEL1/backfill?seasons=2022,2023,2024,2025` |
| Grèce — Super League 1        | `GRE1` | idem                        | `POST /etl/sync/odds-csv/GRE1/backfill?seasons=2022,2023,2024,2025` |
| Russie — Premier League       | `RUS1` | idem                        | `POST /etl/sync/odds-csv/RUS1/backfill?seasons=2022,2023,2024,2025` |

Exemple complet pour `ARG1` (les 7 autres : remplacer le code) :

```bash
BASE_URL=http://localhost:3000

curl -X POST "$BASE_URL/etl/sync/fixtures/ARG1/backfill?seasons=2022,2023,2024,2025"
curl -X POST "$BASE_URL/etl/sync/stats/ARG1/backfill?seasons=2022,2023,2024,2025"
curl -X POST "$BASE_URL/etl/sync/odds-csv/ARG1/backfill?seasons=2022,2023,2024,2025"
```

## Groupe A — cotes via The Odds API uniquement (payant, `odds-historical`)

Pas de source CSV pour ces pays/divisions — seule option de backtest est le
snapshot payant The Odds API. À lancer saison par saison si tu veux limiter
la conso de crédits.

| Ligue                        | Code   | Fixtures + Stats                             | Cotes (odds-historical)                                                    |
| ---------------------------- | ------ | -------------------------------------------- | -------------------------------------------------------------------------- |
| Arabie Saoudite — Pro League | `KSA1` | seasons=2022,2023,2024,2025                  | `POST /etl/sync/odds-historical/KSA1/backfill?seasons=2022,2023,2024,2025` |
| Australie — A-League         | `AUS1` | idem                                         | `POST /etl/sync/odds-historical/AUS1/backfill?seasons=2022,2023,2024,2025` |
| Chili — Primera División     | `CHI1` | idem                                         | `POST /etl/sync/odds-historical/CHI1/backfill?seasons=2022,2023,2024,2025` |
| Allemagne — 3. Liga          | `D3`   | idem                                         | `POST /etl/sync/odds-historical/D3/backfill?seasons=2022,2023,2024,2025`   |
| Brésil — Série B             | `BRA2` | idem (seasonStartMonth=3, aligner si besoin) | `POST /etl/sync/odds-historical/BRA2/backfill?seasons=2022,2023,2024,2025` |

## Fix rapide — compétitions déjà en base (KOR1, UNL)

Ces deux-là existaient déjà avec `includeInBacktest: false` ; seul le
backfill des cotes manque (fixtures/stats déjà en cours de sync normalement) :

```bash
curl -X POST "$BASE_URL/etl/sync/odds-historical/KOR1/backfill?seasons=2022,2023,2024,2025"
```

> ⚠️ **`UNL` — vérifier avant de lancer.** C'est une compétition
> internationale avec `apiSeasonOverride: 2024` (numérotation de saison
> API-Football non-standard pour les tournois multi-années). Je n'ai pas de
> certitude sur le mapping `seasonYear` attendu par le worker
> `odds-historical-import` pour ce cas précis — vérifie le numéro de saison
> retourné par `GET /etl/sync/standings/UNL?season=...` ou les fixtures déjà
> importées avant de lancer le backfill de cotes, plutôt que de deviner.

## Groupe B — observation seule, pas d'endpoint cotes

Aucune source de cotes historiques (ni CSV ni The Odds API) — fixtures +
stats suffisent pour que le moteur tourne, pas de backtest ROI possible.

| Ligue                        | Code   | Fixtures + Stats               |
| ---------------------------- | ------ | ------------------------------ |
| Argentine — Primera Nacional | `ARG2` | `?seasons=2022,2023,2024,2025` |
| Chili — Segunda División     | `CHI2` | idem                           |
| Corée du Sud — K League 2    | `KOR2` | idem                           |
| Chine — League One           | `CHN2` | idem                           |
| Finlande — Ykkösliiga        | `FIN2` | idem                           |
| USA — USL Championship       | `USA2` | idem                           |

Exemple pour `ARG2` (les 5 autres : remplacer le code) :

```bash
curl -X POST "$BASE_URL/etl/sync/fixtures/ARG2/backfill?seasons=2022,2023,2024,2025"
curl -X POST "$BASE_URL/etl/sync/stats/ARG2/backfill?seasons=2022,2023,2024,2025"
```

---

## Notes

- Les saisons `2022,2023,2024,2025` sont un point de départ raisonnable
  (plancher `EUROPEAN_BACKTEST_SEASON_FROM = 2022` utilisé par le worker
  `odds-historical-import`) — ajuste si tu veux moins/plus d'historique.
- Pour les ligues à calendrier civil (Argentine, Chili, Irlande...),
  `seasonYear` correspond à l'année de la saison API-Football (ex. `2025`
  pour la saison qui s'est jouée sur l'année civile 2025) — vérifie le
  premier fixture importé si un doute apparaît sur l'alignement.
- Le endpoint `odds-historical` (Groupe A payant) fait un appel par saison
  avec 1s de délai entre chaque (`BULLMQ_DEFAULT_JOB_OPTIONS` + `delay: i *
1000`) — pas besoin d'espacer manuellement tes appels `curl`, mais
  surveille `GET /etl/status` (queue `odds-historical-import`) pour voir
  l'avancement/les échecs avant de lancer la ligue suivante.
- Une fois le backfill fait pour une ligue, passe-la à `isActive: true` en
  DB (hors scope de ce document — géré par toi) pour qu'elle entre dans les
  syncs routine (`fixtures`/`stats`/`injuries`/`odds-prematch` quotidiens) et
  dans le rebuild `betting-engine` (`POST /etl/rebuild/betting-engine`).
