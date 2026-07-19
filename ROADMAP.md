# EVCore — Roadmap d'implémentation

> Source de vérité pour le suivi d'avancement. Mettre à jour à chaque merge significatif.
> Spécification complète : [EVCORE.md](EVCORE.md) | Conventions : [CLAUDE.md](CLAUDE.md)

**Statut actuel : Phase 3 — Étape 2 en cours (mise à jour le 4 juin 2026)**

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

### Bloc 3 — Daily Picks Generator ✅ (2 mars 2026)

> Notion de "coupon" retirée (bloc combiné supprimé) — le moteur produit désormais
> des picks individuels par fixture (référence historique uniquement ci-dessous).

**Feature flags + shadow scoring**

- [x] `feature-flags.constants.ts` — `FEATURE_FLAGS.SCORING` (LINE_MOVEMENT=true, INJURIES/H2H/CONGESTION/LINEUPS=false shadow)
- [x] Shadow scoring dans `analyzeFixture()` — facteurs calculés mais non pris en compte, shadow\_\* loggés dans `ModelRun.features`
- [x] Filtre line movement — delta cote > 10% sur 7 jours → fixture exclue (depuis `OddsSnapshot` DB)

**Picks quotidiens**

- [x] ~~Calcul probabilité jointe combo-match depuis table Poisson bivariée (`betting-engine.utils.ts`)~~ — **retiré 2026-07-18**, remplacé par les marchés bookmaker pré-combinés `RESULT_TOTAL_GOALS`/`RESULT_BTTS`
- [x] ~~`COMBO_WHITELIST` — 12 combinaisons valides (1X2 × BTTS/OVER, DC × BTTS, OVER × BTTS)~~ — **retiré 2026-07-18**
- [x] Sélection `qualityScore = EV × deterministicScore`, garde d'idempotence par fixture
- [x] Anti-corrélation — max 1 bet par fixture (meilleur qualityScore conservé)
- [x] `BULLMQ_QUEUES.BETTING_ENGINE` + scheduler `onApplicationBootstrap()`
- [x] `NotificationService.sendDailyPicks()` — email (≥ 1 pick)
- [x] `NotificationService.sendNoBetToday()` — email (0 opportunité EV+)
- [x] `upsertOddsSnapshot()` multi-marché (1X2 + Over/Under 2.5 + BTTS) dans `fixture.repository.ts`
- [x] `extractAdditionalMarketOdds()` dans `odds-live-sync.worker.ts`
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
- [x] Rollback d'une auto-activation via `POST /adjustment/:id/rollback` (existant)

---

### Bloc 5 — Settlement des paris + résultats live

- [x] Settlement des bets PENDING dès que la fixture passe `FINISHED` (WON/LOST/VOID)
- [x] Remplacement de `results-sync` par `pending-bets-settlement-sync` ciblé sur les fixtures avec bets PENDING
- [x] `NotificationService.sendBetResult()` — email récap résultat pari individuel

---

### Bloc 6 — Suite Phase 2

- [x] Marché Mi-temps/Fin de match (HT/FT combo)
  - [x] Fondations HT/FT backend: enum marché, stockage score mi-temps, settlement dédié (`resolveHalfTimeFullTimeBetStatus`)
  - [x] Probas HT/FT (9 issues) dérivées du modèle Poisson
  - [x] Ingestion odds live HT/FT + stockage `OddsSnapshot` (`HALF_TIME_FULL_TIME`)
  - [x] Sélection EV/qualityScore étendue au marché HT/FT dans `BettingEngineService`
- [x] Déploiement production (VPS OVH)
  - [x] Docker Compose (backend + web + postgres + redis) sur `/opt/evcore`
  - [x] Nginx reverse proxy + HTTPS Let's Encrypt (`c-evcore.com`, `api.c-evcore.com`)
  - [x] CI/CD GitHub Actions → GHCR → deploy SSH automatique au merge sur `main`
  - [x] `CORS_ORIGIN=https://c-evcore.com` + `NEXT_PUBLIC_API_URL=https://api.c-evcore.com`
- [x] Stabilité first prod sans TimescaleDB
  - [x] Cleanup automatique `OddsSnapshot` via worker ETL `odds-snapshot-retention` (rétention configurable)
  - [x] Indexation `OddsSnapshot` renforcée (requêtes moteur + purge par date)
  - [x] Fenêtre picks multi-jours (1-3 jours) pour combiner 2-3 journées
  - [x] Tuning rate-limit/quota API-Football (estimation appels/jour + warning seuil quota)
- [x] Fallback FRI hors pipeline Poisson principal
  - [x] Branche dédiée `competitionCode === 'FRI'` avant le guard `missing_team_stats`
  - [x] Source primaire `FRI_ELO_REAL` pour sélections nationales seniors mappées
  - [x] Fallback `ODDS_DEVIG` sur cotes 1X2 complètes si Elo indisponible
  - [x] `NO_BET` explicite si aucune source probabiliste exploitable
  - [x] V1 limitée au marché `ONE_X_TWO`
  - [x] Persistance `predictionSource`, `fallbackReason`, diagnostics Elo/odds et `eloSnapshotAt`
- [x] Référence Elo synchronisée en base
  - [x] Worker ETL `elo-sync` depuis `https://eloratings.net/World.tsv`
  - [x] Stockage DB `national_team_elo_rating`
  - [x] Consommation runtime du dernier snapshot Elo par le moteur FRI
  - [x] Conservation du dernier snapshot uniquement
- [x] Audit FRI Elo aligné sur la donnée de prod
  - [x] `fri-elo-audit.ts` lit le dernier snapshot DB au lieu d'un TSV local
  - [x] Génération d'un report texte dans `packages/db/reports/`
  - [x] Benchmark `FRI_ELO_REAL` / `FRI_ELO_INTERNAL` / `ODDS_DEVIG`
- [x] Hygiène des fixtures passées encore `SCHEDULED`
  - [x] Worker ETL `stale-scheduled-sync`
  - [x] Endpoint manuel `POST /etl/sync/stale-scheduled`
  - [x] Réconciliation des fixtures passées récentes encore `SCHEDULED`
- [x] Reporting opérationnel complémentaire
  - [x] `scheduled-fixtures-report.ts` pour volumétrie `SCHEDULED` par date et compétition
- [x] Nettoyage scripts DB obsolètes
  - [x] Suppression `reset-zero-xg.ts`
  - [x] Suppression `sa-away-audit.ts`
  - [x] Suppression `fri-xg-audit.ts`
- [-] OpenClaw integration — abandonné
- [-] Grafana dashboards — abandonné (à réévaluer si monitoring ML le requiert en Phase 3)
- [-] TimescaleDB — abandonné, rétention `OddsSnapshot` via worker suffisante ; les snapshots existants sont conservés pour analyse en Phase 3
- [x] Multi-bookmakers — périmètre stabilisé : Pinnacle + Bet365 (1X2), fallbacks Unibet/Marathonbet/Bwin pour marchés secondaires

---

---

### Bloc 7 — Canaux de prédiction (CONF / BTTS / DRAW)

> Canaux indépendants de l'EV — décision basée sur seuils probabilistes par ligue, calibrés par backtest avant activation.

**CONF (Confiance)**

- [x] `prediction.service.ts` — argmax 1X2 si P_max ≥ seuil ligue
- [x] Seuils actifs : PL (0.55), BL1 (0.50), SP2 (0.55), LL (0.50), POR (0.50), SA (0.55), L1 (0.50), I2 (0.50), UCL/UEL/UECL (0.60) et 10+ ligues supplémentaires
- [x] Endpoint `GET /predictions` avec filtres `channel`, `date`, `status`

**BTTS (BB — Both Teams To Score)**

- [x] Signal : P(BTTS) depuis modèle Poisson (`computeBttsProb`)
- [x] Seuils actifs : BL1 (0.60), PL (0.58), SA (0.62), LL (0.55), SP2 (0.58), D2 (0.60), CH (0.52), I2 (0.58), POR (0.58) et 10+ ligues supplémentaires

**DRAW (Nul)**

- [x] Signal `1/drawOdds` (probabilité implicite bookmaker) — Poisson en fallback
- [x] Verdict backtest DRAW : ROI ≥ +5% + HR ≥ 32% + volume ≥ 10 picks
- [x] Ligues actives : I2 (0.30 — ROI +11.1%), BL1 (0.28 — ROI +21.4%), POR (0.30 — ROI +12.7%), SA (0.30)
- [~] Évaluation ligues supplémentaires (feat/implementing-draw-channel)
- [x] Documentation `DRAW-DETECTION.md` — historique signal, tableau ligues actives/désactivées

**UI & Récap**

- [x] Badge canal (EV, SV, CONF, BTTS, DRAW) dans picks-du-jour
- [x] Boutons cote et panier pour canaux CONF/DRAW/BTTS
- [x] Ordre d'affichage : SV → BB → CONF → DRAW → EV
- [x] Page Récap avec filtres canal/période, stats et courbe progression

### Bloc 8 — Extension marchés Niveau 1/2/2.b + nouveaux canaux (2026-07-18)

> Suite de `docs/market-coverage-expansion.md`. Deux volets : (a) rendre les 10
> marchés ajoutés depuis Niveau 1 exploitables par EV/SAFE, (b) ajouter des
> canaux de prédiction dédiés pour les signaux vraiment indépendants (pas une
> reformulation d'un canal existant — voir arbitrage dans EVCORE.md).

- [x] `listEvaluatedPicks` évalue désormais DRAW_NO_BET, TEAM_TOTAL_HOME/AWAY,
      CLEAN_SHEET_HOME/AWAY, WIN_TO_NIL_HOME/AWAY, TO_WIN_EITHER_HALF,
      RESULT_TOTAL_GOALS, RESULT_BTTS — candidats VALUE (gate EV) au même
      titre que les marchés historiques.
- [x] Nouveaux canaux `CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF` —
      DRAW*NO_BET et WIN_TO_NIL/RESULT*\* écartés du statut "canal dédié"
      (renormalisation/dérivé d'un signal déjà couvert, pas un signal neuf).
- [x] `CleanSheetStrategy`/`WinEitherHalfStrategy` : argmax entre deux
      marchés/picks au-dessus d'un seuil par ligue (pattern `BttsStrategy`).
- [x] `TeamTotalStrategy` : meilleur (équipe × ligne × side) par EV (pattern
      `GoalsStrategy`, doublé sur la dimension équipe).
- [x] Migration Prisma `StrategyChannel` +3 valeurs — écrite et **appliquée**.
- [x] **CLEAN_SHEET / WIN_EITHER_HALF passés en OBSERVATION** (2026-07-18,
      toutes les ligues actives avec n ≥ 50 fixtures settled) : aucune cote
      historique n'existe pour ces marchés (stub vide dans
      `odds-historical-import.worker.ts` ; The Odds API 422 même sur BTTS/DNB
      — pas de fallback possible), donc pas de ROI backtestable. Seuils
      dérivés directement des scores FT/HT déjà en base (taux de base par
      ligue − marge 0.05), même méthodologie que `GOALS_CONFIG`. Jamais misé
      (observation seule), accumulation forward via la sync PREMATCH
      démarrée le même jour.
- [x] **TEAM_TOTAL passé en OBSERVATION** (2026-07-19, mêmes 67 ligues) :
      même méthodologie que `GOALS_CONFIG`, doublée sur la dimension équipe —
      par (ligue × équipe × ligne), side = OVER si taux empirique ≥ 0.55,
      UNDER si ≤ 0.45, les deux dans la bande 0.45–0.55 ; seuil = taux du
      côté choisi − 0.05. Lignes au taux de base > 0.90 exclues (ex. "Away
      Under 4.5" à 99% — near-certain, aucune valeur informative, contrairement
      aux lignes GOALS/CLEAN_SHEET qui restent dans une plage incertaine).
      442 segments dérivés depuis les scores FT réels.
- [x] `backtest.repository.ts`/`tuning.metrics.ts` étendus : fetch des cotes
      CLEAN_SHEET_HOME/AWAY + TO_WIN_EITHER_HALF, sweep par seuil prêt dès
      que la sync PREMATCH aura accumulé assez de volume forward pour un
      vrai ROI (`POST /backtest/tuning`, déjà branché via `TUNING_CHANNELS`).
      TEAM_TOTAL n'a pas cette brique de sweep (comme les lignes GOALS
      1.5/3.5/4.5, qui n'en ont pas non plus faute de cotes historiques) —
      seule la config structurelle par taux de base a été faite.

### Web UI

- [x] Page 404 (`not-found.tsx`) — layout centré, animation CSS, tokens bento

---

## Phase 3 — ML & Scalabilité (après stabilisation Phase 2)

> Objectif : transformer EVCore en système circulant — les résultats réels alimentent l'entraînement,
> qui améliore les prédictions, qui génère de meilleurs picks.
> Architecture : Python worker dans le Docker Compose existant, communication via BullMQ/Redis et PostgreSQL.
> NestJS reste l'autorité — Python entraîne et calibre, NestJS décide.

Docs de cadrage Phase 3:

- [docs/phase3-ml-correction-layer.md](docs/phase3-ml-correction-layer.md) — rôle du ML comme couche de correction au-dessus du Poisson
- [docs/phase3-go-watch-no-go.md](docs/phase3-go-watch-no-go.md) — lecture décisionnelle `GO / WATCH / NO-GO` par `canal × marché`
- [packages/db/reports/edge-vs-pinnacle-2026-06-04.md](packages/db/reports/edge-vs-pinnacle-2026-06-04.md) — premier rapport `edge vs Pinnacle`

### Préconditions DB ✅ (4 juin 2026)

- [x] PgBouncer `v1.25.1-p0` dans Docker Compose dev + prod (`PGBOUNCER_URL` runtime / `DATABASE_URL` migrations)
- [-] Partitionnement `OddsSnapshot` — différé (421k lignes, indexes suffisants ; reconsidérer à 1M+)
- [x] Index `ModelRun.analyzedAt` — scans temporels dataset ML
- [x] Table `ml_model_version` — migration `20260604174057_phase3_ml_model_version`
- [x] Politique `ModelRun` jamais supprimée — documentée dans le schéma

### Bloc A — Étude OddsSnapshot ✅ (4 juin 2026)

- [x] Comparer probabilités moteur vs probabilité implicite Pinnacle — 680 picks analysés
- [x] Edge moyen par canal : `SV` GO (+5.17% / +17.16%), `EV/ONE_X_TWO` NO-GO (-54.86%), `CONF` WATCH
- [x] Matrice GO / WATCH / NO-GO par `canal × marché` — voir `docs/phase3-go-watch-no-go.md`
- [x] Rapport → `packages/db/reports/edge-vs-pinnacle-2026-06-04.md`

### Bloc B — Infrastructure ML ✅ (juin 2026 — détail dans `docs/phase3-ml-todo.md` étapes 3–7bis)

- [x] Service `ml-worker` Python dans Docker Compose (image `python:3.12-slim`, accès Redis + PostgreSQL)
- [x] Queue BullMQ `ml-training` — NestJS pousse le job, Python consomme
- [x] `MlController` NestJS : `POST /ml/train`, `GET /ml/models/active`, activate/rollback/delete
- [x] Script Python `train.py` : lit `ModelRun` + outcomes depuis PostgreSQL, entraîne, sérialise en base
- [x] Suite de tests pytest ml-worker + job CI (étape 7bis)
- [ ] Upgrade VPS OVH si besoin (≥ 4 vCPU / 8 GB RAM) avant premier entraînement prod

### Bloc C — Correction layer XGBoost + Calibration ✅ (juin 2026 — détail dans `docs/phase3-ml-todo.md` étapes 4–7)

> Architecture retenue (voir `docs/phase3-ml-correction-layer.md`) : le modèle apprend
> **où le Poisson se trompe** (cible `outcome_correct` sur les lignes avec cote Pinnacle) et
> produit une probabilité corrigée. Il ne remplace pas Poisson — il le calibre. La correction
> est servie en **shadow mode** via le serveur d'inférence (pas de chargement de poids au démarrage).

- [x] Feature extraction : form, xG, H/A, volatilité + delta_p Pinnacle (depuis `OddsSnapshot`)
- [x] Entraînement (LogReg < 200 samples, XGBoost au-delà) — `auto` par segment
- [x] Calibration scikit-learn (isotonic, `CalibratedClassifierCV`) — corriger le biais des probabilités
- [x] Modèle sérialisé + métriques écrites en `ml_model_version` (Brier, Calibration Error, ROI shadow)
- [x] `BettingEngineService` consomme la correction en **shadow mode** (étape 6 — loggée, n'agit pas encore)
- [x] Basculement automatique si Brier amélioré ≥ 5% + cooldown 7 jours
- [x] Rollback manuel via `POST /ml/models/:id/rollback`
- [x] Job BullMQ hebdomadaire — ré-entraînement si ≥ 50 nouveaux bets settled
- [ ] **Promotion hors shadow** (décision par segment, voir `docs/phase3-ml-todo.md` étape 7ter) — LA SUITE

### Bloc D — Gestion dynamique du drawdown

- [ ] Ajustement de la fraction Kelly selon la trajectoire du drawdown en cours
- [ ] Réduction progressive des mises si drawdown > 8% (paliers : 75% → 50% → 25% Kelly)
- [ ] Reprise automatique au niveau normal après retour au-dessus du seuil sur 20 bets consécutifs

### Bloc E — Monte Carlo (diagnostic, optionnel)

- [ ] Simulation 10 000 saisons fictives depuis les probabilités calibrées
- [ ] Calcul intervalles de confiance ROI — distinguer malchance structurelle vs dérive du modèle
- [ ] Utilisé uniquement comme outil de diagnostic, pas dans la décision de betting

---

## Refactor Domaine — Architecture des canaux de stratégie

> Cadrage : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md)
> · Plan d'exécution détaillé : [TODO.md](TODO.md)
>
> Refactor **transverse** (schéma, betting engine, settlement, API, frontend) qui
> remplace les trois vocabulaires de canal concurrents (`PredictionChannel`,
> `CouponLegCanal`, `isSafeValue`) par un enum unique `StrategyChannel`, et
> représente chaque run comme **multi-canal** au lieu d'un `BET`/`NO_BET` global.
> Bascule unique et propre : legacy supprimé uniquement **après gate de parité vert**.
> Aucun nouveau canal activé sans backtest séparé par ligue / marché / saison.

- [ ] Cadrage & gel du design : schéma cible, enum `StrategyChannel` v1 (canaux réels
      uniquement), grain `ModelRun` (1-à-N), mapping legacy → cible
- [ ] Contrat & registre de stratégies (`StrategyContext`, `allowedMarkets`, une stratégie
      par canal) derrière les tables cibles, calculs probabilistes inchangés
- [ ] Migration schéma : enums + tables `channel_decision` / `channel_selection` + `Bet.channelSelectionId`
- [ ] Backfill idempotent + transactionnel de l'historique matérialisé
- [ ] Gate de vérification (réconciliation + parité ancien/nouveau rapport) **avant tout DROP**
- [ ] Bascule des consommateurs (engine, settlement, API, frontend) dans la même release
- [ ] Suppression du legacy (`Prediction`, `PredictionChannel`, `CouponLegCanal`,
      `Bet.isSafeValue`, `ModelRun.decision`) — rollback testé
- [ ] Nouveaux canaux phasés, backtest avant activation : `BB` côté `NO`, `GOALS`,
      `CONSENSUS`, `AVOID`, `UNDERDOG`/`FAVORITE`, `MARKET_MOVE`, `FIRST_HALF`, `LIVE_VALUE`

---

## Phase 4

> **EVA** (Expected Value Analyst) — d'abord construite (2026-06) comme assistant
> conversationnel (function calling Groq, 18 tools, SSE, conversations persistées en DB,
> `/dashboard/chat`), puis **entièrement remplacée** le 2026-07-02 par un flow plus simple :
> module `analysis-sheet` — fiche d'analyse compacte sur une plage de dates (SQL raw, `json_agg`,
> une ligne par pick retenu + rejets en résumé, historique de ligne de mouvement sur les
> réanalyses rolling-horizon), exportable `.txt`/`.json`, et un bouton **"Analyser avec Eva"**
> qui envoie la fiche à Groq en un seul appel (pas de tool-calling, pas de streaming SSE) et
> retourne une analyse de cohérence + picks proposés. UI : `/dashboard/analysis-sheet`.
> Le module `chat` (contrôleur, tools, boucle d'orchestration, `chat.pick-engine`/ladder — redondant
> avec le module coupon autonome) a été supprimé ; seuls le client Groq et le modèle `ChatUsage`
> (rate-limit quotidien) ont survécu, réutilisés tels quels. Tables `chat_conversation`/`chat_message`
> laissées en place (non écrites, suppression explicite à décider plus tard).

- [x] EVA — Fiche d'analyse + appel Groq single-shot (`apps/backend/src/modules/analysis-sheet/`,
      `apps/web/app/dashboard/analysis-sheet/`)
  - [x] Requête SQL raw (CTE + `json_agg`) par plage de dates, filtres compétition/canal
  - [x] Export `.txt`/`.json`, bouton "Analyser avec Eva" (Groq, sans tool-calling)
  - [x] Dédup + historique des passes rolling-horizon (ADVANCE/PRE_KICKOFF/LIVE) pour repérer
        le line movement
  - [ ] Durcissement sécurité + golden set (adversarial, injection par données) — pas encore fait
        pour le nouveau flow single-shot
- [ ] SaaS / multi-tenant
- [ ] API interne
- [ ] Groupe premium

---

## Au-delà — Extension multi-sport (différé, non planifié)

> Cadrage : [docs/multi-sport-extension.md](docs/multi-sport-extension.md)
>
> Le cœur probabiliste (Poisson) est spécifique au football ; « ajouter un sport »
> = écrire un **second socle** derrière la même colonne stratégie/décision, pas une
> config. Préconditions strictes avant tout code : (1) edge football prouvé — ML
> promu hors shadow + biais top-picks corrigé ; (2) abstraction `sport` dans le
> schéma (Market, ChannelSelection, socle pluggable). Tennis = 1ᵉʳ candidat. Tant
> que les préconditions ne sont pas remplies : **recherche uniquement, pas de code.**

- [-] Tennis (2ᵉ socle) — différé jusqu'aux préconditions ci-dessus
- [-] Basketball / Esports — réévalués seulement après validation du pattern multi-sport

---

## GitHub Milestones

| Milestone         | Contenu                                   | Due date     |
| ----------------- | ----------------------------------------- | ------------ |
| `mvp-foundations` | Setup monorepo, DB, Docker, CI            | 28 fév 2026  |
| `mvp-month-1`     | ETL, stats rolling, modèle, backtest      | 14 mars 2026 |
| `mvp-month-2`     | Odds, EV, simulation, tracking            | 31 mars 2026 |
| `mvp-month-3`     | Automatisation, apprentissage, validation | 8 avr 2026   |
| `phase-2`         | Live, canaux prédiction, déploiement prod | 4 juin 2026  |
| `phase-3`         | ML circulant, XGBoost, scalabilité DB     | TBD          |
