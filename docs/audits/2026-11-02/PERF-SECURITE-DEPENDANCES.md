# Performance, sécurité, dépendances et code mort — état au 02/11/2026

_Demande : préparer une PR « performance, sécurité, mise à jour des dépendances, NestJS 12, Prisma, CI de sécurité des images comme iddia, nettoyage du code mort », avec la lenteur de la fiche de match et l'absence d'indicateur de chargement. Scan fait sur `main` (99508109), sans démarrer Docker ni les serveurs : les mesures en base (EXPLAIN, tailles de tables) restent à faire sur la copie de prod._

## 0. En une page

| #   | Constat                                                                                                                                                                                                                  | Gravité         | Effort             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------ |
| 1   | **Aucun `loading.tsx` dans toute l'app** : un clic sur un match ne montre rien tant que le serveur n'a pas fini, et Next ne précharge rien d'une route dynamique sans cette frontière                                    | Haute (UX)      | S                  |
| 2   | **Le serveur Next appelle l'API par son adresse publique** (`https://api.c-evcore.com`) : chaque lecture d'un rendu sort sur Internet, repasse le proxy et le TLS, au lieu de `http://backend:3000` sur le réseau Docker | Haute (latence) | S                  |
| 3   | Les squelettes de chargement **existent déjà** (`screen-skeleton.tsx`, `skeleton.tsx`) mais ne sont branchés nulle part                                                                                                  | —               | S                  |
| 4   | `pnpm audit` : 5 critiques, 15 hautes. Les 5 critiques (RCE Next) viennent d'**une** dépendance de dev inutilisée, `@react-email/ui`                                                                                     | Haute           | XS                 |
| 5   | En prod : DoS `body-parser` et `multer` via `@nestjs/platform-express` 11 — corrigé seulement en NestJS 12 (multer 2.5.0, express 5.3.0)                                                                                 | Haute           | M (avec NestJS 12) |
| 6   | Pas de scan des images, actions GitHub non épinglées par empreinte (`semver-release-action@master`)                                                                                                                      | Moyenne         | S                  |
| 7   | La référence d'API (`/reference`, Scalar) est publique en prod : toute la surface de l'API est listée                                                                                                                    | Moyenne         | XS                 |
| 8   | Clés RustFS en double (`.env` et Intégrations) — cause de la panne du stockage de ce matin                                                                                                                               | Moyenne         | S                  |
| 9   | ~45 routes backend qu'aucun écran n'appelle, un module ML encore chargé, 6 dépendances mortes, 8 entrées de catalogue mortes                                                                                             | Basse (dette)   | M                  |
| 10  | 18 fichiers hors dépôt appellent Prisma (dont un contrôleur), 3 index redondants, `odds_snapshot` sans rétention                                                                                                         | Basse → Moyenne | M                  |

Ordre proposé pour la PR : § 8.

---

## 1. La fiche de match lente, et rien ne bouge au clic

### Ce qui se passe au clic sur un match

1. La ligne de match est un `<Link>` vers `/matches/[id]`, interceptée par `@sheet/(.)matches/[id]` qui rend `MatchSheetView`, un **composant serveur**.
2. Next demande au serveur le rendu de ce segment. **Sans `loading.tsx`, rien n'a été préchargé** : la doc embarquée le dit en toutes lettres — pour une route dynamique, le préchargement s'arrête « au segment le plus proche qui a une frontière `loading.js` » (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`, l. 302). Il n'y en a aucune dans `apps/web/app`.
3. Côté serveur Next, `MatchSheetView` lit la session puis la fiche : `getPlayerSession()` (→ `GET /auth/me`) et `getMatchSheet()` (→ `GET /matches/:id/sheet`). **Chacune part vers `NEXT_PUBLIC_API_URL`** (`lib/api/shared.ts`) : sortie du conteneur, DNS, proxy public, TLS, retour.
4. Côté backend, la fiche fait 5 requêtes en 3 allers-retours séquentiels (en-tête → 4 en parallèle → cotes jouables), mises en cache par match (`SharedReads`, `SCREEN_READS_TTL_MS`). Les index nécessaires existent (`model_run(fixtureId, analyzedAt)`, `channel_decision(modelRunId, channel)`, `channel_selection(channelDecisionId, rank)`, `fixture(homeTeamId|awayTeamId, status, scheduledAt)`). À froid, sans le cache, c'est là que le temps part — à mesurer (§ 5).
5. Pendant tout ce temps, l'écran ne change pas : pas de squelette, pas d'état « en cours » sur la ligne touchée.

### Corrections

| Correction                                                                                                                                                                               | Où                                                              | Effet                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loading.tsx` sur chaque segment d'écran (`today`, `matches`, `results`, `me`, `notifications`, `ticket`, admin) et sur les slots `@sheet`                                               | `apps/web/app/(player)/**`                                      | La coquille (bandeau + squelette) est préchargée et s'affiche **au clic**, sans attendre le serveur                                                          |
| Brancher `ScreenSkeleton` / `Skeleton` (déjà écrits, hauteurs des vrais blocs, `aria-busy`) + un squelette de fiche pour le tiroir                                                       | `components/scoreboard/states/`                                 | Rien à dessiner de neuf                                                                                                                                      |
| `useLinkStatus` sur les lignes cliquables (match, coupon, résultat) : une pastille ou un voile discret sur la ligne touchée                                                              | `match-row.tsx`, lignes de coupon et de résultat                | Retour immédiat **même sur réseau lent**, quand le préchargement n'a pas fini (doc : `01-getting-started/04-linking-and-navigating.md`, § « Slow networks ») |
| Adresse interne pour les appels serveur : variable serveur `API_INTERNAL_URL=http://backend:3000` (dans le compose, pas le `.env` : c'est la topologie), repli sur `NEXT_PUBLIC_API_URL` | `lib/api/shared.ts`, `server-api.ts`, `docker-compose.prod.yml` | Supprime l'aller-retour Internet + TLS sur **chaque** lecture serveur, sur tous les écrans                                                                   |
| `<Suspense>` par bloc dans la fiche : l'en-tête et « Notre lecture » d'abord, la forme et les autres paris en streaming                                                                  | `match-sheet.tsx`                                               | Premier contenu plus tôt sur une fiche froide                                                                                                                |
| Mise en page joueur : `getUnreadCount()` attend la session puis part seul (`app/(player)/layout.tsx` l. 66)                                                                              | idem                                                            | Un aller-retour de moins au chargement complet                                                                                                               |

À vérifier après coup : le budget « LCP ≤ 2,5 s à froid en Slow 4G » de `docs/refonte-ui/16-performance-et-qualite.md` § 2, que la CI mesure déjà (`web-budgets`) — mais sur un faux backend local, donc sans le coût réseau du point 2.

---

## 2. Sécurité

### 2.1 Dépendances (`pnpm audit`, 02/11)

5 critiques, 15 hautes, 20 moyennes, 5 basses (Dependabot en compte 41 sur `main`).

| Source                                                                                           | Ce qu'elle amène                                                                                                                        | Dans une image de prod ?         | Correction                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@react-email/ui` 6.5.0 (devDependency de `packages/transactional`, **inutilisée** d'après knip) | Les 5 critiques (RCE Next 16.0–16.4.0 : Image Optimization, `use cache`, `next/og`) et la plupart des hautes (Next, `postcss`, `sharp`) | Non (dev), mais sur chaque poste | **Retirer la dépendance** : la moitié de l'audit disparaît                                                                        |
| `@nestjs/platform-express` 11.2.7                                                                | `body-parser` (DoS, haute), `multer` 2.0–2.4 (DoS, haute)                                                                               | **Oui, backend**                 | NestJS 12 : `platform-express@12.3.2` embarque `multer 2.5.0` et `express 5.3.0` ; la branche 11 (11.2.8) reste en `multer 2.4.0` |
| `shadcn` (CLI, `packages/ui`)                                                                    | `systeminformation` (haute, Windows), `zod` < 4.6.6                                                                                     | Non                              | Mettre à jour `shadcn` 4.22                                                                                                       |
| `@nestjs/cli`, `@nestjs/swagger`, `@testcontainers/postgresql`                                   | `fast-uri`, `glob`, `minimatch`, `js-yaml`, `uuid` (moyennes/basses)                                                                    | Non (sauf `js-yaml` via swagger) | Montée NestJS 12 + testcontainers 12                                                                                              |

Le web de prod est en `next@16.4.2` : hors des plages critiques listées.

### 2.2 Images et CI — reprendre le modèle iddia

iddia (`.github/workflows/docker.yml`) :

- **Trivy** installé depuis sa release immuable, **vérifiée par empreinte SHA-256** — jamais par son action ni son image, détournées en mars 2026 (GHSA-69fq-xp46-6x23) ;
- l'image est construite en `.tar`, **scannée avant d'être poussée** : un premier passage liste tout (CRITICAL, HIGH), le second bloque (`--ignore-unfixed --exit-code 1`) ; une faille acceptée un temps va dans `.trivyignore` avec sa date de fin ;
- toutes les actions **épinglées par empreinte de commit** (`actions/checkout@3d3c42e…  # v7.0.1`) ;
- seules les images dont le code a changé sont reconstruites (job « Pick the images to build ») ; les autres sont recopiées sous le nouveau tag.

EVCore aujourd'hui (`deploy.yml`, `ci.yml`, `release.yml`) : aucun scan, actions épinglées par étiquette (`@v6`, `@v7`), `K-Phoen/semver-release-action@master` (une branche : n'importe quel commit poussé dessus s'exécute avec nos secrets), les trois images reconstruites à chaque fois (9 min 22 s mesurées le 28/10).

À faire :

1. Scan Trivy dans `deploy.yml` pour backend, web et vantage-worker, même procédure qu'iddia, `.trivyignore` daté.
2. Épingler **toutes** les actions par empreinte (commentaire avec la version), remplacer `@master`.
3. `pnpm audit --audit-level high --prod` dans `ci.yml` (bloquant), et `actions/dependency-review-action` sur les PR.
4. Plus tard : ne reconstruire que les images touchées (gain direct sur les 9 min).

### 2.3 Le backend et le web

| Point                                                                                                                        | État                                                      | À faire                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `helmet`, `compression`, throttler global + limites strictes sur `/auth/*`, `trust proxy 1`, `ValidationPipe({ whitelist })` | En place                                                  | —                                                                                                                         |
| Référence d'API Scalar sur `/reference`                                                                                      | **Publique en prod**                                      | La servir hors production seulement, ou derrière le jeton admin                                                           |
| Content-Security-Policy du web                                                                                               | Absente (noté dans `next.config.mjs`)                     | Écrire la liste réelle des origines (API, stockage, images api-sports) — en mode `Report-Only` d'abord                    |
| Clés RustFS dans Intégrations **et** dans le `.env`                                                                          | Deux sources, ont divergé ce matin (`InvalidAccessKeyId`) | Retirer `storage.accessKey` / `storage.secretKey` des Intégrations : le stockage lit le `.env`, comme le conteneur RustFS |
| `rustfs/rustfs:latest`                                                                                                       | Non épinglée                                              | Épingler la version qui tourne (`docker inspect evcore-rustfs`)                                                           |
| Prisma dans un contrôleur (`adjustment.controller.ts`)                                                                       | Règle CLAUDE.md non tenue                                 | Déplacer dans le dépôt                                                                                                    |

---

## 3. Dépendances et migrations

### 3.1 NestJS 12 (sorti le 27/08, 12.3.2 au 30/10)

**Pourquoi y aller** : il corrige les deux failles de prod du § 2.1 ; c'est la ligne maintenue (11 passe en `legacy`).

**Ce qui nous concerne dans les ruptures** ([guide de migration](https://docs.nestjs.com/migration-guide), [notes de version](https://github.com/nestjs/nest/releases/tag/v12.0.0)) :

- Node : 20.19+ / 22.12+ à l'exécution (images en `node:24-alpine`) ; **24.15+ pour `nest upgrade`** (poste local en 24.15.0 : OK).
- TypeScript 6 exigé par `@nestjs/schematics` 12 (on y est déjà : 6.0.2).
- **Ordre des hooks de cycle de vie** par niveau de hiérarchie : à vérifier sur les `onModuleInit` qui s'enchaînent (stockage, intégrations, `EtlService` qui pose ses planifications, `MlModule.onApplicationBootstrap`).
- `@Optional()` n'est plus hérité par un constructeur redéclaré d'une sous-classe (rétabli en 12.1 seulement sans constructeur).
- Forme des erreurs du `ValidationPipe` : nouvelle option `errorFormat` — la fixer explicitement et vérifier ce que le web lit (`extractFirstErrorMessage`).
- `ConsoleLogger` : paramètres structurés par défaut (on logge par pino, peu d'impact).
- Express : vidange des requêtes en cours à l'arrêt — vérifier l'arrêt avec la passerelle socket.io et les workers BullMQ.

**Paquets compagnons** : `@nestjs/config` 12.0.1, `@nestjs/swagger` 12.1.0, `@nestjs/bullmq` 12.0.0 (accepte BullMQ 3 à 6), `@nestjs/throttler` 6.7.1 (accepte Nest 12), `@nestjs/cli` 12, `@nestjs/schematics` 12, `@nestjs/testing` 12. Procédure : `nest upgrade --dry-run`, puis `nest upgrade`, puis typecheck, lint, tests, et un démarrage local.

**Nouveautés, et ce qu'elles valent pour EVCore** :

| Nouveauté                                                                                                                                            | Intérêt                                                                  | Recommandation                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard Schema** : `@Body({ schema })`, `StandardSchemaValidationPipe`, `ConfigModule.forRoot({ validationSchema: z.object(...) })`               | Zod partout (on a déjà Zod pour l'externe et un `ENV_SCHEMA` Zod manuel) | Utiliser **pour la config** tout de suite (remplace `env.schema.ts` validé à la main). Pour les DTO : CLAUDE.md impose class-validator, qui reste pleinement supporté — **décision à prendre**, pas dans ce lot                                                                             |
| **@nestjs/observe** (0.3.x) : p95 par route, traces jusqu'aux requêtes `pg`, jobs BullMQ (attente, tentatives), erreurs groupées, CPU/mémoire/boucle | Exactement ce qui manque pour mesurer la fiche de match                  | Service **hébergé** (pas d'export OTLP ni Prometheus), offre gratuite 300 000 événements/mois, coupée au-delà, 3 jours de rétention ; il envoie par défaut des lignes de code source. **Pas maintenant** : d'abord le journal de requêtes existant + `pg_stat_statements` (§ 5), sans tiers |
| Diagnostic des conflits de routes (`routeConflictPolicy`)                                                                                            | Attrape un `@Get(':id')` qui masque `@Get('me')`                         | Activer en `warn`                                                                                                                                                                                                                                                                           |
| `errorCode` dans les exceptions HTTP                                                                                                                 | Le web branche aujourd'hui sur le statut                                 | Utile, pas urgent                                                                                                                                                                                                                                                                           |
| ESM                                                                                                                                                  | Optionnel ; aucun gain mesuré au démarrage ni en mémoire                 | **Rester en CommonJS**                                                                                                                                                                                                                                                                      |
| CLI (rspack, `nest build --parallel`)                                                                                                                | Nous compilons avec SWC                                                  | Rien à faire                                                                                                                                                                                                                                                                                |

### 3.2 Prisma

- Nous sommes en **7.10.1**, la dernière stable. Le tag `latest` de npm pointe sur **Prisma 8.0.0-rc.29** : une réécriture (contrat à la place de `schema.prisma`, `@prisma/orm-postgres`, requêtes chaînées), encore sans `$extends`, écritures imbriquées ni niveaux d'isolation d'après les premiers retours. **Ne pas migrer** ; épingler le catalogue sur `^7` pour qu'un `pnpm update` ne monte pas en RC par erreur.
- Ce que Prisma 8 apportera et qu'on peut faire **dès maintenant en SQL de migration** : index partiels et d'expression.

### 3.3 Le reste

| Paquet                                                                                                                                     | Actuel → dernier                                        | Avis                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `next`                                                                                                                                     | 16.4.2 → 16.4.4                                         | Mineure, à prendre                                                                                                                                                                                                                                                 |
| `bullmq`                                                                                                                                   | 5.81 → 6.5                                              | **Bloqué** : le vantage-worker pose encore deux tâches répétables à l'ancienne (`queue.add(..., { repeat })`, `apps/vantage-worker/src/main.ts` l. 60–90), que BullMQ 6 refuse. Passer d'abord à `upsertJobScheduler` (comme le backend), en BullMQ 5, puis monter |
| `ioredis`                                                                                                                                  | 5 → 6                                                   | Avec BullMQ 6                                                                                                                                                                                                                                                      |
| `typescript`                                                                                                                               | 6.0.2 → 7.0.2 (compilateur natif, beaucoup plus rapide) | Pas avant NestJS 12 stabilisé ; vérifier `emitDecoratorMetadata`                                                                                                                                                                                                   |
| `eslint` 10, `vitest` 5, `@types/node` 26, `lucide-react` 1, `@tanstack/react-table` 9, `react-day-picker` 10, `@react-email/components` 1 | Majeures                                                | Un lot à part, une à la fois                                                                                                                                                                                                                                       |
| `@types/node`                                                                                                                              | 22                                                      | Monter en **24** (on tourne en Node 24)                                                                                                                                                                                                                            |
| Mineures (`resend`, `openai`, `prettier`, `turbo`, `typescript-eslint`, `shadcn`, `@scalar/…`)                                             | —                                                       | À prendre dans ce lot                                                                                                                                                                                                                                              |

Garde-fou existant à garder : `minimumReleaseAge: 20160` (14 jours) dans `pnpm-workspace.yaml`.

---

## 4. Code mort

Méthode : routes des contrôleurs backend comparées au code du web, du worker, de `docs/exploitation.md` et des workflows ; knip 5 sur le monorepo. Une route appelée par une adresse construite dynamiquement peut échapper à la recherche : **chaque suppression se confirme d'abord**.

### 4.1 Routes backend qu'aucun écran ni procédure n'appelle (45 sur 160)

| Groupe                                | Routes                                                                                                                                                                                      | Origine                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ancien tableau de bord                | `GET /dashboard/{summary, track-record-summary, competition-stats, channel-health, channel-stats, ai-track-record, channel-stats-by-competition}`, `POST /dashboard/announcements/:id/read` | Anciennes pages `/dashboard/*` (redirigées)                                      |
| Ancien écran Décisions                | `GET /channel-decisions/{by-match, by-channel, facets}`                                                                                                                                     | Écran retiré                                                                     |
| Anciens écrans coupons                | `GET /coupons/{abstentions, track-record, indices, followed/summary}`, `POST /coupons/:id/view`                                                                                             | `indices` était gardé le 09-03 pour la calibration : **à confirmer**             |
| Risque / audit                        | `/risk/*` (6), `/audit/*` (3)                                                                                                                                                               | Ancienne admin                                                                   |
| ML                                    | `GET /reports/ml-promotion`                                                                                                                                                                 | ML retiré                                                                        |
| Formation                             | `/formation/progress` (3)                                                                                                                                                                   | Remplacée par l'aide (`/me/help`)                                                |
| Exploitation remplacée par la console | `GET /etl/status`, `GET /etl/schedulers`, `DELETE /etl/queue/:name/failed`, `/etl/stats-backfill/{status,pause,resume,run}`                                                                 | Remplacées par `/console/queues/*` et `PUT /console/stats-backfill`              |
| Divers                                | `PATCH /notifications/read-all`, `POST /coupons/settle`, `POST /coupons/:id/settle`                                                                                                         | Le règlement par plage les couvre                                                |
| Recherche                             | `/backtest/{channels,tuning,calibration}`                                                                                                                                                   | Outils d'étude : à garder ou à passer en script                                  |
| **À garder**                          | `POST /adjustment/:id/rollback`                                                                                                                                                             | Exigé par CLAUDE.md (retour arrière humain) — à ajouter à `docs/exploitation.md` |

### 4.2 Modules et fichiers

- **Module ML du backend** (`modules/ml/` : inférence, ordonnanceur, écouteur d'entraînement), toujours chargé dans `app.module.ts` ; l'appel `predictShadowCorrection` est derrière `FEATURE_FLAGS.SCORING.ML_CORRECTION = false`, le ml-worker n'est plus déployé, et la proposition ML v2 exclut tout appel ML à l'analyse. À retirer avec ses deux e-mails (`ml-model-missing`, `ml-model-activated`), `ML_WORKER_URL` du schéma d'env, et le job `ml-worker` de `ci.yml` si `apps/ml-worker` n'est plus testé d'ici le lot ML v2. **Décision à prendre** : garder `apps/ml-worker` tel quel (décidé le 01/11) ou l'archiver.
- Web : `components/scoreboard/ui/score-line.tsx` (inutilisé). Les squelettes sont aussi signalés : **à brancher, pas à supprimer** (§ 1).
- Backend : `config/bankroll.constants.ts`, scripts `apps/backend/scripts/*` et `src/scripts/*` non référencés (à trier : outils ponctuels déjà joués ?).
- Le retour de `/dashboard/*` (`app/dashboard/[[...retired]]`, `helpers/retired-routes.ts`, redirections de `next.config.mjs`) : à retirer une fois que les anciens favoris ne servent plus (journal des 404 à regarder).
- knip signale aussi 69 exports et 106 types exportés inutilisés : à trier, beaucoup sont des faux positifs (e-mails rendus par nom, pages `*.dev.tsx`).

### 4.3 Dépendances mortes

| Paquet                          | Dépendance                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/backend`                  | `groq-sdk` (le backend est sans LLM depuis le 09-03), `cheerio` (aucun import)        |
| `packages/transactional`        | `@react-email/ui` (§ 2.1)                                                             |
| `packages/ui`                   | `@hookform/resolvers`, `zod`                                                          |
| `apps/vantage-worker`           | `decimal.js`, `ioredis` (à vérifier : connexion BullMQ)                               |
| Catalogue `pnpm-workspace.yaml` | `@tiptap/*` (4), `recharts`, `@tanstack/react-query`, `driver.js`, `socket.io-client` |

`prisma` et `pino-pretty` sont signalés à tort (CLI des migrations dans l'image, transport pino par nom).

---

## 5. Prisma et la base : des requêtes rapides

### Ce qui est déjà bien

Adaptateur `pg` + PgBouncer en mode transaction, pool de 18 par processus sous un pool serveur de 25 ; SQL brut pour les écrans, avec `DISTINCT ON` et les index qui vont avec ; lectures d'écran partagées en mémoire (`SharedReads`) ; un point d'entrée par écran.

### Ce qui manque

1. **On ne mesure rien en prod.** Activer `pg_stat_statements` (`shared_preload_libraries` dans le compose de Postgres, une extension en migration) : il donne, par requête, le nombre d'appels, le temps moyen et le total. C'est la première chose à regarder avant toute optimisation.
2. **La ligne de journal par requête d'API existe** (`common/http/request-log.ts` : route, statut, durée). Il reste à s'en servir : extraire le p95 de `GET /matches/:id/sheet` des journaux de prod (`docker logs evcore-backend`) avant et après le lot.
3. **`EXPLAIN (ANALYZE, BUFFERS)` des 5 requêtes de la fiche** sur la copie de prod, à froid (le cache `SharedReads` masque le coût réel).
4. **`odds_snapshot` n'a aucune rétention** (`ODDS_SNAPSHOT_RETENTION_DAYS` retirée) : la plus grosse table grossit sans fin, et toutes les lectures de cotes la parcourent. Mesurer sa taille (`pg_total_relation_size`) ; si elle domine, partitionner par mois ou archiver ce qui n'est ni clôture ni ouverture.
5. **Index redondants** (coût à chaque écriture, rien en lecture) : `model_run(fixtureId)` (couvert par `(fixtureId, analyzedAt)`), `channel_decision(modelRunId)` (couvert par l'unique `(modelRunId, channel)`), `bet(fixtureId)` (couvert par l'unique `(fixtureId, pickKey, userId)`). Vérifier dans `pg_stat_user_indexes` qu'ils ne servent pas, puis les retirer.
6. **18 fichiers hors dépôt appellent Prisma** (ETL, moteur, risque, ajustement — et un contrôleur). Règle CLAUDE.md : on déplace quand on y touche ; le contrôleur est à faire dans ce lot.

### Se former (Prisma 7)

- `select` explicite toujours (ou `omit`), jamais l'objet entier vers un écran ;
- pas d'`await` dans une boucle : `IN (...)`/`ANY($1)`, `Promise.all` par tranches (`async.utils.ts`) ;
- pagination par curseur, `take` sur toute liste ;
- un index par chemin de lecture, écrit dans la migration qui ajoute la lecture, et l'`EXPLAIN` dans le commit quand le plan n'est pas trivial ;
- `$queryRaw` typé pour les lectures d'écran agrégées, l'API Prisma pour les écritures ;
- la taille du pool : processus × `DATABASE_POOL_MAX` ≤ `MAX_CLIENT_CONN` de PgBouncer, et le pool serveur PgBouncer ≤ `max_connections` de Postgres.

---

## 6. Next.js : une app fluide et rapide

Les règles de `docs/refonte-ui/16-performance-et-qualite.md` tiennent (serveur par défaut, un point d'entrée par écran, peu de JavaScript côté joueur, budgets Lighthouse en CI). Ce qui manque pour la **sensation** de vitesse, dans l'ordre de la doc embarquée (`node_modules/next/dist/docs/`) :

1. **`loading.js`** : frontière de préchargement + affichage instantané (`03-api-reference/03-file-conventions/loading.md`).
2. **`useLinkStatus`** : le retour au toucher quand le réseau est lent (`03-api-reference/04-functions/use-link-status.md`).
3. **`<Suspense>` par bloc** : streaming de ce qui est lent sans retenir le reste.
4. **Préchargement** : les `<Link>` du joueur sont en mode par défaut — c'est bien, à condition d'avoir les `loading.tsx`.
5. **À étudier ensuite** : `cacheComponents` / `partialPrefetching` (préchargement des parties statiques de chaque route) et `staleTimes` (réutiliser un écran déjà vu au retour arrière). Changement de modèle de cache : un lot à part, mesuré.

---

## 7. Ce que j'ajoute à la liste

- **Les 8 tests e2e joueur qui échouent sur `main`** : une CI rouge masque les vraies régressions ; à remettre au vert dans ce lot.
- **`API_INTERNAL_URL`** pour le web (§ 1) — le gain le plus large pour le moins de code.
- **Rétention de `odds_snapshot`** (§ 5).
- **Retrait des clés de stockage des Intégrations** (§ 2.3), demandé ce matin.
- **`.trivyignore` daté** et une règle : une faille acceptée a une date de fin.
- **Images plus rapides** : ne reconstruire que l'image touchée (modèle iddia).

---

## 8. Le lot proposé — une branche, petits commits, une PR

Branche `chore/perf-security-deps`, depuis `main`. Chaque ligne = un commit.

**A. Fluidité (ce que le joueur sent)**

1. `API_INTERNAL_URL` pour les appels serveur du web + compose de prod.
2. `loading.tsx` sur chaque écran et chaque tiroir, avec les squelettes existants ; squelette de fiche de match.
3. `useLinkStatus` sur les lignes de match, de coupon et de résultat.
4. Fiche de match : `<Suspense>` par bloc ; mise en page : nombre de non-lus en parallèle de la session.

**B. Sécurité** 5. Retirer `@react-email/ui` (+ `groq-sdk`, `cheerio`, dépendances mortes de `packages/ui`, catalogue mort). 6. Clés de stockage hors des Intégrations (backend, admin, test de connexion, doc). 7. `/reference` hors production (ou derrière le jeton admin). 8. CI : Trivy dans `deploy.yml` (modèle iddia), actions épinglées par empreinte, `pnpm audit --prod` bloquant, `dependency-review` sur les PR, `rustfs` épinglée.

**C. NestJS 12 et dépendances** 9. `nest upgrade` (Nest 12, config 12, swagger 12, bullmq 12, cli/schematics/testing 12), `errorFormat` fixé, hooks vérifiés. 10. Config validée par Standard Schema (le `ENV_SCHEMA` Zod passe dans `ConfigModule`). 11. Mineures (`next` 16.4.4, `resend`, `openai`, `shadcn`, `prettier`, `turbo`…), `@types/node` 24, catalogue Prisma épinglé `^7`. 12. vantage-worker : tâches répétables → `upsertJobScheduler` (prépare BullMQ 6, qui reste hors lot).

**D. Code mort** 13. Routes du § 4.1 confirmées, retirées avec leurs services, DTO et tests. 14. Module ML du backend et ses e-mails (selon décision). 15. Fichiers et scripts morts, exports inutilisés triés.

**E. Base** 16. `pg_stat_statements` ; p95 des écrans relevé dans les journaux de requête (avant / après). 17. Index redondants retirés (après lecture de `pg_stat_user_indexes`). 18. Prisma hors du contrôleur `adjustment`.

**F. Tests** 19. Les 8 e2e joueur remis au vert.

Hors lot (lots suivants) : BullMQ 6 / ioredis 6, TypeScript 7, ESLint 10, Vitest 5, majeures du web (lucide 1, TanStack Table 9, react-day-picker 10), `cacheComponents`, rétention d'`odds_snapshot` (après mesure), reconstruction sélective des images, CSP.

## 9. Décisions à prendre

1. **DTO** : garder class-validator (CLAUDE.md) ou passer à Zod via Standard Schema ? Recommandation : garder, Standard Schema pour la config seulement.
2. **Module ML du backend** : le retirer maintenant ? Recommandation : oui ; `apps/ml-worker` reste pour le lot ML v2.
3. **@nestjs/observe** : non pour l'instant (service tiers, quota gratuit court) ; journal de requêtes + `pg_stat_statements` d'abord.
4. **Routes « à confirmer »** : `/coupons/indices`, `/backtest/*`.

Sources : [NestJS 12 — notes de version](https://github.com/nestjs/nest/releases/tag/v12.0.0), [guide de migration](https://docs.nestjs.com/migration-guide), [InfoQ, octobre 2026](https://www.infoq.com/news/2026/10/nestjs-12-observability/), [NestJS Observe](https://docs.nestjs.com/observability/overview), [Prisma 8 vs 7](https://dev.to/fabwaseem/prisma-8-vs-prisma-7-should-you-upgrade-a-tested-migration-guide-p5b), [BullMQ, migration v5 → v6](https://docs.bullmq.io/guide/migrations/migrate-from-v5-to-v6).
