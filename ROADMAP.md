# EVCore — Roadmap d'implémentation

> Source de vérité pour le suivi d'avancement. Mettre à jour à chaque merge significatif.
> Spécification complète : [EVCORE.md](EVCORE.md) | Conventions : [CLAUDE.md](CLAUDE.md)

**Statut actuel : Mois 2 terminé — Semaines 1→8 terminées, Mois 3 à venir (mise à jour le 28 février 2026)**

---

## Légende

- `[ ]` À faire
- `[x]` Terminé
- `[~]` En cours
- `[-]` Annulé / reporté

---

## MVP — Phase 1 (3 mois)

### Fondations (avant Mois 1)

- [~] Cahier des charges (EVCORE.md)
- [~] Conventions IA (CLAUDE.md, copilot-instructions.md)
- [~] Roadmap (ROADMAP.md)
- [x] Guide d'écriture backend (`apps/backend/CODE_GUIDE.md`)
- [x] Initialisation monorepo `apps/backend` (NestJS)
- [x] Docker Compose (PostgreSQL + Redis + Novu)
- [x] Schéma Prisma initial (Competition, Season, Team, Fixture, ModelRun, Bet, AdjustmentProposal)
- [x] Configuration CI/CD (GitHub Actions — lint + type-check + test)
- [x] Setup Novu (Slack + Email)

---

### Mois 1 — Import, modèle probabiliste, backtest

**Semaine 1 — ETL historique**

- [x] Worker `fixtures_sync` — API-FOOTBALL (3 saisons EPL : 2022, 2023, 2024)
- [x] Worker `results_sync` — API-FOOTBALL (statuts FT/AET/PEN/AWD)
- [x] Worker `stats_sync` — API-FOOTBALL `/fixtures/statistics` (proxy xG : shots_on_target × 0.35)
- [x] Worker `odds_csv_import` — football-data.co.uk CSV (Pinnacle + Bet365 closing odds, 4 saisons)
- [x] Validation Zod sur chaque ingestion
- [x] Tests unitaires des schémas Zod
- [x] Tests unitaires métier ETL (`mapStatus`, dispatch BullMQ + delays)
- [x] Migration API — abandon football-data.org + Understat + FBref → API-FOOTBALL single key

**Semaine 2 — Stats rolling**

- [x] Calcul forme récente (5 matchs, decay 0.8)
- [x] Calcul xG rolling (10 matchs)
- [x] Calcul performance domicile/extérieur (saison)
- [x] Calcul volatilité ligue (écart-type Poisson)
- [x] Stockage des stats dans la DB (`TeamStats` via upsert)
- [x] Trigger manuel backend pour backfill (`POST /rolling-stats/backfill/:season`, `POST /rolling-stats/backfill-all`)
- [x] Helpers rolling-stats extraits dans un util dédié (`rolling-stats.utils.ts`)
- [x] Source de vérité dates (`date.utils.ts`) + standardisation des conversions Date

**Semaine 3 — Modèle probabiliste**

- [x] Modèle de Poisson pour prédire buts domicile/extérieur
- [x] Génération probabilités 1X2
- [x] Dérivation Over/Under 2.5, BTTS, Double Chance depuis les probabilités 1X2
- [x] Score déterministe pondéré (Forme 30% / xG 30% / Dom-Ext 25% / Volatilité 15%)
- [x] Tests unitaires avec inputs/outputs connus
- [x] Intégration applicative: analyse fixture/saison + persistance `ModelRun`

**Semaine 4 — Backtest & calibration**

- [x] Pipeline backtest sur 3 saisons historiques (exécution par saison)
- [x] Calcul Brier Score par saison
- [x] Calcul Calibration Error par marché
- [x] Rapport de performance (JSON + log Pino)

---

### Mois 2 — Odds, EV, simulation

**Semaine 5 — Intégration odds historiques**

- [x] Worker `odds_csv_import` — football-data.co.uk (Pinnacle + Bet365 closing odds, 4 saisons)
- [x] Stockage `OddsSnapshot` avec timestamp dans la DB (marché ONE_X_TWO)
- [x] Validation Zod CSV row (Date DD/MM/YYYY, odds positifs, FTR enum)
- [x] Endpoints manuels ETL (`POST /etl/sync/full`, `POST /etl/sync/stats`, `POST /etl/sync/odds-csv`)
- [x] Migration clé unique API-FOOTBALL (abandon The Odds API)

**Semaine 6 — Calcul EV**

- [x] Implémentation `calculateEV()` avec `decimal.js`
- [x] Application du seuil EV ≥ 8% (depuis config)
- [x] Génération `ModelRun` complet (features + score + decision)
- [x] Tests unitaires EV avec cas limites (EV exactement 8%, en dessous, au dessus)

**Semaine 7 — Simulation value bets**

- [x] Simulation de placement sur données historiques
- [x] Calcul ROI simulé par marché
- [x] Calcul drawdown max simulé
- [x] Calcul EV moyen simulé

**Semaine 8 — Tracking & contraintes**

- [x] Implémentation seuil alerte ROI < -10% (30 derniers paris)
- [x] Implémentation suspension automatique ROI < -15% (50+ paris)
- [x] Alerte Novu si Brier Score > seuil acceptable
- [x] Alerte Novu sur suspension marché
- [x] Rapport hebdomadaire ROI/Brier Score par endpoint (`POST /risk/report/weekly`)

---

### Mois 3 — Automatisation, apprentissage, stabilisation

**Semaine 9 — Automatisation quotidienne**

- [ ] Setup Kestra (Docker Compose)
- [ ] Orchestration des jobs ETL via Kestra (plannings, retries, monitoring)
- [ ] Gestion erreurs ETL : retry 3×, alerte si échec total
- [ ] Gestion `POSTPONED` fixtures

**Semaine 10 — Boucle d'apprentissage**

- [ ] Log probabilité estimée vs résultat réel post-match
- [ ] Calcul erreur calibration par match
- [ ] Génération `AdjustmentProposal` automatique
- [ ] Endpoint backend pour appliquer/refuser/geler une proposal
- [ ] Contraintes : min 50 bets, max 5%/semaine, jamais auto-appliqué

**Semaine 11 — Stabilisation**

- [ ] Tests d'intégration end-to-end (ETL → scoring → decision → log)
- [ ] Revue complète des Zod schemas
- [ ] Revue des logs Pino (structure, niveaux)
- [ ] Hardening Docker Compose (restart policies, volumes, secrets)

**Semaine 12 — Validation MVP**

- [ ] Brier Score de référence mesuré et documenté
- [ ] ROI simulé de référence mesuré et documenté
- [ ] Calibration Error de référence documentée
- [ ] Go/No-Go : validation manuelle avant passage Phase 2
- [ ] Mise à jour ROADMAP.md avec résultats de validation

---

## Phase 2 (après validation MVP)

- [ ] Sources live : API-Football + The Odds API
- [ ] Snapshot odds horodaté pré-match
- [ ] Kelly fractionnelle (0.25) — config flag
- [ ] Multi-ligues (Serie A, La Liga, Ligue 1)
- [ ] Marché Mi-temps/Fin de match
- [ ] OpenClaw integration (LLM delta 30%, Zod-validated, temperature 0)
- [ ] Grafana dashboards (ROI, Brier Score, drawdown)
- [ ] TimescaleDB (odds snapshots haute fréquence)
- [ ] Multi-bookmakers

---

## Phase 3 (après stabilisation Phase 2)

- [ ] Python worker (backtesting avancé, calibration scikit-learn)
- [ ] Modèle ML léger (XGBoost)
- [ ] Détection inefficience marché
- [ ] Simulation Monte Carlo
- [ ] Gestion dynamique drawdown

---

## Phase 4

- [ ] SaaS / multi-tenant
- [ ] API interne
- [ ] Groupe premium

---

## GitHub Milestones

| Milestone         | Contenu                                   | Due date     |
| ----------------- | ----------------------------------------- | ------------ |
| `mvp-foundations` | Setup monorepo, DB, Docker, CI            | 28 fév 2026  |
| `mvp-month-1`     | ETL, stats rolling, modèle, backtest      | 14 mars 2026 |
| `mvp-month-2`     | Odds, EV, simulation, tracking            | 31 mars 2026 |
| `mvp-month-3`     | Automatisation, apprentissage, validation | 8 avr 2026   |
| `phase-2`         | Live, OpenClaw, Grafana                   | 31 mai 2026  |
