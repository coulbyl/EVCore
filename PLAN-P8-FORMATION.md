# PLAN — P8 Centre de formation (`/dashboard/formation`)

Référence : `TODO-UI.md` → section **P8 — Centre de formation**.

Objectif : transformer l’actuelle aide “markdown brut” (`/dashboard/help` → `content/help-leagues.md`) en un **centre de formation** structuré (articles + vidéos + progression + recherche), tout en respectant les conventions UI (shadcn/@evcore/ui), les patterns Next.js App Router, et les best practices NestJS pour la persistance de progression (phase 2).

Format d’inspiration validé : `~/lab/coulby-connect/apps/web/app/(customer)/(dashboard)/help` (landing en sections + pages détail `[slug]` avec métadonnées, étapes/tips/warnings, related).

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

Pattern cible : landing “Help” en **sections empilées** (inspiré de Coulby Connect) + contenu data-driven (index MDX).

**Sections**

- Hero : titre + description (“Comprenez chaque pick, maîtrisez le système”).
- Search bar (filtre texte + filtres category/difficulty) + action secondaire optionnelle (ex: “Contacter support” → non requis sur EVCore).
- Grille de catégories (5) avec icône, nombre d’items, progression par catégorie.
- “Tutoriels / À regarder” : liste d’articles/vidéos en cards (format type/durée) — équivalent Coulby “Tutorials”.
- “FAQ / À retenir” (optionnel) : accordéon de questions fréquentes sur EV, canaux, bankroll — équivalent Coulby “FAQ”.
- “Recommandé pour vous” : 2–3 items (heuristiques Phase 1, API Phase 2).
- Barre de progression globale : `X / Y` contenus terminés.
- Recherche (Phase 1 : filtre local/serveur, Phase 2 : index).

**Interactions**

- Filtrer par catégorie / difficulté.
- Ouvrir un article ou une vidéo.

### 1.2 `/dashboard/formation/articles/[slug]` (Article)

Pattern cible : page détail type Coulby “Help detail” mais alimentée par MDX (au lieu de mock data inline).

**Affichage**

- Titre + méta (difficulté, temps de lecture estimé).
- Intro/summary (si présent dans le frontmatter).
- Contenu MDX (callouts, tableaux, encadrés “À retenir”, code blocks).
- Blocs structurés optionnels si le contenu s’y prête (inspiré Coulby) :
  - “Étapes” (liste)
  - “Tips” (liste)
  - “Attention” (callout warning)
- Navigation : “Précédent / Suivant” dans la même catégorie.
- “Articles liés” (related) : 3–6 items max, déterminés par frontmatter (`related?: string[]`) ou heuristique (même catégorie).
- CTA : “Marquer comme lu” (Phase 1 : localStorage, Phase 2 : backend).

**Accessibilité**

- Titres structurés (h1/h2/h3) et table des matières optionnelle.
- Contrastes OK via tokens, pas de `dark:` hardcodé.

### 1.3 `/dashboard/formation/videos/[slug]` (Vidéo)

Pattern cible : page détail similaire “demo/video” Coulby : player + durée + chapitres + related + CTA “vu”.

**Affichage**

- Player (YouTube/Vimeo embed ou fichier vidéo HTML5).
- Chapitres (timestamps) + description.
- Contenus liés (articles recommandés).
- CTA : “Marquer comme vu”.

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
- Valeur : `{ read: Record<string, string>, watched: Record<string, string> }` (slug → ISO date)
- API front :
  - `useFormationProgress()` (client hook)
  - `markRead(slug)`, `markUnread(slug)`, idem vidéos
- Calcul :
  - Progression par catégorie via intersection `slugs` (content index) × `read`.

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

---

## 6) Recherche

### 6.1 Phase 1 (sans infra)

- Recherche par `title`, `summary`, et (optionnel) contenu brut (sans MDX compilé) :
  - Lire les fichiers et filtrer côté serveur (accueil Formation) + passer résultats au client.
  - Pour une recherche live, utiliser un filtre côté client sur l’index déjà chargé.

### 6.2 Phase 2 (scalable)

- Backend : endpoint `GET /formation/search?q=...&category=...`
- Indexation :
  - Au démarrage (ou cron) : indexer titres + texte (extraction MDX → texte).
  - Stocker un index léger (DB ou fichier), ou utiliser une lib (à décider selon contraintes).

---

## 7) Migration de `help-leagues.md`

### 7.1 Stratégie

- Garder `/dashboard/help` en place au début (feature flag / coexistence).
- Extraire `help-leagues.md` en articles “Guide par ligue” :
  - 1 ligue = 1 article `leagues-<slug>.mdx`
  - Ajouter `summary` + difficulté par défaut (`beginner`).
- Une fois la page Formation stable :
  - Mettre un lien “Formation” dans la nav.
  - Soit rediriger `/dashboard/help` → `/dashboard/formation?category=leagues`
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

1. **Content skeleton**

- Créer dossiers `apps/web/content/formation/articles` et `apps/web/content/formation/videos`.
- Ajouter 2–3 premiers articles “Les bases” + 1 vidéo exemple.

2. **Index & pages (Next.js)**

- Implémenter `listContent()` + `getContentBySlug()`.
- Construire `/dashboard/formation` (liste + filtres + progression Phase 1).
- Construire `/articles/[slug]` et `/videos/[slug]`.

3. **Progression Phase 1**

- Hook + localStorage, UI progression par catégorie/global.

4. **Recherche Phase 1**

- Filtre simple (titre/summary), puis option contenu si besoin.

5. **Migration `help-leagues.md`**

- Découper en articles et publier “Guide par ligue”.
- Ajouter un lien depuis l’ancienne page Help (ou redirection plus tard).

6. **Backend Phase 2**

- Prisma : modèle `UserContentProgress` + migration.
- NestJS : module + endpoints + guard + DTO validation.
- Front : sync login + optimistic updates.

7. **E2E**

- Playwright sur les vues clés + backend e2e.

---

## 10) Definition of Done (P8)

- `/dashboard/formation` + pages article/vidéo opérationnelles.
- Contenu minimal en place (au moins : 3 articles “Les bases” + 1 “Guide par ligue” migré + 1 vidéo).
- Progression Phase 1 fonctionnelle + UI claire.
- Recherche Phase 1 fonctionnelle.
- Playwright : scénarios clés + responsive OK.
- Phase 2 (si incluse dans la livraison) : persistance backend + sync multi-device validées.
