# ml-worker — désynchronisation post-refactor (corrigé)

Date : 2026-07-01
Statut : **Chantier de désynchronisation corrigé et ré-entraîné.** Le diagnostic ci-dessous a été traité le 2026-07-01 (voir "Ce qui a été fait"), puis un cycle d'entraînement réel a tourné le même jour (voir "Session du 2026-07-01 (suite)"). **Reste en cours pour demain** : vérifier que `ML_CORRECTION_ENABLED=true` (activé + backend redémarré, non encore confirmé par un `ModelRun` post-restart) fait bien tourner l'inférence shadow, puis décider de l'extension du rapport de promotion aux canaux non-VALUE.

Impact : le mode reste **"shadow"** pour tous les canaux (la correction ML est calculée et stockée, mais **jamais appliquée aux décisions** — voir `betting-engine.service.ts` `computeShadowMlByChannel` / `ModelRun.features.shadow_ml_by_channel`). Donc **aucun impact sur les paris live / le money**.

---

## Ce que fait le ml-worker (rappel archi)

- **`apps/ml-worker`** (Python) = 2 process dans un conteneur :
  1. **Worker BullMQ** (queue `ml-training`) : sur job `train`, extrait un dataset, entraîne un modèle de **correction de probabilité** (LogReg < 200 échantillons, sinon XGBoost calibré isotonic), persiste dans `ml_model_version` (+ `.pkl` dans `/app/models`).
  2. **Serveur FastAPI** (port 8000) : `/infer` (segment + features → proba corrigée), `/health`, `/reload` (re-sync des modèles actifs).
- **Backend NestJS** (`apps/backend/src/modules/ml`) : scheduler cron (retrain lundi 03:00 UTC + catch-up horaire), activation/rollback des versions, et **appel shadow** à `/infer` **par canal** pendant l'analyse d'un fixture (`betting-engine.service.ts` `computeShadowMlByChannel`).
- **Contrat de features** : `packages/analysis-core/src/score/ml-features.ts` (`MlShadowFeatures` / `buildMlShadowFeatures`) — le vecteur échangé entre le scoring déterministe (producteur) et le worker (consommateur). `buildMlShadowFeatures` prend désormais un `pick` générique + un `channel` (plus seulement le pick VALUE).
- **Contrat anti-drift partagé** : `packages/analysis-core/src/score/ml-shadow-contract.json` — liste canonique des `league_tier` (top5/international) et des segments d'entraînement/canaux live, vérifiée par des tests des deux côtés (TS : `ml-features.spec.ts`, `ml.constants.spec.ts` ; Python : `test_ml_shadow_contract.py`).
- **Segments d'entraînement** (`ML_SEGMENTS` / `VALID_SEGMENTS`) : `ALL`, `VALUE:ONE_X_TWO`, `VALUE:OVER_UNDER`, `VALUE:BTTS`, `VALUE:FIRST_HALF_WINNER`, `SAFE:ONE_X_TWO`, `SAFE:OVER_UNDER`, `DOMINANT:ONE_X_TWO`, `BTTS:BTTS`, `DRAW:ONE_X_TWO`, `GOALS:OVER_UNDER`. `CORRECT_SCORE` exclu (voir plus bas).
- **Canaux branchés en inférence live** (`ML_SHADOW_CHANNELS`) : `VALUE`, `DOMINANT`, `BTTS`, `DRAW`, `GOALS`. `SAFE` reste entraîné (`ML_SEGMENTS`) mais volontairement exclu de l'inférence live (décision du 2026-07-01, après revue des premiers runs).

Flux : `channel_selection` (résultat par canal, plus seulement `bet`) + odds Pinnacle → dataset (1 ligne = 1 sélection réglée) → correction → `ml_model_version` → chargé en mémoire → `/infer` en shadow, une fois par canal, pendant l'analyse.

---

## Diagnostic initial (2026-07-01) — traité

### 1. Extract SQL cassé (erreur dure) — CORRIGÉ
`apps/ml-worker/src/data/extract.py` joignait `channel_selection cs` et lisait `cs.channel` — colonne déplacée sur `channel_decision.channel` (migration `add_channel_decisions`, 17 juin 2026). La requête plantait (`column cs.channel does not exist`) → le cron d'entraînement échouait depuis ~2 semaines.

**En creusant, un problème plus profond est apparu** : même corrigé, le join partait de la table `bet`, qui **n'existe que pour VALUE et SAFE** (seuls canaux individuellement stakés — cf `channel_decision.service.ts` / `betting-engine.service.ts`). DOMINANT, BTTS, DRAW, GOALS ne créent jamais de `Bet` ; leur résultat vit uniquement sur `channel_selection.result` (settlement analytique, doc §5 de `coupon/DESIGN.md`). L'extract ne pouvait donc **structurellement pas** voir ces canaux, indépendamment du bug de join.

**Correctif appliqué** : la requête source désormais `channel_selection` directement (`JOIN channel_decision cd ON cd.id = cs."channelDecisionId"`, `JOIN model_run mr ON mr.id = cd."modelRunId"`), lit `cs.probability/odds/ev/result` au lieu de `bet.*`, et couvre `VALUE, SAFE, DOMINANT, BTTS, DRAW, GOALS` dans le `WHERE`.

### 2. Noms de canaux périmés — CORRIGÉ
`EV`→`VALUE`, `CONF`→`DOMINANT` renommés partout : `extract.py`, `train.py` `VALID_SEGMENTS`, backend `ml.constants.ts` `ML_SEGMENTS`, `reports.constants.ts`, `chat.golden.spec.ts`. Les `ml_model_version` existants (ancienne nomenclature) ont été **désactivés** plutôt que retaggés (voir §6).

### 3. Mismatch `canal` entraînement ↔ inférence — CORRIGÉ
`buildMlShadowFeatures` prenait un `valueBet: ViablePick` et codait `canal: "VALUE"` en dur, même quand un jour on voudrait corriger un autre canal. Signature généralisée : `buildMlShadowFeatures({ pick, channel, ... })` où `channel` est passé explicitement par l'appelant (un par canal désormais, cf §5).

### 4. Codes de ligue divergents (`league_tier`) — CORRIGÉ
`ml-features.ts` avait `TOP5 = {PL, PD, BL1, SA, FL1}` (codes périmés) vs `extract.py` `_TOP5 = {PL, SA, LL, BL1, L1}` (codes actuels). Aligné sur `extract.py` (source de vérité) : `{PL, SA, LL, BL1, L1}`. Un test croisé (`ml-shadow-contract.json` + tests TS/Python) empêche la régression.

### 5. Nouveaux canaux non couverts — CORRIGÉ (scope étendu)
Décision prise après lecture des volumes réels en base (paris/sélections réglés, 2026-07-01) :

| Canal          | Sélections réglées | Entraînement | Inférence live |
| -------------- | ------------------: | :-----------: | :--------------: |
| VALUE          | ~1003                | ✅            | ✅               |
| SAFE           | ~495                 | ✅            | ❌ (retiré 2026-07-01) |
| DOMINANT       | ~7225                | ✅            | ✅               |
| BTTS           | ~8693                | ✅            | ✅               |
| DRAW           | ~3340                | ✅            | ✅               |
| GOALS          | ~34654                | ✅            | ✅               |
| CORRECT_SCORE  | **1**                 | ❌ (sous le seuil de 50) | ❌            |

`CORRECT_SCORE` reste hors périmètre (marché observation-only depuis la modale correct-score, commit `63e0a0e`) — un seul settlement en base, loin du minimum de 50 (`ML_RETRAIN_MIN_NEW_BETS`). À revisiter quand le volume existera.

### 6. Ré-entraînement sur données recalibrées — FAIT (voir §"Session du 2026-07-01 (suite)")
Tous les `ml_model_version` existants (32 lignes, dont 7 actives) ont été **désactivés** en base le 2026-07-01 (`isActive = false`, note d'audit ajoutée) : ils avaient été entraînés soit sur l'extract cassé, soit avant la recalibration HT/plancher d'edge VALUE (voir [[project_value_edge_floor]]). Un nouveau cycle a été déclenché le même jour depuis `/dashboard/ml` — détail plus bas.

---

## Ce qui a été fait (2026-07-01)

1. **`apps/ml-worker/src/data/extract.py`** : source réécrite (`channel_selection`/`channel_decision`/`model_run` au lieu de `bet`/`channel_selection`), canaux `VALUE/SAFE/DOMINANT/BTTS/DRAW/GOALS`, canal lu directement depuis `cd.channel` (plus de `CASE WHEN ... THEN 'SV' ELSE 'EV'`).
2. **`apps/ml-worker/src/jobs/train.py`** : `VALID_SEGMENTS` mis à jour (11 segments, nomenclature actuelle).
3. **`apps/backend/src/modules/ml/ml.constants.ts`** : `ML_SEGMENTS` aligné, ajout de `ML_SHADOW_CHANNELS` (canaux branchés en live) et des types `MlShadowCorrection`/`ShadowMlByChannel`.
4. **`packages/analysis-core/src/score/ml-features.ts`** : `TOP5_COMPETITIONS` corrigé, `buildMlShadowFeatures` généralisé (`pick` + `channel` au lieu de `valueBet` figé sur `"VALUE"`).
5. **`apps/backend/src/modules/betting-engine/betting-engine.service.ts`** : le bloc d'inférence shadow (mono-canal, avant la création du `ModelRun`) est remplacé par `computeShadowMlByChannel`, appelé **après** la persistance des `ChannelDecision` (elles fournissent le pick rang 1 par canal), puis écrit via un `modelRun.update`. `shadow_ml_corrected_p`/`shadow_ml_edge_delta` restent peuplés depuis le résultat VALUE (compat `reports.service.ts`) ; le détail par canal est dans `features.shadow_ml_by_channel`.
6. **`apps/backend/src/modules/reports/reports.constants.ts`** + **`chat.golden.spec.ts`** : nomenclature renommée (`EV:*`→`VALUE:*`, `CONF:*`→`DOMINANT:*`).
7. **DB** : les 32 `ml_model_version` existants désactivés (`isActive = false`), note d'audit ajoutée — aucun retag, conformément à la décision "repartir de zéro" (poids entraînés sur données invalides).
8. **Garde-fou anti-drift** : `packages/analysis-core/src/score/ml-shadow-contract.json` (contrat partagé) + tests des deux côtés — `ml-features.spec.ts`, `apps/backend/src/modules/ml/ml.constants.spec.ts`, `apps/ml-worker/tests/test_ml_shadow_contract.py`.

Tests backend (`pnpm --filter backend test`) et analysis-core (`pnpm --filter @evcore/analysis-core test`) passent en entier après ces changements (632 + 54 tests). Tests Python (`apps/ml-worker`, `python -m pytest tests/`) : 62/62 passent également (venv temporaire installé pour la vérification, non commité).

---

## Session du 2026-07-01 (suite) — premier vrai cycle d'entraînement

### Retrait de SAFE de l'inférence live
Après revue des premiers runs, `SAFE` retiré de `ML_SHADOW_CHANNELS` (`apps/backend/src/modules/ml/ml.constants.ts`) — reste entraîné (`ML_SEGMENTS`) mais plus appelé à l'inférence. Contrat partagé (`ml-shadow-contract.json`) et doc mis à jour en cohérence. `computeShadowMlByChannel` lit `ML_SHADOW_CHANNELS` dynamiquement, aucun autre changement de code nécessaire.

### Entraînement réel via `/dashboard/ml`
Web avait son propre `ML_SEGMENTS` codé en dur (ancienne nomenclature, 6 segments) dans `ml-page-client.tsx` — **corrigé** en l'extrayant dans `ml-page-constants.ts`, aligné sur les 11 segments backend.

Résultats du premier cycle (extract corrigé confirmé — échantillons bien plus gros qu'avant, GOALS entraîné pour la première fois) :

| Segment | Samples | Brier | ROI simulé | Statut |
| --- | ---: | ---: | ---: | --- |
| BTTS:BTTS | 2151 | 0.241 | +11.1% | ✅ auto-activé immédiatement |
| DOMINANT:ONE_X_TWO | 4618 | 0.221 | +6.7% | ✅ activé via catch-up |
| DRAW:ONE_X_TWO | 2890 | 0.235 | +25.6% | ✅ activé via catch-up |
| GOALS:OVER_UNDER | 5932 | 0.250 | -4.1% | ✅ activé via catch-up (ROI négatif à surveiller) |
| ALL | 16445 | 0.239 | +6.3% | ✅ activé via catch-up |
| VALUE:ONE_X_TWO | 421 | 0.264 | +46.3% | trained, pas encore actif |

**Pourquoi seul BTTS s'est auto-activé tout de suite** : plusieurs jobs terminés en rafale ⇒ l'écouteur BullMQ (`ml.training-events.listener.ts`, événement `completed`) en a raté certains — comportement anticipé (cf commentaire `ML_CRON_SCHEDULES.CATCH_UP_SWITCH` dans `ml.constants.ts`). Le bouton **"Synchroniser l'auto-switch"** de `/dashboard/ml` (`catchUpAutoSwitch()`) a rattrapé les 3 segments manquants.

**Segments qui ont échoué (`training aborted`)** : `VALUE:OVER_UNDER`, `VALUE:BTTS`, `VALUE:FIRST_HALF_WINNER`, `SAFE:ONE_X_TWO`, `SAFE:OVER_UNDER`. Pas un bug — `correction.py` `_assert_class_balance` exige ≥20 WON et ≥20 LOST dans le split train (70%) *et* dans le split test (30%), après filtrage aux lignes avec cote Pinnacle correspondante (`delta_p` non nul). Diagnostic détaillé (rejoué en direct via `extract_dataset`) :

| Segment | Total réglé | Avec cote Pinnacle | Cause du blocage |
| --- | ---: | ---: | --- |
| SAFE:ONE_X_TWO | 207 | 202 (98%) | à 1 négatif près dans le split test (19 vs 20) — passera avec quelques bets de plus |
| VALUE:BTTS | 171 | 90 (53%) | split test trop petit après filtrage Pinnacle |
| VALUE:OVER_UNDER | 287 | 62 (22%) | faible couverture Pinnacle |
| VALUE:FIRST_HALF_WINNER | 59 | 30 (51%) | volume brut trop faible |
| SAFE:OVER_UNDER | 271 | 42 (15%) | faible couverture Pinnacle |

Décision : **laissé tel quel** (pas d'abaissement de `_MIN_CLASS_SAMPLES`, ce serait affaiblir le garde-fou). SAFE:ONE_X_TWO se débloquera naturellement bientôt. Les 4 autres ont un vrai problème de couverture Pinnacle sur OVER_UNDER/BTTS/FIRST_HALF_WINNER — sujet ETL séparé, pas traité ici.

### `ML_CORRECTION_ENABLED` — à vérifier demain
Le flag était à `false` (non défini) dans l'environnement du backend qui tournait — **aucune correction shadow n'était calculée**, même avec des modèles actifs. Mis à `true` dans `.env` + backend redémarré (2026-07-01 23:25). **Pas encore confirmé** : aucun `ModelRun` créé depuis le redémarrage pour vérifier que `features.shadow_ml_by_channel` se remplit. À vérifier dès la prochaine analyse (backfill ou cron ETL).

### Rapport de promotion (`reports.service.ts`) — ouvert, pas traité
Toujours limité au canal VALUE (`ReportsRepository.findSettledEvSelections` filtre `channel: VALUE`). BTTS/DOMINANT/DRAW/GOALS ont maintenant des modèles actifs et (une fois le flag confirmé) une correction shadow par canal, mais leur comparaison Brier/ROI n'est pas branchée dans ce rapport — toujours listés en `META_ONLY_SEGMENTS`. Point bloquant identifié si on l'attaque : la logique "ROI corrigé" du rapport utilise `EV_THRESHOLD` comme critère de replacement des picks, qui est spécifique à la logique de sélection VALUE et ne correspond pas à la logique des autres canaux (argmax pour DOMINANT, implied prob pour DRAW, etc.) — nécessite une vraie décision de conception avant d'étendre, pas un simple copier-coller de `compareSegment`.

## Références
- Fichiers : `apps/ml-worker/src/{data/extract,models/correction,jobs/train,inference/registry,inference/server}.py`, `apps/backend/src/modules/ml/*`, `apps/backend/src/modules/betting-engine/betting-engine.service.ts` (`computeShadowMlByChannel`), `packages/analysis-core/src/score/ml-features.ts`, `packages/analysis-core/src/score/ml-shadow-contract.json`.
- Renommage des canaux : mémoire "Code en anglais".
- Recalibration ayant changé les features : `docs/data-poor-leagues-calibration.md`, mémoire [[project_value_edge_floor]].
