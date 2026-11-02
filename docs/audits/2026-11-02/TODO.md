# Lot perf / sécurité / dépendances — todo, un commit par ligne

_Branche `chore/perf-security-deps`. Rapport : [PERF-SECURITE-DEPENDANCES.md](PERF-SECURITE-DEPENDANCES.md). Décisions du 02/11 : class-validator gardé pour les DTO (Standard Schema pour la config seulement), module ML du backend retiré (`apps/ml-worker` gardé), pas d'`@nestjs/observe`, `/coupons/indices` et `/backtest/*` supprimés, backend séparé en deux processus (modèle iddia `main.worker.ts`), notifications refaites (lot N). Une seule PR vers `main` à la fin, après `/code-review high`._

_Mesures de départ (copie de prod du 02/11, 7,9 Go) : `odds_snapshot` 6,1 Go / 25,2 M lignes ; `notification` 2 351 lignes, dont 1 234 `XG_UNAVAILABLE_REPORT` et 410 `MORNING_BRIEF` (4 lues) ; `user_notification_read` 1 679._

## A. Fluidité

- [x] A1 `perf(web): server renders call the API on the internal network` — `API_INTERNAL_URL` (serveur seulement, repli `NEXT_PUBLIC_API_URL`), posée dans le compose de prod ; le rendu serveur transmet l'adresse du joueur (`X-Forwarded-For`) pour que la limite de débit compte par joueur (reste de A13 de la refonte). _Fait : `SERVER_BACKEND_URL` dans `server-api.ts` seul (jamais dans le bundle client, `shared.ts` reste public). L'en-tête du proxy est transmis tel quel : le backend fait confiance à un saut (`trust proxy 1`) et lit la dernière entrée, celle que le proxy a vue — un joueur qui forge l'en-tête ne change que les entrées de gauche. Les lectures publiques (`cookieHeader: ""`) ne lisent aucun en-tête et restent en cache._
- [ ] A2 `perf(web): loading boundaries on every screen and sheet` — `loading.tsx` avec les squelettes existants, squelette de fiche de match.
- [ ] A3 `feat(web): pending state on tapped rows` — `useLinkStatus` sur les lignes de match, de coupon et de résultat.
- [ ] A4 `perf(web): stream the match sheet by block, unread count beside the session` — `<Suspense>` par bloc, non-lus en parallèle.

## B. Sécurité

- [ ] B1 `chore(deps): drop dead dependencies` — `@react-email/ui`, `groq-sdk`, `cheerio`, deps mortes de `packages/ui` et du vantage-worker, catalogue mort.
- [ ] B2 `refactor(storage): read the RustFS keys from the .env only` — retirées des Intégrations (backend, admin, test de connexion, doc).
- [ ] B3 `fix(backend): API reference outside production only`.
- [ ] B4 `ci: scan images with Trivy, pin actions by digest, block on prod audit` — modèle iddia, `.trivyignore` daté, `dependency-review`, `semver-release-action@master` remplacée, `rustfs` épinglée.

## D. Code mort

- [ ] D1 `refactor(backend): remove routes no screen calls` — § 4.1 du rapport, plus `/coupons/indices` et `/backtest/*` (lisent `channel_selection` sans déduplication).
- [ ] D2 `refactor(backend): remove the ML module` — inférence, ordonnanceur, e-mails ML, `ML_WORKER_URL`.
- [ ] D3 `chore: remove dead files and scripts`.

## P. Deux processus

- [ ] P1 `refactor(backend): run queues and schedules in a worker process` — `main.worker.ts` + `WorkerModule` (`createApplicationContext`, sans HTTP) ; l'API ne garde que les files où elle dépose ; test de séparation des arbres de modules ; service `backend-worker` dans les deux compose.
- [ ] P2 `feat(backend): worker heartbeat and GET /health/worker` — bail et battement de cœur par tâche (`worker_job`), 503 nommant les tâches en retard.
- [ ] P3 `feat(backend): event-loop delay in the request log` — `monitorEventLoopDelay` par processus, pour mesurer le gain de P1.

## N. Notifications

- [ ] N1 `refactor(notification): one deliver() for the bell and the push` — préférence, ligne, puis push ; les 5 appelants n'appellent plus que lui.
- [ ] N2 `feat(push): deliver through a queue in the worker` — file `push-delivery`, concurrence bornée, nouvel essai sur 429/5xx.
- [ ] N3 `feat(push): notification id, tag, TTL and urgency` — un push de la même conversation remplace le précédent, le résumé du matin expire à midi.
- [ ] N4 `feat(web): a tapped push marks its notification read, badge follows live` — `?n=<id>`, `postMessage` → `router.refresh()`, `setAppBadge`.
- [ ] N5 `feat(notification): push operations alerts to admins` — ETL, voyant rouge, suspension de marché ; bruit `XG_UNAVAILABLE_REPORT` regardé.
- [ ] N6 `feat(notification): 90-day retention` — tâche quotidienne dans le worker, cloche bornée à 90 jours.

## C. NestJS 12 et dépendances

- [ ] C1 `chore(deps): upgrade NestJS to 12` — compagnons 12, `errorFormat` fixé, hooks vérifiés.
- [ ] C2 `refactor(config): validate the env through ConfigModule's schema`.
- [ ] C3 `chore(deps): minor upgrades, @types/node 24, Prisma held on 7`.
- [ ] C4 `refactor(vantage-worker): job schedulers instead of repeatable jobs`.

## E. Base

- [ ] E1 `feat(db): pg_stat_statements` — extension + `shared_preload_libraries` ; p95 de la fiche relevé avant / après.
- [ ] E2 `perf(db): drop redundant indexes`.
- [ ] E3 `refactor(adjustment): Prisma out of the controller`.

## F. Fin

- [ ] F1 `test(web): player e2e green on main`.
- [ ] F2 Revue `/code-review high`, corrections, bilan ici, PR.
