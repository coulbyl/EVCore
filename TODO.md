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

## ▶ Reprise (prochaine session) — 2026-06-22

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
- [ ] **`chat` — à repenser** : garde encore le vocab legacy `EV/SV/CONF/BB/NUL`
      (schemas LLM + `chat.read.repository` conversions + `chat.golden.spec`).
      Seuls ses refs `StrategyChannel.EV→.VALUE` ont été touchés pour compiler.
- [x] **Dette front séparée** (2026-06-21) : `domains/ai-engine` → `domains/coupon`
      + imports ; chemins API périmés corrigés (`/ai-engine/coupons` → `/coupons`,
      `/ai-engine/investment-indices` → `/coupons/indices`) ; page+domaine
      `investment-summary` morts supprimés (route orpheline, aucun lien nav).
      web typecheck/lint ✅. Reste cosmétique : fichiers internes encore nommés
      `investment-indices*` dans `domains/coupon` (→ `coupon-indices*`).
- [ ] **[optionnel]** unifier `pnl-by-canal` (clés lowercase `global/ev/sv`,
      contrat séparé cohérent) et renommer les tokens CSS `--canal-ev/-sv/-conf`.

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
- [x] **Étage 2** (2026-06-22) : brique **tuning** + bascule du front.
      - Backend : `POST /backtest/tuning` (`ChannelTuningService`) sweepe les
        seuils `DOMINANT/DRAW/BTTS` **hors-ligne** depuis `model_run.features` +
        cotes (`findChannelTuningRows`, lit la DB, ne ré-exécute pas le moteur) ;
        recommande un seuil par ligue×canal (ROI/hit/coverage + verdict PASS).
        **Consultatif** : aucune auto-application (`CHANNEL_STRATEGY_CONFIG`
        édité à la main). `tuning.metrics.ts` pur + spec, `tuning.constants.ts`
        (grilles + règles de promotion). backend typecheck/lint/589 tests ✅.
      - Front : page `performance` **allégée** — `OverviewSection` (P&L par
        canal) conservée + nouvelle `ChannelAnalysisSection` à 3 onglets
        (Backtest canaux `/backtest/channels`, Tuning seuils `/backtest/tuning`,
        Calibration modèle `/backtest/calibration`). Supprimés : onglets legacy
        EV/SV + sections `weights-timeline`/`competition-stats`/`calibration`
        live, use-cases `run-backtest`/`run-safe-value-backtest`. web
        typecheck/lint ✅ (2 warnings `<img>` préexistants).
      - Reste : `grid-search` legacy (sweep EV `evFloor`/`modelScore` qui
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

- [ ] `BTTS` côté `NO` : calibration **séparée par côté** (seuil, `minSampleN`, backtest distincts),
      démarrage en observation, marché contraint à `BTTS` (doc §6.1 / §15.10)
- [ ] `GOALS` (`OVER_UNDER`) — les probabilités existent déjà, à prioriser
- [ ] `CONSENSUS` (méta) — exploite les décisions normalisées, mesurer l'indépendance des stratégies
- [ ] `AVOID` (méta) — décision négative explicite, bloque la publication sans effacer les autres canaux
- [ ] `UNDERDOG` / `FAVORITE` — après calibration des segments 1X2
- [ ] `MARKET_MOVE` — quand l'historique de cotes est assez dense
- [ ] `FIRST_HALF` — dataset mi-temps validé (calibration séparée)
- [ ] `LIVE_VALUE` — pipeline live isolé des analyses J-/JT
