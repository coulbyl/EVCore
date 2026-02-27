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

## Semaine 5 — Intégration odds historiques

### Résultats attendus

- [ ] Worker `odds_historical_sync` (3 saisons EPL)
- [ ] Insertion `OddsSnapshot` idempotente et rejouable
- [ ] Validation Zod stricte des payloads odds
- [ ] Tests unitaires des schémas odds + mapping DB
- [ ] Mettre à jour le .env.example (bien documenté)

### Implémentation

- [ ] Créer `apps/backend/src/modules/etl/workers/odds-historical-sync.worker.ts`
- [ ] Ajouter `odds.schema.ts` + `odds.schema.spec.ts`
- [ ] Ajouter la queue BullMQ et trigger dans `etl.service.ts`
- [ ] Upsert par clé métier (`fixtureId`, `bookmaker`, `market`, `snapshotAt`)
- [ ] Logger Pino avec compteurs (`fetched`, `validated`, `inserted`, `skipped`, `failed`)

### Critères de validation

- [ ] Worker relançable sans doublons
- [ ] 1 run complet par saison sans crash même avec payload partiel
- [ ] Tests unitaires passants

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

- [ ] `mvp-month-2` lancé
- [ ] Semaine 5 terminée
- [ ] Semaine 6 terminée
- [ ] Semaine 7 terminée
- [ ] Semaine 8 terminée
- [ ] Docs `ROADMAP.md` synchronisées
