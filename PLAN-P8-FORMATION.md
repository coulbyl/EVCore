# PLAN — P8 Centre de formation (`/dashboard/formation`)

Référence : `TODO-UI.md` → section **P8 — Centre de formation**.

Objectif : transformer l’actuelle aide “markdown brut” (`/dashboard/help` → `content/help-leagues.md`) en un **centre de formation** structuré (articles + vidéos + progression + recherche), tout en respectant les conventions UI (shadcn/@evcore/ui), les patterns Next.js App Router, et les best practices NestJS pour la persistance de progression (phase 2).

Format d’inspiration validé : `~/lab/coulby-connect/apps/web/app/(customer)/(dashboard)/help` (landing en sections + pages détail `[slug]` avec métadonnées, étapes/tips/warnings, related).

**État (2026-05-01)** : Phase 1 (web) implémentée avec navigation **par catégorie** + lecture intégrée (liste ↔ contenu) + progression localStorage + “Dernier lu / Continuer” + navigation “Précédent/Suivant + Related” + recherche full-text par catégorie + mobile bottom sheet. Les anciennes routes `/dashboard/formation/articles/[slug]` et `/dashboard/formation/videos/[slug]` redirigent vers la nouvelle structure.

---

## 0) Portée & contraintes

### Ce que couvre P8

- Une page d’accueil Formation avec catégories, contenu recommandé et progression.
- Des pages “Article” et “Vidéo” avec navigation et actions “marquer comme lu”.
- Un système de progression (Phase 1 local, Phase 2 persisté).
- Une recherche (Phase 1 simple, Phase 2 indexable).
- La migration du contenu actuel `help-leagues.md` en articles “Guide par ligue”.

### Ce que P8 ne couvre pas (à expliciter pour éviter le scope creep)

- Écriture complète de tous les contenus (sauf les premiers “Les bases”).
- IA/génération de contenu.
- Analytics avancés / AB tests (peut venir après).

---

## 1) Livrables UX (pages & comportements)

### 1.1 `/dashboard/formation` (Accueil)

Pattern final : **hub de catégories** (cartes cliquables) → expérience “master/detail” par catégorie.

**Sections**

- Hero : titre + description (“Comprenez chaque pick, maîtrisez le système”).
- “Dernier lu / Continuer” : reprend automatiquement le dernier contenu ouvert (localStorage).
- Grille de catégories (5) avec icône, nombre d’items, progression par catégorie, CTA “Parcourir”.
- Progression globale : `X / Y` contenus terminés.

**Interactions**

- Cliquer une catégorie → ouvre la page catégorie (lecture).

### 1.2 `/dashboard/formation/[category]` (Lecture par catégorie)

Pattern cible : **liste d’items (gauche) + zone de lecture (droite)**, sans navigation “catalogue” (pas de Recommended/Library).

**Affichage**

- Breadcrumb premium en haut (Formation → Catégorie).
- Sidebar : recherche + progression catégorie + liste d’items (cliquables) + état “Terminé”.
- Zone de lecture : header item + CTA “Marquer comme terminé” + contenu.

**Accessibilité**

- Titres structurés (h1/h2/h3) et table des matières optionnelle.
- Contrastes OK via tokens, pas de `dark:` hardcodé.

**Mobile**

- La liste d’items s’ouvre dans un **bottom sheet (Drawer)** via un bouton fixe “Contenus”.

### 1.3 `/dashboard/formation/[category]/[slug]` (Lecture d’un item)

**Affichage**

- Article : carte de lecture (max-width) + header item + CTA completion.
- Vidéo : carte player + chapitres + description + CTA completion.
- Navigation : boutons “Précédent / Suivant” + section “Related” (autres contenus de la catégorie).

### 1.4 Routes legacy (compat)

- `/dashboard/formation/articles/[slug]` → redirect vers `/dashboard/formation/{category}/{slug}`
- `/dashboard/formation/videos/[slug]` → redirect vers `/dashboard/formation/{category}/{slug}` (en conservant `?t=...`)

---

## 2) Modèle de contenu (MDX + frontmatter)

### 2.1 Format

- Fichiers `.mdx` avec frontmatter (YAML).
- Frontmatter minimal (Phase 1) :
  - `title: string`
  - `category: bases | channels | bankroll | leagues | app`
  - `difficulty: beginner | intermediate | advanced`
  - `readTime: number` (minutes)
  - `slug: string` (stable, unique)
  - `summary?: string`
  - `updatedAt?: string` (ISO)
  - `videoUrl?: string` (si page vidéo, ou si article lié à une vidéo)
  - `videoProvider?: youtube | vimeo | html5` (si `videoUrl`)
  - `videoDuration?: string` (ex: "6 min", affichage UI)
  - `chapters?: { label: string; start: number }[]` (start en secondes)
  - `transcriptUrl?: string` (optionnel, si disponible)
  - `thumbnail?: string` (optionnel)

### 2.2 Arborescence (dans `apps/web`)

- `apps/web/content/formation/articles/<slug>.mdx`
- `apps/web/content/formation/videos/<slug>.mdx` (ou `.json` si préféré pour chapitres)

### 2.3 Conventions

- `slug` = kebab-case ASCII (source de vérité côté FS + frontmatter).
- Les catégories sont fixes (les 5 proposées dans `TODO-UI.md`).
- Préparer l’internationalisation : frontmatter peut accepter `locale` plus tard si besoin (Phase 2/3).

---

## 3) Next.js (App Router) — architecture & rendu MDX

### 3.1 Structure des routes (proposée)

- `apps/web/app/dashboard/formation/page.tsx` (accueil)
- `apps/web/app/dashboard/formation/articles/[slug]/page.tsx`
- `apps/web/app/dashboard/formation/videos/[slug]/page.tsx`

### 3.1bis Composition “sections landing” (inspiration Coulby)

Découper la landing en composants dédiés (réutilisables et testables), sur le modèle :

- `apps/web/app/dashboard/formation/components/formation-header.tsx`
- `apps/web/app/dashboard/formation/components/formation-search-bar.tsx` (client)
- `apps/web/app/dashboard/formation/components/formation-categories.tsx`
- `apps/web/app/dashboard/formation/components/formation-tutorials.tsx`
- `apps/web/app/dashboard/formation/components/formation-faq.tsx` (optionnel)
- `apps/web/app/dashboard/formation/components/formation-recommended.tsx`
- `apps/web/app/dashboard/formation/components/formation-progress.tsx`

Règle Next.js : garder la page `page.tsx` en Server Component, et ne mettre `'use client'` que sur les briques interactives (search, mark-as-read).

### 3.2 Rendu MDX : choix technique (décision à prendre tôt)

**Option A (recommandée) — “content loader” + compilation MDX côté serveur**

- Lire le fichier (`fs`) depuis `apps/web/content/formation/**`.
- Parser frontmatter (`gray-matter`).
- Compiler MDX en React côté serveur (ex: `@mdx-js/mdx` + `@mdx-js/react`) et rendre dans un Server Component.
- Avantages : support naturel des routes dynamiques `[slug]`, indexation/recherche facile, découplé du routing.
- Points de vigilance : perf (mettre du cache), contrôler les composants exposés à MDX.

**Option B — `@next/mdx` (plugin) + imports statiques**

- Configurer `@next/mdx` + `mdx-components.tsx` (Next.js : requis en App Router).
- Nécessite une stratégie pour importer les MDX de manière statique (ex: index généré qui exporte un mapping `slug -> component`).
- Avantages : pipeline Next officiel pour MDX pages/imports.
- Inconvénients : plus lourd à maintenir si le contenu change souvent.

**Décision** : choisir Option A si on veut itérer vite sur le contenu (probable). Garder Option B comme fallback si on veut que les MDX soient “first-class pages” via `page.mdx`.

### 3.3 `mdx-components.tsx`

Si Option B (ou si on veut standardiser les balises même en Option A) :

- Ajouter `apps/web/mdx-components.tsx` (conforme Next.js : `useMDXComponents()` export unique).
- Mapper les balises/blocks vers shadcn/@evcore/ui :
  - `a` → lien stylé (tokens)
  - `blockquote` → `Alert` (variant info)
  - `pre/code` → composant `Code` (si existant) / style homogène
  - `table` → table stylée (shadcn Table) ou wrapper dédié

### 3.4 Données, cache & SEO

- Indexer le contenu (liste articles/vidéos) via un “content service” côté serveur :
  - `listContent()` : lit les fichiers + frontmatter.
  - `getBySlug(slug)` : lit 1 fichier + compile.
- Mettre en cache (Next.js) :
  - Phase 1 : cache mémoire/process (si acceptable) + “stable sort”.
  - Phase 2 : utiliser tags/revalidate si on veut hot-reload de contenu en prod.
- Metadata :
  - `generateMetadata()` sur `[slug]` à partir du frontmatter.

---

## 4) UI (shadcn/@evcore/ui) — composition & règles

### 4.1 Composants à privilégier

- Layout : `Page`, `PageContent`, `ResponsiveGrid`, `Card`, `Separator`.
- Navigation : `Breadcrumb` (si existant) ou pattern similaire à `/dashboard/help`.
- States : `Skeleton`, `Empty`.
- Badges : `Badge` pour difficulté/catégorie/type (`article|video`), `ProgressBar` pour progression.
- Recherche : `Input` + `Button` (optionnel) ; si besoin d’autocomplete → `Command` + `Popover`.
- FAQ : `Accordion` (shadcn) au lieu d’un accordéon custom.

### 4.2 Règles shadcn à appliquer (repo)

- Tokens sémantiques uniquement (`bg-background`, `text-muted-foreground`, etc.).
- Layout au `gap-*` (pas de `space-y-*`/`space-x-*`).
- Composition Card complète (`CardHeader`/`CardContent`/`CardFooter`) là où pertinent.
- Accessibilité : tout overlay (Sheet/Dialog/Drawer) a un title (au besoin `sr-only`).

### 4.4 Notes de transposition (diff vs Coulby)

- Coulby utilise des classes couleur brand custom : sur EVCore, tout passe par tokens + composants `@evcore/ui`.
- Coulby met beaucoup de pages en `'use client'` : sur EVCore, favoriser Server Components (App Router) et limiter le client aux interactions.
- Coulby a des “mock objects” inline : sur EVCore, source = fichiers `content/formation/**` + frontmatter.

### 4.3 Responsive (DoD)

- Vues testées à `375px`, `768px`, `1280px`.
- Sur mobile : navigation simple + CTA visibles, pas de colonnes serrées.

---

## 4.5 Players (vidéos)

### 4.5.1 Options supportées (Phase 1)

- **YouTube embed** (recommandé pour commencer) : `videoProvider: youtube` + `videoUrl` (ou `videoId` si tu préfères).
- **Vimeo embed** : `videoProvider: vimeo` + `videoUrl`.
- **HTML5 `<video>`** : `videoProvider: html5` + `videoUrl` pointant vers un fichier `.mp4` servi statiquement (ou CDN).

### 4.5.2 Composants (proposés)

- `apps/web/app/dashboard/formation/components/formation-video-player.tsx`
  - Server wrapper qui rend un `<iframe>` (YouTube/Vimeo) ou un `<video controls>`.
  - Conteneur responsive via classes layout (ex: `aspect-video w-full overflow-hidden rounded-2xl border border-border`).
- `apps/web/app/dashboard/formation/components/formation-chapters.tsx`
  - Liste des chapitres à partir du frontmatter `chapters`.
  - **YouTube/Vimeo** : chapitres comme liens qui mettent à jour un query param `?t=123` (re-render de l’iframe avec `start`).
  - **HTML5** : chapitres pilotent `currentTime` via ref (client component).

### 4.5.3 Sécurité & perf (à appliquer)

- Iframe : `loading="lazy"`, `referrerPolicy="strict-origin-when-cross-origin"`, `allowFullScreen`.
- Iframe : `allow` minimal (ex: `encrypted-media; picture-in-picture; fullscreen`), éviter permissions inutiles.
- HTML5 : `preload="metadata"` par défaut (éviter gros downloads sur mobile).

### 4.5.4 Tests (Playwright)

- Vérifier que la page vidéo affiche bien le player (iframe ou tag video) + que cliquer un chapitre modifie l’URL (`t=`) ou met à jour l’état.

---

## 5) Progression & persistance

### 5.1 Phase 1 — localStorage (rapide, itératif)

- Clé : `evcore:formation:progress:v1`
- Valeur :
  - `read: Record<string, string>` (slug → ISO date)
  - `watched: Record<string, string>` (slug → ISO date)
  - `recent?: { category; type; slug; openedAt }` (dernier contenu ouvert)
- API front :
  - `useFormationProgress()` (client hook)
  - `markCompleted(type, slug)`, `unmarkCompleted(type, slug)`
  - `setRecent({ category, type, slug })` (alimenté via `FormationRecentTracker`)
- Calcul :
  - Progression par catégorie via intersection `slugs` (content index) × `read`.
  - “Dernier lu / Continuer” basé sur `progress.recent`.

### 5.2 Phase 2 — backend (NestJS + DB)

Objectif : sync multi-device + base pour “recommandé pour vous”.

**Modèle DB (Prisma, dans `packages/db/prisma/schema.prisma`)**

- Nouveau modèle (exemple) :
  - `UserContentProgress` :
    - `userId`
    - `contentType` (`ARTICLE` | `VIDEO`)
    - `slug`
    - `completedAt`
    - `createdAt`, `updatedAt`
    - `@@unique([userId, contentType, slug])`
    - index `userId`

**Module NestJS (dans `apps/backend/src/modules/`)**

- `formation` (ou `content-progress`) module dédié (éviter de surcharger `auth`).
- Controller :
  - `GET /formation/progress` → liste des contenus complétés (par type optionnel)
  - `POST /formation/progress` → marquer comme complété (DTO validé)
  - `DELETE /formation/progress/:type/:slug` → retirer un completion
- Sécurité :
  - Auth guard obligatoire, ne retourner que la progression du user courant.
  - Validation DTO (class-validator) + erreurs HTTP standard.

**Stratégie sync**

- Front : au login, hydrater le store depuis backend, puis écrire localStorage (cache).
- Offline-first : si request échoue, buffer local puis retry (optionnel).

**Statut (2026-05-01)**

- Modèle DB + migration ajoutés (`packages/db/prisma`).
- Endpoints backend implémentés (`apps/backend/src/modules/formation-progress`).
- Front : sync au chargement Formation + POST/DELETE sur action completion (optimistic + rollback).

---

## 6) Recherche

### 6.1 Phase 1 (sans infra)

- Recherche par catégorie (Phase 1) :
  - Filtre local immédiat (title/summary) sur l’index chargé.
  - Full-text (title/summary + contenu) via un endpoint Next `GET /api/formation/search?category=...&q=...` (debounced, `q.length >= 2`).

### 6.2 Phase 2 (scalable)

- Backend : endpoint `GET /formation/search?q=...&category=...`
- Indexation :
  - Au démarrage (ou cron) : indexer titres + texte (extraction MDX → texte).
  - Stocker un index léger (DB ou fichier), ou utiliser une lib (à décider selon contraintes).

---

## 7) Migration de `help-leagues.md`

### 7.1 Stratégie

- Garder `/dashboard/help` en place au début (feature flag / coexistence).
- Extraire `help-leagues.md` en articles “Guide par ligue” (1 ligue = 1 fichier) + un fichier intro commun.
- Une fois la page Formation stable :
  - Mettre un lien “Formation” dans la nav.
  - Option : rediriger `/dashboard/help` → `/dashboard/formation/leagues`
  - Soit conserver `/dashboard/help` comme “legacy” pendant une période.

---

## 8) Tests (web + backend)

### 8.1 Playwright (web)

Scénarios minimaux :

- Accueil Formation s’affiche (catégories + compteurs).
- Navigation vers un article, rendu du contenu, “marquer comme lu” met à jour la progression.
- Navigation prev/next dans une catégorie.
- Recherche : filtrage cohérent.
- Responsive check : `375/768/1280`.

### 8.2 Backend (NestJS)

- Tests e2e (Supertest ou Vitest e2e existant) :
  - Auth required sur `/formation/progress`.
  - CRUD progression : create/list/delete.
  - Validation DTO (slug vide/type invalide → 400).

---

## 9) Ordre d’exécution (checklist)

1. **Content skeleton** ✅

- [x] Créer `apps/web/content/formation/articles` et `apps/web/content/formation/videos`
- [x] Ajouter 3 articles “Les bases” + 1 vidéo exemple

2. **Index & pages (Next.js)** ✅

- [x] Implémenter index + `getFormationContentBySlug()`
- [x] Construire `/dashboard/formation` (hub catégories)
- [x] Construire navigation par catégorie `/dashboard/formation/[category]/[slug]`
- [x] Ajouter redirects legacy `/dashboard/formation/articles/[slug]` + `/dashboard/formation/videos/[slug]`

3. **Progression Phase 1** ✅

- [x] Hook localStorage + UI progression global/catégorie

4. **Recherche Phase 1** ➖ (partiel)

- [x] Recherche full-text au niveau catégorie (title/summary + contenu) + fallback filtre local

5. **Migration `help-leagues.md`** ✅

- [x] Script : `apps/web/scripts/split-help-leagues.mjs`
- [x] Générer `apps/web/content/formation/articles/leagues/*` (+ `leagues-intro.md`)
- [x] Extraire “Comment lire un pick” en article dédié

6. **Backend Phase 2** ✅ (implémenté)

- Prisma : modèle `UserContentProgress` + migration (à appliquer en env).
- NestJS : module + endpoints + guard + DTO validation.
- Front : sync au chargement Formation + optimistic updates (rollback en cas d’échec).

7. **E2E** ✅ (tests ajoutés, exécution à valider hors sandbox)

- [x] Playwright : `apps/web/e2e/formation.spec.ts` + update responsive
- [ ] Valider exécution e2e en local/CI (le sandbox peut bloquer le port mock backend)

---

## 10) Definition of Done (P8)

- `/dashboard/formation` + pages article/vidéo opérationnelles.
- Contenu minimal en place (au moins : 3 articles “Les bases” + guides ligues + 1 vidéo).
- Progression Phase 1 fonctionnelle + UI claire.
- Recherche Phase 1 fonctionnelle (au moins titre/summary) — idéalement full-text.
- Playwright : scénarios clés + responsive OK.
- Phase 2 (si incluse dans la livraison) : persistance backend + sync multi-device validées.
