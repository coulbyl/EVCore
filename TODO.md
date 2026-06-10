# EVCore — Phase 3 Plan d'exécution ML

> Référence : [ROADMAP.md](ROADMAP.md) · [docs/phase3-ml-correction-layer.md](docs/phase3-ml-correction-layer.md) · [docs/phase3-go-watch-no-go.md](docs/phase3-go-watch-no-go.md)
>
> **Principe directeur** : le ML ne remplace pas le moteur Poisson — il apprend où il se trompe et corrige les probabilités avant la décision. NestJS reste l'autorité finale.
>
> **Premier chantier identifié** : `EV / ONE_X_TWO` — edge affiché moyen +19.57%, ROI réel -54.86% sur 22 picks. Biais structurel confirmé.
> **Référence saine à ne pas toucher** : `SV / OVER_UNDER` — hit rate 73.6%, ROI +5.17%.

---

## Statut

- `[ ]` À faire
- `[x]` Terminé
- `[~]` En cours
- `[-]` Abandonné / hors périmètre v1

---

## Étape 0 — Commit des travaux Codex en attente ✅

- [x] Commit `packages/db/scripts/analyze-edge.ts`
- [x] Commit `docs/phase3-ml-correction-layer.md` + `docs/phase3-go-watch-no-go.md`
- [x] Commit `ROADMAP.md` (liens vers les docs Phase 3 ajoutés)

---

## Étape 1 — Préconditions DB ✅

- [x] **PgBouncer** `v1.25.1-p0` dans Docker Compose (dev + prod) — `PGBOUNCER_URL` pour le runtime, `DATABASE_URL` direct pour les migrations
- [-] **Partitionnement `OddsSnapshot`** — différé : 421k lignes, indexes existants suffisants ; à reconsidérer à 1M+
- [x] **Index `ModelRun.analyzedAt`** — ajouté pour les scans temporels du dataset ML
- [x] **Table `ml_model_version`** — migration `20260604174057_phase3_ml_model_version`
- [x] **Politique de rétention `ModelRun`** — documentée dans le schéma Prisma (commentaire)

---

## Étape 2 — Accumulation de données ✅

- [x] Backfill historique : 1 455 bets backfill + 806 prod = **2 261 bets total**
- [x] Extraction étendue aux prédictions settlées (`CONF`, `DRAW`, `BTTS`) : **17 370 lignes ML**, **8 742 avec Pinnacle**
- [x] Volume suffisant pour XGBoost sur `ALL` et les gros canaux `CONF`, `DRAW`, `BTTS`
- [ ] Re-générer le rapport `edge-vs-Pinnacle` toutes les 2 semaines (cron ou endpoint dédié)

---

## Étape 3 — Infra Python Worker ✅

- [x] Service `ml-worker` dans `docker-compose.yml` (build local, DATABASE_URL + PGBOUNCER_URL + Redis)
- [x] `apps/ml-worker/` : Dockerfile, requirements.txt, scaffold asyncio
- [x] Queue BullMQ `ML_TRAINING` dans `BULLMQ_QUEUES`, job `{ segment, triggeredBy }`
- [x] `MlModule` NestJS : MlController / MlService / MlRepository
  - `POST /ml/train`, `GET /ml/models`, `GET /ml/models/active`, `POST /ml/models/:id/activate`
- [x] `POST /ml/backfill` + `MlBackfillWorker` — backfill historique par saison
- [x] Page admin `/dashboard/ml` — backfill, entraînement, gestion versions
- [x] `AdminGuard` dédié — suppression de `assertAdmin` dupliqué dans 4 controllers
- [x] Test de communication : backfill terminé avec succès (1 455 bets générés)

---

## Étape 4 — Feature Engineering + Dataset Pipeline ✅

- [x] `src/data/extract.py` — jointure `ModelRun × Bet/Prediction × Fixture × OddsSnapshot(Pinnacle)`
- [x] Feature matrix v1 : `prob_estimated`, `deterministic_score`, `ev`, `p_poisson_*`, `p_pinnacle`, `delta_p`, `recent_form`, `xg`, `performance_dom_ext`, `volatilite_ligue`, `odds_segment`, `league_tier`, `canal`, `market`, `pick`
- [x] Target : `outcome_correct` (`Bet.status WON/LOST` ou `Prediction.correct true/false`)
- [x] Split temporel `temporal_split()` — 80/20 par ordre chronologique (pas aléatoire)
- [x] Filtre par segment (`canal:market`) + `ALL`
- [x] Dataset actuel : 17 370 lignes settlées, 8 742 avec cotes Pinnacle exploitables
- [x] Validation minimum : split LogReg `ALL` OK — train 3322W/2797L, test 1448W/1175L
- [x] Segments lançables : `EV:ONE_X_TWO`, `EV:OVER_UNDER`, `EV:BTTS`, `CONF:ONE_X_TWO`, `DRAW:ONE_X_TWO`, `BTTS:BTTS`
- [-] `SV:OVER_UNDER` retiré du training v1 — référence saine et split Pinnacle exploitable insuffisant après mapping par cote cible

---

## Étape 5 — Modèle v1 : Correction Layer ✅

- [x] `src/models/correction.py` — logistic regression + XGBoost (auto-select ≥200 samples Pinnacle), split temporel 70/30, métriques (Brier, CalErr, ROI simulé)
- [x] Guard classe balance minimum (20 samples par classe par split)
- [x] `src/models/persist.py` — joblib → `/app/models/{uuid}.pkl`, INSERT `ml_model_version`
- [x] Volume Docker `ml_models` (dev + prod) — modèles persistés entre restarts
- [x] `jobs/train.py` câblé end-to-end : extract → train → persist → retour métriques
- [x] **Premier entraînement LogReg terminé** sur `ALL` bets-only (757 samples Pinnacle, avant extension Prediction)
  - Version DB : `1087eb88-510f-48d8-91c6-9147bc234403`
  - Test split : 228 samples, Brier `0.2418`, Calibration Error `0.0912`, ROI test-set `+20.42%`
  - Baseline même test split : Brier Poisson/prob actuelle `0.2423` → gain LogReg ≈ `0.2%` seulement (insuffisant pour shadow activation)
- [ ] Lancer entraînement XGBoost (`algorithm: auto`) par segment prioritaire : `CONF:ONE_X_TWO` (4 772), `DRAW:ONE_X_TWO` (1 561), `BTTS:BTTS` (1 185), `ALL` (8 742)
- [ ] Rapport comparatif offline : baseline Poisson vs LogReg vs XGBoost par segment

---

## Étape 6 — Intégration BettingEngine (Shadow Mode) ✅

> Ne jamais activer directement en prod. Shadow d'abord — les paris ne changent pas mais les corrections sont loggées.

- [x] `MlInferenceService` + `MlInferenceModule` — HTTP client vers le serveur Python (timeout 500ms, fallback gracieux)
- [x] Shadow mode câblé dans `BettingEngineService.analyzeFixture()` — appel inference, log `shadow_ml_corrected_p` + `shadow_ml_edge_delta` dans `ModelRun.features`
- [x] Feature flag `FEATURE_FLAGS.SCORING.ML_CORRECTION = false` — activation manuelle uniquement
- [x] `MlInferenceModule` importé dans `BettingEngineModule`, mock dans tous les tests
- [ ] **Critères de validation shadow** (minimum avant activation prod) :
  - ≥50 picks résolus en shadow
  - Brier Score corrigé ≥5% mieux que baseline sur la fenêtre shadow
  - Calibration Error corrigée ≤ baseline
  - ROI simulé corrigé ≥ ROI baseline sur la même fenêtre

---

## Étape 7 — Activation et pipeline de ré-entraînement ✅

- [x] `POST /ml/models/:id/activate` — bascule `isActive`, notifie par email
- [x] `POST /ml/models/:id/rollback` — réactive la version précédente (`rollbackOfId`), notifie
- [x] `MlTrainingEventsListener` (QueueEventsHost) — auto-switch si Brier ≥5% mieux + cooldown 7 jours
- [x] `MlSchedulerWorker` + queue `ML_SCHEDULER` — cron lundi 03:00 UTC, déclenche re-train si ≥50 bets settled
- [x] Notification email `sendMlModelActivatedAlert()` sur activation + rollback
- [x] `ML_MODEL_ACTIVATED` dans `NotificationType` (migration `20260610150025`)

---

## Étape 8 — Drawdown dynamique (après ML stable en prod)

> N'activer qu'une fois le ML en prod depuis ≥30 jours stables.

- [ ] `BettingEngineService` calcule le drawdown courant (ROI glissant 30 derniers bets)
- [ ] Fraction Kelly dynamique :
  - Drawdown 0–8% : Kelly normal (config `KELLY_FRACTION`)
  - Drawdown 8–12% : Kelly × 0.75
  - Drawdown 12–15% : Kelly × 0.50
  - Drawdown >15% : Kelly × 0.25 (suspension automatique existante inchangée)
- [ ] Reprise automatique au palier normal : drawdown revient sous 5% sur 20 bets consécutifs
- [ ] Log dans `ModelRun.features` : `kelly_fraction_applied`, `current_drawdown_pct`

---

## Matrice GO / WATCH / NO-GO (v1 — mise à jour au fil des rapports)

| Segment                  | Statut         | Action                                                         |
| ------------------------ | -------------- | -------------------------------------------------------------- |
| `SV / OVER_UNDER`        | **GO**         | Référence — ne pas corriger, servir de baseline de comparaison |
| `SV / OVER_UNDER_HT`     | **GO**         | Référence — même logique                                       |
| `CONF / ONE_X_TWO`       | **WATCH → v1** | 4 772 samples Pinnacle — lancer LogReg puis XGBoost            |
| `DRAW / ONE_X_TWO`       | **WATCH → v1** | 1 561 samples Pinnacle — lancer LogReg puis XGBoost            |
| `BTTS / BTTS`            | **WATCH → v1** | 1 185 samples Pinnacle — lancer LogReg puis XGBoost            |
| `EV / ONE_X_TWO`         | **WATCH → v1** | 585 samples Pinnacle — lancer LogReg segmenté                  |
| `EV / OVER_UNDER_HT`     | **WATCH**      | ROI +3.97% — légèrement positif, surveiller avant de corriger  |
| `EV / OVER_UNDER`        | **WATCH → v1** | 147 samples Pinnacle exploitables — lançable mais fragile      |
| `EV / BTTS`              | **WATCH → v1** | 206 samples Pinnacle — lançable                                |
| `EV / FIRST_HALF_WINNER` | **NO-GO v1**   | ROI -25.61% — hors périmètre                                   |
| `HALF_TIME_FULL_TIME`    | **NO-GO v1**   | Hors périmètre v1                                              |
