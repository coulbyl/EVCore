# EVCore — Reste à faire

> État au 04/11/2026. Seulement ce qui est ouvert et encore vrai. Les chantiers
> datés (plan stratégies phase 4, plafond IA, lots ML, relectures du 10/11 et du
> 10/12) sont dans [ROADMAP.md](ROADMAP.md). L'ancien fichier, avec ses
> décisions et mesures, est archivé dans
> [docs/archive/TODO-2026-10.md](docs/archive/TODO-2026-10.md).

## Utilisateur (préalables)

- [ ] **Renouveler l'abonnement API-Football Pro avant le 05/11 à 11:55 UTC** (7 500 requêtes par jour couvrent tout le plan stratégies).
- [ ] Vérifier en prod que `STATS_BACKFILL_ENABLED` n'est pas à `false` (encore honorée à `false`, `stats-backfill.service.ts`) ; si elle vaut `true` ou est absente, la retirer du `.env` (`docs/audits/2026-10-31/ENV-NETTOYAGE.md`). Les effectifs de #301 dépendent du rattrapage des stats.
- [ ] Serveur : si `/opt/apps/scripts/deploy-evcore.sh` nomme les services, y ajouter `backend-worker` ; brancher la sonde `GET /health/worker` (200 / 503) sur la supervision ; vérifier qu'aucun cron serveur n'appelle les routes retirées (`/risk/report/weekly`, `/etl/status`…) (`docs/audits/2026-11-02/TODO.md`).

## Dépendances

- [ ] Retirer de `minimumReleaseAgeExclude` (`pnpm-workspace.yaml`) `@nestjs/*@12.3.2` après le 10/11 ; `pnpm install` ne doit rien changer au lockfile. _multer et body-parser retirés le 05/11, lockfile inchangé ; audit prod : plus aucun avis élevé (restent fast-uri sous `prisma > @prisma/dev`, outil de dev, correctif 3.1.9 admissible le 16/11, et deepmerge sans correctif publié)._
- [ ] A10c : finir l'audit des dépendances quand la garde de délai laisse passer les correctifs (`pnpm update -r --no-save` puis `pnpm audit`) ; à décider à part : js-yaml sous `@nestjs/swagger`, uuid sous testcontainers, zod 3 sous la CLI shadcn, deepmerge (`docs/refonte-ui/15-todo.md`).

## Produit (questions de mesure, `docs/refonte-ui/15-todo.md`)

- [ ] Une lecture à 1 chance sur 3 (Detroit City – Hartford Athletic, 31/10) : regarder les candidats (`readingOf`, `matches-reading.ts`) et décider d'un plancher de chance ou de laisser le match « sans lecture ».
- [ ] Le désaccord de l'IA est-il prédictif ? Sur les lectures réglées, taux de réussite quand l'IA joue un pari incompatible avec le nôtre contre les autres ; à mesurer sur la cohorte v5/v6 vers le 10/11.

## Moteur et calibration

- [ ] Sous-blocs totaux par équipe / clean sheet / win-to-nil / DNB / mi-temps jamais re-fittés après les facteurs de λ du 06/10 : attendre une saison de plus par ligue, ou un fit hiérarchique.
- [ ] Sous-annonce résiduelle 2026 de la famille « buts » (Over 2.5 : 0,518 annoncé, 0,539 réalisé) : à relire au prochain re-fit du global sur une saison 2026 complète.
- [ ] Le 1X2 (`rebalanceThreeWayProbabilities`) n'a pas le retrait par ligue vers le taux de base des marchés dérivés (ligues pauvres en données).
- [ ] `CALIBRATION_MARKET = Market.ONE_X_TWO` (`adjustment.service.ts`) : choix MVP, à réévaluer comme décision produit.
- [ ] Pénalité longshot et `calibration_alert` : seuils globaux, pas par ligue ; `RESULT_BTTS`, `FIRST_HALF_WINNER`, `OVER_UNDER` 4,5 non couverts (trop peu de volume aux cotes longues).

## Backtest

- [ ] `packages/db/scripts/backtest-channel-league-whitelist.ts` lit les `channel_selection` enregistrées au lieu de rejouer le pipeline actuel : le réécrire en rejeu, ou ne pas s'en servir pour justifier une activation.
- [ ] Migrer les scripts `packages/db/scripts/backtest-*.ts` vers `packages/backtest-core/scripts/` (priorité aux scripts à risque, `docs/backtest-harness-architecture.md` § 1).
- [ ] `BacktestRunner` assemble les entrées mais pas la prédiction finale : extraire de `BettingEngineService.analyzeFixture` le calcul des λ et du côté favori.
- [ ] Elo FRI (`fri-model.service.ts` / `fri-model.utils.ts`) non extrait vers `analysis-core` + `PointInTimeLoader`.

## Dette technique

- [ ] Appels Prisma hors repository encore présents dans `rolling-stats.service.ts`, `betting-engine.service.ts`, `bet-settlement.service.ts`, `etl.service.ts`, `calibration.service.ts`, `fri-model.service.ts`, `fixture-scoring.service.ts`, `congestion.service.ts`, `h2h.service.ts` : à déplacer quand on touche le fichier (règle CLAUDE.md).
- [ ] `evaluatedMarkets` / `EvaluatedMarket` dans le contexte de stratégie : plus aucun canal ne le lit depuis VALUE/SAFE en phase 2 ; candidat au nettoyage.
- [ ] Enum `NotificationType` sans `CALIBRATION_ALERT` (`packages/db/prisma/schema.prisma`) : l'alerte de calibration reste dans `features.calibration_alert` (lu par la fiche), sans notification (`docs/archive/etl-renforcement-coherence.md`). Migration à décider ; les valeurs mortes (`SUBSCRIPTION_*`, `ML_MODEL_*`) sont conservées volontairement.
- [ ] Images de déploiement trop lentes : 9 min 22 s dont 6 min 24 s sur le serveur (28/10). À optimiser une fois les lots en cours finis.
