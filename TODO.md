# EVCore — TODO Mois 3 : Automatisation, apprentissage, stabilisation

> Plan de travail détaillé pour le milestone `mvp-month-3`.
> Références: [ROADMAP.md](ROADMAP.md), [EVCORE.md](EVCORE.md)
> Archive Mois 2: voir section Mois 2 ci-dessous (gardée pour référence)

---

## Objectif du mois 3

Rendre le moteur autonome et apprenant :

- automatiser les jobs ETL (crons quotidiens/hebdo sans intervention manuelle),
- implémenter la boucle d'apprentissage (calibration post-match → AdjustmentProposal),
- stabiliser l'infrastructure (tests E2E, logs, Docker hardening),
- valider le MVP avec métriques de référence.

---

## Semaine 9 — Automatisation quotidienne ✅

### Résultats

- [x] `ETL_CRON_SCHEDULES` + `ETL_SCHEDULER_KEYS` dans `etl.constants.ts`
- [x] `EtlService.onApplicationBootstrap()` — `upsertJobScheduler` sur les 4 queues (idempotent)
- [x] Crons : fixtures/results/stats à 02h/03h/04h UTC quotidien, odds-csv le lundi 05h UTC
- [x] `ETL_SCHEDULING_ENABLED` — désactivable via env (dev/test)
- [x] `@OnWorkerEvent('failed')` sur les 4 workers — alerte Novu sur échec définitif uniquement
- [x] `sendEtlFailureAlert()` dans `NotificationService` (workflow `evcore-etl-failure`)
- [x] Kestra abandonné — BullMQ repeatable jobs suffisants pour MVP
- [x] Retry 3× + backoff exponentiel 5s déjà configuré (`BULLMQ_DEFAULT_JOB_OPTIONS`)
- [x] POSTPONED fixtures — déjà géré partout (aucune modification nécessaire)

---

## Semaine 10 — Boucle d'apprentissage

- [ ] Log probabilité estimée vs résultat réel post-match (via `ModelRun`)
- [ ] Calcul erreur calibration par match
- [ ] Génération `AdjustmentProposal` automatique (si ≥ 50 bets sur le marché)
- [ ] Endpoint `POST /adjustment/:id/apply` + `POST /adjustment/:id/reject` + `POST /adjustment/:id/freeze`
- [ ] Contraintes : max 5% de variation par semaine, jamais auto-appliqué

---

## Semaine 11 — Stabilisation

- [ ] Tests d'intégration end-to-end (ETL → scoring → decision → log)
- [ ] Revue complète des Zod schemas (edge cases manquants)
- [ ] Revue des logs Pino (structure, niveaux, champs manquants)
- [ ] Hardening Docker Compose (restart policies, volumes nommés, health checks)

---

## Semaine 12 — Validation MVP

- [ ] Brier Score de référence mesuré et documenté (run backtest complet 3 saisons)
- [ ] ROI simulé de référence mesuré et documenté
- [ ] Calibration Error de référence documentée
- [ ] Go/No-Go : validation manuelle avant passage Phase 2
- [ ] Mise à jour ROADMAP.md avec résultats de validation

---

## Suivi d'exécution (Mois 3)

- [x] `mvp-month-3` lancé
- [x] Semaine 9 terminée
- [ ] Semaine 10 terminée
- [ ] Semaine 11 terminée
- [ ] Semaine 12 terminée
- [ ] Docs `ROADMAP.md` synchronisées

---

## Archive Mois 2

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

## Semaine 6 — Calcul EV ✅

### Résultats

- [x] `calculateEV(prob, odds)` — source unique dans `betting-engine.utils.ts`, exportée et réutilisée par le service et le backtest
- [x] Seuil `EV_THRESHOLD = 0.08` appliqué dans `analyzeFixture()` (double gate : score ≥ 60% ET EV ≥ 8%)
- [x] `findLatestOneXTwoOddsSnapshot()` — priorité Pinnacle → Bet365 → MarketAvg, filtre pré-match strict
- [x] `Bet` persisté avec `probEstimated`, `oddsSnapshot`, `ev`, `stakePct` (1%)
- [x] `selectBestOneXTwoValueBet()` — type de retour corrigé (suppression `| null` mensonger)
- [x] Tests : EV exact au seuil, EV < seuil (NO_BET + pas de Bet créé), 88 tests passants

---

## Semaine 7 — Simulation value bets ✅

### Résultats

- [x] Simulation placement des bets historiques (filtre EV ≥ 8% identique au moteur live)
- [x] ROI simulé par marché (`ONE_X_TWO`)
- [x] Drawdown max (courbe equity + peak)
- [x] EV moyen simulé
- [x] `loadLatestOneXTwoOddsForFixtures()` — batch query, aucun N+1
- [x] `findLatestStatsBeforeFixture()` — recherche binaire + tie-break par ID (prévention look-ahead)
- [x] `simulateOneXTwoBet()` — utilise `calculateEV()` depuis `betting-engine.utils` (source unique)
- [x] `MarketAccumulator` — agrégations `wins`, `losses`, `voids`, `stake`, `profit`, `maxDrawdown`
- [x] Cas "pas d'odds" et "odds invalides" (`odds ≤ 1`, `isFinite()`) couverts
- [x] Rapport déterministe sur re-run (même inputs → mêmes outputs)
- [x] Tests : bet placé et gagné (ROI=1.1), EV sous seuil → 0 bets (ROI=0)

---

## Semaine 8 — Tracking & contraintes ✅

### Résultats

- [x] Alerte ROI `< -10%` sur 30 derniers paris (`RiskService.checkMarketRoi`)
- [x] Suspension auto ROI `< -15%` sur 50+ paris (`MarketSuspension` créé en DB + alerte Novu)
- [x] Alerte Novu si `brierScore > 0.30` (post-backtest automatique)
- [x] Alerte Novu suspension marché (payload normalisé : market, roi, betCount, suspendedAt)
- [x] Rapport hebdo via `POST /risk/report/weekly` (ROI + bets placés sur 7 jours)

### Implémentation

- [x] `modules/notification/notification.service.ts` — wrapper Novu HTTP typé (ConfigService, NOVU_ALERTS_ENABLED)
- [x] `modules/risk/risk.constants.ts` — seuils configurables (ROI_ALERT_THRESHOLD, ROI_SUSPENSION_THRESHOLD, BRIER_SCORE_ALERT_THRESHOLD)
- [x] `modules/risk/risk.service.ts` — `checkMarketRoi()`, `isMarketSuspended()`, `checkBrierScore()`, `generateWeeklyReport()`
- [x] `modules/risk/risk.controller.ts` — `POST /risk/check/:market`, `GET /risk/suspension/:market`, `POST /risk/report/weekly`
- [x] `MarketSuspension` model Prisma + migration SQL + génération client
- [x] `analyzeFixture()` gated par `marketSuspension.findFirst` (triple gate : score + EV + non-suspendu)
- [x] `BacktestService` : alerte Novu Brier Score post-backtest
- [x] `.env.example` mis à jour (NOVU_SUBSCRIBER_ID, NOVU_ALERTS_ENABLED, workflow IDs documentés)

### Critères de validation

- [x] Règles testées par scénarios (10 tests `risk.service.spec.ts`)
- [x] Alertes désactivables via `NOVU_ALERTS_ENABLED=false`
- [x] 98 tests passants au total

---

## Suivi d'exécution (Mois 2)

- [x] `mvp-month-2` lancé
- [x] Semaine 5 terminée
- [x] Semaine 6 terminée
- [x] Semaine 7 terminée
- [x] Semaine 8 terminée
- [x] Docs `ROADMAP.md` synchronisées
