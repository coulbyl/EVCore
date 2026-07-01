# ml-worker — désynchronisation post-refactor (à traiter)

Date : 2026-07-01
Statut : **CASSÉ depuis le refactor des canaux (migration `20260617000232`, 17 juin 2026).** Diagnostic posé, chantier reporté à une nouvelle conversation.

Impact : **le mode est "shadow"** (la correction ML est calculée et stockée, mais **PAS appliquée aux décisions** — voir `betting-engine.service.ts` `shadowMlCorrectedP`/`shadowMlEdgeDelta`). Donc **aucun impact sur les paris live / le money**. Ce qui est cassé = l'**entraînement** (cron en erreur) et la **qualité des features shadow**. Toute la couche Phase 3 tourne à vide.

---

## Ce que fait le ml-worker (rappel archi)

- **`apps/ml-worker`** (Python) = 2 process dans un conteneur :
  1. **Worker BullMQ** (queue `ml-training`) : sur job `train`, extrait un dataset, entraîne un modèle de **correction de probabilité** (LogReg < 200 échantillons, sinon XGBoost calibré isotonic), persiste dans `ml_model_version` (+ `.pkl` dans `/app/models`).
  2. **Serveur FastAPI** (port 8000) : `/infer` (segment + features → proba corrigée), `/health`, `/reload` (re-sync des modèles actifs).
- **Backend NestJS** (`apps/backend/src/modules/ml`) : scheduler cron (retrain lundi 03:00 UTC + catch-up horaire), activation/rollback des versions, et **appel shadow** à `/infer` pendant l'analyse d'un fixture.
- **Contrat de features** : `packages/analysis-core/src/score/ml-features.ts` (`MlShadowFeatures` / `buildMlShadowFeatures`) — le vecteur échangé entre le scoring déterministe (producteur) et le worker (consommateur).
- **Segments** : `ALL` + `EV:ONE_X_TWO`, `EV:OVER_UNDER`, `EV:BTTS`, `CONF:ONE_X_TWO`, `DRAW:ONE_X_TWO`, `BTTS:BTTS`.

Flux : `model_run.features` + odds Pinnacle → dataset (1 ligne = 1 bet settlé) → correction → `ml_model_version` → chargé en mémoire → `/infer` en shadow pendant l'analyse.

---

## Inventaire de la dérive (à corriger)

### 1. Extract SQL cassé (erreur dure) — BLOQUANT
`apps/ml-worker/src/data/extract.py` :
- l.74 : `JOIN channel_selection cs` puis l.80 `AND cs.channel IN ('EV','SAFE')` et l.59 `CASE WHEN cs.channel = 'SAFE'…`.
- **La colonne `channel` n'existe plus sur `channel_selection`** — elle a été déplacée sur `channel_decision` (migration `add_channel_decisions`, 17 juin). La requête **plante** (`column cs.channel does not exist`) → **le cron d'entraînement échoue depuis ~2 semaines**.
- Fix : ajouter `JOIN channel_decision cd ON cd.id = cs."channelDecisionId"` et lire `cd.channel`.

### 2. Noms de canaux périmés
- `'EV'` → renommé **`VALUE`** ; `'CONF'` → **`DOMINANT`** ; (`SV` → `SAFE`, déjà géré partiellement). Voir mémoire "Code en anglais".
- Présent dans : `extract.py` (l.59/80), `jobs/train.py` `VALID_SEGMENTS` (l.22-30), **et côté backend** `apps/backend/src/modules/ml/ml.constants.ts` `ML_SEGMENTS`, ainsi que les `segment` déjà stockés en DB (`EV:*`, `CONF:*`).
- Décision à prendre : **renommer les segments** (`EV:*`→`VALUE:*`, `CONF:*`→`DOMINANT:*`) partout de façon cohérente, et migrer/retagger les `ml_model_version` existants (ou repartir de zéro).

### 3. Mismatch `canal` entraînement ↔ inférence
- Entraînement (`extract.py`) produit `canal ∈ {'EV','SV'}`.
- Inférence (`ml-features.ts` l.~73) envoie `canal: "VALUE"`.
- Le `OneHotEncoder(handle_unknown="ignore")` traite `"VALUE"` comme inconnu → **la feature `canal` est morte à l'inférence**. À aligner sur une seule convention.

### 4. Codes de ligue divergents (`league_tier`)
- `ml-features.ts` (TS, producteur) : `TOP5 = {PL, PD, BL1, SA, FL1}` — **codes périmés** (`PD`/`FL1`).
- `extract.py` (Python, entraînement) : `_TOP5 = {PL, SA, LL, BL1, L1}` — codes actuels.
- Conséquence : La Liga (`LL`) et Ligue 1 (`L1`) sont classées **`secondary` à l'inférence** mais **`top5` à l'entraînement** → feature incohérente. Aligner sur `LL`/`L1` des deux côtés (et revoir la liste avec l'expansion de ligues, cf `LEAGUES-EXPANSION-2026.md`).

### 5. Nouveaux canaux non couverts
- L'extract ne pull que `VALUE`/`SAFE`. Or **`DRAW` est staké** (il alimente le coupon, cf `signal-window`) et n'est **pas corrigé** — un segment `DRAW:ONE_X_TWO` existe pourtant dans la liste, incohérent avec le `WHERE`.
- Canaux ajoutés depuis (`CORRECT_SCORE`, `GOALS`) : décider s'ils entrent dans la couche de correction (a priori non — observation only — mais à trancher).

### 6. Ré-entraînement sur données recalibrées (obligatoire après fix)
- Le modèle actif a été entraîné sur des `features`/`deterministic_score`/`p_poisson_*` **d'avant** : correction mi-temps (`FIRST_HALF_GOAL_FRACTION`), λ-scale par ligue, plancher d'edge VALUE (change la population de bets). Voir [[project_value_edge_floor]] et la correction HT dans `poisson.ts`.
- Après régénération des `model_run` (script `apps/backend/src/scripts/reanalyze-scope.ts`), **ré-entraîner tous les segments** et re-mesurer Brier/calibration/ROI avant activation.

---

## Plan de traitement (ordre proposé)

1. **Débloquer l'extract** : join `channel_decision`, `cd.channel`, canaux `VALUE`/`SAFE` (+ `DRAW` si on l'inclut). Vérifier que la requête renvoie des lignes (aujourd'hui : ~815 VALUE + 268 SAFE settlés).
2. **Unifier la nomenclature de segments/canaux** partout : `extract.py`, `train.py` `VALID_SEGMENTS`, backend `ml.constants.ts` `ML_SEGMENTS`, `ml-features.ts` `canal`. Décider du sort des `ml_model_version` existants (retag vs reset).
3. **Aligner `league_tier`** (TS ↔ Python) sur les codes actuels + revue liste top5/international.
4. **Trancher le périmètre** : DRAW dans la correction ? CORRECT_SCORE/GOALS ?
5. **Ré-entraîner** sur les `model_run` régénérés, valider (Brier/calibration/ROI shadow) segment par segment.
6. **Garde-fou anti-drift** : test d'intégration qui vérifie que les `canal`/segment/`league_tier` émis par `ml-features.ts` == ceux attendus par l'extract Python (le fichier `ml-features.ts` dit vouloir "rendre la dérive impossible à manquer" — ça ne l'a pas été ; ajouter une vraie garde).

---

## À vérifier en début de chantier

- Pourquoi des `ml_model_version` datées 22/29 juin existent alors que l'extract plante depuis le 17 ? (runs en échec qui persistent quand même une version ? versions d'avant migration ? divergence code déployé ↔ repo ?) — voir `persist.py` + le scheduler backend.
- Le mode reste-t-il "shadow" ou compte-t-on **appliquer** la correction (cap ≤ 0.30 façon OpenClaw) ? Si application : c'est un changement de phase, à cadrer (cf `EVCORE.md`, backend = autorité finale).
- Env Python / build du worker : `pyproject.toml`, comment le conteneur est lancé (`main.py`), tests `apps/ml-worker/tests/`.

## Références
- Fichiers : `apps/ml-worker/src/{data/extract,models/correction,jobs/train,inference/registry,inference/server}.py`, `apps/backend/src/modules/ml/*`, `packages/analysis-core/src/score/ml-features.ts`, `apps/backend/src/modules/betting-engine/ml-shadow-features.ts`.
- Renommage des canaux : mémoire "Code en anglais".
- Recalibration ayant changé les features : `docs/data-poor-leagues-calibration.md`, mémoire [[project_value_edge_floor]].
