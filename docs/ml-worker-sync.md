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

| Canal         | Sélections réglées |       Entraînement       |     Inférence live     |
| ------------- | -----------------: | :----------------------: | :--------------------: |
| VALUE         |              ~1003 |            ✅            |           ✅           |
| SAFE          |               ~495 |            ✅            | ❌ (retiré 2026-07-01) |
| DOMINANT      |              ~7225 |            ✅            |           ✅           |
| BTTS          |              ~8693 |            ✅            |           ✅           |
| DRAW          |              ~3340 |            ✅            |           ✅           |
| GOALS         |             ~34654 |            ✅            |           ✅           |
| CORRECT_SCORE |              **1** | ❌ (sous le seuil de 50) |           ❌           |

`CORRECT_SCORE` reste hors périmètre (marché observation-only depuis la modale correct-score, commit `63e0a0e`) — un seul settlement en base, loin du minimum de 50 (`ML_RETRAIN_MIN_NEW_BETS`). À revisiter quand le volume existera.

### 5bis. CLEAN_SHEET / TEAM_TOTAL / WIN_EITHER_HALF ajoutés — 2026-07-24

Le tableau ci-dessus (§5) est daté du 2026-07-01, avant que ces 3 canaux
n'existent. Revérifié en direct le 2026-07-24 :

| Canal           |               Sélections réglées |  Cote Pinnacle/Bet365   | Entraînement | Inférence live |
| --------------- | -------------------------------: | :---------------------: | :----------: | :------------: |
| CLEAN_SHEET     |                        171 / 122 |  ✅ Bet365 uniquement   |      ✅      |       ✅       |
| TEAM_TOTAL      |                        219 / 122 | ✅ Pinnacle (3346/3040) |      ✅      |       ✅       |
| WIN_EITHER_HALF |                              238 |  ✅ Bet365 uniquement   |      ✅      |       ✅       |
| CORRECT_SCORE   | 1365 (427 fixtures dédupliquées) |   ✅ Pinnacle (9974)    | ❌ non fait  |       ❌       |

Le doc affirmait "aucune cote historique n'existe" pour ces marchés — c'était
vrai début juillet mais plus le 07-24 (la sync PREMATCH a élargi sa
couverture entretemps). `TEAM_TOTAL` a une vraie couverture Pinnacle ;
`CLEAN_SHEET`/`WIN_EITHER_HALF` n'en ont **aucune**, uniquement Bet365 —
décision utilisateur (2026-07-24) : élargir la source de dévigage de
`extract.py` à `Pinnacle OR Bet365` (Pinnacle préféré quand les deux
existent) plutôt que d'attendre une couverture Pinnacle qui n'arrivera peut-être
jamais pour ces marchés.

Changements (`apps/ml-worker/src/data/extract.py`) :

- `_ODDS_LATERAL_SQL` : remplace les colonnes nommées fixes
  (`homeOdds`/`yesOdds`/`overOdds`/...) par un objet JSON générique
  `{pick: odds}` par (fixture, marché) — nécessaire car `TEAM_TOTAL` a des
  picks arbitraires par ligne (`OVER_1_5`, `UNDER_2_5`, ...), pas juste
  HOME/DRAW/AWAY/YES/NO/OVER/UNDER. Source `bookmaker IN ('Pinnacle',
'Bet365')`, priorité à Pinnacle via `ORDER BY (bookmaker = 'Pinnacle')
DESC`.
- `_devig_pinnacle`/`_pinnacle_prob_for_pick`/`_target_odds` remplacés par
  `_complement_picks(market, pick)` (quelles issues concurrentes dévig
  contre) + `_devig_pick(market, pick, picks_odds)` (générique, marche pour
  n'importe quel marché à 2/3 issues connu).
- `_extract_poisson` devient sensible au marché (`market` en paramètre) —
  lit `cleanSheetHome/Away`, `winEitherHalfHome/Away`,
  `teamTotalHome/Away[pick]` selon le cas, au lieu de toujours chercher
  home/draw/away/bttsYes/over25.
- `CORRECT_SCORE` toujours exclu — dévigger un marché à ~50 issues (une par
  score) est un problème différent des marchés à 2/3 issues gérés ici, pas
  une extension triviale du même code.

#### Plan pour CORRECT_SCORE — prochaine session

Bonne nouvelle découverte en faisant §5bis : la généralisation de
`_ODDS_LATERAL_SQL` en JSON générique `{pick: odds}` (au lieu de colonnes
nommées) capture **déjà** tout le tableau de cotes CORRECT_SCORE d'un match
(toutes les scorelines cotées, ex. `{"0:0": 8.5, "1:0": 6.0, "2:1": 9.0, ...}`)
sans rien changer côté SQL — le plombage lourd est fait. Volume confirmé
07-24 : 1365 lignes réglées / 427 fixtures dédupliquées, 9974 lignes de cote
Pinnacle — largement au-dessus du plancher de 50 (`ML_RETRAIN_MIN_NEW_BETS`).

Reste précisément à faire (2 points, pas plus) :

1. **Dévigage multi-issues** (`extract.py`) — `_complement_picks` retourne
   une liste FIXE par marché (`["HOME","DRAW","AWAY"]` etc.), ce qui ne
   marche pas pour CORRECT_SCORE : le groupe à dévigger contre n'est pas une
   liste connue à l'avance, c'est **toutes les clés présentes dans
   `picks_odds` pour cette ligne** (le tableau de cotes réellement observé
   pour ce match précis, variable d'un match à l'autre). Ajouter un cas
   spécial dans `_devig_pick` : si `market == "CORRECT_SCORE"`, dévigger le
   pick cible contre `list(picks_odds.values())` (toutes les scorelines
   cotées de ce match), pas contre `_complement_picks`.
2. **Feature Poisson manquante** (`_extract_poisson` + backend) —
   `features.probabilities` sur `ModelRun` ne contient **pas** la matrice de
   score exact aujourd'hui : `computeCorrectScoreMatrix` est calculée à la
   volée dans `correct-score.strategy.ts` au moment de la décision, jamais
   persistée. Sans backend change, `p_poisson_pick` resterait `null` pour
   CORRECT_SCORE (dégradé mais pas bloquant — `correction.py` tolère déjà
   des features manquantes via l'imputer médian ; à évaluer si ça vaut le
   coup d'ajouter la persistance complète de la matrice avant d'entraîner,
   ou si dégrader ce champ pour ce canal suffit pour une première passe).

Une fois ces deux points traités : ajouter `CORRECT_SCORE:CORRECT_SCORE` à
`ML_SEGMENTS`/`ML_SHADOW_CHANNELS` (backend), `VALID_SEGMENTS` (train.py),
`ml-shadow-contract.json`, et `SHADOW_CAPTURED_SEGMENTS`
(reports.constants.ts) — même mécanique que CLEAN_SHEET/TEAM_TOTAL/
WIN_EITHER_HALF ci-dessus, `computeShadowMlByChannel` n'a besoin d'aucun
changement (déjà générique par canal).

`ML_SEGMENTS`/`ML_SHADOW_CHANNELS` (backend), `VALID_SEGMENTS` (Python),
`ml-shadow-contract.json` (contrat partagé) mis à jour en cohérence — les 3
sont vérifiés identiques par `ml.constants.spec.ts`/`test_ml_shadow_contract.py`.
`reports.constants.ts` (`SHADOW_CAPTURED_SEGMENTS`) étendu aussi : ces 3
canaux ont maintenant une vraie comparaison Brier dans le rapport de
promotion (`GET /reports/ml-promotion`), pas juste `META_ONLY`.

**`computeShadowMlByChannel` (betting-engine.service.ts) n'a nécessité
aucun changement** — il itère déjà `ML_SHADOW_CHANNELS` génériquement (pick
rang 1 du canal, quel que soit le marché), et `buildMlShadowFeatures`
(ml-features.ts) n'a aucune branche spécifique à un marché. L'ajout de ces
3 canaux n'a donc touché que l'extraction (entraînement offline) — le
chemin d'inférence live était déjà prêt.

### 5ter. Incident prod "Entraînement échoué" (§5bis a cassé TOUS les canaux) — CORRIGÉ 2026-07-24

Le rewrite §5bis (`_ODDS_LATERAL_SQL` en JSON générique `{pick: odds}`) a
cassé l'entraînement en production le jour même, pas seulement pour les 3
nouveaux canaux — **pour tous**, y compris VALUE/DOMINANT/DRAW/SAFE.

**Cause** : `jsonb_object_agg(pick, odds)` lève une erreur Postgres dure
("null value not allowed for object key") dès qu'il agrège une ligne où
`pick IS NULL`. Or **100% des lignes Pinnacle/Bet365 du marché ONE_X_TWO**
(64928/64928, vérifié en direct) ont `pick IS NULL` — le prix 1X2 vit dans
les colonnes dédiées `homeOdds`/`drawOdds`/`awayOdds`, jamais dans
`pick`/`odds`. `ONE_X_TWO` étant partagé par VALUE/DOMINANT/DRAW/SAFE,
n'importe quel entraînement sur n'importe quel canal déclenchait ce crash.

**Bug masquant** (a fait perdre du temps de diagnostic) : `worker.py`
loggait l'exception via `logger.exception("job failed", extra={"name":
job.name})` — `extra={"name": ...}` entre en collision avec l'attribut
interne `name` de `LogRecord` (le nom du logger lui-même), donc ce log
plante à son tour avec `KeyError: "Attempt to overwrite 'name' in
LogRecord"`. C'est CE message qui remontait en prod, pas l'erreur réelle
(`jsonb_object_agg`) — corrigé en renommant la clé en `job_name`.

**Correctifs** (`apps/ml-worker/src/data/extract.py`) :

- `jsonb_object_agg(pick, odds) FILTER (WHERE pick IS NOT NULL)` — ne
  crashe plus.
- `MAX("homeOdds")`/`MAX("drawOdds")`/`MAX("awayOdds")` récupérés en
  parallèle dans la même lateral join, fusionnés dans le même dict
  `picks_odds` (clés `HOME`/`DRAW`/`AWAY`) côté Python — restaure le devig
  Pinnacle pour ONE_X_TWO/FIRST_HALF_WINNER sans réintroduire un cas
  spécial par marché dans `_devig_pick`.

**Vérifié en direct** (conteneurs relancés par l'utilisateur) : `extract_dataset`

- `correction.train()` de bout en bout sur `DOMINANT:ONE_X_TWO` (5643
  lignes Pinnacle, Brier 0.207), `CLEAN_SHEET:CLEAN_SHEET_HOME` (169, Brier
  0.312), `TEAM_TOTAL:TEAM_TOTAL_HOME` (211, Brier 0.181),
  `WIN_EITHER_HALF:TO_WIN_EITHER_HALF` (228, Brier 0.219) — tous OK.

**Leçon** : les tests unitaires sur `_build_row`/`_devig_pick` n'ont pas
attrapé ce bug — ils passent un `picks_odds` déjà construit en Python, ils
ne testent jamais le SQL lui-même. Un bug purement SQL (comportement
d'agrégat sur une valeur NULL) ne peut être attrapé que par une exécution
réelle contre la DB. Test de non-régression ajouté
(`test_one_x_two_reads_price_from_dedicated_columns_not_picks_odds`) qui
verrouille au moins le contrat Python (fusion des colonnes dédiées dans
`picks_odds`), mais ne remplace pas une vérification contre la DB réelle
avant de livrer un changement touchant `_ODDS_LATERAL_SQL`.

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

| Segment            | Samples | Brier | ROI simulé | Statut                                            |
| ------------------ | ------: | ----: | ---------: | ------------------------------------------------- |
| BTTS:BTTS          |    2151 | 0.241 |     +11.1% | ✅ auto-activé immédiatement                      |
| DOMINANT:ONE_X_TWO |    4618 | 0.221 |      +6.7% | ✅ activé via catch-up                            |
| DRAW:ONE_X_TWO     |    2890 | 0.235 |     +25.6% | ✅ activé via catch-up                            |
| GOALS:OVER_UNDER   |    5932 | 0.250 |      -4.1% | ✅ activé via catch-up (ROI négatif à surveiller) |
| ALL                |   16445 | 0.239 |      +6.3% | ✅ activé via catch-up                            |
| VALUE:ONE_X_TWO    |     421 | 0.264 |     +46.3% | trained, pas encore actif                         |

**Pourquoi seul BTTS s'est auto-activé tout de suite** : plusieurs jobs terminés en rafale ⇒ l'écouteur BullMQ (`ml.training-events.listener.ts`, événement `completed`) en a raté certains — comportement anticipé (cf commentaire `ML_CRON_SCHEDULES.CATCH_UP_SWITCH` dans `ml.constants.ts`). Le bouton **"Synchroniser l'auto-switch"** de `/dashboard/ml` (`catchUpAutoSwitch()`) a rattrapé les 3 segments manquants.

**Segments qui ont échoué (`training aborted`)** : `VALUE:OVER_UNDER`, `VALUE:BTTS`, `VALUE:FIRST_HALF_WINNER`, `SAFE:ONE_X_TWO`, `SAFE:OVER_UNDER`. Pas un bug — `correction.py` `_assert_class_balance` exige ≥20 WON et ≥20 LOST dans le split train (70%) _et_ dans le split test (30%), après filtrage aux lignes avec cote Pinnacle correspondante (`delta_p` non nul). Diagnostic détaillé (rejoué en direct via `extract_dataset`) :

| Segment                 | Total réglé | Avec cote Pinnacle | Cause du blocage                                                                    |
| ----------------------- | ----------: | -----------------: | ----------------------------------------------------------------------------------- |
| SAFE:ONE_X_TWO          |         207 |          202 (98%) | à 1 négatif près dans le split test (19 vs 20) — passera avec quelques bets de plus |
| VALUE:BTTS              |         171 |           90 (53%) | split test trop petit après filtrage Pinnacle                                       |
| VALUE:OVER_UNDER        |         287 |           62 (22%) | faible couverture Pinnacle                                                          |
| VALUE:FIRST_HALF_WINNER |          59 |           30 (51%) | volume brut trop faible                                                             |
| SAFE:OVER_UNDER         |         271 |           42 (15%) | faible couverture Pinnacle                                                          |

Décision : **laissé tel quel** (pas d'abaissement de `_MIN_CLASS_SAMPLES`, ce serait affaiblir le garde-fou). SAFE:ONE_X_TWO se débloquera naturellement bientôt. Les 4 autres ont un vrai problème de couverture Pinnacle sur OVER_UNDER/BTTS/FIRST_HALF_WINNER — sujet ETL séparé, pas traité ici.

### `ML_CORRECTION_ENABLED` — à vérifier demain

Le flag était à `false` (non défini) dans l'environnement du backend qui tournait — **aucune correction shadow n'était calculée**, même avec des modèles actifs. Mis à `true` dans `.env` + backend redémarré (2026-07-01 23:25). **Pas encore confirmé** : aucun `ModelRun` créé depuis le redémarrage pour vérifier que `features.shadow_ml_by_channel` se remplit. À vérifier dès la prochaine analyse (backfill ou cron ETL).

### Rapport de promotion (`reports.service.ts`) — ouvert, pas traité

Toujours limité au canal VALUE (`ReportsRepository.findSettledEvSelections` filtre `channel: VALUE`). BTTS/DOMINANT/DRAW/GOALS ont maintenant des modèles actifs et (une fois le flag confirmé) une correction shadow par canal, mais leur comparaison Brier/ROI n'est pas branchée dans ce rapport — toujours listés en `META_ONLY_SEGMENTS`. Point bloquant identifié si on l'attaque : la logique "ROI corrigé" du rapport utilise `EV_THRESHOLD` comme critère de replacement des picks, qui est spécifique à la logique de sélection VALUE et ne correspond pas à la logique des autres canaux (argmax pour DOMINANT, implied prob pour DRAW, etc.) — nécessite une vraie décision de conception avant d'étendre, pas un simple copier-coller de `compareSegment`.

## Références

- Fichiers : `apps/ml-worker/src/{data/extract,models/correction,jobs/train,inference/registry,inference/server}.py`, `apps/backend/src/modules/ml/*`, `apps/backend/src/modules/betting-engine/betting-engine.service.ts` (`computeShadowMlByChannel`), `packages/analysis-core/src/score/ml-features.ts`, `packages/analysis-core/src/score/ml-shadow-contract.json`.
- Renommage des canaux : mémoire "Code en anglais".
- Recalibration ayant changé les features : `docs/data-poor-leagues-calibration.md`, mémoire [[project_value_edge_floor]].
