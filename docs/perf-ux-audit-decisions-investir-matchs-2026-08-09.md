# Audit perf + UX — Dashboard EVCore (2026-08-09)

> Rapport d'analyse — aucune modification de code effectuée. Sert de base de
> travail pour la session suivante. Périmètre étendu au fil de la session :
> Décisions/Investir/Matchs (perf), nav mobile + annonces + onboarding (UX),
> puis latence login + bug email reset password (repérés en cours de route).

## Résumé exécutif

| Sujet                                                                                         | Verdict                                                                                             | Priorité                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| N+1 sur `findNewCoachTeams` (Décisions + Investir)                                            | ✅ **Corrigé** (2026-08-09, branche `fix/perf-ux-audit`) — requête groupée au lieu du `count` en boucle | Haute                                          |
| Sur-fetch + dédup en mémoire sur `findByDate` (Décisions + Investir)                          | ✅ **Corrigé** (2026-08-09) — `DISTINCT ON` en SQL, même pattern que `investment-calibration.repository.ts` | Haute                                          |
| Pas de pagination forcée sur `/fixtures/scoring` (Matchs)                                     | ✅ **Corrigé** (2026-08-09) — `limit` par défaut à 50 + scroll infini frontend (`useInfiniteQuery`) | Moyenne                                        |
| Filtres `timeSlot`/`betStatus` appliqués après le fetch (Matchs)                              | ✅ **`timeSlot` corrigé** (borne SQL sur `scheduledAt`) — `betStatus` **laissé en mémoire** (risque de réécrire le join "dernier run / top-2 EV" pour un gain jugé trop faible vs le risque) | Basse (sauf si pas de `limit`)                 |
| Aucune pagination/virtualisation frontend (les 3 pages)                                       | **Matchs corrigé** (scroll infini) — Décisions/Investir toujours non paginés côté frontend          | Moyenne                                        |
| Inbox caché sur mobile, aucune notification in-app pour les messages support                  | **Notification in-app corrigée** (2026-08-09, `NotificationType.SUPPORT_MESSAGE`) — Inbox toujours absent de la nav mobile (§5.A, décision A1/A2 en attente) | Haute                                          |
| Aucun onboarding utilisateur (tour guidé, tooltips)                                           | **Confirmé, inexistant** — pas encore traité                                                        | Moyenne                                        |
| Annonces : pas de page historique, pas de notification in-app, lu/non-lu en localStorage seul | ✅ **Corrigé** (2026-08-09) — page `/dashboard/updates`, modèle `AnnouncementRead`, notification in-app, entrée de nav avec badge | Haute (bloquant si tu multiplies les annonces) |
| Bug "tab actif non stylé"                                                                     | **Non reproduit** dans les 3 écrans cités — voir §4, en attente de précision de ta part             | À clarifier avec toi                           |
| Regroupement par ligue / mode d'affichage                                                     | Inexistant sur ces 3 pages, mais un précédent réutilisable existe (Track Record) — pas encore traité | Fonctionnalité à construire                    |
| Latence au login — `scryptSync` bloquant l'event loop Node                                    | ✅ **Corrigé** (2026-08-09) — `crypto.scrypt` async, mêmes paramètres N/r/p/maxmem                  | Haute                                          |
| Email reset password → localhost en prod                                                      | ✅ **Corrigé** (`APP_URL` ajoutée en prod le 2026-08-09 — à vérifier après redéploiement/restart)   | —                                              |
| Logo EVCore invisible dans les emails transactionnels                                         | ✅ **Corrigé** (2026-08-09) — URL hébergée (`https://c-evcore.com/icons/icon-192.png`) au lieu du data URI | Moyenne                                        |
| Clé `GROQ_API_KEY` collée en clair dans le chat pendant la session                            | ✅ **Faite tourner** (confirmé par toi le 2026-08-09)                                                | **Haute, immédiate**                           |
| Aucun rate-limiting sur `POST /auth/login`                                                    | ✅ **Corrigé** (2026-08-09) — `@nestjs/throttler`, 5 tentatives/60s par IP                          | Haute                                          |
| Anomalie `RUS1` / marché DRAW : 0% hit sur 22 paris réglés                                    | ✅ **Expliquée et corrigée** (2026-08-09) — pas un signal RUS1 : `backtest-channel-league-whitelist.ts` comptait chaque repasse d'analyse (ADVANCE) comme un pari indépendant. n=22 réel = 6 matchs (aucun n'était nul). Dédup ajoutée, n global DRAW corrigé de 4838 → 3735 | Moyenne                                        |
| `settleProposal` écrit les legs puis le résultat coupon en séquence, hors transaction DB      | **Constaté, risque faible** — pas encore traité                                                     | Basse                                          |

---

## 1. Performance backend

### 1.1 Décisions — `ChannelDecisionRepository.findByDate` (`apps/backend/src/modules/betting-engine/channel-decision.repository.ts:222-297`)

- **Sur-fetch + dédup en mémoire.** Aucune pagination (`take`/`skip`). Chaque fixture peut avoir plusieurs `ModelRun` (ADVANCE → PRE_KICKOFF → LIVE) × plusieurs canaux × sélections — la requête charge tout, puis `latestPerFixtureChannel` (lignes ~400-412) déduplique **en Node** pour ne garder que la décision la plus récente par `(fixtureId, channel)`. Ce filtrage devrait être fait en SQL (`DISTINCT ON`), pas après coup.
- **Le bon pattern existe déjà dans ce repo** et n'est simplement pas appliqué ici : `InvestmentCalibrationRepository.computeMeanError` (`investment-calibration.repository.ts:40-63`) utilise un `$queryRaw` avec `DISTINCT ON` pour exactement ce type de problème. `SignalWindowService` (module coupon) fait de même pour son agrégat de calibration.
- **`select` imbriqué à 5 niveaux** (`channelDecision → modelRun → fixture → season → competition` + équipes + sélections) — pas anormal en soi pour Prisma, mais amplifie le volume transféré combiné au sur-fetch ci-dessus.

### 1.2 N+1 avéré — `ChannelDecisionRepository.findNewCoachTeams` (lignes 337-380)

Pour **chaque équipe distincte** du jour (jusqu'à ~260 si 131 matchs), le code fait un `fixture.count(...)` **dans une boucle** (`Promise.all([...teamAsOf.entries()].map(async (...) => { ... await fixture.count(...) }))`). C'est en parallèle (pas séquentiel), donc pas le pire cas possible, mais ça reste **N requêtes DB** au lieu d'une seule requête groupée (`groupBy` ou agrégat SQL). Ce code tourne à **chaque appel** de `listByMatch` ET `listByChannel` — donc à chaque chargement de Décisions ET d'Investir (qui réutilise `listByChannel`).

**C'est le point le plus actionnable de tout l'audit** : remplacer la boucle par une seule requête agrégée par équipe.

### 1.3 Investir — `InvestmentService.listBestPicks` (`investment.service.ts:259-354`)

- Hérite de **tous** les problèmes 1.1/1.2 via `listByChannel`.
- `findLambdaTotals` (requête séparée) est correct : un seul `findMany` avec `where: { id: { in: modelRunIds } }`.
- `computeMeanError` (calibration) est déjà bien fait (`DISTINCT ON`).
- Le `topN`/`maxPicks` n'est appliqué **qu'après** avoir tout chargé et trié en mémoire — pas un problème de volume aujourd'hui, mais scale mal si le nombre de picks/jour augmente.

### 1.4 Matchs — `FixtureScoringService.getFixtures` (`fixture-scoring.service.ts:118-236`)

- **Pagination optionnelle, pas forcée** : `FixtureScoringQueryDto.limit` est `@IsOptional()` sans défaut. Si le frontend n'envoie pas `limit`, **toutes** les fixtures du jour sont chargées sans `take`.
- Le `select` (modelRuns `take:1` → bets `take:2` → channelSelection…) est borné à chaque niveau — pas de N+1 ici, contrairement à Décisions.
- Les filtres `timeSlot` et `betStatus` sont appliqués **après** la requête (`.filter()` en mémoire, lignes ~241-245 et ~316-317) — anodin si `limit` est fourni par le frontend, aggrave le problème sinon (on filtre après avoir tout chargé).

### 1.5 Index Prisma

Globalement corrects pour les filtres actuels (`Fixture` a `@@index([status, scheduledAt])`, `@@index([seasonId, status, scheduledAt])`, `@@index([homeTeamId/awayTeamId, status, scheduledAt])`). Le problème n'est **pas** un manque d'index — c'est le nombre de requêtes (N+1) et le sur-fetch qui dominent.

### 1.6 Point non vérifié

Impossible de confirmer les routes exactes appelées par le frontend ni de mesurer les temps réels (EXPLAIN ANALYZE, logs) dans le temps imparti — audit basé sur lecture de code uniquement. À valider avec un profiling réel avant de prioriser strictement.

---

## 2. Performance frontend

Aucune pagination ni virtualisation trouvée sur `decisions/` ou `investment/` (pas de `react-window`/`react-virtual`, pas de `useInfiniteQuery`, pas d'`IntersectionObserver`). Toutes les cartes du jour sont rendues d'un coup :

- Décisions : `grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3` (`MatchGrid`)
- Investir : `columns-1 sm:columns-2 lg:columns-3` (masonry CSS)

Sur mobile, avec ~131 fixtures/jour et plusieurs picks chacune, ça peut contribuer à une lenteur perçue même si le backend répond vite (temps de rendu DOM + hydratation React). À traiter comme un axe séparé du backend, pas un substitut.

> **2026-08-09** — investigué en vague 4. Contrairement à Matchs, ni
> Décisions ni Investir n'ont de vrai sur-fetch à corriger : `/investments`
> est déjà plafonné à 15 picks/mode (`INVESTMENT_LIMITS.maxPicks`) ;
> `/channel-decisions/by-match|by-channel` (`ChannelDecisionListQueryDto`) n'a
> toujours aucun `limit`/`cursor`, mais son fetch reste borné à une seule
> journée (~131 matchs × quelques canaux, pas un historique qui grossit sans
> fin) — le vrai coût ici est le rendu DOM (toutes les cartes d'un coup), pas
> la taille de la requête réseau. **Décision : laissé de côté** — pas de
> problème mesuré aujourd'hui qui justifie le risque d'un rendu progressif ou
> d'une pagination SQL sur ces deux endpoints. À rouvrir seulement si une
> lenteur réelle est constatée sur ces pages.

---

## 3. Regroupement par ligue / modes d'affichage

Aucune des 3 pages ne groupe par ligue aujourd'hui — liste plate partout (par fixture pour Investir, par match pour Décisions). La capture "Indice de paris" (drawer d'agrégats stats, `coupon-indices-drawer.tsx`) n'est **pas** la vue "liste de matchs par ligue" que tu montres (1. Division, etc.) — cette vue-là n'a pas été retrouvée avec un vrai group-by-league ; possible qu'elle vienne d'un écran non couvert par cet audit.

**Précédent réutilisable déjà dans le repo** : Track Record (`apps/web/app/dashboard/track-record/components/channel-competition-section.tsx`) groupe par compétition via un **`Select`** (dropdown), pas des onglets — choix explicite car "10 canaux ne rentrent pas en onglets sans wrap sur mobile". Bon pattern à reprendre pour Décisions/Investir plutôt que d'inventer de nouveaux onglets qui déborderaient sur mobile avec ~35 compétitions/jour.

**Proposition à discuter** (pas encore décidée, à trancher à la prochaine session) :

- Un sélecteur "Grouper par : Aucun / Ligue" (dropdown, pattern Track Record) au-dessus de la liste
- Un toggle "Vue : Liste / Grille" indépendant du regroupement
- Groupement par ligue = simple `groupBy(competition.name)` côté client sur les données déjà chargées (pas de nouvel appel API) tant que la pagination n'est pas en place ; à revoir si on passe à une pagination serveur

---

## 4. Bug "onglet actif non stylé" — non reproduit, besoin de précision

Recherche menée sur les 3 écrans cités :

- Décisions ("Par match"/"Par canal") → `ScrollableTabs` (composant partagé)
- Investir ("Probabilité/Valeur/Sécurité/Victoire/Buts") → `ScrollableTabs`
- Nav bas + sidebar (Accueil/Décisions/Investir/Combinés/Formation) → `page-shell.tsx`/`app-shell.tsx`, classes conditionnelles `item.active ? ... : ...` correctement câblées

**Aucun bug trouvé dans le code de ces 3 écrans** — l'état actif vient de l'attribut `data-state="active"` posé automatiquement par Radix (pas une prop `isActive` gérée à la main), donc pas de piste de "prop non transmise" ici. Sur les captures fournies, les onglets actifs ("Par match", "Probabilité", nav "Décisions"/"Investir") semblent d'ailleurs correctement stylés (gras/soulignés) — je n'ai pas identifié visuellement l'onglet fautif sur les images partagées.

**Seule piste concrète trouvée** : dans `packages/ui/src/components/tabs.tsx` (variant `"line"`, ~lignes 67-70), le style de fond de l'onglet actif est défini par deux règles Tailwind qui peuvent entrer en conflit selon le thème clair/sombre — l'ordre de génération CSS (pas l'ordre d'écriture JSX) décide laquelle s'applique, ce qui peut donner un rendu incohérent en dark mode.

**Ce qu'il me faut pour trancher** : soit une capture précise de l'onglet fautif (avec le thème actif visible), soit le nom de l'écran si ce n'est pas un des 3 ci-dessus. Sans ça je risquerais de "corriger" un composant qui n'a rien.

---

## 5. Navigation mobile — Inbox caché, aucune notification in-app liée

**Confirmé.** La barre de nav basse mobile (`app-shell.tsx`, tableau `MOBILE_NAV_ORDER`) n'affiche que 5 items, filtrés explicitement :

```ts
const MOBILE_NAV_ORDER = [
  "/dashboard", // Accueil
  "/dashboard/decisions", // Décisions
  "/dashboard/investment", // Investir
  "/dashboard/coupons", // Coupons (pas "Combinés" — nom de route réel)
  "/dashboard/formation", // Formation
];
```

L'item **Inbox** (`/dashboard/inbox`, icône `MessageCircle`, badge `inboxUnreadCount`) existe pleinement — module backend complet (`apps/backend/src/modules/support/`, avec gateway temps réel + notifier), page frontend, compteur de non-lus — mais il est **absent de ce tableau**, donc invisible sur mobile. Accessible seulement via la sidebar desktop ou une URL directe.

**Aggravant confirmé** : les messages support ne créent **jamais** de ligne dans la table `Notification` — l'enum `NotificationType` (schema Prisma) ne contient aucune valeur du type `SUPPORT_MESSAGE`. `support-notifier.service.ts` déclenche uniquement un email et une notification push navigateur, jamais une entrée dans le système "cloche + `/dashboard/notifications`". Le seul signal visuel est le badge `inboxUnreadCount` sur l'item de nav Inbox — invisible sur mobile puisque l'item lui-même l'est. Un utilisateur mobile qui reçoit une réponse support ne le sait donc que par email/push navigateur (souvent désactivé/ignoré sur mobile), jamais par la cloche qu'il regarde déjà dans l'app.

### Propositions (à trancher ensemble)

**A. Faire de la place dans la barre basse** — 5 slots c'est déjà plein, il faut choisir :

- **A1.** Remplacer Formation par Inbox dans les 5 slots principaux, Formation reste accessible depuis Accueil/profil. Argument : Formation est un contenu de référence consulté occasionnellement, Inbox est une communication qui a une fenêtre de pertinence courte (l'utilisateur veut répondre vite).
- **A2. (recommandé)** Ajouter un 6ᵉ slot "Plus" (`MoreHorizontal`) qui ouvre une feuille (`Sheet`/`Drawer`) listant Inbox, Formation, Notifications, Profil — pattern "More" classique iOS/Android. Scale mieux si d'autres sections arrivent plus tard, n'oblige pas à sacrifier un item existant maintenant.

**B. Combler la déconnexion notification (indépendant de A, à faire dans tous les cas)**

- Ajouter `SUPPORT_MESSAGE` (ou `SUPPORT_REPLY`) à `NotificationType`, et faire créer une vraie ligne `Notification` par `support-notifier.service.ts` en plus de l'email/push existants — ça fait apparaître le message dans la cloche + `/dashboard/notifications`, visible partout, y compris mobile, sans dépendre de la visibilité de l'item Inbox.

---

## 6. Onboarding utilisateur — inexistant

**Confirmé, aucun mécanisme trouvé** (recherche exhaustive : pas de `react-joyride`/`driver.js`/`shepherd`, pas de composant tour/tooltip/welcome custom). Le module **Formation** (`apps/web/app/dashboard/formation/`) existe et est pédagogiquement solide, mais c'est **100% du contenu sur la stratégie de paris** (probabilités implicites, unité de mise, variance, canaux) — rien sur _comment utiliser l'interface EVCore elle-même_ (où trouver quoi, ce que veut dire un badge, comment lire un onglet). Les deux besoins sont réels et distincts.

### Propositions (combinables, pas exclusives)

1. **Pont contextuel vers Formation (quick-win, effort faible)** — une icône "?" discrète sur Décisions/Investir/Coupons qui ouvre directement l'article Formation pertinent (ex. Décisions → `comment-lire-un-pick.md`). Le contenu existe déjà, il manque juste la passerelle au bon moment/au bon endroit — aucun nouveau système à construire.
2. **Tour guidé au premier login (5-6 étapes max)** — `react-joyride` ou `driver.js` (à comparer : poids bundle, compat React 19), séquence Décisions → Investir → Coupons → Inbox/notifications. Un flag `hasSeenOnboarding` (nouvelle colonne `users`, migration à faire par toi selon la convention du repo) pour ne le montrer qu'une fois, rejouable depuis le profil ("Revoir le guide"). Jamais plus de 5-6 étapes — un tour trop long se ferme sans être lu.
3. **Empty states pédagogiques** — plutôt qu'un modal intrusif, des indices contextuels légers directement dans les écrans vides (ex. première visite sur Investir sans historique → encart explicatif au lieu d'un écran vide silencieux). Moins intrusif que 2, complémentaire.

**Séquence recommandée** : 1 (quick-win, cette semaine) → 3 (continu, à intégrer page par page) → 2 (le plus gros morceau, à cadrer à part avec choix de lib).

---

## 7. Annonces — pas d'historique, pas de notification in-app, lu/non-lu jamais synchronisé

**Confirmé.** Le mécanisme actuel (`apps/web/components/announcements.tsx`, hook `useDashboardAnnouncements`) montre **une seule annonce à la fois** — la plus récente non-fermée — en bannière sur le dashboard. Si tu multiplies les annonces, les précédentes deviennent **définitivement invisibles** dès qu'une nouvelle est publiée et que l'utilisateur ferme la bannière : il n'y a aucun endroit où revenir les consulter.

Trois lacunes structurelles, toutes confirmées :

1. **Aucune page utilisateur listant l'historique.** La seule route `/dashboard/announcements` existante est **strictement admin** (redirige un non-admin vers `/dashboard`) — c'est l'interface de création, pas de consultation. Aucune route `/dashboard/news`/`/updates` côté utilisateur n'existe.
2. **Lu/non-lu géré uniquement en `localStorage`** (`evcore:dashboard:announcements:dismissed:v1`) — pas de modèle `AnnouncementRead` côté serveur. Un utilisateur qui change d'appareil ou vide son cache revoit toutes les annonces déjà lues ; impossible de calculer un vrai compteur de non-lus fiable.
3. **Aucune notification in-app** — `announcements.service.ts::notifyPublished()` déclenche uniquement une **push navigateur** (`PushService`), jamais d'email, jamais de ligne dans la table `Notification` (l'enum `NotificationType` n'a pas de valeur `ANNOUNCEMENT_PUBLISHED`). Sur mobile sans push activée, une annonce publiée est invisible tant que l'utilisateur n'ouvre pas le dashboard par hasard avant qu'elle ne soit remplacée par la suivante.

### Propositions

1. **Page "Annonces" côté utilisateur** — nouvelle route (`/dashboard/announcements` restructurée par rôle, ou une route dédiée du type `/dashboard/updates` pour ne pas mélanger avec l'admin) listant toutes les annonces publiées non expirées, plus récente en premier, réutilisant le rendu riche déjà existant (`RichTextViewer`). C'est le prérequis direct à "multiplier les annonces" — sans ça, publier plus = en perdre plus.
2. **Modèle `AnnouncementRead`** (userId + announcementId, ou userId + `lastSeenAnnouncementId`) — remplace le `localStorage`, permet un vrai compteur de non-lus synchronisé entre appareils. Migration Prisma à faire par toi selon la convention du repo.
3. **`NotificationType.ANNOUNCEMENT_PUBLISHED`** — `notifyPublished()` crée aussi une ligne `Notification` (en plus de la push existante, pas à la place) → visible dans la cloche + `/dashboard/notifications`, cohérent avec la même correction proposée pour les messages support (§5.B) — les deux peuvent être faits ensemble, même pattern.
4. **Badge de compteur** sur l'entrée de nav vers la nouvelle page Annonces, une fois 2 en place — même réflexion que pour Inbox (§5.A) sur où le placer dans une barre mobile déjà pleine (le slot "Plus" proposé en §5.A2 est un bon candidat pour héberger Annonces également, pas seulement Inbox/Formation).

---

## 8. Latence au login — `scryptSync` bloque l'event loop

**Confirmé, et c'est probablement la vraie cause.** `auth.service.ts::login` (lignes ~124-190) ne fait que 2 requêtes DB simples (`user.findFirst` avec `select` explicite, puis `session.create`) — pas de relations imbriquées lourdes, ce n'est pas la source du problème.

Le hash de mot de passe (`auth.utils.ts:15-33`) utilise **`scryptSync`** (crypto natif Node), pas bcrypt/argon2, avec des paramètres lourds : `N=32768, r=8, p=1`, `maxmem` 64 Mo. Deux problèmes cumulés :

- Ces paramètres sont volontairement coûteux (bonne pratique sécurité), donc un calcul de 100-300ms+ est **attendu**, pas une anomalie en soi.
- Mais `scryptSync` est **synchrone** — il bloque la boucle d'événements Node pendant tout le calcul. Sous plusieurs logins concurrents, **chaque requête HTTP en cours sur le serveur** (pas seulement les logins) se met en pause pendant ce calcul. C'est ça qui transforme un coût de hash légitime en latence perçue globale, surtout si plusieurs utilisateurs se connectent en même temps.

**Fix ciblé** : remplacer `scryptSync` par la variante asynchrone `crypto.scrypt` (callback ou promisifiée via `util.promisify`) avec les **mêmes paramètres** N/r/p/maxmem — le calcul passe sur le thread pool de libuv au lieu de bloquer le thread principal. Aucun changement de sécurité, aucune migration de hash existant nécessaire (même algorithme, mêmes paramètres) — uniquement la façon de l'invoquer.

Pas de rate-limiter (`@nestjs/throttler`) trouvé sur `POST /auth/login` — pas la source de latence ici, mais à noter comme absence séparée (protection brute-force) si jamais utile pour un futur audit sécurité.

---

## 9. Email reset password → localhost en prod ✅ corrigé

> **2026-08-09** : `APP_URL` ajoutée aux variables d'environnement de prod.
> À vérifier après le prochain restart/redéploiement du backend (la variable
> est lue au démarrage) — déclencher un reset password de test et confirmer
> que le lien pointe vers `https://c-evcore.com/...`.

**Confirmé, bug réel, fix trivial.** `auth.service.ts:658-659` (méthode privée `createResetToken`, utilisée à la fois par le flow utilisateur et par `generateAdminResetLink` côté admin) :

```ts
const appUrl = this.config.get<string>("APP_URL", "http://localhost:3000");
const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
```

Le nom de variable (`APP_URL`) est cohérent entre le code et `.env.example` (bien documenté : "Public URL of the frontend — used for reset password links in emails.") — ce n'est **pas** un problème de nommage. Le fallback hardcodé `http://localhost:3000` s'applique silencieusement si `APP_URL` n'est pas définie dans l'environnement réel — et aucune trace de `APP_URL` n'existe dans un docker-compose/CI/Dockerfile de ce repo. Le bug vient donc très probablement d'un **oubli de définir `APP_URL` sur le serveur de prod** (devrait être `https://c-evcore.com` d'après le domaine de prod déjà utilisé ailleurs dans ce repo).

**Fix** : ajouter `APP_URL=https://c-evcore.com` aux variables d'environnement du déploiement prod (pas un changement de code). Isolé au flow reset password (utilisateur + admin) — la vérification d'email (OTP à 6 chiffres, `mail.service.ts:53-59`) n'utilise aucune URL, donc pas concernée par ce bug.

---

## 9bis. Logo EVCore invisible dans les emails — cause identifiée, pas un bug de code

**Confirmé sur la capture du reset password.** Le logo est inséré via `packages/transactional/src/components/evcore-layout.tsx:87-93` (composant `Img` de react-email) :

```tsx
<Img
  src={EVCORE_LOGO_DATA_URI}
  alt="EVCore"
  width="36"
  height="36"
  style={styles.logo}
/>
```

`EVCORE_LOGO_DATA_URI` (`packages/transactional/src/components/logo.ts`) est une image PNG encodée en base64 et **inlinée directement dans le HTML** (`data:image/png;base64,...`), plutôt qu'hébergée à une URL. Vérifié : la donnée elle-même est valide (décode en PNG correct, en-tête PNG conforme, 3085 octets) — **ce n'est pas un asset cassé ou tronqué**. `width`/`height` sont bien renseignés, donc pas un problème de dimension non plus.

**La vraie cause : les URI `data:` dans un `<img src>` sont peu fiables en email.** De nombreux clients mail (webmail Gmail en particulier, passerelles de sécurité d'entreprise) suppriment ou bloquent les images encodées en base64 directement dans le HTML — contrairement à une image hébergée à une vraie URL HTTPS, qui reste le standard recommandé pour l'email transactionnel précisément pour cette raison de compatibilité. Le composant/le code n'a pas de bug ; c'est le choix "data URI" qui ne tient pas sur tous les clients.

**Fix proposé** : héberger le logo à une URL statique réelle plutôt que de l'inliner — ex. `${APP_URL}/icons/icon-192.png` (fonctionnera maintenant que `APP_URL` est correctement configurée en prod, cf. §9), ou un asset servi par le frontend Next.js déjà existant (`apps/web/public/icons/icon-192.png`, source du data URI actuel d'après le commentaire dans `logo.ts`). Changement contenu à `evcore-layout.tsx` + suppression de `logo.ts`, aucun risque de régression ailleurs (le composant est déjà partagé par tous les emails transactionnels, donc un seul point à corriger règle tous les templates d'un coup).

---

## 11. Autres observations notées en cours de route (hors périmètre perf/UX initial)

Points relevés pendant le travail sur le générateur de coupon et pendant l'audit, jamais formalisés jusqu'ici.

### 11.1 Clé `GROQ_API_KEY` exposée en clair dans le chat — à faire tourner

Pendant la session, un `.env` de prod a été collé directement dans la conversation, contenant un `GROQ_API_KEY` réel. Je n'ai jamais reproduit ni loggé cette valeur (règle secrets du `CLAUDE.md`), mais elle est restée visible en clair dans l'historique de chat. **Si ce n'est pas déjà fait : faire tourner cette clé côté Groq dès que possible** — un secret vu une fois dans un chat ne doit plus être considéré comme confidentiel.

### 11.2 Aucun rate-limiting sur `/auth/login` ✅ corrigé

> **2026-08-09** : `@nestjs/throttler` ajouté, appliqué uniquement sur
> `POST /auth/login` (5 tentatives / 60s, suivi par IP) — pas de guard
> global, pas d'impact sur le reste de l'API. Vérifié en direct : 429 dès
> la 6ᵉ tentative.

Vérifié : aucun `ThrottlerModule`/`@Throttle` dans `apps/backend/src/modules/auth/` ni dans `app.module.ts`. Au-delà de la latence `scryptSync` déjà notée en §8, l'absence de limite de tentatives sur le login est un vrai gap de sécurité (brute force, credential stuffing) — indépendant du fix de perf, à traiter comme son propre chantier (`@nestjs/throttler` sur le contrôleur auth, ou au niveau guard global).

### 11.3 Anomalie de données — `RUS1` / marché DRAW à 0% hit (n=22) ✅ expliquée et corrigée

> **2026-08-09** : ce n'était pas un signal de ligue. `backtest-channel-league-whitelist.ts`
> comptait chaque repasse d'analyse (`ModelRun.phase = ADVANCE`, ré-exécutée
> à intervalles réguliers avant kickoff) comme un pari indépendant, au lieu
> de ne garder que la dernière passe par `(fixture, channel)` — même bug de
> fond que celui corrigé sur `findByDate` en vague 1, mais dans un script
> ad hoc plutôt que dans l'API de lecture. Vérification en base : les
> "22 paris" RUS1/DRAW étaient en réalité **6 matchs distincts** (aucun n'a
> fini nul — 2-4, 1-2, 2-1, 1-2, 0-2 — donc le 0% en lui-même était correct,
> mais sur un échantillon 3.7× plus petit que rapporté). Corrigé dans
> `fetchRows()` (dédup par dernière `analyzedAt` par fixture, même pattern
> `DISTINCT ON`). Effet mesuré à l'échelle globale : le nombre réel de
> sélections DRAW réglées passe de 4838 à 3735 — ce biais gonflait le n de
> **toutes** les ligues du script, pas seulement RUS1 ; certaines
> confirmations "n≥20" du whitelisting pourraient être à revérifier avec les
> chiffres corrigés (RUS1 lui-même tombe sous le seuil et disparaît du
> rapport).

Repéré dans les résultats du script `backtest-channel-league-whitelist.ts` (backtest per-league DRAW/BTTS de la Vague B/C) : la ligue russe `RUS1` affiche 0% de hit rate sur 22 paris DRAW réglés (ROI -100%), un écart bien plus extrême que les autres ligues à échantillon comparable. Jamais creusé plus loin — pourrait être un vrai signal (marché DRAW structurellement mauvais sur cette ligue), une anomalie de règlement (mapping fixture/score erroné côté ETL pour cette compétition), ou juste un petit échantillon malchanceux. À vérifier avant de faire confiance à `RUS1` dans n'importe quel canal, et avant d'étendre `DRAW_STAKED_LEAGUES`.

### 7.4 Body HTML brut affiché dans `/dashboard/notifications` ✅ corrigé

> **2026-08-09**, repéré en testant la vague 3 : `NotificationType.ANNOUNCEMENT_PUBLISHED`
> stocke `Announcement.description` tel quel dans `Notification.body` — du
> rich-text HTML produit par l'éditeur admin (`<p>...</p>`), jamais du texte
> brut. `notifications-page-client.tsx` affichait ce body directement, donc
> les balises apparaissaient en clair dans la liste. Corrigé côté frontend
> uniquement (le body en base reste du HTML, potentiellement utile ailleurs) :
> `NOTIFICATION_BODY_IS_HTML` masque le body pour ce type, remplacé par un
> lien "Voir" (`NOTIFICATION_LINKS`) vers `/dashboard/updates` (et
> `/dashboard/inbox` pour `SUPPORT_MESSAGE`, même mécanisme). Au passage :
> ces deux nouveaux types n'avaient jamais été ajoutés à
> `NOTIFICATION_SEVERITY` côté frontend (`domains/notification/types/notification.ts`)
> — leur badge de sévérité était silencieusement absent (`undefined` sur un
> `Record` typé, TypeScript ne l'aurait pas laissé passer avec `satisfies`
> mais l'objet n'utilisait qu'une annotation de type). Ajoutés en `"low"`.
>
> **Non traité, à surveiller** : le push notification des annonces
> (`AnnouncementsService.notifyPublished` → `PushService.sendToAllUsers`)
> envoie aussi `announcement.description` brut comme corps de notification
> navigateur — même défaut, pas encore corrigé, pré-existant (pas introduit
> par la vague 3).

### 11.4 `settleProposal` — écritures séquentielles hors transaction

`coupon-settlement.service.ts` (`settleProposal`) écrit chaque leg (`settleLeg`) puis le résultat final du coupon en séquence, sans transaction Prisma (`$transaction`) englobante. Risque faible en pratique — un crash à mi-chemin laisserait des legs réglés mais pas de résultat coupon final, rattrapable au prochain passage du cron (idempotent) — mais ça reste un état intermédiaire visible en base pendant une fenêtre courte. À noter, pas urgent.

---

## 10. Plan proposé pour la session suivante (à prioriser ensemble)

> **Suivi des vagues** — branche `fix/perf-ux-audit` (toutes les vagues de ce
> chantier y sont empilées). Vague 1 (points 1-7) fermée le 2026-08-09,
> commit `7e5d1854`. Vague 2 (points 8 [notifications seulement], 12, 16)
> fermée le 2026-08-09, commit `66962691`. Vague 3 (points 9-10) fermée le
> 2026-08-09, commit `b5e76819` — au passage, entrée de nav ajoutée pour
> `/dashboard/updates` (pinnée en sidebar, pas besoin d'attendre la
> décision A1/A2 du point 11 puisque ça ne touche pas la barre mobile à 5
> slots), et fix d'un bug découvert en testant : le body HTML des
> annonces s'affichait brut dans `/dashboard/notifications` (balises
> `<p>` visibles) — cf §7.4 ci-dessous. Vague 4 : point 15 fermé sans code
> le 2026-08-09 (voir §2) — Investir déjà borné, Décisions n'a pas de vrai
> problème mesuré aujourd'hui.

1. ~~**`APP_URL` en prod** (§9)~~ ✅ fait le 2026-08-09 — reste à vérifier après restart backend.
2. ~~**Faire tourner `GROQ_API_KEY`** (§11.1)~~ ✅ fait, confirmé par toi le 2026-08-09.
3. ~~**`scryptSync` → `scrypt` async** (§8)~~ ✅ fait le 2026-08-09 (vague 1) — même paramètres de sécurité, `auth.utils.ts`.
4. ~~**Logo email → URL hébergée au lieu d'un data URI** (§9bis)~~ ✅ fait le 2026-08-09 (vague 1) — `evcore-layout.tsx`, `logo.ts` supprimé.
5. ~~`findNewCoachTeams` → une requête groupée au lieu de N (§1.2)~~ ✅ fait le 2026-08-09 (vague 1) — `channel-decision.repository.ts`.
6. ~~`findByDate` → `DISTINCT ON` en SQL au lieu de dédup en mémoire (§1.1)~~ ✅ fait le 2026-08-09 (vague 1), même pattern que `investment-calibration.repository.ts`.
7. ~~`FixtureScoringQueryDto.limit` → valeur par défaut forcée (§1.4)~~ ✅ fait le 2026-08-09 (vague 1) — `limit` par défaut 50 + `timeSlot` déplacé dans le `where` Prisma. `betStatus` **laissé en mémoire** (le join "dernier run / top-2 EV par fixture" est trop risqué à reproduire en SQL pour le gain, cf priorité "Basse" du §1.4). Effet de bord découvert et corrigé le même jour : le frontend Matchs n'avait jamais eu de vraie pagination (comptait sur "pas de `limit` = tout charger") — ajout d'un scroll infini (`useInfiniteQuery` + sentinel `IntersectionObserver`) dans `use-fixtures.ts`/`fixtures-table.tsx`, qui couvre une partie du point 15 pour cette page.
8. ~~`NotificationType.SUPPORT_MESSAGE` + `NotificationType.ANNOUNCEMENT_PUBLISHED` (§5.B + §7.3)~~ ✅ fait le 2026-08-09 (vague 2) — les deux créent maintenant une vraie ligne `Notification` en plus du push/email existant. Migration Prisma lancée par toi le même jour.
9. ~~**Page "Annonces" côté utilisateur** (§7.1)~~ ✅ fait le 2026-08-09 (vague 3) — `/dashboard/updates`, filtre Toutes/Non lues, ouverture = marquage lu.
10. ~~Modèle `AnnouncementRead` (§7.2)~~ ✅ fait le 2026-08-09 (vague 3) — remplace le `localStorage`, la bannière dashboard et la nouvelle page partagent le même état serveur. Migration lancée par toi le même jour.
11. Décider A1 vs A2 pour la nav mobile (§5.A) — ne bloque plus Annonces (déjà accessible via la sidebar), reste pertinent pour Inbox sur la barre basse mobile à 5 slots.
12. ~~Rate-limiting sur `/auth/login` (§11.2)~~ ✅ fait le 2026-08-09 (vague 2) — `@nestjs/throttler`, 5/60s par IP, scope limité à cette route.
13. Clarifier le bug des onglets (§4) avant d'y toucher.
14. Concevoir le regroupement par ligue + modes d'affichage (§3) — commencer par le dropdown pattern Track Record.
15. ~~Pagination/virtualisation frontend (§2)~~ Matchs fait (cf point 7). Décisions/Investir **fermés sans code** le 2026-08-09 (vague 4) — Investir déjà borné à 15 picks/mode, Décisions borné à une journée, pas de problème mesuré aujourd'hui. À rouvrir si une lenteur réelle est constatée.
16. ~~Investiguer l'anomalie `RUS1` DRAW (§11.3)~~ ✅ fait le 2026-08-09 (vague 2) — pas un signal de ligue, un bug de comptage dans le script de backtest (repasses d'analyse comptées comme paris indépendants). Corrigé, n global DRAW révisé 4838 → 3735.
17. Onboarding (§6) — démarrer par le quick-win (pont Formation), cadrer le tour guidé à part.
