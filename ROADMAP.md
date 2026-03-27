# EVCore — Roadmap d'implémentation

> Source de vérité pour le suivi d'avancement. Mettre à jour à chaque merge significatif.
> Spécification complète : [EVCORE.md](EVCORE.md) | Conventions : [CLAUDE.md](CLAUDE.md)

**Statut actuel : Phase 2 — Bloc 6 en cours (mise à jour le 3 mars 2026)**

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
- [x] Docker Compose (PostgreSQL + Redis + Mailpit)
- [x] Schéma Prisma initial (Competition, Season, Team, Fixture, ModelRun, Bet, AdjustmentProposal)
- [x] Configuration CI/CD (GitHub Actions — lint + type-check + test)
- [x] Setup Nodemailer + Mailpit (Email)

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
- [x] Endpoints manuels ETL (`POST /etl/sync/full`, `POST /etl/sync/:type`, `POST /etl/sync/:type/:competitionCode`)
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
- [x] Alerte notification si Brier Score > seuil acceptable
- [x] Alerte notification sur suspension marché
- [x] Rapport hebdomadaire ROI/Brier Score par endpoint (`POST /risk/report/weekly`)

---

### Mois 3 — Automatisation, apprentissage, stabilisation

**Semaine 9 — Automatisation quotidienne**

- [x] BullMQ repeatable jobs (`upsertJobScheduler`) — crons quotidiens/hebdo pour les 4 workers ETL
- [x] `ETL_CRON_SCHEDULES` + `ETL_SCHEDULER_KEYS` dans `etl.constants.ts` (configurables)
- [x] `EtlService.onApplicationBootstrap()` — registration idempotente au démarrage
- [x] `ETL_SCHEDULING_ENABLED` — flag pour désactiver le scheduling en dev/test
- [x] `@OnWorkerEvent('failed')` sur les 4 workers — alerte notification uniquement sur échec définitif (après 3 tentatives)
- [x] `sendEtlFailureAlert()` dans `NotificationService`
- [x] Gestion `POSTPONED` fixtures — déjà couverte par le statut pipeline existant
- [-] Setup Kestra — abandonné au profit de BullMQ natif (infra simplifiée pour MVP)

**Semaine 10 — Boucle d'apprentissage**

- [x] `BettingEngineService.settleOpenBets()` — résolution WON/LOST/VOID post-match
- [x] `BettingEngineService.getEffectiveWeights()` — charge le dernier `AdjustmentProposal` APPLIED
- [x] `CalibrationService.compute()` — Brier score + meanError déterministe
- [x] `AdjustmentService.settleAndCheck()` — settle → calibrate → auto-apply si déclenché
- [x] Auto-apply : brierScore > 0.25 ET betCount ≥ 50 ET cooldown 7 jours
- [x] `AdjustmentService.rollback()` — nouveau proposal APPLIED avec poids inversés (audit complet)
- [x] `AdjustmentController` : 3 endpoints (settle-and-check, list, rollback)
- [x] `sendWeightAdjustmentAlert()` — alerte notification sur auto-apply + rollback

**Semaine 11 — Stabilisation**

- [x] Tests E2E Testcontainers (`vitest.config.e2e.ts`, `global-e2e.ts`, `prisma-test.ts`)
- [x] `test/adjustment.e2e-spec.ts` — 3 tests intégration (settle, weights, auto-apply)
- [x] Revue Zod schemas : `paging.total` fix, `response.length(2)` stats, 22 tests créés
- [x] Revue logs Pino : dead code retiré, log CSV épuré, niveau debug pour "SMTP disabled"
- [x] Docker Compose : `start_period` postgres (10s) + redis (5s)

**Semaine 12 — Validation MVP** ✅ Go Phase 2 (2 mars 2026)

- [x] Cold-start guard `MIN_PRIOR_TEAM_STATS = 5` — fixtures ignorées si ≤ 5 stats par équipe
- [x] xG proxy fallback `shots_on_goal × 0.35` — 2022-23 première moitié (API sans expected_goals)
- [x] `extractXg()` : priorité native → proxy si champ absent, 0 si null
- [x] `BRIER_SCORE_PASS_THRESHOLD` recalibré à 0.65 (battre le classifieur aléatoire 0.667)
- [x] Brier Score de référence mesuré : **0.592** (3 saisons agrégées, 2 mars 2026)
- [x] Calibration Error de référence : **2.5%** (PASS ≤ 5%)
- [x] ROI simulé de référence : **+2.28%** (PASS ≥ -5%)
- [x] Go/No-Go : **GO Phase 2** — modèle bat le hasard sur 3 saisons EPL
- [x] Mise à jour ROADMAP.md avec résultats de validation

---

## Phase 2 (après validation MVP)

- [x] Sources live : API-Football (worker `odds-live-sync`, Pinnacle → Bet365 fallback)
- [x] Snapshot odds horodaté pré-match (`OddsSnapshot` live par fixture)
- [x] ETL multi-ligue (config `COMPETITIONS`, `isActive`, jobs avec `competitionCode`)
- [x] Odds CSV multi-compétitions (`divisionCode` par ligue, import PL/SA/LL/BL1 configurable)
- [x] API rolling-stats multi-ligue (`POST /rolling-stats/backfill/:competition/:season`)
- [x] `getActiveCsvSeasonCodes()` — fenêtre glissante 3 saisons (remplace `CSV_ODDS_SEASONS` hardcodé)
- [x] ETL controller : endpoints paramétrés `/sync/:type`, `/sync/:type/:competitionCode` + Swagger complet
- [x] `odds-live-sync` : lockDuration 600s + schema odds assoupli (Exact Score > 1000, Asian Handicap = 1.00)
- [x] `odds-csv-import` : rows sans cotes (saison en cours) skippées en `debug` silencieux
- [x] `odds-csv-import` incrémental : snapshots closing déjà présents skippés sans upsert
- [x] Pipeline live validé en prod : `synced: 4, skipped: 0` sur 4 fixtures EPL (2 mars 2026)
- [x] Kelly fractionnelle (0.25) — config flag `KELLY_ENABLED`
- [~] Multi-ligues (Serie A, La Liga, Bundesliga configurées, activation progressive)

### Bloc 3 — Daily Coupon Generator ✅ (2 mars 2026)

**Feature flags + shadow scoring**

- [x] `feature-flags.constants.ts` — `FEATURE_FLAGS.SCORING` (LINE_MOVEMENT=true, INJURIES/H2H/CONGESTION/LINEUPS=false shadow)
- [x] Shadow scoring dans `analyzeFixture()` — facteurs calculés mais non pris en compte, shadow\_\* loggés dans `ModelRun.features`
- [x] Filtre line movement — delta cote > 10% sur 7 jours → fixture exclue (depuis `OddsSnapshot` DB)

**Coupon quotidien** — spec : [COUPON.md](COUPON.md)

- [x] `DailyCoupon` — modèle Prisma (id, date unique, status, legCount, Bets[] FK)
- [x] `coupon.constants.ts` — `COUPON_MAX_LEGS=6`, `COUPON_CRON_SCHEDULE` (20h00 UTC), `COUPON_SCHEDULER_KEY`
- [x] Calcul probabilité jointe combo-match depuis table Poisson bivariée (`betting-engine.utils.ts`)
- [x] `COMBO_WHITELIST` — 12 combinaisons valides (1X2 × BTTS/OVER, DC × BTTS, OVER × BTTS)
- [x] `CouponService.generateDailyCoupon(date)` — sélection `qualityScore = EV × deterministicScore`, garde d'idempotence
- [x] Anti-corrélation — max 1 bet par fixture (meilleur qualityScore conservé)
- [x] `CouponWorker` — `@Processor('betting-engine')`, lockDuration 5 min
- [x] `BULLMQ_QUEUES.BETTING_ENGINE` + scheduler `onApplicationBootstrap()` (flag `COUPON_SCHEDULING_ENABLED`)
- [x] `NotificationService.sendDailyCoupon()` — email (coupon ≥ 1 leg)
- [x] `NotificationService.sendNoBetToday()` — email (0 opportunité EV+)
- [x] `upsertOddsSnapshot()` multi-marché (1X2 + Over/Under 2.5 + BTTS) dans `fixture.repository.ts`
- [x] `extractAdditionalMarketOdds()` dans `odds-live-sync.worker.ts`
- [x] Tests unitaires `CouponService` (6 cas : NO_BET, PENDING, max legs, tri qualityScore, idempotence)
- [x] Tests unitaires `computeJointProbability`, `COMBO_WHITELIST`, `resolveComboPickBetStatus`
- [x] 204 tests passants, lint ✓, typecheck ✓

---

### Bloc 4 — Shadow Data Collection + AdjustmentService étendu

**Shadow services (données réelles, score non activé)**

- [x] ETL worker `injuries-sync` — API-Football `/injuries` par fixture SCHEDULED proche (today+tomorrow UTC), stocké en `ModelRun.features.shadow_injuries`
- [x] `H2HService` — 5 dernières confrontations depuis fixtures DB, `shadow_h2h` dans ModelRun (DISABLED par défaut)
- [x] `CongestionService` — jours depuis dernier match + fixtures dans les 4 prochains jours, `shadow_congestion` (DISABLED)

**Boucle d'auto-activation**

- [x] `AdjustmentService` étendu — corrélation Spearman shadow\_\* vs outcomes sur 50+ bets
- [x] Auto-activation si |rho| > 0.15 : poids shadow feature activé, `AdjustmentProposal` généré et appliqué
- [ ] Rollback d'une auto-activation via `POST /adjustment/:id/rollback` (existant)

---

### Bloc 5 — Coupon settlement + résultats live

- [x] `CouponService.settleExpiredCoupons()` — settle les coupons PENDING dont tous les bets sont WON/LOST/VOID
- [x] `DailyCoupon.status` → SETTLED (tous paris résolus), LOST (≥ 1 LOST), WON (tous WON)
- [x] Worker ou endpoint déclenché post `settleOpenBets()` pour cascader le statut coupon
- [x] Remplacement de `results-sync` par `pending-bets-settlement-sync` ciblé sur les fixtures avec bets PENDING
- [x] `NotificationService.sendCouponResult()` — email récap résultat coupon (WON/LOST)

---

### Bloc 6 — Suite Phase 2

- [x] Marché Mi-temps/Fin de match (HT/FT combo)
  - [x] Fondations HT/FT backend: enum marché, stockage score mi-temps, settlement dédié (`resolveHalfTimeFullTimeBetStatus`)
  - [x] Probas HT/FT (9 issues) dérivées du modèle Poisson
  - [x] Ingestion odds live HT/FT + stockage `OddsSnapshot` (`HALF_TIME_FULL_TIME`)
  - [x] Sélection EV/qualityScore étendue au marché HT/FT dans `BettingEngineService`
- [x] Stabilité first prod sans TimescaleDB
  - [x] Cleanup automatique `OddsSnapshot` via worker ETL `odds-snapshot-retention` (rétention configurable)
  - [x] Indexation `OddsSnapshot` renforcée (requêtes moteur + purge par date)
  - [x] Coupon multi-jours (fenêtre 1-3 jours) pour combiner 2-3 journées
  - [x] Tuning rate-limit/quota API-Football (estimation appels/jour + warning seuil quota)
- [ ] OpenClaw integration — `STAND-BY POST-PROD` (voir `OPENCLAW.md`)
  - Activation après 30+ jours prod stables, d'abord en shadow mode
  - Contraintes: delta ≤ 30%, validation Zod stricte, temperature 0, fallback déterministe
- [ ] Grafana dashboards — `STAND-BY POST-PROD` (voir `GRAFANA.md`)
  - Activation quand le monitoring manuel (logs/SQL) n'est plus suffisant
- [ ] TimescaleDB (odds snapshots haute fréquence, remplacement `OddsSnapshot` Postgres standard)
- [ ] Multi-bookmakers (Betclic, Unibet via odds-api ou scraping)

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
