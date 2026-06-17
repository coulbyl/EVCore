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

## ▶ Reprise (prochaine session)

Étapes 0-4 terminées et commitées ; Étape 5 **en cours** : l'engine est **branché**
sur le flux live — `analyzeFixture` et `analyzeFriFixture` construisent un
`StrategyContext` (`strategy-context.builder.ts`) et persistent les décisions
multi-canal via `ChannelDecisionService.recordRunDecisions` → `saveRunDecisions`.
Écriture **additive** : les writes legacy (`Prediction` / `isSafeValue`) restent
en place pour ne rien casser (décision « engine d'abord, vérifiable »).

Les `Bet` matérialisés (EV, SAFE en flux principal ; EV en FRI) sont **reliés** à
leur `ChannelSelection` (`Bet.channelSelectionId`) via `findChannelSelectionId`
(match par `pickKey`, `null` si divergence live/backtest connue). `saveRunDecisions`
retourne désormais les sélections persistées avec leurs IDs.

Settlement analytique **fait** : `ChannelSelection.result` écrit au règlement
(early + final) en mirroir des bets, `Bet.status` reste l'autorité financière.

API read **faite** : `GET /channel-decisions` expose les décisions normalisées
(channel/status/selections, REJECTED + reasonCode, filtres date/competition/channel/market/status).

**Prochain pas** : gate de parité legacy↔canaux (Étape 4), puis retrait legacy
(Étape 6). La vue `/dashboard/decisions` est la surface principale ; les routes
legacy `/dashboard/investment` et `/dashboard/picks` redirigent vers elle.

État : unit 570/570 ✅ · e2e 18/18 (série) ✅ · lint ✅ · typecheck ✅.

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

## Étape 3 — Backfill (via ETL, pas de script standalone)

> **Décision** : le backfill historique passe par l'**ETL** (worker `betting-engine-analysis`
> qui ré-exécute l'engine branché sur une fenêtre de dates → écrit `ChannelDecision` /
> `ChannelSelection` nativement, + lien `Bet.channelSelectionId`). Les scripts standalone
> `backfill-channel-decisions.{ts,lib}` et leur e2e ont été **supprimés** (commit de l'Étape 5).

- [x] Production native des décisions par l'engine (EV/SAFE + DOMINANT/DRAW/BTTS), lien `Bet`
- [x] Idempotence garantie par `@@unique([modelRunId, channel])` (un re-run = un nouveau `ModelRun`)
- [-] Migrer les jambes de coupon `CouponLegCanal → StrategyChannel` — **déplacé en Étape 6** :
  conversion de colonne `CouponProposalLeg.canal`, à faire dans la migration qui drop `CouponLegCanal`
  (l'API mappe `CouponLegCanal → StrategyChannel` au niveau DTO d'ici là)
- [ ] **[ETL]** Brancher / exposer le déclenchement du backfill par fenêtre (ré-analyse historique)
      côté ETL si besoin d'un rattrapage de masse

---

## Étape 4 — Vérification (parité avant DROP)

> Les scripts standalone `verify-channel-backfill.{ts,lib}` et leur e2e ont été **supprimés**
> (le backfill ne passe plus par un script). La parité legacy↔canaux avant le DROP (Étape 6)
> reste à câbler — via une requête/job ETL plutôt qu'un CLI dédié.

- [ ] **[à recâbler]** Réconciliation comptage + parité des résultats settlés par canal
      (legacy `Bet`/`Prediction` vs `ChannelSelection`) avant tout DROP — gate read-only via ETL/analytics

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
      Écriture additive legacy conservée jusqu'au retrait Étape 6.
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
      liens **Investissement/Sélections commentés** dans la nav (sidebar + mobile) — pages
      legacy `/dashboard/investment` + `/dashboard/picks` redirigées vers `/dashboard/decisions`,
      i18n complet des libellés canaux/codes de rejet.
- [x] Rapports / exports ML lisent la nouvelle représentation (un objet par `run × channel × selection`) :
      `reports/ml-promotion` agrège les `ChannelSelection` settlées du canal `EV`
      au lieu des `Bet` legacy `isSafeValue=false`.

---

## Étape 6 — Suppression du legacy (migration finale, après gate vert)

- [ ] Retirer les writes legacy `Prediction` / `Bet.isSafeValue` du flux engine
- [ ] Convertir `CouponProposalLeg.canal` : `CouponLegCanal → StrategyChannel`
      (`EV→EV`, `SV→SAFE`, `BB→BTTS`, `NUL→DRAW`, `CONF→DOMINANT`) avant de droper l'enum
- [ ] `DROP TABLE prediction` ; `DROP TYPE PredictionChannel`, `CouponLegCanal`
- [ ] `ALTER TABLE bet DROP COLUMN isSafeValue`
- [ ] Retirer `ModelRun.decision`
- [ ] Rollback testé : transaction non committée + migration `down` Prisma

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
