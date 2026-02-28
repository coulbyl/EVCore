# EVCore — TODO Mois 2 : Odds, EV, simulation

> Plan de travail détaillé pour le milestone `mvp-month-2`.
> Références: [ROADMAP.md](ROADMAP.md), [EVCORE.md](EVCORE.md)
> Archive Mois 1: [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md)

---

## Objectif du mois 2

Passer d'un moteur probabiliste/backtest à un moteur de décision value-bet piloté par les cotes:

- importer et historiser les odds,
- calculer l'EV de chaque pick,
- simuler les performances (ROI, drawdown, EV moyen),
- mettre en place les alertes de contrôle.

---

## Semaine 5 — Intégration odds historiques ✅

> Migration complète réalisée le 28 février 2026 : abandon API-Sports + Understat + FBref → API-FOOTBALL single key + football-data.co.uk CSV.

### Résultats

- [x] Worker `odds_csv_import` — football-data.co.uk CSV (Pinnacle + Bet365 closing odds, 4 saisons : 2122→2425)
- [x] Worker `stats_sync` — API-FOOTBALL `/fixtures/statistics` (proxy xG : shots_on_target × 0.35, constante `XG_SHOTS_CONVERSION_FACTOR`)
- [x] Worker `fixtures_sync` + `results_sync` — API-FOOTBALL (auth `x-apisports-key`, statuts FT/AET/PEN/AWD)
- [x] Insertion `OddsSnapshot` idempotente et rejouable (Pinnacle → Bet365 → MarketAvg fallback)
- [x] Validation Zod stricte : `OddsCsvRowSchema`, `ApiFootballStatisticsResponseSchema`, `ApiFootballFixturesResponseSchema`
- [x] Tests unitaires complets (84 tests passants)
- [x] `.env.example` mis à jour (`API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_PLAN`)
- [x] Endpoints manuels ETL (`POST /etl/sync/full`, `POST /etl/sync/stats`, `POST /etl/sync/odds-csv`)
- [x] `findFinishedWithoutXg(seasonId)` — requête DB-side pour traitement incrémental des stats
- [x] Stagger rate-limit : 6s entre jobs saison (API-FOOTBALL), 2s entre fixtures (stats), 2s entre saisons (CSV)

---

## Semaine 6 — Calcul EV

### Résultats attendus

- [ ] Fonction `calculateEV(prob, odds)` avec `decimal.js`
- [ ] Seuil EV configurable (`EV_THRESHOLD`, cible 8%)
- [ ] `ModelRun` enrichi avec décision EV-aware
- [ ] Tests unitaires cas limites

### Implémentation

- [ ] Ajouter util EV (module betting-engine)
- [ ] Brancher EV dans la décision `BET` / `NO_BET`
- [ ] Persister `probEstimated`, `oddsSnapshot`, `ev`, `stakePct` sur `Bet`
- [ ] Garder logique déterministe testable sans infra externe

### Critères de validation

- [ ] Cas `EV = seuil`, `EV < seuil`, `EV > seuil` couverts
- [ ] Aucun calcul EV en `number` natif
- [ ] Typecheck et tests passants

---

## Semaine 7 — Simulation value bets

### Résultats attendus

- [ ] Simulation placement des bets historiques
- [ ] ROI simulé par marché
- [ ] Drawdown max
- [ ] EV moyen

### Implémentation

- [ ] Étendre le module `backtest` pour reporter par marché
- [ ] Ajouter agrégations (`wins`, `losses`, `voids`, `stake`, `profit`)
- [ ] Ajouter snapshot JSON de rapport comparatif par saison
- [ ] Couvrir les cas "pas d'odds" et "odds invalides"

### Critères de validation

- [ ] Rapport stable/reproductible sur re-run
- [ ] Résultats cohérents avec tests déterministes

---

## Semaine 8 — Tracking & contraintes

### Résultats attendus

- [ ] Alerte ROI `< -10%` sur 30 derniers paris
- [ ] Suspension auto ROI `< -15%` sur 50+ paris
- [ ] Alerte Novu si `brierScore > seuil`
- [ ] Alerte Novu suspension marché
- [ ] Rapport hebdo ROI/Brier par email

### Implémentation

- [ ] Service de règles de risque (seuils configurables)
- [ ] Job planifié hebdomadaire de synthèse
- [ ] Intégration Novu avec payload normalisé
- [ ] Journal d'audit des alertes envoyées

### Critères de validation

- [ ] Règles testées par scénarios de série temporelle
- [ ] Pas de spam d'alertes (cooldown/min interval)
- [ ] Alertes désactivables par env flag

---

## Suivi d'exécution (Mois 2)

- [x] `mvp-month-2` lancé
- [x] Semaine 5 terminée
- [ ] Semaine 6 terminée
- [ ] Semaine 7 terminée
- [ ] Semaine 8 terminée
- [x] Docs `ROADMAP.md` synchronisées
