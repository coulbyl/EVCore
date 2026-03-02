# EVCore — TODO Phase 2 : Live odds, bankroll, observabilité

> Plan de travail courant après validation MVP.
> Références: [ROADMAP.md](ROADMAP.md), [EVCORE.md](EVCORE.md)
> Archives: [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)

---

## Objectif Phase 2

Transformer le MVP validé en moteur live exploitable en production :

- odds live pré-match fiables,
- multi-ligue propre et activable par configuration,
- bankroll management (Kelly fractionnelle),
- observabilité produit (dashboard + alerting).

---

## Bloc 1 — Odds live + ETL multi-ligue ✅

### Résultats

- [x] Worker `odds-live-sync` (API-Football `/odds?fixture=...`)
- [x] Priorité bookmaker: Pinnacle (`id=4`) puis Bet365 (`id=8`)
- [x] Snapshot live enregistré dans `OddsSnapshot`
- [x] ETL full multi-ligue: jobs/schedulers nommés par `competitionCode`
- [x] `odds-csv-import` multi-compétitions (`divisionCode` par ligue)
- [x] Route breaking change: `POST /rolling-stats/backfill/:competition/:season`
- [x] Helpers date renommés génériques (`seasonFallbackStartDate/EndDate`)
- [x] Règle qualité `max-params <= 3` activée (exceptions DI Nest documentées)
- [x] Lint + typecheck + tests backend passants (184 tests)

---

## Bloc 2 — Kelly fractionnelle (0.25)

- [ ] Ajouter config `KELLY_ENABLED` + `KELLY_FRACTION=0.25`
- [ ] Implémenter sizing Kelly fractionnelle dans le moteur de décision
- [ ] Ajouter garde-fous bankroll (cap mise max, min EV conservé)
- [ ] Tests unitaires Kelly: edge cases (probabilités extrêmes, cotes faibles, stake cap)

## Bloc 3 — Observabilité & pilotage risque

- [ ] Dashboard Grafana (ROI, Brier, calibration, drawdown, volume bets)
- [ ] Exposer métriques nécessaires (ou agrégats API) pour dashboard
- [ ] Alerting hebdo/quotidien avec seuils explicites et runbook court

---

## Suivi d'exécution (Phase 2)

- [x] Bloc 1 terminé
- [ ] Bloc 2 lancé
- [ ] Bloc 3 lancé
- [x] Docs `ROADMAP.md` synchronisées
