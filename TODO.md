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

Étapes 0-5 terminées et commitées. La vue `/dashboard/decisions` est la surface
principale ; `/dashboard/investment` et `/dashboard/picks` redirigent vers elle.
L'engine écrit les `ChannelDecision` / `ChannelSelection` et ne recrée plus les
`Prediction` ni le flag legacy `Bet.isSafeValue`. Les lectures runtime EV/SAFE
passent par `Bet.channelSelection → ChannelDecision.channel`. La config
historique `prediction.constants` a été renommée/déplacée en config de
stratégies (`betting-engine/strategies/channel-strategy.config.ts`) avec le
vocabulaire `DOMINANT` / `DRAW` / `BTTS`. `ModelRun.decision` a aussi été retiré
du schéma cible et des consommateurs runtime ; les surfaces legacy affichent un
pick EV à partir de la présence d'un `Bet.channelSelection` matérialisé.

**Priorité 1 — couper le legacy (Étape 6)** :

- retirer les consommateurs/schémas legacy restants ;
- recâbler ou supprimer les scripts diagnostics DB qui lisent encore les
  anciennes tables (`prediction`, puis `isSafeValue`) — fait pour les scripts
  diagnostics/backtests ad hoc.

**Priorité 2 — purge destructive + rebuild/backfill après cleanup** :

- décision actée : garder la table `model_run`, mais vider les données d'analyse
  historiques (`ModelRun`, `ChannelDecision`, `ChannelSelection`, `Prediction`,
  `Bet`, `BetSlip`, `CouponProposal`, `CouponProposalLeg`, transactions liées si
  nécessaire) avant rebuild ;
- adapter `ml-backfill` pour recréer les `ModelRun` + décisions canaux sur
  l'historique utile, sans marquer artificiellement les runs en backfill ;
- recâbler une vérification minimale post-rebuild : compte de sélections, résultats
  settlés, absence de références legacy.
- coupon : reconstruire un vrai service coupon basé sur `ChannelDecision` /
  `ChannelSelection`, car les pipelines legacy `/investment` et `/picks`
  disparaissent aussi.

**Priorité 3 — nouveaux canaux** : seulement après cleanup + rebuild stables.

État dernier passage : Prisma validate ✅ · `@evcore/db build` ✅ · backend
typecheck/lint ✅ · web typecheck/lint ✅ (2 warnings `<img>` préexistants).
Vitest backend 58 fichiers / 537 tests ✅ au passage précédent ; e2e repository
non relancé ici si Docker/Testcontainers indisponible.

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
> **Priorité actuelle** : commencer par le legacy cleanup. Ensuite, utiliser/adaptater
> `ml-backfill` pour reconstruire les runs utiles plutôt que maintenir deux chemins
> historiques en parallèle.

- [x] Production native des décisions par l'engine (EV/SAFE + DOMINANT/DRAW/BTTS), lien `Bet`
- [x] Idempotence garantie par `@@unique([modelRunId, channel])` (un re-run = un nouveau `ModelRun`)
- [x] Migrer les jambes de coupon `CouponLegCanal → StrategyChannel` :
      schema cible prêt (`CouponProposalLeg.canal StrategyChannel`) + mapping du
      pipeline investissement actuel vers le modèle cible (`EV→EV`, `SV→SAFE`,
      `BB→BTTS`, `NUL→DRAW`, `CONF→DOMINANT`). Les coupons existants seront purgés,
      donc la migration n'a pas besoin de préserver les lignes historiques.
      La migration SQL reste à générer/appliquer par toi.
- [ ] Remplacer le pipeline coupon legacy par un vrai service coupon branché sur
      `ChannelDecision` / `ChannelSelection` : source des legs, scoring, odds
      combinées, settlement et DTO doivent utiliser `StrategyChannel` nativement
      (plus de dépendance aux anciens pipelines `/investment` / `/picks`).
- [x] **[destructif]** Ajouter une commande explicite de purge des données d'analyse
      historiques avant rebuild : `BetSlipItem` / `BetSlip` /
      `BankrollTransaction` liées, `CouponProposalLeg` / `CouponProposal`, `Bet`,
      `Prediction`, `ChannelSelection`, `ChannelDecision`, puis `ModelRun`.
      Commande : `pnpm --filter @evcore/db db:purge:analysis -- --confirm=PURGE_ANALYSIS_DATA`.
      Exécutée en local : 42 242 `ModelRun`, 15 185 `Prediction`, 2 338 `Bet`,
      125 `ChannelDecision`, 21 `ChannelSelection`, 98 coupons, 153 slips et
      403 transactions liées supprimés. Ne jamais lancer implicitement dans un seed.
- [ ] **[ETL]** Adapter `ml-backfill` pour le rebuild historique post-cleanup :
      fixtures terminées utiles → nouveau `ModelRun` →
      `ChannelDecision` / `ChannelSelection` → settlement analytique
- [ ] **[optionnel]** Exposer un backfill par fenêtre seulement si le rebuild par saisons
      via `ml-backfill` ne suffit pas

---

## Étape 4 — Vérification post-cleanup / post-rebuild

> Les scripts standalone `verify-channel-backfill.{ts,lib}` et leur e2e ont été **supprimés**
> (le backfill ne passe plus par un script). La parité legacy↔canaux avant le DROP (Étape 6)
> reste à câbler — via une requête/job ETL plutôt qu'un CLI dédié.

- [ ] **[à recâbler]** Vérification post-rebuild : comptage `ModelRun` /
      `ChannelDecision` / `ChannelSelection`, résultats settlés par canal,
      absence de dépendance runtime à `Prediction` / `isSafeValue` /
      `ModelRun.decision`

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
      liens **Investissement/Sélections commentés** dans la nav (sidebar + mobile) — pages
      legacy `/dashboard/investment` + `/dashboard/picks` redirigées vers `/dashboard/decisions`,
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
