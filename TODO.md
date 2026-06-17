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

## Étape 0 — Cadrage & gel du design

- [ ] Valider le schéma Prisma cible `ChannelDecision` / `ChannelSelection` (doc §4.3)
- [ ] Figer l'enum `StrategyChannel` **v1 = canaux réels uniquement** : `EV`, `SAFE`,
      `DOMINANT`, `BTTS`, `DRAW` (+ `GOALS` si prêt). Ne **pas** figer les canaux
      spéculatifs (`UNDERDOG`, `CONSENSUS`, `AVOID`…) — `ADD VALUE` plus tard, par canal
- [ ] Acter le grain `ModelRun` = une exécution immuable, `Fixture → ModelRun` 1-à-N (doc §8.1)
- [ ] Geler le mapping legacy → cible : `PredictionChannel.CONF → DOMINANT`,
      `PredictionChannel.DRAW → DRAW`, `PredictionChannel.BTTS → BTTS`,
      `CouponLegCanal.NUL → DRAW`, `CouponLegCanal.BB → BTTS`, `CouponLegCanal.SV → SAFE`,
      `isSafeValue=true → SAFE`, `ModelRun.decision → ChannelDecision(EV)`
- [ ] **[multi-sport]** Figer `enum SportType { FOOTBALL }` (extensible : `TENNIS`,
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

## Étape 3 — Backfill (script idempotent + transactionnel)

> Script : `apps/backend/src/scripts/backfill-channel-decisions.ts` (`--dry-run`, `--limit`, `--from/--to`, `--batch-size`)

- [x] `EV` : `Bet(source=MODEL, isSafeValue=false)` → `ChannelDecision(EV, SELECTED)` + sélection ;
      sinon `NO_BET` → `ChannelDecision(EV, REJECTED, reasonCode=BACKFILL)`
- [x] `SAFE` : `Bet(isSafeValue=true)` → `ChannelDecision(SAFE, SELECTED)` + sélection
- [x] `DOMINANT` / `DRAW` / `BTTS` depuis `Prediction` (mapping §0) → `SELECTED` + sélection
      (`result` dérivé de `correct`)
- [x] Relier chaque `Bet` matérialisé à sa `ChannelSelection` (`channelSelectionId`)
- [-] Migrer les jambes de coupon `CouponLegCanal → StrategyChannel` — **déplacé en Étape 6** :
      conversion de colonne `CouponProposalLeg.canal`, à faire dans la migration qui drop `CouponLegCanal`
      (l'API mappe `CouponLegCanal → StrategyChannel` au niveau DTO d'ici là). Pas un backfill de `ChannelDecision`
- [x] Re-exécutable sans doublon (clés `@@unique`) — skip si `(modelRunId, channel)` existe, pas de rejet inventé
- [x] Tests d'idempotence + réconciliation (`test/backfill-channel-decisions.e2e-spec.ts`, 4 tests verts)

---

## Étape 4 — Vérification (gate AVANT tout DROP)

> Gate read-only : `apps/backend/src/scripts/verify-channel-backfill{,.lib}.ts`
> (CLI sort en code ≠ 0 si rouge → bloque le DROP en CI). Tests : `test/verify-channel-backfill.e2e-spec.ts` (4 verts).

- [x] Réconciliation comptage : `count(ChannelSelection)` == `count(Bet MODEL)` + `count(Prediction)` (`count_parity`)
- [x] Parité des résultats settlés par canal (`settled_parity_{EV,SAFE,DOMINANT,DRAW,BTTS}`,
      WON/LOST legacy vs nouveau) + complétude des liens (`all_model_bets_linked`)
- [x] Test de parité ancien/nouveau « rapport » (résultats settlés) — couvert par `settled_parity_*`
- [x] Gate read-only : aucun DROP exécuté ; un gate rouge n'altère rien (le DROP reste Étape 6, conditionné au vert)

---

## Étape 5 — Bascule des consommateurs (même release)

- [ ] **[différé d'Étape 1]** Ajouter `phase: J_MINUS | MATCH_DAY | LIVE` dans `StrategyContext` + sur `ModelRun` (doc §5/§8.1) — fonde `NOT_APPLICABLE` et les canaux `LIVE_VALUE`/`FIRST_HALF`.
      Reporté ici car les 5 canaux v1 ne l'exploitent pas encore
- [ ] Engine écrit **uniquement** `ChannelDecision` / `ChannelSelection` (plus de `Prediction`/`isSafeValue`)
- [ ] Settlement analytique sur `ChannelSelection.result` ; `Bet.status` reste l'autorité financière
      (anti-double-comptage : une sélection liée à un `Bet` réglée une seule fois côté analytique)
- [ ] API : DTO normalisés `channel` / `status` / `selections` ; exposer `REJECTED` +
      `reasonCode` ; filtres par stratégie / marché / phase
- [ ] Frontend : **un seul** type aligné sur `StrategyChannel`, mapping canal → clé i18n,
      tokens couleur remappés ; vue run **multi-canal** (plus de `BET`/`NO_BET`) ;
      suppression de la reconstruction `isSafeValue` / `Prediction` côté client
- [ ] Rapports / exports ML lisent la nouvelle représentation (un objet par `run × channel × selection`)

---

## Étape 6 — Suppression du legacy (migration finale, après gate vert)

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
