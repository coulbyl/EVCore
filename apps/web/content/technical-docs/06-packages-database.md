# Packages partagés & base de données

EVCore est un monorepo pnpm/Turborepo. Le dossier `packages/` regroupe le code partagé entre `apps/backend`, `apps/web`, `apps/docs` et les workers (`apps/ml-worker`, `apps/vantage-worker`, `apps/etl`...). Cette page documente cinq packages structurants : `packages/db`, `packages/analysis-core`, `packages/backtest-core`, `packages/ui` et `packages/transactional`.

## packages/db (@evcore/db)

`@evcore/db` est le client Prisma singleton partagé par toute l'application — aucun autre package ou app ne doit instancier son propre `PrismaClient`.

`packages/db/src/client.ts` construit ce singleton via `@prisma/adapter-pg` (adapter pg, pas le moteur natif Prisma), avec un pattern global (`globalForPrisma`) qui évite la multiplication d'instances en dev (hot reload). La connexion utilise `PGBOUNCER_URL` en priorité (PgBouncer devant Postgres, en prod comme en dev), avec repli sur `DATABASE_URL`. Le paramètre `max` du pool `pg` (10 par défaut) est le vrai plafond de requêtes concurrentes côté app — il est distinct du paramètre `connection_limit` de l'URL, qui ne s'applique qu'au moteur natif Prisma et est ignoré par l'adapter pg.

`packages/db/src/index.ts` réexporte `prisma` et l'intégralité des types générés (`./generated/prisma/client.js`). `packages/db/src/seed.ts` initialise les données de référence (compétitions suivies, avec leur `leagueId` API-Football, leur code interne et leur `csvDivisionCode` pour l'import CSV historique).

### Modèles Prisma structurants

Le schéma vit dans `packages/db/prisma/schema.prisma` et compte une quarantaine de modèles. Les plus structurants :

| Modèle                                 | Rôle                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Competition`                          | Une ligue/compétition suivie (code interne, `leagueId` API-Football, inclusion backtest)                                                 |
| `Season`                               | Une saison d'une compétition (bornes de dates, regroupe les `Fixture`)                                                                   |
| `Team`                                 | Une équipe, rattachée à une compétition                                                                                                  |
| `Fixture`                              | Un match : équipes, horodatage, score, xG, statut (`SCHEDULED`, `POSTPONED`...)                                                          |
| `TeamStats`                            | Stats glissantes d'une équipe après un `Fixture` donné (forme, xG, taux de victoire...) — features du scoring déterministe               |
| `ModelRun`                             | Une exécution de l'Betting Engine sur un `Fixture` : score déterministe, delta LLM (Phase 2), score final, snapshot des features         |
| `ChannelDecision`                      | Une décision par canal (DOMINANT, VALUE, DRAW...) pour un `ModelRun` donné — immuable après création                                     |
| `ChannelSelection`                     | Le(s) pick(s) retenu(s) au sein d'une `ChannelDecision` (marché, pick, probabilité, cote, EV, résultat)                                  |
| `Bet`                                  | Un pari par marché et par `ModelRun` — probabilité estimée, cote, EV, stake, statut de règlement                                         |
| `OddsSnapshot`                         | Un instantané de cotes pour un `Fixture`/marché/bookmaker — scaffolding Phase 2, `NO_BET` si absent en live                              |
| `AdjustmentProposal`                   | Une proposition d'ajustement des poids du modèle, auto-appliquée par le backend quand la calibration le déclenche (schéma `calibration`) |
| `MarketSuspension`                     | Suspension automatique d'un marché (ROI < -15 % sur 50+ paris) — schéma `calibration`                                                    |
| `CouponProposal` / `CouponProposalLeg` | Un coupon proposé par le moteur (cote combinée, probabilité jointe, score de signal) et ses jambes                                       |
| `User`                                 | Compte utilisateur (rôle, MFA, préférences)                                                                                              |
| `Notification`                         | Notification in-app (broadcast admin/ops ou personnelle)                                                                                 |
| `Subscription` / `SubscriptionEvent`   | Suivi de la mise virtuelle automatique et de la discipline de suivi                                                                      |
| `MlModelVersion`                       | Versionning des modèles ML entraînés par `ml-worker` (Phase 3, shadow)                                                                   |
| `NationalTeamEloRating`                | Notation Elo des équipes nationales (source eloratings.net)                                                                              |

Le schéma Prisma est en `multiSchema` : la plupart des modèles vivent dans `public`, tandis que `AdjustmentProposal` et `MarketSuspension` (ainsi que les modèles de reporting de calibration) sont isolés dans un schéma Postgres dédié `calibration`, au sein de la même base de données — pas de base séparée.

### Scripts sous packages/db/scripts

Le dossier `packages/db/scripts/` concentre des scripts `tsx` exécutés en ligne de commande (via les entrées `db:*` de `packages/db/package.json`), organisés en trois familles :

- **Audits** (`audit-fixtures.ts`, `audit-channel-market-league-calibration.ts`, `fri-goal-model-audit.ts`, `fri-elo-audit.ts`...) : contrôles de cohérence et de calibration sur les données déjà en base.
- **Backtests** (préfixe `backtest-*`, plusieurs dizaines de scripts) : validation de calibration par marché/signal (shrinkage BTTS, GOALS, TEAM_TOTAL, ajustements H2H, fenêtre de signal, ranking coupon...). Chacun est un script autonome ; ce ne sont pas les mêmes backtests que ceux orchestrés par `apps/backend/src/modules/backtest` ou rejoués via `packages/backtest-core` — voir la section suivante pour la distinction.
- **Maintenance** (`db-stats.ts`, `purge-analysis-data.ts`, `purge-day-analysis.ts`, `cleanup-legacy-ml-models.ts`, `scheduled-fixtures-report.ts`) : statistiques, purges ciblées et rapports opérationnels.

## packages/analysis-core (@evcore/analysis-core)

`@evcore/analysis-core` est le noyau déterministe pur d'EVCore : toute la logique de scoring, de probabilité, de sélection et de settlement, extraite du backend pour être **strictement identique** en production et en backtest.

### Frontière non négociable

Le package n'a aucune dépendance infra : pas de DB, pas de HTTP, pas de Redis, pas de NestJS, pas de BullMQ, pas d'accès à `process.env`. Entrées et sorties sont des objets simples ; même entrée, même sortie. Cette frontière est vérifiée automatiquement par `packages/analysis-core/src/architecture.guard.spec.ts`, qui scanne tous les fichiers source et fait échouer le build au moindre import interdit (`@nestjs/*`, `@evcore/db`, `@prisma/*`, `ioredis`, `bullmq`, `process.env`).

### Contenu du noyau

D'après `packages/analysis-core/src/index.ts`, le package exporte :

- `types/` — les enums de domaine (`Market`, `StrategyChannel`, `ChannelDecisionStatus`, `ModelRunPhase`, `SportType`) définis en `const object` + union type, **source de vérité** ; Prisma garde des enums aux mêmes valeurs mais ne les définit plus.
- `ev/` — la formule `EV = probabilité × cote − 1` (`ev-math.ts`).
- `probability/` — dérivation Poisson, H2H, congestion des calendriers, shrinkage over/under, résolution des stats d'équipe.
- `score/` — score déterministe et features ML partagées avec `ml-worker` (`ml-features.ts`, contrat `ml-shadow-contract.json`).
- `selection/` — évaluation et validation des picks, pricing des combinés.
- `strategies/` — l'implémentation des canaux (DOMINANT, VALUE, SAFE, BTTS, DRAW, GOALS, DOUBLE_CHANCE, TEAM_TOTAL, CLEAN_SHEET, CONSENSUS, AVOID, CORRECT_SCORE, DRAW_NO_BET, WIN_TO_NIL, WIN_EITHER_HALF, FIRST_HALF, OVER_UNDER_HT, HALF_TIME_FULL_TIME, RESULT_BTTS, RESULT_TOTAL_GOALS), leur config et l'orchestrateur.
- `settlement/` — résolution du statut d'un pari après résultat (`resolvePickBetStatus` et variantes).
- `metrics/` — score de Brier, erreur de calibration, ROI plat, drawdown.
- `pricing/` — assemblage des cotes multi-bookmakers.

### État d'avancement réel

L'extraction décrite dans `lab.md` (à la racine du repo) est **entièrement terminée** : les étapes 0 à 6 du plan sont cochées. Concrètement :

- Les enums de domaine ont migré vers `analysis-core/types`, avec un test de conformité côté backend qui casse le build si un enum Prisma diverge de sa contrepartie noyau.
- Toute la logique pure (EV, probabilité, sélection, stratégies, settlement, métriques) a été déplacée tranche par tranche, chaque tranche prouvée iso-comportement par les specs existantes (616/616 tests verts au moment de la bascule, golden specs inchangés).
- `apps/backend` (module `betting-engine`) et le module `backtest` du backend consomment `analysis-core` via de purs fichiers shims de réexport — zéro logique dupliquée. `ml-worker` consomme le contrat `MlShadowFeatures` défini dans `analysis-core/score/ml-features.ts`.
- Le domaine calibration (`AdjustmentProposal`, `MarketSuspension`) est passé sur un schéma Postgres dédié (`calibration`) dans la base unique, pas une base séparée.

Il ne reste, selon `lab.md`, qu'un point ouvert non bloquant : la politique de rétention/volumétrie du schéma `calibration` (partitionnement à reconsidérer seulement au-delà d'1M+ lignes).

## packages/backtest-core (@evcore/backtest-core)

`@evcore/backtest-core` est le harnais partagé de rejeu point-in-time pour les backtests — distinct d'`analysis-core`, qui fournit la logique de scoring elle-même.

### Rôle

Le package garantit qu'un backtest ne peut jamais lire une donnée « du futur » par rapport à l'instant rejoué. `packages/backtest-core/src/point-in-time-loader.ts` est le seul fichier du package autorisé à importer `@evcore/db` (règle enforcée par son propre `architecture.guard.spec.ts`) : chaque lecture historique (cotes, stats d'équipe, H2H, congestion) y est bornée par un paramètre `asOf`, appliqué à l'horodatage propre de chaque donnée — jamais seulement à la date du match.

Trois briques :

- `PointInTimeLoader` — unique point d'accès à la base pour les données de rejeu.
- `ReplayEngine` — parcourt les fixtures chronologiquement (générateur asynchrone), résout chaque étape via le loader.
- `BacktestRunner` — assemble, pour chaque fixture, l'ensemble des entrées point-in-time disponibles (cotes, stats des deux équipes, H2H, congestion) en un seul step enrichi.

Le scope actuel du `BacktestRunner` est explicitement documenté comme partiel : il assemble les **entrées** du modèle, pas encore la probabilité finale — la composition complète (dérivation des lambdas, détermination du favori pour le scoring H2H) reste à extraire de `BettingEngineService.analyzeFixture`.

### Articulation avec analysis-core et le module backend backtest

- `analysis-core` fournit les fonctions pures de scoring (Poisson, EV, stratégies) — le « quoi calculer ».
- `backtest-core` fournit le mécanisme de rejeu fiable dans le temps — le « comment lire l'historique sans tricher » — et importe `analysis-core` pour les types/fonctions qu'il assemble (`FullOddsSnapshot`, `TeamStatsInput`, signaux H2H et congestion).
- Le module `apps/backend/src/modules/backtest` (controller, repository, `channel-backtest.service.ts`, `model-calibration.service.ts`, `channel-tuning.service.ts`) reste l'orchestration NestJS : il consomme `analysis-core` pour le scoring et s'appuie sur les mêmes garanties de non-fuite temporelle que `backtest-core` formalise.
- Les scripts `backtest-*` de `packages/db/scripts/` restent des scripts autonomes plus anciens/ciblés ; ils ne passent pas nécessairement par `backtest-core`. Un vrai backtest, au sens des conventions du projet, doit rejouer le pipeline actuel sur données historiques — jamais relire des décisions déjà enregistrées en base avec une config aujourd'hui périmée.

## packages/ui (@evcore/ui)

`@evcore/ui` est la bibliothèque de composants React partagée entre `apps/web` et `apps/docs`, basée sur shadcn/ui (style `new-york`, base color `neutral`, `cssVariables: true`, cf. `packages/ui/components.json`).

Conventions :

- Chaque composant shadcn est exposé comme point d'entrée dédié dans `exports` de `packages/ui/package.json` (`@evcore/ui/button`, `@evcore/ui/card`, `@evcore/ui/data-table`...) plutôt que via un unique barrel — cohérent avec la règle du projet « chaque fichier importe seulement ce qu'il utilise, pas de barrel re-export ».
- `packages/ui/src/components/` regroupe une cinquantaine de composants : primitives shadcn standard (`button.tsx`, `dialog.tsx`, `select.tsx`, `sidebar.tsx`, `data-table.tsx`...) et composants composites propres au produit (`stat-card.tsx`, `feature-card.tsx`, `filter-bar.tsx`, `table-card.tsx`, `top-nav.tsx`).
- `data-table.tsx` s'appuie sur `@tanstack/react-table`, conformément à la convention du projet de piloter tri/pagination/visibilité des colonnes par un modèle de colonnes réutilisable plutôt que par de l'état ad hoc.
- Dépendances notables : Radix UI (`radix-ui`), `class-variance-authority` pour les variants, `tailwind-merge`/`clsx` pour la composition de classes (`lib/utils.ts`, réexporté aussi comme `cn`), `react-hook-form` + `@hookform/resolvers` + `zod` pour les formulaires, `next-themes` pour le thème clair/sombre.
- Toute évolution de composant shadcn doit passer par `pnpm dlx shadcn@latest docs <component>` et une prévisualisation `--dry-run`/`--diff` avant modification, conformément aux règles du projet.

## packages/transactional (@evcore/transactional)

`@evcore/transactional` contient les templates d'emails transactionnels, construits avec React Email (`@react-email/components`, `@react-email/render`).

- `packages/transactional/src/emails/` : un fichier par email — `email-verification.tsx`, `password-reset.tsx`, `roi-alert.tsx`, `market-suspension.tsx`, `brier-alert.tsx`, `weight-adjustment.tsx`, `ml-model-activated.tsx`, `ml-model-missing.tsx`, `etl-failure.tsx`, `xg-unavailable-report.tsx`, `weekly-report.tsx`, `support-message.tsx`. Les noms recoupent directement les événements métier du backend (alertes ROI, suspension de marché, propositions d'ajustement de poids, échecs ETL, xG indisponible).
- `packages/transactional/src/components/` : mise en page et styles partagés entre emails (`evcore-layout.tsx`, `palette.ts`, `shared-styles.ts`).
- `packages/transactional/src/render.ts` expose la fonction de rendu HTML consommée par le module `notification` du backend (envoi via Nodemailer, conformément à `EVCORE.md`/`CLAUDE.md`).
- `pnpm --filter @evcore/transactional dev` lance `email dev --dir src/emails`, la prévisualisation locale React Email.

## Rappel — accès base de données

Conformément à `CLAUDE.md` :

- La base PostgreSQL tourne dans Docker. **Jamais** de `psql` direct ni de `prisma db execute` — ces commandes ne sont pas disponibles dans cet environnement.
- Toute requête ad hoc passe par `docker exec evcore-postgres psql -U postgres -d evcore -c "..."`.
- Les colonnes Postgres sont en camelCase (convention Prisma) : toujours les quoter dans du SQL brut, par exemple `"scheduledAt"`, `"couponProposalId"`, `"isCorrect"`.
- Les migrations Prisma et les scripts comme `regenerate-coupons.js` doivent être communiqués à l'utilisateur pour exécution — jamais lancés directement par l'agent.
