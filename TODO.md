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

## Étape 0 — Commit des travaux Codex en attente

- [ ] Commit `packages/db/scripts/analyze-edge.ts` (script de génération du rapport edge)
- [ ] Commit `docs/phase3-ml-correction-layer.md` + `docs/phase3-go-watch-no-go.md`
- [ ] Commit `ROADMAP.md` (liens vers les docs Phase 3 ajoutés)

---

## Étape 1 — Préconditions DB

> À faire avant toute infra ML. Ces éléments évitent des migrations douloureuses en cours d'entraînement.

- [ ] **PgBouncer** dans Docker Compose — connection pooling, obligatoire avant l'ajout du worker Python (connexions concurrentes NestJS + Python)
- [ ] **Partitionnement `OddsSnapshot` par mois** — PostgreSQL declarative partitioning ; avant 500k lignes ; les requêtes d'extraction de features en seront 10× plus rapides
- [ ] **Index composites** `(competitionCode, "scheduledAt")` sur `Fixture` et `ModelRun` — accélère l'extraction du dataset d'entraînement
- [ ] **Table `ml_model_version`** dans le schéma Prisma :
  ```
  id, createdAt, segment (canal×marché), algorithm, features (JSON),
  metrics (brierScore, calibrationError, roiShadow), modelBlob (bytea ou path S3),
  isActive, activatedAt, rollbackOf (FK self)
  ```
- [ ] **Politique de rétention `ModelRun`** : ajouter une contrainte / note dans `etl.constants.ts` — jamais de purge, c'est le dataset ML

---

## Étape 2 — Accumulation de données (parallèle)

> Contrainte critique : `EV / ONE_X_TWO` n'a que **22 picks** avec cotes Pinnacle. C'est insuffisant pour XGBoost seul. Logistic regression d'abord, XGBoost quand on approche 200+ picks par segment.

- [ ] Re-générer le rapport `edge-vs-Pinnacle` toutes les 2 semaines (`POST /etl/analyze-edge` ou cron)
- [ ] Tracker le volume par segment dans le rapport — seuil de déclenchement ML v1 : **100 picks** sur le segment cible
- [ ] Segment prioritaire : `EV / ONE_X_TWO` — actuellement 22 picks, objectif 100+
- [ ] Second segment : `CONF / ONE_X_TWO` — 153 picks déjà disponibles, candidat immédiat pour calibration fine

---

## Étape 3 — Infra Python Worker

- [ ] Service `ml-worker` dans `docker-compose.yml` :
  ```yaml
  ml-worker:
    build: ./apps/ml-worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]
  ```
- [ ] `apps/ml-worker/` : `Dockerfile`, `requirements.txt`, `train.py` scaffold
  - Dépendances : `xgboost`, `scikit-learn`, `psycopg2-binary`, `redis`, `bullmq` (ou poll Redis direct)
- [ ] Queue BullMQ `ml-training` — NestJS pousse le job avec `{ segment, triggeredBy }`
- [ ] **`MlModule` NestJS** :
  - `MlController` : `POST /ml/train` (déclenche job), `POST /ml/model/:id/activate` (rollback), `GET /ml/model/active`
  - `MlService` : push BullMQ, lecture/écriture `ml_model_version`
  - `MlRepository` : toutes les requêtes Prisma sur `ml_model_version`
- [ ] Test de communication : NestJS → Redis → Python → PostgreSQL → retour

---

## Étape 4 — Feature Engineering + Dataset Pipeline

> La qualité des features est plus importante que le choix du modèle.

- [ ] Script Python `extract_dataset.py` qui lit depuis PostgreSQL :
  - Jointure `ModelRun` × `OddsSnapshot` × `Bet` (outcome réel)
  - Filtres : `Bet.status IN (WON, LOST)`, OddsSnapshot Pinnacle présent, marché ciblé
- [ ] **Feature matrix v1** (par pick) :
  - `p_home`, `p_draw`, `p_away` (Poisson brut)
  - `deterministic_score`
  - `p_pinnacle_home`, `p_pinnacle_draw`, `p_pinnacle_away` (de-vigged)
  - `delta_p` = `p_model - p_pinnacle` (feature centrale — mesure la divergence)
  - `implied_odds_pinnacle` (niveau de cote)
  - `odds_segment` : low (<1.5), mid (1.5–2.5), high (>2.5)
  - `league_tier` : top5 / secondaire / international
  - `market` : ONE_X_TWO / OVER_UNDER / etc.
  - `canal` : EV / SV / CONF / DRAW
  - `form_delta`, `xg_delta` (home - away)
  - `days_since_season_start` (proxy de maturité des stats rolling)
- [ ] **Target v1** : `outcome_correct` (1 si WON, 0 si LOST) — binaire
- [ ] **Split temporel** (pas aléatoire — évite le data leakage) : 80% anciens / 20% récents
- [ ] Validation minimum : ≥50 positifs ET ≥50 négatifs dans chaque split avant entraînement

---

## Étape 5 — Modèle v1 : Correction Layer

> Commencer simple. Logistic regression d'abord (interprétable, robuste petit dataset). XGBoost en v2 quand le volume le justifie.

- [ ] **v1 — Logistic Regression** sur `CONF / ONE_X_TWO` (153 picks, candidat immédiat) :
  - Entraîner sur features v1
  - Évaluer : Brier Score baseline vs. corrigé, Calibration Error, ROI simulé
  - Objectif minimal : Brier Score ≥5% mieux que baseline Poisson
- [ ] **v2 — XGBoost** sur tous segments disponibles, segment comme feature :
  - Hyperparams : `max_depth=4`, `n_estimators=200`, `learning_rate=0.05` (conservative)
  - Early stopping sur le validation set temporel
  - Feature importance loggée dans `ml_model_version.metrics`
- [ ] **Calibration post-modèle** via `CalibratedClassifierCV` (scikit-learn) :
  - Méthode : isotonic si >1000 samples, Platt sinon
  - Vérifier que les probabilités corrigées sont dans [0, 1] et somment à 1 par fixture
- [ ] Sérialiser le modèle entraîné en `ml_model_version.modelBlob` (joblib + base64 ou path fichier)
- [ ] Rapport offline : comparer baseline Poisson / logReg / XGBoost sur le test set

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

| Segment | Statut | Action |
| --- | --- | --- |
| `SV / OVER_UNDER` | **GO** | Référence — ne pas corriger, servir de baseline de comparaison |
| `SV / OVER_UNDER_HT` | **GO** | Référence — même logique |
| `CONF / ONE_X_TWO` | **WATCH → v1** | 153 picks : premier segment à corriger (Étape 5 v1) |
| `EV / ONE_X_TWO` | **WATCH → v2** | 22 picks — attendre 100+ avant XGBoost |
| `EV / OVER_UNDER_HT` | **WATCH** | ROI +3.97% — légèrement positif, surveiller avant de corriger |
| `EV / OVER_UNDER` | **WATCH** | ROI -7.28% global mais forte variance par ligue — segmenter d'abord |
| `DRAW / ONE_X_TWO` | **WATCH** | 20 picks, ROI +13.90% — trop petit, observer |
| `EV / FIRST_HALF_WINNER` | **NO-GO v1** | ROI -25.61% — hors périmètre |
| `EV / BTTS` | **NO-GO v1** | Couverture Pinnacle incomplète |
| `BTTS / BTTS` | **NO-GO v1** | Mapping marché sharp manquant |
| `HALF_TIME_FULL_TIME` | **NO-GO v1** | Hors périmètre v1 |
