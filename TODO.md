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
- [ ] Figer l'enum `StrategyChannel` **v1 = canaux réels uniquement** : `EV`, `SV`,
      `DOMINANT`, `BB`, `NUL` (+ `GOALS` si prêt). Ne **pas** figer les canaux
      spéculatifs (`UNDERDOG`, `CONSENSUS`, `AVOID`…) — `ADD VALUE` plus tard, par canal
- [ ] Acter le grain `ModelRun` = une exécution immuable, `Fixture → ModelRun` 1-à-N (doc §8.1)
- [ ] Geler le mapping legacy → cible : `CONF → DOMINANT`, `DRAW → NUL`, `BTTS → BB`,
      `isSafeValue=true → SV`, `ModelRun.decision → ChannelDecision(EV)`

---

## Étape 1 — Contrat & registre de stratégies (backend, derrière les tables cibles)

- [ ] `StrategyContext`, `StrategyDecision`, interface `ChannelStrategy` + `allowedMarkets` (doc §5)
- [ ] Extraire les règles actuelles dans des stratégies dédiées : `EV`, `SV`,
      `DOMINANT` (ex-`CONF`), `BB`, `NUL` — une stratégie par fichier
- [ ] Orchestrateur betting engine : `strategies.map(evaluate)` → `saveRunDecisions`,
      phase 1 (primaires) puis phase 2 (méta) explicites
- [ ] Conserver les calculs probabilistes actuels **à l'identique** (Poisson, lambdas, probas)
- [ ] Tests unitaires par stratégie : **sélection ET rejet** + invariant `allowedMarkets`
      (une sélection hors périmètre fait échouer le run, pas d'écriture)

---

## Étape 2 — Schéma cible (migration Prisma)

- [ ] Enums `StrategyChannel`, `ChannelDecisionStatus`
- [ ] Tables `channel_decision`, `channel_selection` (`@@unique([modelRunId, channel])`,
      `@@unique([channelDecisionId, rank])`, index)
- [ ] `Bet.channelSelectionId` (FK nullable)
- [ ] Valeurs `Decimal` partout (probas/cotes/EV/score) — jamais `number` natif

---

## Étape 3 — Backfill (script idempotent + transactionnel)

- [ ] `EV` : `Bet(source=MODEL, isSafeValue=false)` → `ChannelDecision(EV, SELECTED)` + sélection ;
      sinon `NO_BET` → `ChannelDecision(EV, REJECTED, reasonCode=BACKFILL)`
- [ ] `SV` : `Bet(isSafeValue=true)` → `ChannelDecision(SV, SELECTED)` + sélection
- [ ] `DOMINANT` / `NUL` / `BB` depuis `Prediction` (mapping §0) → `SELECTED` + sélection
      (`result` dérivé de `correct`)
- [ ] Relier chaque `Bet` matérialisé à sa `ChannelSelection` (`channelSelectionId`)
- [ ] Migrer les jambes de coupon `CouponLegCanal → StrategyChannel`
- [ ] Re-exécutable sans doublon (clés `@@unique`) — pas d'invention de rejets historiques
- [ ] Tests d'idempotence + réconciliation

---

## Étape 4 — Vérification (gate AVANT tout DROP)

- [ ] Réconciliation comptage : `ChannelSelection SELECTED` == `Bet MODEL` + `Prediction` migrées
- [ ] Parité par fixture + somme des résultats settlés
- [ ] Test de parité ancien/nouveau rapport sur la même période (gate de migration)
- [ ] Échec ⇒ transaction non committée, aucun legacy supprimé, état précédent intact

---

## Étape 5 — Bascule des consommateurs (même release)

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

- [ ] `DROP TABLE prediction` ; `DROP TYPE PredictionChannel`, `CouponLegCanal`
- [ ] `ALTER TABLE bet DROP COLUMN isSafeValue`
- [ ] Retirer `ModelRun.decision`
- [ ] Rollback testé : transaction non committée + migration `down` Prisma

---

## Étape 7 — Nouveaux canaux (phasé — backtest AVANT activation)

> Checklist par canal (doc §11) : hypothèse → `allowedMarkets` → critères `SELECTED` /
> codes de rejet → seuils par ligue → implémentation → tests → **backtest séparé** →
> shadow/observation → activation par segment validé → settlement + métriques → API/front.

- [ ] `BB` côté `NO` : calibration **séparée par côté** (seuil, `minSampleN`, backtest distincts),
      démarrage en observation, marché contraint à `BTTS` (doc §6.1 / §15.10)
- [ ] `GOALS` (`OVER_UNDER`) — les probabilités existent déjà, à prioriser
- [ ] `CONSENSUS` (méta) — exploite les décisions normalisées, mesurer l'indépendance des stratégies
- [ ] `AVOID` (méta) — décision négative explicite, bloque la publication sans effacer les autres canaux
- [ ] `UNDERDOG` / `FAVORITE` — après calibration des segments 1X2
- [ ] `MARKET_MOVE` — quand l'historique de cotes est assez dense
- [ ] `FIRST_HALF` — dataset mi-temps validé (calibration séparée)
- [ ] `LIVE_VALUE` — pipeline live isolé des analyses J-/JT
