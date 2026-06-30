# EVCore — Plan d'exécution : Architecture des canaux de stratégie

> Référence : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md) · [ROADMAP.md](ROADMAP.md)
> Plan ML archivé : [docs/phase3-ml-todo.md](docs/phase3-ml-todo.md)
>
> **Principe directeur** : un canal = une **stratégie de sélection**, pas un marché.
> Un socle probabiliste commun, plusieurs stratégies indépendantes qui l'interprètent.
> Le backend reste l'autorité — l'invariant `selection.market ∈ channel.allowedMarkets`
> est vérifié à la persistance, jamais côté client.
>
> **Méthode** : bascule unique et propre (pas de double écriture ni de coexistence
> durable de vocabulaire), legacy supprimé **uniquement après gate de parité vert**.
> Aucun nouveau canal n'est activé sans backtest séparé par ligue/marché/saison.

---

## Statut

- `[ ]` À faire
- `[x]` Terminé
- `[~]` En cours
- `[-]` Abandonné / hors périmètre v1

---

## ▶ Reprise (prochaine session) — 2026-06-25 : **CALIBRATION MODÈLE PAR LIGUE (profondeur)**

**Prochain sujet : recalibrer le modèle probabiliste ligue par ligue, en
profondeur.** Base de départ : [model-calibration.json](model-calibration.json)
(fenêtre 1 an 2025-06-24 → 2026-06-23, seuils Brier ≤ 0.65 / calibError ≤ 0.05 /
minSample 100). Sur 48 ligues : **28 PASS · 12 FAIL · 8 INSUFFICIENT_DATA**.

**Cibles prioritaires (FAIL — modèle mal calibré, n suffisant) :**
`POL1` (Brier 0.697) · `UECL` (0.664, n=388) · `F2` (0.661) · `POL2` (0.658) ·
`MLS` (0.653, calibErr OK mais Brier > seuil) · `KOR1` · `SRB1` · `UEL` ·
`WCQE` · `FIN1` · `WCQAF` · `FRI`.

**INSUFFICIENT_DATA (pas un pb de calibration — manque de volume)** : `WCQCA`,
`WCQAS`, `WC`, `ISL1`, `WCQSA`, `LAT1`, `EST1`, `UNL` → accumuler des données,
ne pas recalibrer à vide.

**Pourquoi ça compte** : l'insight structurel prouvé (session 2026-06-23) est que
le modèle n'a **aucun edge directionnel sur les marchés résultat** (Brier modèle
0.633 > marché 0.595). Tant que la calibration par ligue ne s'améliore pas, les
canaux orientés résultat (DOMINANT) restent fragiles et plusieurs ligues
resteront non-activables. C'est le **prérequis modèle** avant de rouvrir ces
canaux. Surveiller aussi les PASS limites (Brier ~0.65 : `J1`, `I2`, `CH`,
`SWE2`, `D2`, `SP2`) qui peuvent basculer FAIL d'une saison à l'autre.

### Session 2026-06-24 — récap

**UX mobile `/dashboard/decisions` — FAIT** : header fixture dédié mobile (équipes
empilées, plus de troncature `G…`), ligne « Par canal » qui stack sur mobile
(noms + badge plus écrasés), wording « N **autres** canaux évalués », barre
résumé + toggle déplacés dans un **2ᵉ header épinglé** (hors scroll) sur les deux
lentilles (filtres match / onglets canal contrôlés), suppression du filtre canal
redondant en vue Par match, `DataNav` full-width < lg (décisions + combinés),
`DaySummary` full-width mobile, bannière WC2026 retirée. web typecheck/lint ✅.

**Tuning seuils canaux — FAIT** : `tuning.json` (1 an) appliqué à
`channel-strategy.config.ts` avec garde-fou **50 bets** (validation manuelle) :
**7 ENABLE · 12 RETUNE · 4 DISABLE**, 50 écartés (n < 50 / overfit). backend
typecheck/lint ✅. Effet au prochain run moteur.

**GOALS — élargi lignes 1.5/3.5/4.5 en OBSERVATION (FAIT)** : décision = on
**abandonne le backfill historique** (le worker `odds-historical-import` n'importe
que la ligne 2.5 ; densifier 1.5/3.5/4.5 demanderait `alternate_totals` par-event
the-odds-api + crédits, et reste clairsemé sur les ligues mineures). On s'appuie
sur les **cotes PREMATCH** (API-Football, qui collecte déjà les 4 lignes) et on
**observe au fil de l'eau**. `GOALS_CONFIG` ré-écrit **contextuel ligue par ligue**
(38 ligues cotées prematch) : côté par **profil de buts réel** de la ligue (OVER si
taux Over de la ligne ≥ 0.55, UNDER si ≤ 0.45, les deux en bande 0.45–0.55), seuil
= **taux de base − 0.05** (gate de conviction aligné ligue ; l'**EV prematch**
tranche entre lignes), uniquement lignes avec couverture cotes ≥ 80. Toujours
**observation seule** (jamais staké — pas dans `getTodayPool`). Généré depuis la DB
(taux de buts × couverture). backend typecheck/lint ✅ ; specs GOALS/orchestrateur/
channel-decision mises à jour (fixtures complétées sur l'échelle OU + assertion
GOALS BL1 → SELECTED Under 3.5).

> ⚠️ Pour voir l'effet : purge + rebuild (les décisions GOALS en base datent de
> l'ancienne config) puis date ≤ 2026-06-15. Promotion staking seulement si le ROI
> forward confirme un edge cross-saison (+ ajout au pool de mise).
> ⚠️ **Dette pré-existante non liée** : 9 tests backend rouges depuis le commit de
> tuning 2026-06-24 (3bbb99f) — assertions périmées dans `channel-strategy.config.spec`
> (DOMINANT/DRAW/BTTS) + boundary btts/dominant/draw. À recâbler séparément.

### Session 2026-06-23 — récap

**Canaux (Étape 7 close avec données/modèle actuels) :**

- **Activés** : CONSENSUS (accord 1X2, validé 3/3 saisons) · AVOID (divergence
  extrême, **enforced** dans le pool de mise) · GOALS (**observation**, décision
  produit — PAS un edge validé) · BTTS NO (observation).
- **Écartés (preuves read-only)** : CONTRARIAN · UNDERDOG · FAVORITE · FIRST_HALF.
  → **Insight structurel prouvé** : le modèle n'a aucun edge directionnel sur les
  marchés résultat — Brier modèle 0.633 > marché 0.595. Ne plus tenter de canal
  « battre le marché sur le résultat » sans amélioration majeure du modèle.
- **Data-bloqués** : MARKET_MOVE (historique cotes), LIVE_VALUE (pipeline live).

**Front décisions — FAIT :** refonte UX (carte pick-first, bandeau AVOID, badge
CONSENSUS, résumé jour, tri conviction, filtres canal) + consolidation en **1
route** `/dashboard/decisions` (toggle en-page, view dans l'URL) + suppression de
la route backend morte `GET /channel-decisions`. web + backend
typecheck/lint/610 tests ✅. **Mobile non audité.**

**Données — à régénérer pour tout voir :**

- Décisions en base = ancien rebuild → **CONSENSUS/AVOID absents**, GOALS =
  SA UNDER seulement (dates SA, ex. 2025-05-18). Purge + rebuild pour peupler les
  nouveaux canaux ; consulter une date ≤ 2026-06-15 (rien après).
- **Coupons = 0** : générés par le pipeline **live** (`betting-engine-analysis`
  enchaîne `generate-coupons`), PAS par le rebuild historique (volontaire). Pour
  en voir : `POST /coupons/generate?date=` sur une date avec bets (ex. 2026-05-30).

---

## Historique reprise — 2026-06-22

### ✅ Re-wipe + rebuild — FAIT & VÉRIFIÉ (2026-06-21)

Dataset reconstruit **sain** via `POST /etl/rebuild/betting-engine` (worker
idempotent `modelRuns: { none: {} }`). Vérifs base :

- **1.00 run/fixture** (11 218 `model_run` / 11 218 fixtures) → plus de duplication.
- Cotes natives bien attachées : `VALUE` 323/323, `SAFE` 208/208, `DOMINANT`
  1938 (1323 cotées), `BTTS` 2095 (979 cotées), `DRAW` 610 (0 EV = conforme).
  Les deux problèmes du diagnostic 2026-06-20 sont résolus.

Worker durci au passage : isolation d'erreur par fixture (`Promise.allSettled`),
batching (`ETL_REBUILD_CONCURRENCY`, défaut 4), log de progression. Pool pg
configurable (`DATABASE_POOL_MAX`) pour ne pas asphyxier l'API pendant un rebuild.

> Reste optionnel : trancher le **scope cotes** (le rebuild traite toutes les
> fixtures FINISHED sans `ModelRun`, pas seulement celles avec `OddsSnapshot`).

### ✅ Unification du vocabulaire des canaux — FAIT (2026-06-21)

Un seul vocab partout : **`VALUE · SAFE · DOMINANT · BTTS · DRAW`** (le canal `EV`
était ambigu : `ev` est une métrique sur toutes les sélections). Migration enum
Prisma `ALTER TYPE "StrategyChannel" RENAME VALUE 'EV' TO 'VALUE'`.

- [x] Supprimé : chain legacy `investment-backtest`, module orphelin `summary`.
- [x] `SV→SAFE`, `CONF→DOMINANT` (bet-slip, bankroll, dashboard).
- [x] `EV→VALUE` backend (enum + refs + `ValueStrategy` + coupon + ml-shadow).
- [x] Frontend aligné + libellés i18n (« Value / Valeur »).
- [x] backend typecheck/lint/553 tests ✅ ; web typecheck/lint ✅.

### ▶ À faire demain (dans l'ordre)

- [x] **Étape 1 — EV au cœur du coupon** (2026-06-21) : `legEV` sur `ScoredPick`
      (`calculateEV(calibratedProbability, oddsSnapshot)`), `FALLBACK_ODDS` supprimé
      (jambes sans cote réelle exclues de `compose`), `couponEV =
calculateEV(jointProbability, combinedOdds)` calculé/filtré (`minCouponEV`
      0.05) et tri value-driven (`compareCouponsByEV` : EV ↓, proba jointe, legs ↑).
      `couponEV`/`legEV` tracés dans `reasoning`/`featureSnapshot`. backend
      typecheck/lint/556 tests ✅. Détail :
      [coupon/DESIGN.md](apps/backend/src/modules/coupon/DESIGN.md) § Étape 1.
- [x] **`chat` — repensé** (2026-06-22) : vocab unifié + tools de perf rebranchés. - **Vocab** : un seul enum canonique `VALUE/SAFE/DOMINANT/BTTS/DRAW` dans
      les schémas LLM (param `channel` unique, fini les deux enums
      `[EV,SV,BB,NUL,CONF]` / `[EV,SV,CONF,DRAW,BTTS]`), le prompt système
      (`CANAUX …`, `CHAT_PROMPT_VERSION` → `eva-v7`), la sortie EVA et le
      front (`domains/chat` type `Channel`, `CHANNEL_STYLE/LABEL`). La clé de
      sortie des picks renommée `canal` → `channel` (backend `ChatStreamPick` + front `ChatPick` + picks persistés ; anciens messages non migrés,
      perte assumée des badges). Helpers legacy
      `channelToPrisma/canalToStrategyChannel/strategyChannelToCanal` supprimés. - **Bug corrigé** : les filtres `canal` du pick-engine comparaient `'EV'`
      à `pick.canal === 'VALUE'` (jamais un match) — désormais alignés. - **Rebranchement** : `getChannelPerformance/getLeaguePerformance/
getSegmentPerformance/getPredictionOutcomes/getEdgeAnalysis/
findChannelLeagueHitRate` lisent `channel_selection` (helper
      `settledChannelRows`) pour **les 5 canaux** au lieu de `Bet` (EV/SV
      seulement) — DOMINANT/DRAW/BTTS renvoyaient toujours vide. - backend typecheck/lint/571 tests ✅ · web typecheck/lint ✅.
- [x] **Dette front séparée** (2026-06-21) : `domains/ai-engine` → `domains/coupon` + imports ; chemins API périmés corrigés (`/ai-engine/coupons` → `/coupons`,
      `/ai-engine/investment-indices` → `/coupons/indices`) ; page+domaine
      `investment-summary` morts supprimés (route orpheline, aucun lien nav).
      web typecheck/lint ✅.
- [x] **Cosmétique vocab — FAIT (2026-06-22)** : - `pnl-by-canal` : clés du contrat `ev/sv` → `value/safe` (backend
      `PnlByCanalResponse` + service, front use-case + `canal-cards` +
      `overview-section`, i18n `canalEv/canalSv` → `canalValue/canalSafe`). - Tokens CSS `--canal-ev/-sv/-conf(-soft)` (+ mappings `--color-canal-*`
      et classes Tailwind `*-canal-ev/sv/conf`) → `--canal-value/-safe/-dominant`. - `investment-indices*` → `coupon-indices*` dans `domains/coupon` + types
      `InvestmentIndices*` → `CouponIndices*`, hook `useCouponIndices`, et le
      composant `coupon-indices-drawer` (`CouponIndicesDrawer`). - backend typecheck/lint/571 tests ✅ · web typecheck/lint ✅.
- [x] **Slugs de formation en anglais (2026-06-22)** : les slugs d'articles
      « canal » (persistés en base dans `user_content_progress`, pas des badge
      codes comme noté à tort) passés au format `<name>-channel` :
      `canal-ev→value-channel`, `canal-sv→safe-channel`,
      `canal-confiance→dominant-channel`, `canal-draw→draw-channel`,
      `canal-btts→btts-channel`, `les-3-canaux→the-3-channels`. Fichiers +
      frontmatter + tous les `related[]`/refs inline + `FORMATION_GRADUATE_ARTICLES`.
      Migration de données `20260622120000_rename_formation_canal_slugs` (UPDATE
      `user_content_progress.slug`) **à appliquer par toi** (CLI) — préserve la
      progression utilisateur. > Reste ouvert : les **tokens CSS** `--canal-value/-safe/-dominant/-draw/-btts` > gardent le préfixe FR `canal`. À basculer en `--channel-*` si on veut > éliminer « canal » des identifiants de code aussi (surface large : ~12 > fichiers + `canal-badge`/`CANAL_*`).

---

Étapes 0-5 terminées et commitées. La vue `/dashboard/decisions` est la surface
principale ; les surfaces legacy `/dashboard/investment` et `/dashboard/picks`
ont été supprimées.
L'engine écrit les `ChannelDecision` / `ChannelSelection` et ne recrée plus les
`Prediction` ni le flag legacy `Bet.isSafeValue`. Les lectures runtime EV/SAFE
passent par `Bet.channelSelection → ChannelDecision.channel`. La config
historique `prediction.constants` a été renommée/déplacée en config de
stratégies (`betting-engine/strategies/channel-strategy.config.ts`) avec le
vocabulaire `DOMINANT` / `DRAW` / `BTTS`. `ModelRun.decision` a aussi été retiré
du schéma cible et des consommateurs runtime ; les surfaces legacy affichent un
pick EV à partir de la présence d'un `Bet.channelSelection` matérialisé.

Étapes 0-6 terminées. Module `ai-engine/` supprimé, remplacé par `coupon/` avec
`StrategyChannel` natif. Route `/coupons`. Typecheck ✅ lint ✅.

### Refactor `BettingEngineService` — TERMINÉ (2026-06-21)

God class décomposée (3402 → 1424 lignes, −58 %), **behavior-preserving** (aucun
calcul modifié), validée par un golden de caractérisation byte-identique à chaque
étape. Collaborateurs extraits :

- [x] `pricing/odds-snapshot.loader.ts` — data-access cotes (`@Injectable`)
- [x] `selection/pick-evaluation.ts` — moteur EV/SAFE (fonctions pures)
- [x] `settlement/bet-settlement.service.ts` — settlement paris (`@Injectable`)
- [x] `selection/pick-validation.ts`, `math/probability.ts`,
      `pricing/odds-mapping.ts`, `ml-shadow-features.ts`
- [x] Façade publique inchangée (consommateurs intacts) ; duplications
      `buildBetPickKey`/`isHalfTimeFullTimePick`/`MatchProbabilities` éliminées.
- [x] `betting-engine.golden.spec.ts` ajouté (filet de non-régression).

### Fil calibration / signal coupon — TERMINÉ (juin 2026)

Détail complet : [apps/backend/src/modules/coupon/DESIGN.md](apps/backend/src/modules/coupon/DESIGN.md).

- [x] **Bug bloquant** `computeSignalWindow` : `cs.channel` → `cd.channel` (la
      colonne est sur `channel_decision`) — la calibration de fenêtre plantait et
      n'avait jamais tourné.
- [x] **B3** — calibration de jambe principiée : blend 50/50 remplacé par
      `clamp(pModel − meanError[market])` (`calibrateLegProbability`), `meanError`
      depuis `CalibrationService` via `SignalWindow.marketCalibration`.
- [x] **B6** — calibration des 5 canaux (filtre `EV/SAFE` retiré ; canal sans
      échantillon → prior `CANAL_BASE_WEIGHT`).
- [x] **B-TEMP** — biais temporel corrigé : sémantique as-of (`computeSignalWindow(_, asOf)`,
      `CalibrationService({ asOf })`, borne `fixture.scheduledAt < asOf`). Défaut
      `now` → live inchangé.
- [x] **B-ODDS** — BTTS/DOMINANT attachent cote + EV (`priceForSelection`,
      `strategies/selection-odds.ts`) ; principe « tout canal attache son prix »
      gravé sur `StrategySelection`. Exception : DRAW (signal = proba implicite).
- [x] **Backfill** historique `channel_selection.odds/ev` :
      `scripts/backfill-selection-odds.ts` (dev-only, lancé — 6841 lignes pricées).
- [x] **B-ROI** mesuré : EV +11.5%, DRAW +9.9%, SAFE +3.7%, BTTS +1.0%,
      DOMINANT −2.1% (EV anti-prédictive). Décision : DOMINANT/BTTS restent
      **prédiction** (suivi via `channel_selection`), pas de mise. DRAW = candidat staking.

### Couche coupon — Étapes 1–6 + B7 FAITES & VÉRIFIÉES (2026-06-21)

Étapes 1 (EV au cœur), 2 (overround/proba fair), 4 (profils de risque), 5 (staking
Kelly), 6 (combos même-match, derrière `COUPON_COMBOS_ENABLED`) et B7 (deux pools
documentés — réel staking-eligible EV/SAFE vs virtuel prédiction) **faites**.
Migration `20260621230000_coupon_leg_combo` appliquée + client Prisma régénéré.

- [x] **Vue ROI roulante par canal × EV-bin** (outil de promotion) : `GET
/coupons/roi` (`CouponRoiService`) — ROI mise plate par canal × bin d'EV
      depuis `channel_selection` settlé (tous canaux), flag `promote` (ROI>0 &
      échantillon ≥ `MIN_BET_COUNT`).
- [x] **Unification active — staker DRAW** : DRAW entre dans le pool réel via
      `channel_selection` (`getTodayPool({ includeDraw })`), flag
      `COUPON_STAKE_DRAW` (défaut **on** — backtesté +9.9%, kill-switch env).

backend typecheck/lint/581 tests ✅.

### ✅ Redesign backtest par canal (remplacement direct, TERMINÉ 2026-06-22)

Le `backtest.service.ts` legacy (3109 l) est un fourre-tout : 5 canaux → 3 chemins
(marketPerformance EV, `predictionBacktests` DOMINANT/DRAW/BTTS, `safe-value` SAFE),
moteur ré-implémenté inline, `PredictionChannel` divorcé de `StrategyChannel`.
Cible : **1 harnais paramétrique par canal**, **lecture DB** (pas de moteur inline),
calibration modèle **séparée**.

- [x] **Étage 1** (2026-06-21) : nouveau harnais — `BacktestRepository` (lit
      `channel_selection` + `model_run.features`), `ChannelBacktestService`
      (`POST /backtest/channels` : ROI/ROI×EV-bin/hit/drawdown/calibration/verdict
      par canal×ligue), `ModelCalibrationService` (`POST /backtest/calibration` :
      Brier/ECE par ligue, channel-agnostic), métriques pures. Legacy intact.
      backend typecheck/lint/584 tests ✅.
- [x] **Étage 2** (2026-06-22) : brique **tuning** + bascule du front. - Backend : `POST /backtest/tuning` (`ChannelTuningService`) sweepe les
      seuils `DOMINANT/DRAW/BTTS` **hors-ligne** depuis `model_run.features` +
      cotes (`findChannelTuningRows`, lit la DB, ne ré-exécute pas le moteur) ;
      recommande un seuil par ligue×canal (ROI/hit/coverage + verdict PASS).
      **Consultatif** : aucune auto-application (`CHANNEL_STRATEGY_CONFIG`
      édité à la main). `tuning.metrics.ts` pur + spec, `tuning.constants.ts`
      (grilles + règles de promotion). backend typecheck/lint/589 tests ✅. - Front : page `performance` **allégée** — `OverviewSection` (P&L par
      canal) conservée + nouvelle `ChannelAnalysisSection` à 3 onglets
      (Backtest canaux `/backtest/channels`, Tuning seuils `/backtest/tuning`,
      Calibration modèle `/backtest/calibration`). Supprimés : onglets legacy
      EV/SV + sections `weights-timeline`/`competition-stats`/`calibration`
      live, use-cases `run-backtest`/`run-safe-value-backtest`. web
      typecheck/lint ✅ (2 warnings `<img>` préexistants). - Reste : `grid-search` legacy (sweep EV `evFloor`/`modelScore` qui
      ré-exécute le moteur) **non migré** — il vit avec le reste du legacy et
      tombe en Étage 3.
- [x] **Étage 3** (2026-06-22) : legacy supprimé. `backtest.service.ts`
      (god class 3109 l) + `backtest.service.spec.ts` + `grid-search.service.ts`
      droppés ; routes legacy retirées du contrôleur (`POST /backtest`,
      `/:competitionCode`, `/:competitionCode/:seasonName`, `/safe-value`,
      `/grid-search/:code`) — restent **uniquement** `/backtest/channels`,
      `/backtest/tuning`, `/backtest/calibration`. `backtest.report.ts` réduit
      aux helpers purs survivants (`getOneXTwoOutcome`, `brierScoreOneXTwo`,
      `calibrationError` + types 1X2/calibration) ; types legacy
      (`PredictionChannel`, `*BacktestReport`, `*PredictionBacktest*`,
      `BacktestMarketPerformance`…) supprimés. `backtest.module` ne fournit plus
      que les 4 collaborateurs canaux (plus de `BettingEngineModule` ni d'export
      `BacktestService`). backend typecheck/lint/571 tests ✅.

**Étape 7 — nouveaux canaux** : chacun nécessite backtest séparé avant activation.
Candidats : `GOALS` (probabilités déjà là), `BTTS_NO`, `CONSENSUS`, `AVOID`,
`UNDERDOG/FAVORITE`, `MARKET_MOVE`, `FIRST_HALF`, `LIVE_VALUE`.

État courant : Prisma validate ✅ · `@evcore/db build` ✅ · backend
typecheck/lint/553 tests ✅ · web typecheck/lint ✅ (2 warnings `<img>` préexistants).
Dataset reconstruit sain (cf. § Reprise).

---

## Étape 0 — Cadrage & gel du design

- [x] Valider le schéma Prisma cible `ChannelDecision` / `ChannelSelection` (doc §4.3)
- [x] Figer l'enum `StrategyChannel` **v1 = canaux réels uniquement** : `EV`, `SAFE`,
      `DOMINANT`, `BTTS`, `DRAW` (+ `GOALS` si prêt). Ne **pas** figer les canaux
      spéculatifs (`UNDERDOG`, `CONSENSUS`, `AVOID`…) — `ADD VALUE` plus tard, par canal
- [x] Acter le grain `ModelRun` = une exécution immuable, `Fixture → ModelRun` 1-à-N (doc §8.1)
- [x] Geler le mapping legacy → cible : `PredictionChannel.CONF → DOMINANT`,
      `PredictionChannel.DRAW → DRAW`, `PredictionChannel.BTTS → BTTS`,
      `CouponLegCanal.NUL → DRAW`, `CouponLegCanal.BB → BTTS`, `CouponLegCanal.SV → SAFE`,
      `isSafeValue=true → SAFE`, `ModelRun.decision → ChannelDecision(EV)`
- [x] **[multi-sport]** Figer `enum SportType { FOOTBALL }` (extensible : `TENNIS`,
      `BASKETBALL` — ajoutés quand le second socle existe). Décision : `sport` vit sur
      `Competition`, pas sur `Fixture` ni `ChannelSelection` (dérivable via la relation)

---

## Étape 1 — Contrat & registre de stratégies (backend, derrière les tables cibles)

- [x] `StrategyContext`, `StrategyDecision`, interface `ChannelStrategy` + `allowedMarkets` (doc §5)
- [x] **[multi-sport]** Ajouter `sport: SportType` dans `StrategyContext` (injecté depuis
      `Competition.sport` via `Fixture`). Ajouter `allowedSports?: readonly SportType[]`
      sur `ChannelStrategy` — stratégies sans ce champ = tous sports
- [x] Extraire les règles actuelles dans des stratégies dédiées : `EV`, `SAFE`,
      `DOMINANT` (ex-`CONF`), `BTTS`, `DRAW` — une stratégie par fichier
- [x] Orchestrateur betting engine : `strategies.map(evaluate)` → `saveRunDecisions`,
      phase 1 (primaires) puis phase 2 (méta) explicites
- [x] Conserver les calculs probabilistes actuels **à l'identique** (Poisson, lambdas, probas)
- [x] Tests unitaires par stratégie : **sélection ET rejet** + invariant `allowedMarkets`
      (une sélection hors périmètre fait échouer le run, pas d'écriture)

---

## Étape 2 — Schéma cible (migration Prisma)

- [x] Enums `StrategyChannel`, `ChannelDecisionStatus`
- [x] **[multi-sport]** Enum `SportType { FOOTBALL }` + champ `sport SportType @default(FOOTBALL)`
      sur `Competition` — migration backward-compatible, toutes les compétitions existantes
      héritent de `FOOTBALL`. `ChannelDecision`/`ChannelSelection` n'ont pas de champ `sport`
      direct : le sport se dérive via `ModelRun → Fixture → Competition`
- [x] Tables `channel_decision`, `channel_selection` (`@@unique([modelRunId, channel])`,
      `@@unique([channelDecisionId, rank])`, index settlement `[market, result, createdAt]`)
- [x] `ChannelDecision.configVersion` (audit config/seuils, doc §2.4/§4.3)
- [x] `Bet.channelSelectionId` (FK nullable)
- [x] Valeurs `Decimal` partout (probas/cotes/EV/score) — jamais `number` natif
- [x] **Toi** : migration `add_channel_decisions_and_sport` appliquée sur la DB + client régénéré
      (`@evcore/db` dist expose `SAFE`/`DRAW` ✅, backend typechecke)

---

## Étape 3 — Backfill / rebuild historique (après cleanup legacy)

> **Décision** : le backfill historique passe par l'**ETL** (worker `betting-engine-analysis`
> qui ré-exécute l'engine branché sur une fenêtre de dates → écrit `ChannelDecision` /
> `ChannelSelection` nativement, + lien `Bet.channelSelectionId`). Les scripts standalone
> `backfill-channel-decisions.{ts,lib}` et leur e2e ont été **supprimés** (commit de l'Étape 5).
>
> **Rôle clarifié** : `ml-backfill` est conservé comme worker de rebuild analytique
> post-purge. Son nom vient de l'historique ML, mais son rôle actuel est de
> ré-exécuter le betting engine sur les fixtures terminées sans `ModelRun`, afin
> de recréer des runs normaux et leurs décisions de canaux. Pas de chemin
> parallèle ni de flag `isBackfill`.

- [x] Production native des décisions par l'engine (EV/SAFE + DOMINANT/DRAW/BTTS), lien `Bet`
- [x] Idempotence garantie par `@@unique([modelRunId, channel])` (un re-run = un nouveau `ModelRun`)
- [x] Migrer les jambes de coupon `CouponLegCanal → StrategyChannel` :
      schema cible prêt (`CouponProposalLeg.canal StrategyChannel`) + mapping du
      pipeline investissement actuel vers le modèle cible (`EV→EV`, `SV→SAFE`,
      `BB→BTTS`, `NUL→DRAW`, `CONF→DOMINANT`). Les coupons existants seront purgés,
      donc la migration n'a pas besoin de préserver les lignes historiques.
      La migration SQL reste à générer/appliquer par toi.
- [x] Remplacer le pipeline coupon legacy par un vrai service coupon branché sur
      `ChannelDecision` / `ChannelSelection` : source des legs, scoring, odds
      combinées, settlement et DTO doivent utiliser `StrategyChannel` nativement
      (plus de dépendance aux anciens pipelines `/investment` / `/picks`).
      Module `ai-engine/` → `coupon/`, canaux migrés nativement, mapper supprimé,
      route `/coupons`, worker renommé. Typecheck ✅ lint ✅.
- [x] **[destructif]** Ajouter une commande explicite de purge des données d'analyse
      historiques avant rebuild : `BetSlipItem` / `BetSlip` /
      `BankrollTransaction` liées, `CouponProposalLeg` / `CouponProposal`, `Bet`,
      `Prediction`, `ChannelSelection`, `ChannelDecision`, puis `ModelRun`.
      Commande : `pnpm --filter @evcore/db db:purge:analysis -- --confirm=PURGE_ANALYSIS_DATA`.
      Exécutée en local : 42 242 `ModelRun`, 15 185 `Prediction`, 2 338 `Bet`,
      125 `ChannelDecision`, 21 `ChannelSelection`, 98 coupons, 153 slips et
      403 transactions liées supprimés. Ne jamais lancer implicitement dans un seed.
- [x] **[ETL]** Utiliser `ml-backfill` comme rebuild historique post-cleanup :
      fixtures terminées sans `ModelRun` → `analyzeFixture` →
      nouveau `ModelRun` normal → `ChannelDecision` / `ChannelSelection` →
      settlement analytique via le chemin existant
- [ ] **[optionnel]** Exposer un backfill par fenêtre seulement si le rebuild par saisons
      via `ml-backfill` ne suffit pas

---

## Étape 4 — Vérification post-cleanup / post-rebuild

> Les scripts standalone `verify-channel-backfill.{ts,lib}` et leur e2e ont été **supprimés**
> (le backfill ne passe plus par un script). La parité legacy↔canaux avant le DROP (Étape 6)
> reste à câbler — via une requête/job ETL plutôt qu'un CLI dédié.

- [x] **[vérifié]** Vérification post-rebuild : aucun code runtime ne query
      `prisma.client.prediction`, `isSafeValue` ni `ModelRun.decision`.
      Les occurrences de "Prediction" restantes sont des types locaux du module
      backtest (alias pour `'DOMINANT' | 'DRAW' | 'BTTS'`), sans lien avec la
      table droppée. Comptage `ChannelDecision` / `ChannelSelection` settlées
      par canal accessible via le backtest service et query DB directe.

---

## Étape 5 — Bascule des consommateurs (même release)

> **Préparation faite** (derrière les tables cibles, non branchée sur le flux live) :
> registre `strategies/registry.ts` (`V1_STRATEGIES` + `createChannelStrategyOrchestrator`),
> persistance `ChannelDecisionRepository.saveRunDecisions` (doc §5), test d'orchestration
> multi-canal (`channel-strategy.orchestrator.spec.ts`) + e2e repo (`channel-decision-repository.e2e-spec.ts`).
> Reste la **bascule** ci-dessous : brancher l'engine + construire `StrategyContext` depuis le calcul existant, puis retirer le legacy.

- [x] **[différé d'Étape 1]** Ajouter `phase: ADVANCE | PRE_KICKOFF | LIVE`
      dans `StrategyContext` + sur `ModelRun` (doc §5/§8.1) — fonde
      `NOT_APPLICABLE` et les canaux `LIVE_VALUE`/`FIRST_HALF`.
      Le flux actuel dérive `ADVANCE` avant le jour du match, `PRE_KICKOFF`
      le jour du match avant coup d'envoi, et `LIVE` pour l'in-play.
- [x] Engine écrit `ChannelDecision` / `ChannelSelection` — **branché** : `StrategyContext`
      construit depuis l'analyse (`strategy-context.builder.ts`) + routé via `ChannelDecisionService`
      (`betting-engine.module` enregistre repo + service, injection `@Optional()`).
      `Bet.channelSelectionId` relié (EV/SAFE flux principal, EV en FRI) via `findChannelSelectionId`.
      Écriture additive legacy `Prediction` / `Bet.isSafeValue` retirée en Étape 6.
- [x] Settlement analytique sur `ChannelSelection.result` ; `Bet.status` reste l'autorité financière —
      résolveurs purs `channel-selection-settlement.ts` (mirroir exact des bets : `resolve*BetStatus`),
      `ChannelDecisionService.settleFixtureSelections({ mode: early|final })`, câblé dans
      `settleEarlyBets` (early, irrévocable) et `settleOpenBets` (final, re-règle tout — VAR).
      Idempotent → pas de double-comptage financier
- [x] API : DTO normalisés `channel` / `status` / `selections` ; exposer `REJECTED` +
      `reasonCode` ; filtres par stratégie / marché / phase — **fait** : `GET /channel-decisions`
      (`ChannelDecisionController` + `ChannelDecisionListQueryDto`), `ChannelDecisionService.list`
      → `findByDate` (jointure `modelRun→fixture→competition`), filtres date/competition/channel/market/status,
      REJECTED + reasonCode exposés. DTO enrichi présentation : `homeTeam`/`awayTeam`/`homeLogo`/`awayLogo`,
      `country`, `score`/`htScore`, `phase`.
- [x] Frontend : **un seul** type aligné sur `StrategyChannel`, mapping canal → clé i18n,
      tokens couleur remappés ; vue run **multi-canal** (plus de `BET`/`NO_BET`) ;
      suppression de la reconstruction `isSafeValue` / `Prediction` côté client
      — **fait** : nouvelle page `/dashboard/decisions` (route parallèle) consommant
      `GET /channel-decisions` via `domains/channel-decision`, deux lentilles
      _Par match_ (grille multi-canal + rejets/reasonCode en tooltip) / _Par canal_ (tabs),
      remap `StrategyChannel → --canal-*`, cartes alignées sur `pick-card`
      (`FixtureHeading` : logos + pays·ligue + score, bordures `border-border/70` + accent),
      liens **Investissement/Sélections** retirés de la nav (sidebar + mobile) — pages
      legacy `/dashboard/investment` + `/dashboard/picks` supprimées,
      i18n complet des libellés canaux/codes de rejet.
- [x] Rapports / exports ML lisent la nouvelle représentation (un objet par `run × channel × selection`) :
      `reports/ml-promotion` agrège les `ChannelSelection` settlées du canal `EV`
      au lieu des `Bet` legacy `isSafeValue=false`.

---

## Étape 6 — Suppression du legacy (migration finale, après gate vert)

- [x] Retirer les writes legacy `Prediction` / `Bet.isSafeValue` du flux engine
- [x] Convertir `CouponProposalLeg.canal` : `CouponLegCanal → StrategyChannel`
      (`EV→EV`, `SV→SAFE`, `BB→BTTS`, `NUL→DRAW`, `CONF→DOMINANT`) avant de droper l'enum
- [x] Retirer `ModelRun.isBackfill` du schéma et des consommateurs (`chat`, extract ML,
      `ml-backfill`) : une analyse reconstruite par le même engine est un `ModelRun`
      normal, pas une catégorie fonctionnelle séparée
- [x] Retirer le module runtime `Prediction` et le modèle Prisma `Prediction` /
      `PredictionChannel` du schéma cible. Les seuils conservés vivent désormais
      dans `channel-strategy.config.ts` (`DOMINANT`, `DRAW`, `BTTS`) et les
      consommateurs runtime ne dépendent plus de `modules/prediction`.
      Migration SQL à générer/appliquer par toi.
- [x] Retirer `Bet.isSafeValue` du schéma cible et des consommateurs runtime :
      dashboard, fixture scoring, chat/EVA, summary, bankroll, bet slips,
      investment legacy et extract ML lisent désormais le canal via
      `Bet.channelSelection → ChannelDecision.channel`. Migration SQL à
      régénérer/appliquer par toi.
- [x] Mettre à jour ou supprimer les scripts diagnostics ad hoc qui lisent encore
      `prediction` / `isSafeValue` (`packages/db/scripts/*`, `scripts/*.mjs`,
      `apps/backend/scripts/backtest-data-audit.ts`) : les rapports lisent
      désormais `ChannelDecision` / `ChannelSelection` et mappent
      `SAFE→SV`, `DOMINANT→CONF`, `BTTS→BB`, `DRAW→NUL` pour conserver les
      libellés historiques de sortie.
- [x] `DROP TABLE prediction` ; `DROP TYPE PredictionChannel`, `CouponLegCanal`
      — migration `20260618005222_remove_legacy` contient le drop de la table
      `prediction`, du type `PredictionChannel` et du type SQL
      `coupon_leg_canal`.
- [x] Retirer `ModelRun.decision` du schéma cible et des consommateurs runtime :
      engine, dashboard, fixture scoring, audit, chat, bet slips, tests et UI web.
      Les scripts diagnostics ad hoc restent à recâbler dans l'item dédié.
  > Rollback : pas de migration `down` attendue pour cette bascule destructive.
  > En cas de problème, la stratégie réaliste est restore backup avant migration,
  > pas reconstruction des données legacy droppées.

---

## Étape 7 — Nouveaux canaux (phasé — backtest AVANT activation)

> Checklist par canal (doc §11) : hypothèse → `allowedMarkets` → critères `SELECTED` /
> codes de rejet → seuils par ligue → implémentation → tests → **backtest séparé** →
> shadow/observation → activation par segment validé → settlement + métriques → API/front.

- [~] `BTTS` côté `NO` — **OBSERVATION (2026-06-23)**. Calibration séparée du côté
  YES : seuil **global** `BTTS_NO_CONFIG` (volume par ligue trop fin), distinct du
  YES par-ligue. `BttsStrategy` évalue désormais les deux côtés et émet le plus
  confiant ; marché contraint à `BTTS`. **Feasibility 3 saisons (read-only)** :
  P(NO) ≥ 0.65 = **borderline** — +13.8% agrégé mais porté par 2024-25
  (−5%/n10 en 2023-24, +19.4%/n132 en 2024-25, +5.9%/n68 en 2025-26 ; comptage
  instable). **PAS staking-grade** (la barre CONSENSUS = positif 3/3 saisons).
  → activé en **observation seulement** (BTTS n'est jamais staké ; sélection NO
  enregistrée + settlée analytiquement) pour accumuler des données forward.
  10 tests (YES rétrocompat + NO). backend typecheck/lint/609 tests ✅. > Promotion staking seulement si le signal NO se confirme sur saisons futures.
  - **PER-LEAGUE (2026-06-30)** : `BTTS_NO_CONFIG` passé de seuil global → **map par
    championnat** + `getBttsNoConfig(code)` (default disabled). **Outillage d'abord** :
    `/backtest/tuning` produit désormais `bttsNoReports` par ligue (miroir exact du
    YES : `probBttsNo`/`oddsBttsNo` au repo, `buildBttsNoSweep`, grille + règle de
    promotion NO dédiées, DTO). **Verdict calibration** : aucun edge cross-saison
    (sweep par saison → I2 1 seule saison, L1/SA basculent FAIL en 2024-25 ; la
    P(NO) du modèle n'a **aucun lift** sur le taux de base de la ligue → à volume,
    hit ≈ base rate). Le +22%/+16% du 1-an = variance 2025-26. **Décision produit
    (Option 2 pragmatique)** : sélection **structurelle, pas ROI** — éligible =
    base no-BTTS ≥ 0.46 (NO co-viable) ET volume ≥ 15/an ; seuil 0.58 (défensives
    base ≥ 0.50) / 0.55 (quasi-équilibrées). 7 ligues activées en observation :
    **SA·BRA1·FRI @0.58, EL1·CH·EL2·LL @0.55**. Toujours jamais staké. analysis-core
    rebuild + backend typecheck/lint/617 tests ✅. > Le vrai blocage = le modèle
    (P(NO) compressée) ; rouvrir le NO staking seulement après recalibration ligue.
    Re-run l'endpoint chaque saison.
- [~] `GOALS` (`OVER_UNDER`) — **canal prioritaire** (probabilités déjà émises).
  Plan figé 2026-06-22 (archi). **Spécificité** : pas un mono-signal comme
  BTTS/DRAW — c'est une **échelle de 8 picks** (Over/Under × {1.5, 2.5, 3.5, 4.5}),
  chaque (ligne × côté) sur une **échelle de proba différente** (P(Over1.5)≈0.85
  vs P(Over4.5)≈0.10). Décisions d'archi : 1. **Unité de calibration = (ligue × ligne × côté)**, pas la ligue seule. Un
  seuil unique par ligue n'a aucun sens (trivial sur 1.5, impossible sur 4.5). 2. **Promotion jugée sur le ROI** (+ coverage + sample), pas le hit-rate (comme
  DRAW) — Over 1.5 a un hit-rate trivial mais ROI souvent négatif après marge. 3. **Une seule sélection par fixture** (lignes emboîtées = double-comptage
  sinon) : évaluer toutes les (ligne×côté) activées, émettre la **meilleure
  par EV** (`prob × cote − 1`) en rank 1. Value-driven.
  Déjà en place (à ne PAS reconstruire) : échelle `over15…under45` sur
  `MatchProbabilities` (Poisson xG, persistée `model_run.features.probabilities`),
  `Market.OVER_UNDER` + 8 picks mappés odds↔proba (`odds-mapping.ts`) et settlés,
  pattern stratégie + config par ligue, harnais tuning offline consultatif.
  Étapes : - [x] **Pas 0 (read-only, 2026-06-22)** : calibration de l'échelle over/under
  mesurée sur 11 059 fixtures settlées. **Modèle déjà bien calibré** :
  global pred↔réel ≤1.6pp partout (O1.5 .760/.770, O2.5 .525/.541,
  O3.5 .309/.313, O4.5 .157/.152). Écarts par ligue petits et surtout
  **négatifs** (modèle sous-prédit légèrement les Overs → biais favorable
  aux picks Over). Sous-prédicteurs nets = candidats Over : NOR2 −8.8pp,
  SUI2 −8.6pp, MLS −7.9pp, TUR1 −7.7pp, SUI1 −6.7pp. **Décision :
  Dixon-Coles NON requis** (la crainte Poisson-indépendant ne se
  matérialise pas). Le tri des segments gagnants se fera sur le **ROI
  avec cotes**, pas sur le Brier → dépend de l'étape repo ci-dessous. - [x] Enum `StrategyChannel.GOALS` — **déjà présent** schéma + DB + client
  généré (aucune migration nécessaire). - [x] **Pas 0bis — densité des cotes (read-only, 2026-06-22)** : seule la
  ligne **2.5 est cotée à ~100%** (OVER/UNDER : 18 377 fixtures). 1.5 et 3.5
  ≈ 1 681 fixtures (~15%), 4.5 ≈ 697 (~6%) — toutes ligues confondues.
  **Le ROI n'est tunable que sur la 2.5 aujourd'hui.** → **Scope révisé :
  livrer GOALS sur la 2.5 d'abord** (calibration + couverture prêtes), garder
  le schéma config générique sur la ligne pour activer 1.5/3.5/4.5 sans
  refonte une fois les cotes collectées. - [ ] **[ETL] Densifier les cotes `OVER_UNDER` 1.5/3.5/4.5** — prérequis dur à
  l'activation de ces lignes. Tant que non fait, elles restent désactivées
  par design (pas par oubli). Démarrer GOALS sans bloquer là-dessus. - [x] **Pas 0ter — sweep ROI 2.5 par ligue (read-only, 2026-06-22)** : signal
  réel et substantiel. Candidats PASS (ROI ≥ +5%, mise plate, meilleur seuil
  in-sample) — **OVER** : BL1 (.50, +14%), POR (.50, +21%), L1 (.55, +18%),
  MLS (.50, +15%), SP2 (.60, +12.5%), EL1 (.60, +12%), CH (.50, +12%) ;
  **UNDER** : SA (.55, +28%), TUR1 (.55, +10%). SA UNDER cohérent (ligue
  basse). ⚠️ **Seuils choisis in-sample = risque overfit** → liste =
  CANDIDATS, pas config finale. Validation **par saison** obligatoire dans
  le `ChannelTuningService` étendu avant activation (cf. méthodo des
  commentaires datés de la config existante). - [x] Config GOALS (2026-06-22) : sous-forme `GoalsLeagueConfig { lines:
    [{ line, side, enabled, threshold, minSampleN }] }` + `GOALS_CONFIG` +
  `getGoalsLineConfigs`. Candidats du sweep seedés **tous `enabled: false`**
  (en attente validation par saison). - [x] `goals.strategy.ts` (2026-06-22) : fonction pure `decideGoals(context,
    lineConfigs)` (testable hors config prod) + classe `GoalsStrategy`. Gate
  par ligne → ranking value-first (EV ↓, puis proba pour sélections sans
  cote) → 1 sélection rank 1. Enregistrée `registry.ts` (6e primaire).
  10 tests + orchestrateur à jour. backend typecheck/lint/581 tests ✅. - [x] **Tuning étendu (2026-06-22)** : `BacktestRepository` lit `over25/under25`
  (`readSignalProbabilities`) + charge les cotes `OVER_UNDER` OVER/UNDER
  (`latestOverUnderOdds`) → `ChannelTuningRow` enrichi (probOver25/Under25 +
  oddsOver25/Under25). `tuning.metrics` : `buildGoalsLineSweep(side, rows)`
  (signal = proba côté, won = total vs ligne, ROI mise plate) + helpers
  partagés `sweepGrid`/`recommendFrom`. `tuning.constants` : grille GOALS +
  `GOALS_PROMOTION_RULE` ROI-driven (minSample 20, roiFloor +5%, pas de
  hit-rate floor). `ChannelTuningService` émet `goalsReports[]` (DTO
  `GoalsTuningReport`). **v1 = ligne 2.5 OVER/UNDER** (les autres lignes
  attendent la densité de cotes ETL). 4 tests metrics. typecheck/lint/584 ✅. - [x] **Settlement vérifié (2026-06-22)** : `channel-selection-settlement`
  délègue OVER_UNDER à `resolvePickBetStatus` — les 8 picks (OVER_1_5→
  UNDER_4_5) sont couverts (même résolveur que le pipeline EV/SAFE). Aucun
  code settlement à ajouter. - [x] **Calibration + activation (2026-06-22)** : ⚠️ **les `model_run`
  n'existent QUE pour 2025-26** (10 166 runs ; 107/160/785 pour les autres
  saisons) → validation multi-saisons **impossible** avec les données
  actuelles. Validation faite via **holdout intra-saison** (`/backtest/tuning`
  sur H1 → ROI mesuré sur H2 non-vu). Verdict décisif : - **POR OVER** (+53%→−15%), **CH OVER** (+28%→−5%), **TUR1 UNDER**
  (+36%→−24%) : forts in-sample, **s'effondrent** hors-échantillon → overfit. - **BL1/L1/MLS/SP2/EL1 OVER** : aucun seuil PASS sur la demi-saison →
  non concluant. - **SA UNDER** : +29% train → **+21% holdout** (n=91, hit 64.8%), ROI
  positif sur toute la courbe de seuils. **Seul segment robuste**
  (Serie A structurellement basse). → **SA UNDER 2.5 @ 0.50 activé**
  (full +23.3%/n125, holdout +21%/n91). Tous les autres restent
  désactivés. backend typecheck/lint/584 tests ✅. - [x] **[ETL] Rebuild des saisons historiques FAIT (2026-06-23)** : 3 saisons
  pleines (2023-24: 11 873, 2024-25: 12 768, 2025-26: 12 312). Validation
  multi-saisons désormais possible. - [x] **Validation multi-saisons → AUCUNE activation (2026-06-23)** : ROI par
  saison au seuil de chaque candidat. **Verdict : aucun segment ne tient.** - 2025-26 est favorable sur **quasi toutes** les ligues, alors que le
  taux Over 2.5 **réel** est plat (.524/.531/.541) → l'edge n'est pas un
  vrai décalage de buts, c'est un **artefact spécifique à 2025-26**. - **SA UNDER @0.50** : −5.6% / −6.4% / +23.2% → **échoue** (le holdout
  intra-saison qui l'avait activé était DANS la saison anormale). Désactivé. - **POR OVER** : 3/3 positif à 0.50 (+19.6/+1.7/+21.1) mais **instable**
  (à 0.45 : −3.7/+12.9/+4.2) → pas de seuil stable = bruit. - BL1/L1/MLS/SP2/EL1/CH OVER, TUR1 UNDER : positifs **uniquement** en
  2025-26. Tous désactivés. backend typecheck/lint/584 tests ✅. > Caveat « vieilles données dégradées » → **ÉCARTÉ (2026-06-23)** via > `/backtest/calibration` : la calibration 1X2 du modèle est plate sur les > 3 saisons (Brier .631/.631/.625, ECE .040/.040/.036 ; SA .612/.598/.616). > Les saisons reconstruites ne sont PAS plus bruitées → l'edge 2025-26 > n'est pas du « ROI ancien sous-estimé ». Calibration plate + taux de buts > plat + ROI positif seulement en 2025-26 ⇒ variance liée aux cotes de > cette saison, pas un signal durable. **GOALS 2.5 = pas d'edge cross-saison.** > Outillage (canal + tuning) en place : ré-évaluer si le modèle s'améliore > ou si d'autres lignes (1.5/3.5) gagnent des cotes. - [~] **GOALS ACTIVÉ EN OBSERVATION (2026-06-23, décision produit)** : malgré
  le verdict ci-dessus (pas d'edge cross-saison), les segments candidats
  (BL1/POR/L1/MLS/SP2/EL1/CH OVER + SA/TUR1 UNDER) sont passés
  `enabled: true`. **Pas un edge validé** : GOALS n'est PAS dans le pool de
  mise (seuls EV/SAFE/DRAW stakent) → un segment activé émet une sélection
  **enregistrée + settlée analytiquement, jamais misée** = observation +
  visibilité dashboard, zéro exposition. Promotion staking uniquement si un
  vrai edge cross-saison émerge (+ ajout au pool `getTodayPool`).
  backend typecheck/lint/610 tests ✅. > ⚠️ Les décisions GOALS en base datent du rebuild d'hier (SA UNDER alors > activé) ; pour refléter cette nouvelle config, **régénérer** (purge + > rebuild) puis consulter une date ≤ 2026-06-15. - [x] **Front** — **FAIT (2026-06-24)**. - Onglet **Tuning** consomme `goalsReports` : `ChannelTuningResponse`
  front complété (`goalsReports` + types `GoalsTuningReport`/
  `GoalsTuningSide` qui manquaient), 2ᵉ table GOALS dans `tuning-tab.tsx`
  (ligue · ligne±côté · seuil actuel/reco · ROI reco · échantillon),
  `current` nullable géré, i18n `colSegment`/`goalsSection` (fr+en). - Affichage canal GOALS dans `/dashboard/decisions` **vérifié** : tout
  câblé (couleur/label/ordre `channel-constants`, tokens CSS `--canal-goals`,
  i18n `channels.GOALS` fr+en, `formatPickForDisplay` gère les 8 lignes OU,
  GOALS = canal primaire affiché dans les 2 lentilles). Aucun changement
  nécessaire. web typecheck/lint ✅. > Note : `goalsReports`/décisions GOALS = ligne 2.5 OVER/UNDER tant que > les cotes alt-lines prematch ne se sont pas accumulées (forward) ; rien > en base tant qu'un run n'a pas tourné avec la config actuelle (purge + > rebuild pour l'historique). > **Amélioration modèle séparée (channel-agnostic)** : Poisson actuel = > indépendant → sous-estime les scores faibles (0-0, 1-1) → biaise Under 1.5/2.5. > Correction **Dixon-Coles** (paramètre ρ) améliore surtout correct-score + > over/under. À traiter APRÈS le Pas 0 si les lignes basses sont mal calibrées > (bénéficie aussi à BTTS/1X2). Ne pas mélanger avec le travail canal.
- [x] `CONSENSUS` (méta) — **FAIT & ACTIVÉ (2026-06-23)**. Méta-stratégie (phase 2
      de l'orchestrateur) : lit les décisions primaires (`previousDecisions`) et émet
      une sélection 1X2 quand ≥ `minLevel` **classes d'indépendance distinctes**
      s'accordent sur le même pick (classes : directional=DOMINANT, value=VALUE/SAFE,
      market_draw=DRAW, goals=BTTS/GOALS — 2 stratégies de même classe = 1 vote).
      **Calibré globalement** (mécanisme agnostique à la ligue, volume par ligue trop
      faible). **Validé read-only sur `channel_selection` (3 saisons)** : 1X2 niveau-2
      vs baseline niveau-1 → 2023-24 +7.6%(n80) / 2024-25 +18.7%(n129) / 2025-26
      +9.3%(n63), **positif les 3 saisons** alors que la baseline niveau-1 est
      **perdante** partout (−5.5/−10.7/−9.8). v1 = `ONE_X_TWO` (BTTS/OU niveau-2 trop
      rares). `consensus.strategy.ts` (`decideConsensus` pur + classe), enregistré
      registry (phase 2), `CONSENSUS_CONFIG` (enabled, minLevel 2). 10 tests +
      service spec. backend typecheck/lint/594 tests ✅. > Suite : dédup coupon (CONSENSUS HOME == le même pari que DOMINANT/VALUE HOME) > à gérer côté couche coupon si on stake CONSENSUS. Front : afficher le canal.
- [x] `AVOID` (méta) — **FAIT & ACTIVÉ (2026-06-23)**. Décision négative (aucun
      pick) : flague un match à ne pas publier. Des triggers de la doc, **un seul
      existe dans nos données** : la **divergence extrême modèle↔marché**. Les autres
      sont des non-events (aucune fixture n'a HOME&AWAY contradictoires ; `lambdaFloorHit`
      false partout) ou déjà gérés (cotes absentes → NO_BET).
      **Validé read-only (3 saisons)** : quand le modèle revendique un edge ≥ 0.30 sur
      le marché (proba − 1/cote), c'est le **marché** qui a raison — ROI par bucket
      d'edge : [20,30%) +10.9% mais **≥30% −20.4%** (hit 28%). Par saison ≥30% est
      négatif/plat ET pire que le reste à chaque fois (−34.2/−22.5/−0.7 vs +6.8/+3.1/+1.2).
      `avoid.strategy.ts` (`decideAvoid` pur + classe, `allowedMarkets: []`), émet
      SELECTED+offenders (ou REJECTED `no_avoid_signal`). `AVOID_CONFIG` (enabled,
      maxEdge 0.30), global. Enregistré registry (phase 2). 8 tests + service spec
      (8 décisions). Persistance OK (le repo gère les décisions sans sélection).
      backend typecheck/lint/602 tests ✅. > Suite : un **consommateur** doit honorer le blocage AVOID (couche > publication/coupon supprime les picks du match flaggé) — AVOID ne fait > qu'enregistrer la décision pour l'instant.
- [-] `CONTRARIAN` (méta) — **ÉCARTÉ (2026-06-23), pas d'edge**. Étude read-only
  3 saisons : parier le favori du modèle quand il diffère du favori marché =
  **−10.1% ROI** (hit 27%, n=6512) ; les favoris que le modèle juge « survalués
  ≥10pp » gagnent quand même **63.2% vs 64.2% implicite** (≈ aucune info). Le
  marché est efficient sur les favoris. **Insight système** : le modèle ajoute
  de la valeur en _accord_ (CONSENSUS ✅) ou en flaggant sa propre démesure
  (AVOID ✅), **pas en s'opposant au marché**. Non implémenté (reste dans
  `META_STRATEGY_CHANNELS` pour mémoire). Ré-évaluer seulement si le modèle gagne
  une vraie capacité à battre le marché (calibration nettement améliorée).
- [-] `UNDERDOG` — **ÉCARTÉ (2026-06-23), perdant net**. Feasibility 3 saisons :
  outsiders (cote ≥ 3, edge modèle > 0) → **−13.1% / −9.8% / −13.6%** sur ~7000
  picks/saison. Le modèle est systématiquement sur-confiant sur les longshots
  (même travers que la divergence extrême d'AVOID). Pas d'observation : c'est mort.
- [-] `FAVORITE` — **ÉCARTÉ (2026-06-23), pas d'edge robuste**. Favoris (cote ≤ 1.6,
  edge > 0) → −4.3% / −5.9% / **+10.2%** : positif seulement en 2025-26 (artefact,
  comme GOALS). Redondant avec VALUE/DOMINANT par ailleurs (doc §risque). Non
  implémenté.
- [-] `FIRST_HALF` — **ÉCARTÉ pour l'instant (2026-06-23), non robuste**. Vainqueur
  mi-temps (argmax `firstHalfWinner`, marché `FIRST_HALF_WINNER` bien coté) :
  seuil ≥0.50 → +14.4% / **−6.4%** / +4.5% (positif 2/3 mais 2024-25 nettement
  négatif) ; ≥0.45 négatif partout. OU-HT trop peu coté (2129 fx). Pas
  staking-grade. Ré-évaluer si calibration mi-temps dédiée améliorée. > **INSIGHT SYSTÈME consolidé (2026-06-23)** : le modèle **n'a aucun edge > directionnel sur les marchés résultat** — ni 1X2 fin de match (UNDERDOG/ > FAVORITE/CONTRARIAN tous perdants ou artefact) ni vainqueur mi-temps > (FIRST*HALF). **STRUCTUREL, prouvé** : Brier 1X2 modèle 0.633 vs marché > (cotes dévigées) 0.595 sur 26 083 matchs → le marché est un \_meilleur > prédicteur* que notre modèle. Parier nos probas contre la ligne = parier > une estimation moins bonne contre une meilleure : imbattable par construction > (notre modèle xG-Poisson n'utilise qu'un sous-ensemble de l'info que la cote > agrège). Le marché est efficient sur le résultat à tout horizon. La > valeur validée du système vient de : filtrage par accord (CONSENSUS), value > sur le nul (DRAW staké), police de la sur-confiance (AVOID), et prédiction > buts en observation (BTTS/DOMINANT/GOALS). Ne plus tester de canal > « battre le marché sur le résultat » sans une amélioration majeure du modèle.
- [ ] `MARKET_MOVE` — quand l'historique de cotes est assez dense
- [ ] `LIVE_VALUE` — pipeline live isolé des analyses J-/JT
