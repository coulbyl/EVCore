# Backend NestJS

## Pattern de module

Chaque module sous `apps/backend/src/modules/` suit le même enchaînement de couches, avec une responsabilité stricte par fichier :

| Couche      | Fichier                    | Responsabilité                                    | Ne fait jamais                |
| ----------- | -------------------------- | ------------------------------------------------- | ----------------------------- |
| Module      | `*.module.ts`              | Câblage DI : imports, providers, exports          | Contenir de la logique        |
| Controller  | `*.controller.ts`          | Routing HTTP + validation DTO (`class-validator`) | Logique métier                |
| Service     | `*.service.ts`             | Toute la logique métier, orchestration            | Appeler Prisma directement    |
| Repository  | `*.repository.ts`          | Toutes les requêtes Prisma pour un modèle donné   | Contenir de la logique métier |
| `dto/`      | DTO d'entrée/sortie HTTP   | Validation `class-validator`                      | —                             |
| `entities/` | Formes de données exposées | —                                                 | —                             |

Le pattern est respecté de façon quasi systématique dans le code réel : par exemple `apps/backend/src/modules/fixture/fixture.module.ts` déclare `FixtureRepository`, `FixtureService`, `FixtureScoringService` comme providers distincts, avec un seul controller HTTP. Certains modules n'ont pas de repository dédié quand ils n'ont pas (ou peu) de requêtes Prisma propres — `bet/bet.service.ts` est un exemple extrême : une classe vide, commentée `placeholder conservé pour les futures opérations sur les bets`, la création des `Bet` utilisateur étant en réalité gérée par `bet-slip/bet-slip.service.ts`.

Un point de divergence réel par rapport à la description historique : une partie croissante de la logique de scoring pur (Poisson, EV, sélection de pick, H2H, congestion, réconciliation ML) a été extraite dans `packages/analysis-core`, un package partagé entre le backend et le harnais de backtest. Les services NestJS (`betting-engine.service.ts`, `channel-decision.service.ts`, `congestion.service.ts`, `h2h.service.ts`) importent ces fonctions pures plutôt que de les réimplémenter — le service NestJS reste responsable de l'accès Prisma, de l'orchestration et des effets de bord (notifications, persistance), le calcul déterministe lui-même vit hors NestJS pour pouvoir être rejoué à l'identique en backtest.

## Inventaire des modules (`apps/backend/src/modules/`)

- **`fixture/`** — Upsert des compétitions/saisons/équipes/fixtures et des snapshots de cotes (`fixture.repository.ts`), plus `fixture-scoring.service.ts` qui expose les `ModelRun` évalués par fixture pour l'UI d'audit. `match-leg-detection.service.ts` déduit les matchs aller/retour des phases à élimination directe UEFA (l'API ne fournit pas de champ `leg` — détection par paire de fixtures partageant les deux mêmes équipes sur une saison/round).
- **`betting-engine/`** — Cœur du scoring : `betting-engine.service.ts` orchestre le calcul des lambdas Poisson, les corrections H2H/congestion/ML, le gate de cohérence modèle↔marché, et produit le `ModelRun`. `channel-decision.service.ts` invoque le `ChannelStrategyOrchestrator` (de `@evcore/analysis-core`) pour générer les décisions par canal. `h2h.service.ts`, `congestion.service.ts`, `shadow-predictions.service.ts` alimentent des signaux (dont certains restent shadow-only, jamais consommés par le scoring).
- **`etl/`** — Workers BullMQ d'ingestion (`etl.service.ts` déclare les queues/cron via `ETL_CRON_SCHEDULES`), client API-Football (`api-football.client.ts`), résolution des dates de saison par ligue (`league-season-dates.ts`) et matching de noms d'équipes entre sources (`team-name-matching.ts`).
- **`adjustment/`** — Boucle d'apprentissage : `adjustment.service.ts` déclenche la vérification de calibration après règlement d'un fixture et gère l'auto-apply/rollback des `AdjustmentProposal`. `calibration.service.ts` calcule le Brier score et l'erreur moyenne par marché. `channel-reliability.ts` implémente le shrinkage de fiabilité par canal vers un prior poolé.
- **`coupon/`** — Composition de coupons : `coupon-composer.service.ts` sélectionne les jambes sous contrainte d'edge et de cote (voir `MAX_LEG_EDGE`), `coupon-settlement.service.ts` règle les coupons à partir des scores de fixtures, `signal-window.service.ts` calcule un score de fenêtre horaire/jour/canal/ligue, `coupon-roi.service.ts` et `coupon-summary.service.ts`/`coupon-indices.service.ts` exposent des vues de suivi.
- **`investment/`** — Surface « Investir » : `investment.service.ts` sélectionne les canaux investissables (`INVESTMENT_CHANNELS`) et les répartit entre vues `assumed` / `watch` / `excluded` selon les garde-fous `INVESTMENT_GUARDRAILS` (edge, cote minimale) et `investment-coherence.repository.ts` (cohérence lambda/pick). `investment-channel-stats.repository.ts` calcule le ROI shrinké par canal.
- **`risk/`** — `risk.service.ts` calcule le ROI glissant par marché, déclenche l'alerte à -10 %/30 paris et l'auto-suspension à -15 %/50 paris (`RISK_CONSTANTS`), et expose la courbe de calibration et le rapport hebdomadaire.
- **`notification/`** et **`mail/`** — `notification.service.ts` persiste les notifications in-app et route certains types vers les opérateurs (`OPERATOR_TYPES` : `ROI_ALERT`, `MARKET_SUSPENSION`, `WEEKLY_REPORT`, …) ; `mail.service.ts` envoie les emails via Resend avec un template par type d'alerte (`renderMarketSuspension`, `renderWeightAdjustment`, `renderRoiAlert`, etc.).
- **`push/`** — Abonnements et envoi de notifications navigateur (Web Push).
- **`bankroll/`** — Suivi du solde utilisateur (dépôts/retraits/PnL), plafonné par `BANKROLL_LIMITS`.
- **`bet/`** — Quasi vide en l'état (voir plus haut) ; conservé comme point d'extension futur.
- **`bet-slip/`** — Création et règlement des tickets utilisateur (`BetSlipType`), plafonnée par `SLIP_LIMITS` (mise unitaire, nombre de sélections, gain potentiel maximal), avec dépendance à `BankrollService`.
- **`backtest/`** — `channel-backtest.service.ts` et `channel-tuning.service.ts` rejouent le pipeline actuel sur données historiques (jamais une lecture de décisions déjà en base) pour vérifier un canal ou balayer une grille de seuils ; `model-calibration.service.ts` calcule le Brier score et l'erreur de calibration du modèle 1X2 sur une fenêtre historique.
- **`rolling-stats/`** — Maintient les `TeamStats` glissantes (forme récente, xG for/against) utilisées comme features d'entrée du scoring.
- **`analysis-sheet/`** — Génère des fiches d'analyse (JSON/TXT) par plage de dates et compétition, à partir des `ModelRun` déjà calculés.
- **`audit/`** — Vue d'audit des fixtures/`ModelRun` par plage de dates, avec diagnostics extraits des `features` du `ModelRun` (`extractModelRunFeatureDiagnostics`).
- **`ml/`** — Intégration avec le `ml-worker` Python (shadow ML correction) : `ml.service.ts` gère les jobs d'entraînement BullMQ et les versions de modèle, `ml.inference.service.ts` appelle le service d'inférence pour une correction de probabilité shadow (jamais injectée dans le scoring tant que `ML_CORRECTION_ENABLED` n'est pas activé — voir feature flags).
- **`reports/`** — Rapports de suivi de performance par segment/canal, avec verdicts de promotion (`computeVerdict`, `PROMOTION_RULE_TEXT`).
- **`dashboard/`** — Agrégations pour le tableau de bord (statut des workers, métriques primaires par canal).
- **`subscriptions/`** — Abonnements utilisateur à des canaux/ligues ; `subscription-matching.service.ts` déclenche des notifications quand une nouvelle décision de canal ou un coupon correspond à un abonnement, `subscription-settlement.service.ts` calcule le PnL agrégé par abonnement.
- **`auth/`** — Authentification par session + 2FA TOTP (`otplib`, `qrcode`), gérée par `auth.service.ts` et `AuthSessionGuard`. Rate-limitée sur `POST /auth/login` (`AUTH_LOGIN_RATE_LIMIT`).
- **`admin-users/`** — Gestion des comptes utilisateurs côté admin (rôles, activation) derrière `AdminGuard`.
- **`announcements/`** — Annonces produit publiées par un admin, notifiées via `push`/`notification`.
- **`formation-progress/`** et **`gamification/`** — Suivi de progression d'un parcours de formation utilisateur et attribution de badges (volume de paris, séries, patience, etc.).
- **`support/`** — Messagerie support en temps réel (`support.gateway.ts`, WebSocket) avec notification email/push systématique sur nouveau message.
- **`common/`** — `guards/admin.guard.ts` (contrôle de rôle) et `redis/` (`cache.service.ts`, module Redis partagé pour BullMQ et cache applicatif).

## Flux de données ETL → Betting Engine → ModelRun

```
ETL Workers (BullMQ, apps/backend/src/modules/etl/)
        v   [validé par Zod avant toute écriture]
PostgreSQL (Fixture, TeamStats, OddsSnapshot, ...)
        v
BettingEngineService.analyzeFixture()
        v   (probabilités Poisson + corrections H2H/congestion/ML + gate de cohérence)
ChannelDecisionService (ChannelStrategyOrchestrator, 3 phases)
        v
ModelRun stocké + ChannelDecision/ChannelSelection persistées
```

Garde-fous vérifiés dans `betting-engine.service.ts` (`analyzeFixture`) :

- Un fixture `POSTPONED`, `CANCELLED` ou `IN_PROGRESS` retourne `{ status: 'skipped', reason: 'fixture_not_playable' }` — aucun `ModelRun` n'est généré.
- Le score déterministe seul produit une décision `BET`/`NO_BET` par rapport à `getModelScoreThreshold(competitionCode)`, mais la sélection effective d'un pick jouable (`evaluatedPicks`) dépend entièrement de la présence d'un snapshot de cotes : si `this.oddsLoader.findLatestOddsSnapshot(...)` renvoie `null`, `evaluatedPicks` est forcé à un tableau vide — donc aucune sélection n'est possible sans `odds_snapshot`, conformément à la règle produit.
- Un filtre de mouvement de ligne (`FEATURE_FLAGS.SCORING.LINE_MOVEMENT`) annule le pick sélectionné si les cotes se sont resserrées de plus de `LINE_MOVEMENT_THRESHOLD` sur 7 jours (signal anti adverse selection).
- Le gate de cohérence modèle↔marché (`CALIBRATION_GATE`, `market-coherence.ts`) compare la probabilité 1X2 du modèle à la médiane implicite des bookmakers prioritaires ; un déclenchement pose `features.calibration_alert` sans jamais modifier les entrées du modèle, et retire le fixture du pool de mise (même mécanisme d'exclusion qu'`AVOID`).

L'orchestration multi-canaux (`packages/analysis-core/src/strategies/orchestrator.ts`) tourne en 3 phases accumulatives, chaque phase voyant les décisions des phases précédentes via une même `Map` :

1. **Phase 1** — canaux spécialisés par marché (DOMINANT, BTTS, DRAW, GOALS, …), chacun décidant à partir du socle probabiliste partagé.
2. **Phase 2** — filtres (`VALUE`, `SAFE`) : sélectionnent parmi les picks déjà validés par la Phase 1, sans re-scanner les marchés évalués indépendamment.
3. **Phase 3** — méta-canaux (`CONSENSUS`, `CONTRARIAN`, `AVOID`) : lisent toutes les décisions des Phases 1 et 2, n'émettent pas de pick propre.

Ce document ne détaille pas la liste des 19 canaux ni leurs règles par famille — voir `docs/prediction-engine-families.md` et `docs/channel-strategy-architecture.md` pour cette partie.

## Boucle d'apprentissage (`adjustment/`)

`AdjustmentService.settleAndCheck(fixtureId)` est appelé après règlement d'un fixture et enchaîne :

1. Règlement des bets ouverts sur ce fixture (`bettingEngine.settleOpenBets`).
2. `CalibrationService.computeForMarket(Market.ONE_X_TWO)` — le MVP cible exclusivement `ONE_X_TWO` (marché implicite, codé en dur dans `adjustment.service.ts`).
3. Si `calibrationResult.needsAdjustment` est vrai **et** `betCount >= MIN_BET_COUNT` (50, `adjustment.constants.ts`) **et** aucun auto-apply n'a eu lieu dans les `MIN_DAYS_BETWEEN_APPLICATIONS` (7 jours) précédents, un nouvel `AdjustmentProposal` est créé avec `status: APPLIED` directement (`autoApply`) — pas d'étape de validation humaine avant application.
4. Le déclenchement de la calibration lui-même est gouverné par `CALIBRATION_TRIGGER_THRESHOLD = 0.20` (Brier score), et l'amplitude du changement de poids est plafonnée à `MAX_WEIGHT_CHANGE = 0.05` par cycle (`computeAdjustedWeights` déplace ce delta entre les deux features les plus lourdes et les deux plus légères, en préservant la somme des poids à 1).

Le rollback (`POST /adjustment/:id/rollback`) crée un nouveau `AdjustmentProposal` `APPLIED` qui inverse `currentWeights`/`proposedWeights` du proposal ciblé — ce n'est jamais une suppression, toujours une nouvelle entrée traçable. Comme ce nouveau proposal est lui aussi `APPLIED`, il retombe sous la fenêtre `MIN_DAYS_BETWEEN_APPLICATIONS` : un rollback bloque de fait un nouvel auto-apply pendant 7 jours, ce qui réalise la règle « un auto-apply annulé par semaine et par marché » sans logique de rate-limit distincte codée dans le controller.

En parallèle, `AdjustmentService` calcule aussi des corrélations shadow (`computeShadowCorrelations`, Spearman) entre trois features non encore actives dans le scoring (`shadow_h2h`, `shadow_congestion`, `shadow_injuries`) et l'issue des paris réglés, sur les 200 derniers paris. Au-delà de `SHADOW_ACTIVATION_RHO_THRESHOLD = 0.15` et `MIN_BET_COUNT`, une feature shadow est auto-activée via un `AdjustmentProposal` (poids inchangés, note d'activation) — c'est le mécanisme réel derrière l'activation progressive de H2H/congestion en production.

## Suspension de marché (`risk/`)

`RiskService.checkMarketRoi(market)` (`apps/backend/src/modules/risk/risk.service.ts`) lit les `RISK_CONSTANTS` de `risk.constants.ts` :

- **Alerte** : ROI < `-0.10` sur les 30 derniers paris non-`VOID` (`ROI_ALERT_THRESHOLD` / `ROI_ALERT_BET_COUNT`) → notification `sendRoiAlert`, aucune suspension.
- **Auto-suspension** : ROI < `-0.15` sur 50+ paris non-`VOID` (`ROI_SUSPENSION_THRESHOLD` / `ROI_SUSPENSION_BET_COUNT`) → création d'une ligne `MarketSuspension { active: true, triggeredBy: 'auto' }` (idempotent — vérifie `isMarketSuspended` avant de recréer) et notification `sendMarketSuspensionAlert`.

Il n'existe aucun endpoint de réactivation dans le code (`marketSuspension` n'est écrit que par `risk.service.ts`, en lecture par `betting-engine.service.ts` pour exclure les marchés suspendus des picks, et en lecture par `audit.repository.ts`) : la réactivation d'un marché suspendu n'est pas automatisable par construction — elle exige une intervention manuelle en base, conformément à la règle produit.

## Constantes de configuration critiques

| Constante                                                              | Valeur                                                           | Fichier                                                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `EV_THRESHOLD`                                                         | `0.08`                                                           | `apps/backend/src/modules/betting-engine/ev.constants.ts`                                                                    |
| `EV_MAX_SOFT_ALERT`                                                    | `0.60`                                                           | `apps/backend/src/modules/betting-engine/ev.constants.ts` (alerte de calibration, pas un filtre)                             |
| `CALIBRATION_GATE.MAX_DIVERGENCE`                                      | `0.30`                                                           | `apps/backend/src/modules/betting-engine/ev.constants.ts`                                                                    |
| `MAX_LEG_EDGE`                                                         | `0.10`                                                           | `apps/backend/src/modules/coupon/coupon.constants.ts` — plafond d'edge appliqué à toute jambe de coupon                      |
| `INVESTMENT_GUARDRAILS.maxEdge` / `.minOdds`                           | `0.10` / `1.20`                                                  | `apps/backend/src/modules/investment/investment.constants.ts` — mêmes garde-fous remontés du coupon vers la surface Investir |
| `MIN_BET_COUNT`                                                        | `50`                                                             | `apps/backend/src/modules/adjustment/adjustment.constants.ts`                                                                |
| `MAX_WEIGHT_CHANGE`                                                    | `0.05`                                                           | `apps/backend/src/modules/adjustment/adjustment.constants.ts`                                                                |
| `MIN_DAYS_BETWEEN_APPLICATIONS`                                        | `7`                                                              | `apps/backend/src/modules/adjustment/adjustment.constants.ts`                                                                |
| `CALIBRATION_TRIGGER_THRESHOLD` / `BRIER_TARGET`                       | `0.20`                                                           | `apps/backend/src/modules/adjustment/adjustment.constants.ts`                                                                |
| `RISK_CONSTANTS.ROI_ALERT_THRESHOLD` / `ROI_ALERT_BET_COUNT`           | `-0.10` / `30`                                                   | `apps/backend/src/modules/risk/risk.constants.ts`                                                                            |
| `RISK_CONSTANTS.ROI_SUSPENSION_THRESHOLD` / `ROI_SUSPENSION_BET_COUNT` | `-0.15` / `50`                                                   | `apps/backend/src/modules/risk/risk.constants.ts`                                                                            |
| `BANKROLL_LIMITS` (`MAX_DEPOSIT`, `MAX_BET_WIN`)                       | `2 000 000` / `10 000 000`                                       | `apps/backend/src/config/bankroll.constants.ts`                                                                              |
| `SLIP_LIMITS` (`MAX_UNIT_STAKE`, `MAX_ITEMS`, `MAX_POTENTIAL_RETURN`)  | `500 000` / `10` / `5 000 000`                                   | `apps/backend/src/config/bankroll.constants.ts`                                                                              |
| `FEATURE_FLAGS.SCORING.*`                                              | booléens (H2H, H2H_MARKET_SIGNALS, CONGESTION, ML_CORRECTION, …) | `apps/backend/src/config/feature-flags.constants.ts`                                                                         |
| `AUTH_LOGIN_RATE_LIMIT`                                                | `5` tentatives / `60 000` ms                                     | `apps/backend/src/config/rate-limit.constants.ts`                                                                            |

Écart avec `EVCORE.md`/`CLAUDE.md` à noter : le plafond de poids LLM/OpenClaw (`≤ 0.30`) est une règle produit documentée, mais aucun code du backend ne référence `OpenClaw`, un delta LLM (`llm_delta`) ou une constante de cap dédiée — le canal `VANTAGE` (LLM contextuel, en production depuis le 2026-08-28) reste un canal de scoring déterministe classique côté `ChannelStrategyOrchestrator`, sans injection de poids LLM dans le calcul EV. Cette règle est donc à ce jour une contrainte de garde-fou pour une intégration future, pas un mécanisme câblé et vérifiable dans `apps/backend/src/modules/betting-engine/`.

`ETL_CONSTANTS`, `BULLMQ_QUEUES`, `ETL_CRON_SCHEDULES` et `ETL_SCHEDULER_KEYS` (tous dans `apps/backend/src/config/etl.constants.ts`) définissent respectivement les délais de rate-limit par fournisseur (API-Football 6 s, stats 2 s, The Odds API 500 ms), les files BullMQ, les cron d'automatisation quotidienne/hebdomadaire, et les clés stables d'`upsertJobScheduler`. Un gap connu y est documenté en commentaire : aucun cron ne réanalyse un fixture entre la veille au soir (`BETTING_ENGINE_ANALYSIS`, 20 h UTC) et son coup d'envoi — seul l'endpoint manuel `POST /betting-engine/analyze/date/:date` permet une passe le jour même.

## Accès base de données

- `PrismaService` (`apps/backend/src/prisma.service.ts`) expose un client Prisma singleton (`@evcore/db`) et gère sa fermeture propre (`onModuleDestroy`).
- Chaque `*.repository.ts` encapsule toutes les requêtes Prisma pour un modèle (ou un petit groupe de modèles étroitement liés) — les services (`*.service.ts`) n'importent jamais `PrismaService` pour des requêtes métier complexes qui devraient vivre dans un repository ; certains services simples (audit en lecture seule, agrégations) injectent néanmoins `PrismaService` directement pour des requêtes ponctuelles, ce qui reste conforme tant qu'aucune logique métier n'accompagne la requête.
- Les colonnes Postgres suivent la convention Prisma camelCase (`scheduledAt`, `couponProposalId`, `isCorrect`) — toujours entre guillemets doubles en SQL brut.
- `ConfigService` (`@nestjs/config`) est le canal attendu pour tout accès à une variable d'environnement dans un service (voir `etl.service.ts`). Deux exceptions réelles subsistent dans le code : `auth.constants.ts` (`COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN`) et `support.gateway.ts` (`process.env.CORS_ORIGINS`) lisent `process.env` directement au niveau module — à traiter comme une dette, pas comme un second pattern valide.

## Tests

- Framework : Vitest (`apps/backend/vitest.config.ts`), fichiers colocalisés en `*.spec.ts` à côté du fichier testé (ex. `adjustment.constants.spec.ts` à côté d'`adjustment.constants.ts` au niveau `config/`, et le même schéma dans chaque module).
- `apps/backend/test/setup/prisma-test.ts` fournit `truncateAllTables()` sur une vraie base de test Postgres via le client Prisma réel (`@evcore/db`) — aucun mock du client Prisma : les tests d'intégration écrivent et relisent des lignes réelles, tronquées entre les runs.
- Un `vitest.config.e2e.ts` distinct existe pour les tests de bout en bout, séparé de la config unitaire par défaut.
