# EVCore — TODO Mois 3 : Automatisation, apprentissage, stabilisation

> Plan de travail détaillé pour le milestone `mvp-month-3`.
> Références: [ROADMAP.md](ROADMAP.md), [EVCORE.md](EVCORE.md)
> Archive Mois 1: [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md)
> Archive Mois 2: [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)

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

## Semaine 10 — Boucle d'apprentissage ✅

### Résultats

- [x] `BettingEngineService.settleOpenBets(fixtureId)` — résout WON/LOST/VOID pour les bets PENDING d'un fixture
- [x] `BettingEngineService.getEffectiveWeights()` — charge le dernier `AdjustmentProposal` APPLIED depuis la DB
- [x] `calculateDeterministicScore()` — paramètre `weights` optionnel (fallback sur `FEATURE_WEIGHTS`)
- [x] `CalibrationService.compute()` — Brier score + meanError déterministe depuis les bets settlés
- [x] `AdjustmentService.settleAndCheck(fixtureId)` — settle → calibrate → auto-apply si déclenché
- [x] Auto-apply : brierScore > 0.25 ET betCount ≥ 50 ET aucun apply dans les 7 derniers jours
- [x] `computeAdjustedWeights()` — shift top-2 → bottom-2, normalisé sum=1, clampé [0.01, 0.99]
- [x] `AdjustmentService.rollback(id)` — crée un nouveau proposal APPLIED avec poids inversés (audit complet)
- [x] `AdjustmentController` : `POST /adjustment/settle-and-check/:fixtureId`, `GET /adjustment`, `POST /adjustment/:id/rollback`
- [x] `NotificationService.sendWeightAdjustmentAlert()` — alerte Novu sur chaque auto-apply + rollback
- [x] Design confirmé : auto-apply par le backend, humain peut rollback (pas de gate manuelle)
- [x] 108 tests unitaires passants (+ 13 nouveaux)

---

## Semaine 11 — Stabilisation ✅

### Résultats

- [x] Infrastructure E2E — `@testcontainers/postgresql`, `vitest.config.e2e.ts`, `test/setup/global-e2e.ts` (container PG éphémère + migrations), `test/setup/prisma-test.ts` (TRUNCATE CASCADE)
- [x] `test/adjustment.e2e-spec.ts` — 3 tests intégration : settle bets, getEffectiveWeights, auto-apply AdjustmentProposal
- [x] `test/app.e2e-spec.ts` — refactorisé (providers directs, sans AppModule, 3 tests HTTP passants sans DB)
- [x] `vitest.config.ts` — restreint à `src/**/*.spec.ts` (E2E exclus du run unitaire)
- [x] Revue Zod : `paging.total` `positive()` → `nonnegative()`, `response.length(2)` sur stats schema
- [x] Specs Zod créées : `stats.schema.spec.ts` (8 tests) + `odds-csv.schema.spec.ts` (14 tests)
- [x] Revue Pino : dead code `response.length<2` retiré, log CSV épuré, `info` → `debug` pour "Novu disabled"
- [x] Docker Compose : `start_period` ajouté sur postgres (10s) et redis (5s)
- [x] 131 tests unitaires passants (+ 23 vs Semaine 10)

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
- [x] Semaine 10 terminée
- [x] Semaine 11 terminée
- [ ] Semaine 12 terminée
- [ ] Docs `ROADMAP.md` synchronisées
