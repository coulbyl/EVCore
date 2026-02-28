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

