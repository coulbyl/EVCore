# Plan — Noyau d'analyse partagé & domaine de calibration

> Cadrage d'un refactor d'architecture. Objectif : robustesse et cohérence avant tout.
> Statut repo au moment du cadrage : **Phase 3** (ML en shadow, calibration déjà opérationnelle).
> À lire avec [ROADMAP.md](ROADMAP.md), [EVCORE.md](EVCORE.md), [CLAUDE.md](CLAUDE.md).

## 1. Problème réel à résoudre

L'idée de départ (« service de calibration séparé + DB séparée + extraction d'un noyau
pur ») répond à une vraie douleur, mais surdimensionne la solution pour l'état actuel
du code. Le besoin réellement non couvert est **un seul** :

> Garantir que la logique d'analyse exécutée **en production** (génération des picks)
> est **strictement identique** à celle exécutée en **backtest / calibration**, et le
> rester dans le temps — sans divergence silencieuse entre deux copies du code.

Tout le reste (DB séparée, nouveau service HTTP) est de l'infrastructure qui n'attaque
pas ce besoin et introduit des risques de cohérence. On les écarte, avec justification
(§5).

## 2. Ce qui existe déjà (à ne pas réinventer)

| Brique proposée dans le brainstorm         | État réel dans le repo                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Noyau pur (EV, proba, ranking, settlement) | Déjà isolé sous `betting-engine/{math,selection,strategies,settlement}` — **0 dépendance NestJS/Prisma** vérifiée ; seul couplage : enum `Market` + `decimal.js` |
| Service de calibration                     | `adjustment/calibration.service.ts` (Brier/meanError + auto-apply `AdjustmentProposal`)                                                                          |
| Backtests                                  | Module `backtest/` complet (controller, repository, metrics, `channel-backtest`, `model-calibration`)                                                            |
| Versions de modèles                        | Table `ml_model_version` (Phase 3)                                                                                                                               |
| Calcul lourd séparé                        | `apps/ml-worker` (Python/scikit-learn) + queue BullMQ `ml-training`                                                                                              |
| Source de vérité prédictions vs résultats  | `ModelRun` (jamais supprimée — politique documentée) + `Fixture`/`OddsSnapshot`                                                                                  |

Conclusion : **on consolide l'existant**, on ne crée pas une nouvelle pile parallèle.

## 3. Décision d'architecture

1. **Extraire `packages/analysis-core`** — noyau déterministe pur, **aucune** dépendance
   DB / HTTP / Redis / NestJS. C'est la seule partie « nouvelle » et c'est celle qui
   porte toute la valeur. Cible : prod **et** backtest importent le même package.
2. **Une seule base de données.** La calibration devient un **domaine borné** matérialisé
   par un **schéma Postgres dédié** (`calibration`) dans la base existante — pas une
   seconde base. Cohérence transactionnelle et source unique de vérité préservées.
3. **Pas de nouveau service applicatif.** Le déterministe reste en NestJS, le lourd reste
   en `ml-worker`. On formalise un **module `calibration`** côté NestJS qui orchestre
   les deux, derrière le noyau partagé.

### Schéma cible

```txt
packages/
  analysis-core/            # PUR — testable sans infra
    src/
      types/                # Market, StrategyChannel, Pick, Outcome… (source de vérité)
      ev/                   # calculateExpectedValue, implied prob, overround/margin
      probability/          # Poisson, dérivations 1X2 → O/U, BTTS, DC, HT/FT
      ranking/              # qualityScore, anti-corrélation, sélection
      settlement/           # settlePick(prediction, result) — logique pure
      metrics/              # Brier, log loss, calibration error, reliability bins
      normalization/        # devig, normalisation cotes
  db/                       # Prisma — enums alignés sur analysis-core (test de conformité, §2-bis)

apps/
  backend/                  # NestJS — autorité ; consomme analysis-core
    modules/
      betting-engine/       # orchestration prod (I/O, persistance ModelRun)
      backtest/             # orchestration backtest (lecture historique)
      calibration/          # (consolidé) metrics + courbes + déclencheurs, schéma `calibration`
  ml-worker/                # Python — calcul lourd (inchangé)
```

### Frontière non négociable

```txt
analysis-core = fonctions déterministes pures.
  ✗ aucune DB, aucun HTTP, aucun Redis, aucun décorateur NestJS, aucun accès `process.env`
  ✓ entrées = objets simples ; sorties = objets simples ; même input → même output
```

Tout ce qui touche Prisma, BullMQ, les endpoints ou `ConfigService` **reste dans les
apps**. Le noyau ne doit jamais devenir un mini-backend (c'est le piège cité dans le
brainstorm — on l'inscrit comme règle dure).

## 4. Plan d'exécution (séquencé, chaque étape mergeable et verte)

> Principe transverse : **aucun changement de comportement** pendant l'extraction. On
> déplace du code à iso-logique, prouvé par les tests existants (golden specs inclus).

### Étape 0 — Geler la frontière ✅ (25 juin 2026)

- [x] Lister précisément les modules « purs » candidats et leurs dépendances réelles
      (cartographié : couplage unique des fichiers purs = enum `Market`).
- [x] **Ownership des enums/types de domaine — décidé : le noyau possède les types**
      (inversion de dépendance). `analysis-core/types` est la **source de vérité** ; Prisma
      garde ses enums (valeurs string identiques) mais ne les _définit_ pas. Le noyau ne
      doit jamais dépendre de Prisma, sinon il ne builde plus sans `prisma generate`
      (violation de la garantie « zéro infra »). Voir §2-bis pour le mécanisme.

### Étape 1 — Créer `packages/analysis-core` ✅ (25 juin 2026)

- [x] Package TS strict (hérite `base.json` : `strict`, `noUncheckedIndexedAccess`,
      `isolatedModules`), build `tsc` (`tsconfig.build.json` exclut les specs), lint
      `--max-warnings 0`, Vitest. **Zéro** dépendance runtime (enums purs ; `decimal.js`
      viendra en Étape 3 avec les types/maths). Entrée turbo `@evcore/analysis-core#build`.
- [x] Test d'architecture (`architecture.guard.spec.ts`) interdisant tout import
      `@nestjs/*`, `@evcore/db`, `@prisma/*`, `ioredis`, `bullmq` + accès env — scanne les
      sources et casse le build à la moindre fuite d'infra (garde-fou automatisé).

### Étape 2 — Migrer les enums de domaine ✅ (25 juin 2026)

- [x] `Market`, `StrategyChannel`, `ChannelDecisionStatus`, `ModelRunPhase`, `SportType`
      déplacés dans `analysis-core/types` **en `const` object + union type** (Prisma 7 génère
      déjà ce pattern → mirroir exact). Périmètre limité aux **enums** ; les types-feuilles
      (`StrategySelection`…) suivent en Étape 3 avec leur logique.
- [x] Prisma conserve ses enums (valeurs identiques) ; **test de conformité**
      `domain-enums.conformance.spec.ts` (compile-time `AssertEqual` + runtime `toEqual`)
      casse le build si une union diverge. Zéro dérive constatée à la bascule.
- [x] Cœur pur repointé (`strategies/`, `selection/`, `betting-engine.{types,utils}`,
      `channel-strategy.types`) → import des enums depuis `@evcore/analysis-core` ;
      `channel-strategy.types` réexporte pour ne pas churn les imports en aval. Les modules
      couplés Prisma/Nest gardent `@evcore/db` (réexport conformé). Typecheck + lint verts ;
      golden specs verts (iso-comportement) ; 0 nouvelle régression de test.

### Étape 2-bis — Mécanisme anti-dérive (référence)

```ts
// packages/analysis-core/src/types/market.ts — SOURCE DE VÉRITÉ
export const Market = {
  ONE_X_TWO: "ONE_X_TWO",
  OVER_UNDER: "OVER_UNDER",
  BTTS: "BTTS",
  DOUBLE_CHANCE: "DOUBLE_CHANCE",
  HALF_TIME_FULL_TIME: "HALF_TIME_FULL_TIME",
  OVER_UNDER_HT: "OVER_UNDER_HT",
  FIRST_HALF_WINNER: "FIRST_HALF_WINNER",
} as const;
export type Market = (typeof Market)[keyof typeof Market];
```

```ts
// apps/backend/.../market-enum.conformance.spec-d.ts — garde-fou unique
import type { Market as PrismaMarket } from "@evcore/db";
import type { Market as DomainMarket } from "@evcore/analysis-core";
type AssertEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;
const _check: AssertEqual<PrismaMarket, DomainMarket> = true; // build rouge si divergence
```

> Coût assumé : valeurs maintenues à deux endroits (`schema.prisma` + noyau). Le test de
> conformité rend l'oubli impossible (build cassé). À comparer au coût permanent de
> l'option inverse — un noyau qui ne compile pas sans la DB.

### Étape 3 — Migrer la logique pure (par tranches, tests à l'appui) ✅ (29 juin 2026)

- [x] `ev/` ← `ev-math.ts` (formule `EV = p × odds − 1`). Seuil `≥ 0.08` reste en config
      app (`ev.constants.ts`) ; la formule est dans le noyau. Shim backend : aucun (déjà
      consommé via `@evcore/analysis-core`).
- [x] `probability/` ← `match-stats.ts` (`deriveLambdas`, `rebalanceThreeWayProbabilities`,
      `buildMatchupFeatures`, `blendTeamStats`, `mapProbabilitiesToNumber`). Config `LambdaConfig`
      injectée par app (`buildLambdaConfig`). Shim backend : `math/probability.ts`.
- [x] `selection/` ← `pick-evaluation.ts`, `pick-validation.ts`, `combo-pricing.ts`.
      Config `SelectionConfig` injectée par app (`buildSelectionConfig`). Shim backend :
      `selection/pick-evaluation.ts`.
- [x] `strategies/` ← 7 stratégies (VALUE/SAFE/DOMINANT/BTTS/DRAW/GOALS/CONSENSUS/AVOID) + orchestrator + registry + config (~1 800 lignes). `StrategyContext` enrichi de
      `selectionConfig` + `modelScoreThreshold` injectés app-side. Shims backend complets.
- [x] `settlement/` ← `resolvePickBetStatus`, `resolveComboPickBetStatus`, `resolveEarlyBetStatus` + helpers. `bet-settlement.service.ts` (Prisma) appelle le noyau.
- [x] `metrics/` ← Brier score, calibration error (`scoring.ts`) + flatRoi, maxDrawdown,
      evBins (`roi.ts`). Shims backend : `backtest.report.ts`, `backtest.metrics.ts`.
- [x] Après chaque tranche : 616/616 tests verts, lint + typecheck propres, golden specs
      inchangés → iso-comportement prouvé.

### Étape 4 — Backend & ml-worker consomment le noyau ✅ (29 juin 2026)

- [x] `betting-engine` (prod) et `backtest` importent `analysis-core` via shims re-export.
      Un seul chemin de code pour analyser une fixture — zéro copie de logique dans le backend,
      les fichiers locaux sont de purs tunnels vers `@evcore/analysis-core`.
- [x] Contrat d'échange ml-worker documenté et centralisé : `MlShadowFeatures` (le vecteur
      de features passé à Python via Postgres/BullMQ) déplacé dans `analysis-core/score/ml-features.ts`.
      `ml.inference.service.ts` et `ml-shadow-features.ts` deviennent des shims. Le noyau
      est désormais la source de vérité unique du format de données ML ; toute dérive casse
      le typecheck.

### Étape 5 — Domaine calibration sur schéma dédié (DB unique) ✅ code (29 juin 2026)

- [x] **schema.prisma** : `multiSchema` activé (`schemas = ["public", "calibration"]`).
      `AdjustmentProposal` + `MarketSuspension` passent en `@@schema("calibration")`.
      Deux nouveaux modèles ajoutés dans `calibration` schema : - `CalibrationReport` — snapshot de métriques par canal (Brier, calibrationError, roi, evBins) - `ChannelTuningResult` — résultat du backtest de tuning par canal/config
      Tous les modèles/enums existants ont reçu `@@schema("public")` explicite.
      **⚠️ Migration en attente** : exécuter `prisma migrate dev --name add-calibration-schema`
      puis `prisma generate` via le CLI utilisateur pour générer les types Prisma.
- [x] **Module NestJS `calibration`** : `CalibrationModule` + `CalibrationRepository` créés
      dans `apps/backend/src/modules/calibration/`. Le repository expose `saveReport`,
      `listReports`, `saveTuningResult`, `listTuningResults` — prêt pour l'injection dans
      `AdjustmentService` et `ChannelTuningService` après la migration.
      Bridge de types (`calibration-prisma.types.ts`) garantit le typecheck avant génération.
- [ ] **Politique de rétention/volumétrie** : réutiliser le pattern worker de rétention
      `OddsSnapshot` ; (re)considérer le partitionnement uniquement à 1M+ lignes.

### Étape 6 — Gate de validation avant suppression du legacy ✅ (29 juin 2026)

- [x] **Réconciliation** : pas d'ancien chemin vs nouveau — les fichiers backend sont des
      shims re-export depuis `@evcore/analysis-core`. Il n'y a plus deux copies : les
      implémentations vivent exclusivement dans le noyau. Parité bit-à-bit garantie par
      construction (même code exécuté).
- [x] **Golden specs inchangés** : `betting-engine.golden.spec.ts` + tous les specs stratégie
      passent (616/616) avec les mêmes snapshots qu'avant la migration. Aucune dérive de
      comportement.
- [x] **Zéro logique résiduelle dans les shims** : vérification manuelle — toutes les
      strategy/\*.ts et math/probability.ts ne contiennent aucune ligne de logique (0 lignes
      hors exports/commentaires). `analysis-core` architecture guard passe.
- [x] **Rollback disponible** : tout `AdjustmentProposal` peut être annulé via
      `POST /adjustment/:id/rollback` (logique inchangée, couverte par les specs).

## 5. Décisions explicitement écartées (et pourquoi)

| Proposé                                                     | Décision                                            | Raison                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de données séparée pour la calibration                 | **Rejeté** → schéma `calibration` dans la DB unique | La calibration joint `Fixture`/`OddsSnapshot`/`ModelRun` ; une 2ᵉ base force duplication + ETL inter-bases et casse la source unique de vérité (principe CLAUDE.md). Volumétrie déjà traitée par rétention + partitionnement différé. |
| Nouveau service `calibration-api` (HTTP)                    | **Rejeté** → module NestJS + `ml-worker` existant   | Le lourd a déjà son service (`ml-worker`). Un 3ᵉ service ajoute réseau, modes de panne et risque d'incohérence sans bénéfice tant que NestJS est l'autorité.                                                                          |
| `packages/analysis-types` séparé                            | **Différé** → `analysis-core/types` d'abord         | Éviter la prolifération de packages ; extraire un package de types seulement s'il est consommé hors du noyau.                                                                                                                         |
| Extraire workers / endpoints / modèles Prisma dans le noyau | **Interdit** (règle dure)                           | Le noyau doit rester pur ; sinon il devient un mini-backend difficile à maintenir.                                                                                                                                                    |

## 6. Risques & garde-fous

- **Dérive silencieuse prod ≠ backtest** → résolue par construction (un seul package) +
  golden specs en CI.
- **Régression pendant l'extraction** → chaque tranche est iso-logique et gardée par les
  tests + snapshots existants ; rien n'est supprimé avant le gate §4.6.
- **Couplage rampant vers l'infra dans le noyau** → test d'architecture (Étape 1) qui
  échoue le build si un import interdit apparaît.
- **Migration de schéma `calibration`** → transactionnelle, backfill idempotent,
  réconciliation avant tout `DROP`.

## 7. Critère de succès

1. Prod et backtest exécutent **le même** code d'analyse (import unique `analysis-core`).
2. `analysis-core` builde et teste **sans aucune infra** (ni DB, ni Redis, ni HTTP).
3. Métriques de référence (Brier / Cal. error / ROI) **inchangées** après bascule.
4. Une seule base de données ; NestJS reste l'autorité ; `ml-worker` reste le seul moteur
   de calcul lourd.
