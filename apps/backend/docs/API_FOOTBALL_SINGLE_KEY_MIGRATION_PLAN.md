# API-FOOTBALL Single-Key Migration Plan

Date: 2026-02-28
Owner: Backend/ETL
Status: **DÉCISIONS CLOSES — PRÊT À EXÉCUTER**

---

## 1) Objectif

Unifier les sources data pour:

- supprimer les 2 scrapers fragiles (Understat xG, FBref stats),
- migrer fixtures/results de football-data.org vers API-FOOTBALL (même clé que odds),
- remplacer l'endpoint odds historiques (inutilisable pour le passé) par un import CSV one-shot,
- standardiser sur une seule variable d'env `API_FOOTBALL_KEY`.

---

## 2) Architecture cible (décisions closes)

### 2.1 Sources de données

| Worker                          | Source                                     | Type                        | Saisons                |
| ------------------------------- | ------------------------------------------ | --------------------------- | ---------------------- |
| `fixtures-sync`                 | API-FOOTBALL `/fixtures`                   | API temps réel              | 2022, 2023, 2024       |
| `results-sync`                  | API-FOOTBALL `/fixtures?status=FT-AET-PEN` | API temps réel              | 2022, 2023, 2024       |
| `odds-csv-import`               | football-data.co.uk CSV                    | One-shot import             | 2122, 2223, 2324, 2425 |
| `xg-sync`                       | ~~Understat~~                              | **SUPPRIMÉ**                | —                      |
| `stats-sync`                    | ~~FBref~~                                  | **SUPPRIMÉ**                | —                      |
| `odds-historical-sync` (ancien) | ~~API-Sports /odds~~                       | **REMPLACÉ** par CSV import | —                      |

> Constat technique: l'endpoint `/odds` API-FOOTBALL ne conserve les données que 7 jours
> post-match. Les saisons passées (2022-2024) retournent 0 résultats. Confirmé par test live.
> Solution: football-data.co.uk fournit les closing odds Pinnacle + Bet365 en CSV gratuit,
> 4 saisons complètes (~160 KB total), import one-shot.

### 2.2 Variables d'environnement

```
# Conserver / renommer
API_FOOTBALL_KEY              # anciennement ODDS_API_KEY
API_FOOTBALL_LEAGUE_ID        # anciennement ODDS_API_LEAGUE_ID (défaut: 39 = EPL)
API_FOOTBALL_PLAN             # anciennement ODDS_API_PLAN (défaut: pro)
API_FOOTBALL_QUOTA_ALERT_PCT  # anciennement ODDS_API_QUOTA_ALERT_PCT (défaut: 80)

# Supprimer
FOOTBALL_DATA_API_KEY
```

### 2.3 Saisons

- API-FOOTBALL fixtures/results : `EPL_SEASONS: [2022, 2023, 2024]` (= 22/23, 23/24, 24/25)
- CSV odds import : 2122 + 2223 + 2324 + 2425

### 2.4 Décisions modèle (Option A — MVP rapide)

- Désactiver les features xG et stats FBref dans le scoring déterministe.
- Modèle réduit : forme + domicile/extérieur + odds-derived features.
- Recalibration des poids + backtest Brier/ROI après import.

---

## 3) Détails techniques confirmés (tests live)

### API-FOOTBALL `/fixtures`

- Pas de pagination pour une saison EPL complète (`results: 380, paging.total: 1`).
- Champs clés :

```
fixture.id          integer
fixture.date        ISO8601 avec offset
fixture.status.short  "NS"|"FT"|"AET"|"PEN"|"PST"|"CANC"|"SUSP"|...
fixture.status.extra  null (présent mais non documenté)
fixture.venue         { id, name, city }  (objet, pas juste id)
league.round          "Regular Season - N"  → parser N → matchday
league.season         integer (ex: 2022)
teams.home.id / name / winner  (winner: boolean | null)
teams.away.id / name / winner
goals.home / goals.away  integer | null
score.halftime / fulltime / extratime / penalty  { home, away }  nullable
```

- Mapping status → FixtureStatus EVCore :

| API-FOOTBALL               | EVCore    |
| -------------------------- | --------- |
| NS, TBD                    | SCHEDULED |
| 1H, HT, 2H, ET, BT, P, INT | IN_PLAY   |
| FT, AET, PEN               | FINISHED  |
| SUSP                       | SUSPENDED |
| PST                        | POSTPONED |
| CANC, ABD                  | CANCELLED |
| AWD                        | AWARDED   |

- Extraction matchday : `"Regular Season - 24"` → regex `/Regular Season - (\d+)/` → `24`

### CSV football-data.co.uk

- URLs :
  - `https://www.football-data.co.uk/mmz4281/2122/E0.csv`
  - `https://www.football-data.co.uk/mmz4281/2223/E0.csv`
  - `https://www.football-data.co.uk/mmz4281/2324/E0.csv`
  - `https://www.football-data.co.uk/mmz4281/2425/E0.csv`
- Colonnes odds utilisées : `B365H/D/A` (Bet365 ouverture), `B365CH/CD/CA` (closing),
  `PSCH/PSCD/PSCA` (Pinnacle closing — gold standard EV), `AvgCH/AvgCD/AvgCA` (moyenne marché)
- Format CSV, encodage UTF-8, ~40 KB/saison

---

## 4) Plan d'implémentation

### Phase 1 — Constantes + env (0.5 jour)

- [ ] Mettre à jour `etl.constants.ts` :
  - Supprimer : `FOOTBALL_DATA_API_BASE`, `FOOTBALL_DATA_RATE_LIMIT_MS`, `UNDERSTAT_BASE`,
    `UNDERSTAT_RATE_LIMIT_MS`, `FBREF_BASE`, `FBREF_RATE_LIMIT_MS`
  - Renommer : `ODDS_API_BASE` → `API_FOOTBALL_BASE`, `ODDS_RATE_LIMIT_MS` → `API_FOOTBALL_RATE_LIMIT_MS`
  - Ajouter : `EPL_LEAGUE_ID: 39`
  - Mettre à jour : `EPL_SEASONS: [2022, 2023, 2024]`
  - Mettre à jour : queues BullMQ (supprimer `xg-sync`, `stats-sync`, `odds-historical-sync` ;
    ajouter `odds-csv-import`)
- [ ] Mettre à jour `.env.example` (renommages + suppressions)
- [ ] Startup guard : `ConfigService.getOrThrow('API_FOOTBALL_KEY')`

### Phase 2 — Migrer fixtures-sync (1 jour)

- [ ] Nouveau schéma Zod `ApiFootballFixtureSchema` + `ApiFootballFixturesResponseSchema`
      (avec tous les champs confirmés en §3)
- [ ] Parser matchday depuis `league.round`
- [ ] Mapper status codes (table §3)
- [ ] Adapter appel HTTP : header `x-apisports-key`, URL `/fixtures?league=39&season=X`
- [ ] Tests unitaires : mapping status (cas FT, AET, PEN, PST, CANC), extraction matchday,
      champs nullable (venue, winner, extratime)
- [ ] Test idempotence sur 3 saisons

### Phase 3 — Migrer results-sync (0.5 jour)

- [ ] Réutiliser `ApiFootballFixtureSchema` de Phase 2
- [ ] URL : `/fixtures?league=39&season=X&status=FT-AET-PEN`
- [ ] Mapping scores : `goals.home/away` (entier) → `updateScores`
- [ ] Gérer `AET` et `PEN` comme statuts "terminé" en plus de `FT`
- [ ] Tests unitaires : scores null (match non terminé), cas AET/PEN

### Phase 4 — Nouveau worker odds-csv-import (1 jour)

- [ ] Worker BullMQ `odds-csv-import` (one-shot, pas de schedule récurrent)
- [ ] Fetch CSV via `fetch` (pas de lib externe nécessaire), stream → parse ligne par ligne
- [ ] Schéma Zod `OddsRowSchema` : colonnes `Date`, `HomeTeam`, `AwayTeam`, `FTHG`, `FTAG`,
      `FTR`, `B365H/D/A`, `B365CH/CD/CA`, `PSCH/D/A` (optional), `AvgCH/D/A` (optional)
- [ ] Matching fixture par (homeTeam, awayTeam, date) → `externalId` → upsert odds snapshot
- [ ] Gestion des colonnes absentes (Pinnacle parfois vide) : `z.coerce.number().optional()`
- [ ] Tests unitaires : row valide, row sans Pinnacle, row avec score manquant

### Phase 5 — Supprimer scraping (0.5 jour)

- [ ] Supprimer `xg-sync.worker.ts`, `stats-sync.worker.ts`, `odds-historical-sync.worker.ts`
- [ ] Retirer de `etl.module.ts`
- [ ] Supprimer dépendance `cheerio` du `package.json`
- [ ] Nettoyer imports et types orphelins

### Phase 6 — Ajustement modèle Option A (1-2 jours)

- [ ] Désactiver features xG et FBref stats dans le scoring déterministe
- [ ] Recalibrer les poids (forme + home/away + odds-implied probability)
- [ ] Backtest 4 saisons (2122–2425) :
  - Brier Score
  - Calibration Error (ECE)
  - ROI simulé à seuil EV ≥ 0.08
- [ ] Comparer baseline avant/après migration

### Phase 7 — Observabilité (0.5 jour)

- [ ] Logs quota API-FOOTBALL unifiés (headers `x-ratelimit-requests-remaining`)
- [ ] Alerte `API_FOOTBALL_QUOTA_ALERT_PCT` (défaut 80%)
- [ ] Mettre à jour ROADMAP.md, TODO.md, runbooks

---

## 5) Critères d'acceptation

- [ ] `API_FOOTBALL_KEY` est la seule clé externe active dans tous les workers.
- [ ] `FOOTBALL_DATA_API_KEY` supprimée du codebase.
- [ ] Aucun scraping (Understat, FBref) dans les jobs planifiés.
- [ ] ETL 3 saisons fixtures/results stable sans erreur bloquante.
- [ ] 4 saisons odds CSV importées et matchées avec les fixtures en DB.
- [ ] Backtest exécutable avec Brier Score et ROI documentés.
- [ ] `cheerio` absent du `package.json`.

---

## 6) Risques & mitigations

| Risque                                                      | Mitigation                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Matching CSV→fixture échoue (noms d'équipes différents)     | Table de normalisation des noms au parsing CSV                                       |
| Pinnacle closing odds absentes sur certains matchs          | Colonnes optional dans Zod, fallback sur B365CH ou AvgCH                             |
| Mapping status incomplet (statut API-FOOTBALL inconnu)      | Zod `.enum()` strict + log warning + statut `UNKNOWN` en fallback                    |
| Saison 2021/22 absente de l'API-FOOTBALL (free plan bloqué) | Saisons cible passées à [2022, 2023, 2024] ; 2021/22 couverte par CSV odds seulement |

---

## 7) Rollback plan

- Anciens workers conservés derrière feature flag jusqu'à validation du backtest.
- Si KPI backtest dégradés : réactiver pipeline précédent et investiguer feature engineering.

---

## 8) Décisions closes ✅

| Décision                | Choix                                               |
| ----------------------- | --------------------------------------------------- |
| Option modèle           | **A** — désactiver xG, MVP rapide                   |
| Renommage env           | **Oui** — `ODDS_API_*` → `API_FOOTBALL_*`           |
| Source odds historiques | **CSV football-data.co.uk** — one-shot, 4 saisons   |
| Saisons API-FOOTBALL    | **[2022, 2023, 2024]**                              |
| Saisons CSV odds        | **2122, 2223, 2324, 2425**                          |
| Pagination fixtures     | **Non nécessaire** (380 résultats, 1 page confirmé) |
