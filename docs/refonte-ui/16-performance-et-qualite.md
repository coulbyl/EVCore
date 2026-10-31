# Refonte UI — 16. Performance, architecture et revue

_29/10/2026. Demande de l'utilisateur : « il faut que ce soit vraiment performant, les requêtes, la connexion… et qu'on suive bien l'architecture de codage, la performance, les bonnes pratiques », avec une revue en continu. Ce document fixe les budgets, les règles et la cadence de revue de la branche `feat/refonte-ui`, et part d'une lecture de l'application actuelle._

## 1. Ce qu'on a mesuré sur l'application actuelle (29/10)

| Constat | Mesure | Conséquence pour la refonte |
| --- | --- | --- |
| **Deux allers-retours d'authentification par page** | `apps/web/proxy.ts` appelle `GET /auth/me` sur chaque navigation `/dashboard/*` et `/auth/*`, puis le guard backend relit la session en base (`session.findUnique`) sur chaque requête d'API | Une page = proxy → backend → base, puis N requêtes d'API qui refont chacune la lecture de session. Sur 3G, c'est le premier coût visible. |
| **Données chargées côté client après hydratation** | 45 fichiers avec `useQuery`/`useMutation` ; l'accueil est un composant client qui enchaîne ses requêtes après le premier rendu | Écran blanc puis cascade ; chaque écran de la refonte doit être rendu côté serveur en **une requête agrégée**. |
| **Bibliothèques lourdes dans le bundle joueur** | `recharts`, `@tiptap/*` (3 paquets), `driver.js`, `react-day-picker`, `socket.io-client`, `vaul`, 158 composants client | La refonte n'en a besoin d'aucune côté joueur (pas de graphique, pas d'éditeur riche, pas de guide, pas de calendrier). `socket.io` ne sert qu'aux Messages : à charger sur cet écran seulement. |
| **Requêtes non bornées** | 78 `findMany` dans les dépôts, 4 seulement avec `take` | Toute liste exposée au joueur prend un `take` et un curseur. |
| **Prisma hors des dépôts** | 16 services appellent `this.prisma` directement (règle de CLAUDE.md non tenue) | Chaque service touché par la refonte déplace ses requêtes dans un dépôt (règle du dépôt : « quand on y touche, on déplace »). |
| **Pas de compression ni d'en-têtes de sécurité côté API** | `main.ts` : CORS et pipes seulement ; pas de `compression`, pas de `helmet` ; throttler présent | À ajouter en phase A (un commit). |
| **Pas de cache HTTP** | 3 occurrences de `revalidate`/`Cache-Control` dans tout le web | Les pages publiques (landing, `/resultats`) et les données du jour peuvent être servies avec `revalidate` et `ETag`. |
| **Pas de mesure de performance** | Aucun Lighthouse, aucun budget, Playwright fonctionnel seulement | Un budget vérifié en CI dès la phase A. |
| **Pool de base** | `pg` `max` = `DATABASE_POOL_MAX` (18 en prod) derrière PgBouncer ; indexes présents sur `coupon_proposal(forDate, status)`, `fixture(scheduledAt)`, `notification(userId, read, createdAt)` | Correct. Les nouveaux points d'entrée ajoutent leurs indexes (coupon_follow par `userId, createdAt` ; `coupon_proposal(forDate, source, rank)`). |

## 2. Les budgets (vérifiés à chaque phase, bloquants avant chaque PR)

Mesurés sur un **Moto G** simulé (Lighthouse mobile, CPU ×4, « Slow 4G »), sur Aujourd'hui, Matchs, Résultats, Moi et la landing, à froid et à chaud :

| Budget | Valeur | Pourquoi |
| --- | --- | --- |
| LCP (plus grand élément peint) | **≤ 2,5 s** à froid, ≤ 1,2 s à chaud | La carte du jour est le LCP ; elle doit venir du serveur, pas d'une requête client. |
| INP (réactivité au toucher) | **≤ 200 ms** | Suivre, [+], les puces de jour. En CI, Lighthouse ne touche pas l'écran : on vérifie le TBT (temps de blocage total) au même budget, son équivalent de laboratoire. |
| CLS (déplacement de mise en page) | **≤ 0,1** | Polices chargées en `swap` avec métriques de repli, hauteurs réservées pour les diodes et la forme. |
| JavaScript par route | **≤ 150 kB** gzip, premier chargement ≤ 250 kB | Pas de bibliothèque de graphique, d'éditeur ni de guide côté joueur. |
| Requêtes réseau pour afficher un écran | **1 requête d'API** (agrégée) + polices + icônes inline ; **0 requête bloquante** côté client au premier rendu | Un écran = un point d'entrée : `GET /today`, `GET /matches?day=`, `GET /results?period=`, `GET /me`. |
| Taille d'une réponse d'écran | **≤ 30 kB** gzip | `select` explicite dans Prisma, pas d'objet complet, pas de `featureSnapshot` vers le joueur. |
| API p95 par point d'entrée d'écran | **≤ 150 ms** sur la copie de prod, ≤ 250 ms en prod | Mesuré par un test de charge léger (k6 ou autocannon) sur la base locale, et par les journaux en prod. |
| Requêtes SQL par point d'entrée | **≤ 5**, aucune en boucle | Jointures et `IN (...)`, jamais un `await` dans une boucle. |
| Connexion | **1 lecture de session par requête au plus**, mise en cache mémoire 60 s côté backend ; proxy sans appel réseau | Le proxy vérifie la présence du cookie, pas la base (le jeton est opaque : rien à signer, rien à lire sans le backend). |
| Hors ligne | Le dernier écran vu s'affiche en < 1 s sans réseau | Cache du dernier écran (10 § 2) via le service worker, données du jour seulement. |

## 3. Les règles d'architecture (en plus de CLAUDE.md, qui reste la référence)

**Web (Next.js App Router)**

- **Serveur par défaut** : chaque écran est un composant serveur qui appelle **une** fonction de données (`getToday()`, `getMatches(day)`, …) avec `fetch` + `revalidate` court (30 à 60 s pour le jour, 5 min pour Résultats, 0 pour Moi) ; la navigation entre onglets est préchargée (`prefetch`).
- **Client seulement pour un geste** : Suivre, le [+] du ticket, la recherche d'équipe, le fil de Messages, les interrupteurs. Un composant client ne charge jamais les données d'un écran ; il reçoit ses props du serveur et appelle une action pour écrire.
- **Le ticket vit sur l'appareil** (`localStorage` + `try/catch`), calcul des chances côté client à partir des fréquences servies avec chaque cote ; aucune requête pour l'ouvrir.
- **Un composant = un fichier**, `*-constants.ts` pour les formats partagés (`formatOdds`, `formatFrequency`, `formatMoney`), pas de barrel, `"use client"` seulement où il y a un hook (règles existantes).
- **Pas de bibliothèque ajoutée sans budget** : icônes en SVG inline (lucide par import nommé si besoin), pas de recharts, tiptap, driver.js, react-day-picker, vaul côté joueur ; `socket.io-client` chargé dynamiquement sur Messages seulement.
- **Polices auto-hébergées** (Barlow, Barlow Condensed) via `next/font/local`, sous-ensemble latin, `display: swap`, `adjustFontFallback`.
- **Images** : pas de logo d'équipe tant que la licence n'est pas réglée (pastille à trois lettres) ; l'image de partage se dessine en `canvas` côté client ; l'image `og` se génère côté serveur et se met en cache un jour.
- **Service worker** : cache statique (déjà) + cache du dernier écran de chaque onglet, jamais de donnée d'argent ni de session.
- **Tables** (admin seulement) : TanStack Table, colonnes réutilisables, pagination serveur ; les tableaux du joueur sont des listes.

**Backend (NestJS)**

- **Un point d'entrée par écran**, dans un module `screens/` (`today.controller.ts`, `matches.controller.ts`, `results.controller.ts`, `me.controller.ts`, `admin-home.controller.ts`), qui compose depuis les dépôts et renvoie un DTO plat, typé, sans `featureSnapshot`, `reasoning` ni identifiants internes. C'est le seul endroit où la forme de l'écran est connue.
- **Contrôleur → service → dépôt**, Prisma dans les dépôts seulement ; les 16 services existants qui l'enfreignent sont corrigés quand on les touche. `select` explicite, `take` sur toute liste, curseur pour « Voir plus ».
- **Décimal** pour cotes, probabilités, francs ; `number` à la frontière seulement. Shin et les produits de cotes en `decimal.js`.
- **Session** : lue une fois par requête, cache mémoire 60 s par empreinte du jeton, invalidé à chaque écriture d'un utilisateur ou d'une session (déconnexion, pause, suspension, rôle, préférences, mot de passe) ; `touch` d'activité déjà asynchrone. Le proxy Next ne fait plus d'appel réseau : il ne voit que la présence du cookie ; la vérité reste au backend, lue une fois pendant le rendu.
- **Connexion** : mots de passe en argon2id (ou bcrypt coût 12 si déjà en place : à vérifier au commit B10), limitation par IP et par compte sur `/auth/*` (throttler existant, règles à écrire), codes à six chiffres à durée courte, session longue sur l'appareil avec rotation à la connexion.
- **`compression`, `helmet`, `ETag`** sur l'API ; `Cache-Control: private, max-age=30` sur les écrans du jour, `public, s-maxage=300` sur `/results` public et le héros public.
- **Jobs et notifications** : idempotents, fenêtre glissante, jamais une boucle d'`await` par utilisateur sans lot (`Promise.all` par tranches de 50, règle de `async.utils.ts`).
- **Journal** : une ligne par requête d'API avec durée, route, code, identifiant de session tronqué ; p95 lisible dans les journaux de prod.

**Base**

- Un index par nouveau chemin de lecture, écrit dans la migration qui ajoute la colonne ; `EXPLAIN ANALYZE` sur la copie de prod pour chaque point d'entrée d'écran, collé dans le message de commit quand le plan n'est pas trivial.
- Les vues lourdes (`channel_selection_deduped`) ne sont jamais appelées par un écran joueur ; Résultats lit des agrégats par produit calculés au règlement (colonne ou table `product_day`), pas la table brute.

## 4. La cadence de revue

- **À chaque commit** : `pnpm lint`, `pnpm typecheck`, tests du module touché ; le détecteur impeccable sur les fichiers UI modifiés (hook actif).
- **À la fin de chaque phase** (A, B, C, D, F, G) : `/code-review` (`medium` sur l'UI, `high` dès qu'il y a de l'argent, du règlement, des notifications, des jobs ou de l'authentification), budgets Lighthouse sur les écrans de la phase, `EXPLAIN` des nouveaux points d'entrée, et une ligne de bilan dans [15-todo.md](15-todo.md).
- **Avant chaque PR** : tout ce qui précède sur l'ensemble, revue de finition impeccable écran par écran, `pnpm --filter backend test`, Playwright sur les parcours, charge légère sur les points d'entrée d'écran, relecture de ce document avec les mesures réelles.
- **Ce qui bloque une PR** : un budget dépassé, une requête SQL en boucle, un Prisma hors dépôt dans un fichier touché, un `any`, une liste sans `take`, un secret ou une donnée interne dans une réponse d'écran, un montant ou un gain quelque part côté joueur.

## 5. Ajouts au todo

Les lignes suivantes sont ajoutées dans [15-todo.md](15-todo.md) : A10 (compression, helmet, ETag, journal de durée), A11 (session en cache mémoire, proxy sans réseau), A12 (budget Lighthouse en CI), B0 (module `screens/` et le point d'entrée `GET /today`), puis un point d'entrée par écran dans la phase B, C0 (retrait des bibliothèques lourdes du bundle joueur), et une ligne « revue de phase » à la fin de chaque phase.
