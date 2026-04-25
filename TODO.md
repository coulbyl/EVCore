# EVCore - TODO

## Ajout de nouvelles compétitions

### Contexte

Le seed (`packages/db/src/seed.ts`) est la source de vérité pour les compétitions. Le worker CSV `odds-csv-import.worker.ts` gère deux types de sources :

- **Path standard** (`mmz4281/{season}/{code}.csv`) — fichier par saison, format `Div,Date,HomeTeam,...`
- **Path `/new/`** (`new/{code}.csv`) — fichier unique toutes saisons, format `Country,League,Season,Date,Home,Away,...` — déclenché par `EXTRA_LEAGUE_DIVISION_CODES` (ligne 19 du worker)

---

### Tableau confirmé (IDs, CSV codes et Odds API vérifiés)

Fenêtre de backtest : saisons **2023, 2024, 2025** (`2324`, `2425`, `2526`).

#### Groupe A — Backtest possible → `isActive: false` en attente de validation

| Ligue | Code | leagueId | Source odds historiques | The Odds API key |
|---|---|---|---|---|
| Pologne D1 (Ekstraklasa) | `POL1` | 106 | CSV `POL` `/new/` (2023–2025 ✅) | `soccer_poland_ekstraklasa` |
| Suède D1 (Allsvenskan) | `SWE1` | 113 | CSV `SWE` `/new/` (2023–2025 ✅) | `soccer_sweden_allsvenskan` |
| Suède D2 (Superettan) | `SWE2` | 114 | The Odds API historical (depuis 2022 ✅) | `soccer_sweden_superettan` |
| Suisse D1 (Super League) | `SUI1` | 207 | CSV `SWZ` `/new/` (2023–2025 ✅) | `soccer_switzerland_superleague` |
| Turquie D1 (Süper Lig) | `TUR1` | 203 | CSV `T1` `/mmz4281/` (2324–2526 ✅) | `soccer_turkey_super_league` |
| USA MLS | `MLS` | 253 | CSV `USA` `/new/` (2023–2025 ✅) | `soccer_usa_mls` |
| Norvège D1 (Eliteserien) | `NOR1` | 103 | CSV `NOR` `/new/` (2023–2025 ✅) | `soccer_norway_eliteserien` |

> `EXTRA_LEAGUE_DIVISION_CODES` à mettre à jour (worker ligne 19) : ajouter `POL`, `SWE`, `SWZ`, `USA`, `NOR`.
> SWE2 utilise le worker `odds-historical-import` (The Odds API) — ajouter `SWE2: 'soccer_sweden_superettan'` dans `THE_ODDS_API_SPORT_KEYS`.
> Ligues à calendrier civil (SWE1, SWE2, MLS, NOR1) : `seasonStartMonth: 2` → ETL calcule `season=2026`. Seasons CSV filtrées sur `2023`, `2024`, `2025` (colonne `Season` des fichiers `/new/`).

#### Groupe B — Pas de backtest possible → `isActive: false` indéfiniment

Pas d'historique odds disponible (ni CSV ni The Odds API). EV live fonctionnel une fois activé manuellement.

| Ligue | Code | leagueId | API-Football odds live |
|---|---|---|---|
| Pologne D2 (I Liga) | `POL2` | 107 | ✅ Pinnacle |
| Rép. Tchèque D1 (Czech Liga) | `CZE1` | 345 | ✅ Pinnacle |
| Suisse D2 (Challenge League) | `SUI2` | 208 | ✅ Pinnacle |
| Turquie D2 (1. Lig) | `TUR2` | 204 | ✅ Pinnacle |
| Serbie D1 (Super Liga) | `SRB1` | 286 | ✅ Pinnacle |
| Slovénie D1 (1. SNL) | `SVN1` | 373 | ✅ Pinnacle |
| Norvège D2 (1. Division) | `NOR2` | 104 | ✅ Pinnacle |

---

### Étape 1 — `EXTRA_LEAGUE_DIVISION_CODES` dans le worker

Fichier : `apps/backend/src/modules/etl/workers/odds-csv-import.worker.ts` — ligne 19.

```ts
// Avant
const EXTRA_LEAGUE_DIVISION_CODES = new Set(['JPN', 'MEX']);

// Après
const EXTRA_LEAGUE_DIVISION_CODES = new Set(['JPN', 'MEX', 'POL', 'SWE', 'SWZ', 'USA', 'NOR']);
```

---

### Étape 2 — `THE_ODDS_API_SPORT_KEYS` dans etl.constants.ts

Fichier : `apps/backend/src/config/etl.constants.ts` — objet `THE_ODDS_API_SPORT_KEYS`.

```ts
// À ajouter
POL1: 'soccer_poland_ekstraklasa',
SWE1: 'soccer_sweden_allsvenskan',
SWE2: 'soccer_sweden_superettan',
SUI1: 'soccer_switzerland_superleague',
TUR1: 'soccer_turkey_super_league',
MLS:  'soccer_usa_mls',
NOR1: 'soccer_norway_eliteserien',
```

---

### Étape 3 — Ajouter au seed

Fichier : `packages/db/src/seed.ts` — tableau `COMPETITIONS`.

Groupe A (`isActive: false`, backtest possible) :
```ts
// Calendrier août-mai
{ leagueId: 106, code: "POL1", name: "Ekstraklasa", country: "Poland", isActive: false, csvDivisionCode: "POL" },
{ leagueId: 207, code: "SUI1", name: "Super League", country: "Switzerland", isActive: false, csvDivisionCode: "SWZ" },
{ leagueId: 203, code: "TUR1", name: "Süper Lig", country: "Turkey", isActive: false, csvDivisionCode: "T1" },
// Calendrier civil (seasonStartMonth: 2 = mars)
{ leagueId: 113, code: "SWE1", name: "Allsvenskan", country: "Sweden", isActive: false, csvDivisionCode: "SWE", seasonStartMonth: 2 },
{ leagueId: 114, code: "SWE2", name: "Superettan", country: "Sweden", isActive: false, csvDivisionCode: null, seasonStartMonth: 2 },
{ leagueId: 253, code: "MLS", name: "Major League Soccer", country: "USA", isActive: false, csvDivisionCode: "USA", seasonStartMonth: 2 },
{ leagueId: 103, code: "NOR1", name: "Eliteserien", country: "Norway", isActive: false, csvDivisionCode: "NOR", seasonStartMonth: 2 },
```

Groupe B (`isActive: false`, pas de backtest — ne pas activer sans source historique) :
```ts
// Calendrier août-mai
{ leagueId: 107, code: "POL2", name: "I Liga", country: "Poland", isActive: false, csvDivisionCode: null },
{ leagueId: 345, code: "CZE1", name: "Czech Liga", country: "Czech Republic", isActive: false, csvDivisionCode: null },
{ leagueId: 208, code: "SUI2", name: "Challenge League", country: "Switzerland", isActive: false, csvDivisionCode: null },
{ leagueId: 204, code: "TUR2", name: "1. Lig", country: "Turkey", isActive: false, csvDivisionCode: null },
{ leagueId: 286, code: "SRB1", name: "Super Liga", country: "Serbia", isActive: false, csvDivisionCode: null },
{ leagueId: 373, code: "SVN1", name: "1. SNL", country: "Slovenia", isActive: false, csvDivisionCode: null },
// Calendrier civil
{ leagueId: 104, code: "NOR2", name: "1. Division", country: "Norway", isActive: false, csvDivisionCode: null, seasonStartMonth: 2 },
```

---

### Étape 4 — Appliquer et syncer

```bash
# Seed en local
pnpm --filter @repo/db db:seed

# Pour chaque nouvelle ligue active
POST /etl/sync/fixtures/:competitionCode
POST /etl/sync/stats/:competitionCode
POST /rolling-stats/backfill/:competitionCode/:season
POST /etl/sync/odds-csv/:competitionCode  # si csvDivisionCode non null
```

---

### Étape 5 — Backtest et validation (suivre CALIBRATION-GUIDE.md)

```bash
POST /backtest/:competitionCode
```

Critères de passage pour activer (`isActive: true`) :
- ROI simulé ≥ -5%
- Brier Score < 0.65
- Calibration Error ≤ 5%

Si une ligue ne passe pas → rester `isActive: false`, documenter dans CALIBRATION-GUIDE.md.

---

### Checklist

- [x] Confirmer tous les `leagueId` via API-Football
- [x] Confirmer tous les `csvDivisionCode` via football-data.co.uk
- [x] Confirmer disponibilité sur The Odds API
- [x] Confirmer odds Pinnacle sur API-Football (toutes ligues)
- [ ] Ajouter `POL`, `SWE`, `SWZ`, `USA`, `NOR` dans `EXTRA_LEAGUE_DIVISION_CODES` (worker ligne 19)
- [ ] Ajouter les 7 clés Odds API dans `THE_ODDS_API_SPORT_KEYS` (`etl.constants.ts`)
- [ ] Ajouter les 14 compétitions dans `packages/db/src/seed.ts`
- [ ] Lancer `db:seed` en local
- [ ] Sync ETL + rolling stats pour chaque ligue
- [ ] Backtest Pologne D1 (`POL1`)
- [ ] Backtest Rép. Tchèque D1 (`CZE1`)
- [ ] Backtest Suède D1 (`SWE1`)
- [ ] Backtest Suisse D1 (`SUI1`)
- [ ] Backtest Turquie D1 (`TUR1`)
- [ ] Backtest USA MLS (`MLS`)
- [ ] Backtest Serbie D1 (`SRB1`)
- [ ] Backtest Slovénie D1 (`SVN1`)
- [ ] Backtest Norvège D1 (`NOR1`)
- [ ] Backtest ligues D2 (si données suffisantes après D1 validées)
- [ ] Activer (`isActive: true`) les ligues qui passent le backtest
- [ ] Mettre à jour ROADMAP.md
