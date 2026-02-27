# EVCore — Archive Mois 1 (Résumé)

Période: février 2026  
Milestone: `mvp-month-1`

## Objectif

Poser les fondations data + modèle:

- ETL historique EPL,
- stats rolling,
- moteur probabiliste (Poisson),
- backtest (qualité + ROI simulé).

## Livrables terminés

- Semaine 1: ETL (`fixtures_sync`, `results_sync`, `xg_sync`, `stats_sync` extraction/validation), Zod + tests, orchestration BullMQ.
- Semaine 2: module `rolling-stats` (calculs + backfill + tests).
- Semaine 3: module `betting-engine` (Poisson, marchés dérivés, score déterministe, persistance `ModelRun`, tests).
- Semaine 4: module `backtest` (pipeline saison, Brier Score, Calibration Error, ROI simulé, rapport JSON + logs Pino, tests).

## Refactoring/standardisation transverses

- Suppression d'`axios` au profit de `fetch` natif.
- Utilitaires centralisés (`date.utils`, `season.utils`, `prisma.utils`, utilitaires module-scopés).
- Aliases TS backend (`@`, `@modules`, `@utils`, `@config`).
- Guide de code backend: `apps/backend/CODE_GUIDE.md`.

## Qualité et validation

- Typecheck backend: OK.
- Tests unitaires backend: OK (hors e2e dépendants infra Redis/port dans cet environnement).
- Mapping métier critique couvert (`AWARDED -> FINISHED`, dispatch BullMQ avec delays).

## Décision de planification

- L'alerte Novu basée Brier Score est déplacée en Mois 2 (Semaine 8) pour rester alignée avec le tracking/monitoring.

## Commits marquants

- `6d8f3b3` — ETL workers/services/tests.
- `29ada48` — rolling-stats + backfill.
- `776d1c2` — finalisation semaine 3.
- `1c20b72` — module backtest + ROI simulation.
- `6fd6d02`, `50af48a` — mise à jour docs et planification.

## État en sortie de Mois 1

Mois 1 terminé.  
Le plan actif est désormais `TODO.md` (Mois 2: odds, EV, simulation, tracking).
