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

## Étape 2 — Accumulation de données (parallèle)

> Contrainte critique : `EV / ONE_X_TWO` n'a que **22 picks** avec cotes Pinnacle. C'est insuffisant pour XGBoost seul. Logistic regression d'abord, XGBoost quand on approche 200+ picks par segment.

- [ ] Re-générer le rapport `edge-vs-Pinnacle` toutes les 2 semaines (`POST /etl/analyze-edge` ou cron)
- [ ] Tracker le volume par segment dans le rapport — seuil de déclenchement ML v1 : **100 picks** sur le segment cible
- [ ] Segment prioritaire : `EV / ONE_X_TWO` — actuellement 22 picks, objectif 100+
- [ ] Second segment : `CONF / ONE_X_TWO` — 153 picks déjà disponibles, candidat immédiat pour calibration fine

---

## Étape 3 — Infra Python Worker ✅

- [x] Service `ml-worker` dans `docker-compose.yml` (build local, DATABASE_URL + PGBOUNCER_URL + Redis)
- [x] `apps/ml-worker/` : Dockerfile, requirements.txt, scaffold asyncio
- [x] Queue BullMQ `ML_TRAINING` dans `BULLMQ_QUEUES`, job `{ segment, triggeredBy }`
- [x] `MlModule` NestJS : MlController / MlService / MlRepository
  - `POST /ml/train`, `GET /ml/models`, `GET /ml/models/active`, `POST /ml/models/:id/activate`
- [ ] Test de communication end-to-end : NestJS → Redis → Python → PostgreSQL → retour

---

## Étape 4 — Feature Engineering + Dataset Pipeline ✅

- [x] `src/data/extract.py` — jointure `ModelRun × Bet × Fixture × OddsSnapshot(Pinnacle)`
- [x] Feature matrix v1 : `prob_estimated`, `deterministic_score`, `ev`, `p_poisson_*`, `p_pinnacle`, `delta_p`, `recent_form`, `xg`, `performance_dom_ext`, `volatilite_ligue`, `odds_segment`, `league_tier`, `canal`, `market`, `pick`
- [x] Target : `outcome_correct` (1=WON, 0=LOST)
- [x] Split temporel `temporal_split()` — 80/20 par ordre chronologique (pas aléatoire)
- [x] Filtre par segment (`canal:market`) + `ALL`
- [x] Dataset actuel : 803 bets settled, 145 avec cotes Pinnacle (7 marchés)
- [ ] Validation minimum : ≥50 positifs ET ≥50 négatifs dans chaque split — vérifié à l'entraînement (Étape 5)

---

## Étape 5 — Modèle v1 : Correction Layer ✅

- [x] `src/models/correction.py` — logistic regression, split temporel 70/30, métriques (Brier, CalErr, ROI simulé)
- [x] Guard classe balance minimum (20 samples par classe par split)
- [x] `src/models/persist.py` — joblib → `/app/models/{uuid}.pkl`, INSERT `ml_model_version`
- [x] Volume Docker `ml_models` (dev + prod) — modèles persistés entre restarts
- [x] `jobs/train.py` câblé end-to-end : extract → train → persist → retour métriques
- [ ] **v2 — XGBoost** — quand segment cible atteint 200+ picks avec Pinnacle
- [ ] Rapport comparatif offline : baseline Poisson vs logReg vs XGBoost (Étape 7)

---

## Étape 6 — Intégration BettingEngine (Shadow Mode)

> Ne jamais activer directement en prod. Shadow d'abord — les paris ne changent pas mais les corrections sont loggées.

- [ ] `BettingEngineService.analyzeFixture()` charge le `ml_model_version` actif au démarrage via `MlService`
- [ ] Appliquer la correction aux probabilités Poisson avant le calcul EV — uniquement sur les segments activés
- [ ] Log dans `ModelRun.features` : `shadow_ml_p_home`, `shadow_ml_p_draw`, `shadow_ml_p_away`, `shadow_ml_edge_delta`
- [ ] **Critères de validation shadow** (minimum avant activation prod) :
  - ≥50 picks résolus en shadow
  - Brier Score corrigé ≥5% mieux que baseline sur la fenêtre shadow
  - Calibration Error corrigée ≤ baseline
  - ROI simulé corrigé ≥ ROI baseline sur la même fenêtre
- [ ] Feature flag `FEATURE_FLAGS.ML_CORRECTION` : `false` par défaut, activation manuelle

---

## Étape 7 — Activation et pipeline de ré-entraînement

- [ ] `POST /ml/model/:id/activate` — bascule `isActive` + log dans `ModelRun` (audit complet)
- [ ] Rollback : `POST /ml/model/:id/rollback` — réactive la version précédente, crée un nouveau record avec `rollbackOf`
- [ ] Job BullMQ `ml-retrain` hebdomadaire : déclenche re-train si ≥50 nouveaux bets settled depuis le dernier entraînement
- [ ] Auto-switch : si nouveau modèle améliore le Brier Score + cooldown 7 jours (même règle que `AdjustmentProposal`)
- [ ] Notification email `sendMlModelActivatedAlert()` sur activation + rollback

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

| Segment                  | Statut         | Action                                                              |
| ------------------------ | -------------- | ------------------------------------------------------------------- |
| `SV / OVER_UNDER`        | **GO**         | Référence — ne pas corriger, servir de baseline de comparaison      |
| `SV / OVER_UNDER_HT`     | **GO**         | Référence — même logique                                            |
| `CONF / ONE_X_TWO`       | **WATCH → v1** | 153 picks : premier segment à corriger (Étape 5 v1)                 |
| `EV / ONE_X_TWO`         | **WATCH → v2** | 22 picks — attendre 100+ avant XGBoost                              |
| `EV / OVER_UNDER_HT`     | **WATCH**      | ROI +3.97% — légèrement positif, surveiller avant de corriger       |
| `EV / OVER_UNDER`        | **WATCH**      | ROI -7.28% global mais forte variance par ligue — segmenter d'abord |
| `DRAW / ONE_X_TWO`       | **WATCH**      | 20 picks, ROI +13.90% — trop petit, observer                        |
| `EV / FIRST_HALF_WINNER` | **NO-GO v1**   | ROI -25.61% — hors périmètre                                        |
| `EV / BTTS`              | **NO-GO v1**   | Couverture Pinnacle incomplète                                      |
| `BTTS / BTTS`            | **NO-GO v1**   | Mapping marché sharp manquant                                       |
| `HALF_TIME_FULL_TIME`    | **NO-GO v1**   | Hors périmètre v1                                                   |
