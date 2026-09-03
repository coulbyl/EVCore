# Frontend web (`apps/web`)

Documentation technique du dashboard EVCore : structure des routes, architecture par domaine, conventions de composants et mécanisme de contenu markdown. Rédigée à partir du code réel de `apps/web`, pas de la théorie générique des librairies utilisées.

## Stack et son usage réel dans ce repo

`apps/web` est une app Next.js (App Router) dans le monorepo pnpm/Turborepo. Les briques principales :

- **Next.js App Router** — toutes les routes vivent sous `app/`, avec `page.tsx` en Server Component par défaut. Le pattern dominant : le `page.tsx` fait l'auth check et le data fetching serveur minimal, puis délègue l'interactivité à un composant `"use client"` séparé (voir la section pattern de page ci-dessous).
- **`@evcore/ui`** — package interne (workspace) qui fournit les primitives d'UI composées (`Page`, `PageHeader`, `PageHeaderTitle`, `PageHeaderActions`, `PageContent`, `DataTable`, `Badge`, `Skeleton`, `Switch`, `ProgressBar`, `StatCard`, …). Les pages du dashboard composent ces primitives plutôt que de réécrire du markup de layout à chaque page.
- **shadcn/ui** — les composants Radix bruts (`@radix-ui/react-dialog`, `@radix-ui/react-hover-card`, …) sont utilisés directement ou via `@evcore/ui`. Les classes utilisent des tokens sémantiques Tailwind (`bg-panel`, `text-muted-foreground`, `border-border`, `text-accent`) plutôt que des couleurs Tailwind brutes (`gray-500`, `blue-600`), et `gap-*` est la norme pour l'espacement en flex/grid : sur `app/dashboard` et `components/`, 128 fichiers utilisent `gap-*` contre seulement 4 restes en `space-x-*`/`space-y-*`.
- **TanStack Table** — utilisé via le composant `DataTable` de `@evcore/ui`, qui encapsule `useReactTable`/`ColumnDef` et fournit nativement un fallback mobile (`mobileCard`). Exemple concret : `app/dashboard/audit/components/league-breakdown.tsx` définit ses colonnes (`ColumnDef<AuditLeagueRow>[]`) une seule fois et fournit un rendu `mobileCard` alternatif — pas de table desktop et de liste mobile codées séparément.
- **next-intl** — i18n complète, décrite plus bas.
- **TanStack Query** (`@tanstack/react-query`) — tout le data fetching client passe par des hooks `use-*` dans `domains/*/use-cases/`, avec `useQuery`/`useMutation` et des `queryKey` explicites.

## Structure des routes du dashboard (`app/dashboard/`)

Sections principales observées sous `app/dashboard/` :

| Section         | Rôle produit                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decisions`     | Vue des décisions générées par les 19 canaux prédictifs sur les matchs du jour, match par match.                                                                                            |
| `investment`    | « Investir » — point de filtre unique sur les picks (vues `assumed` / `watch` / `excluded`) selon la mesure de calibration du canal, plus une revue exhaustive par onglets.                 |
| `coupons`       | « Propositions » — combinés générés automatiquement par le moteur, présentés comme suggestions non engageantes.                                                                             |
| `bet-slips`     | « Mes coupons » — suivi des coupons que l'utilisateur a effectivement composés/suivis.                                                                                                      |
| `arbitrage`     | Lecture IA qui confronte les décisions des différents canaux et leur fiabilité mesurée sur une compétition donnée — ne propose pas de pick propre.                                          |
| `fixtures`      | Liste des matchs (calendrier), avec filtres par date et accès aux indices de canaux.                                                                                                        |
| `performance`   | Suivi des gains/pertes, ROI, taux de réussite.                                                                                                                                              |
| `bankroll`      | Portefeuille utilisateur (montants, historique).                                                                                                                                            |
| `track-record`  | Historique vérifiable des performances par canal et par compétition, sur des périodes prédéfinies.                                                                                          |
| `audit`         | Console d'administration : volumes (paris, matchs, `ModelRun`), état de la boucle d'apprentissage, activation/désactivation de compétitions. Réservé aux `ADMIN` (accès et route protégés). |
| `engine`        | « Moteur & ETL » — supervision des workers ETL et du moteur de scoring. Réservé aux `ADMIN`.                                                                                                |
| `ml`            | « Moteur ML » — administration du module ML (corrections, shadow predictions). Réservé aux `ADMIN`.                                                                                         |
| `reports`       | Rapports générés côté admin. Réservé aux `ADMIN`.                                                                                                                                           |
| `users`         | Gestion des utilisateurs. Réservé aux `ADMIN`.                                                                                                                                              |
| `subscriptions` | Gestion des abonnements (liste, création, détail).                                                                                                                                          |
| `formation`     | Centre de formation : articles et vidéos pour comprendre chaque canal/pick, avec suivi de progression.                                                                                      |
| `glossaire`     | Documentation éditoriale des termes métier et techniques, servie depuis un fichier markdown. Réservé aux `ADMIN` (protégé par `proxy.ts`).                                                  |
| `help`          | Aide contextuelle (ex. couverture par ligue), même mécanisme markdown que le glossaire.                                                                                                     |
| `inbox`         | Messagerie / conversations (avec route dynamique `[conversationId]`).                                                                                                                       |
| `notifications` | Centre de notifications in-app.                                                                                                                                                             |
| `announcements` | Annonces produit côté admin (création/édition).                                                                                                                                             |
| `updates`       | Fil des annonces/nouveautés visible côté utilisateur.                                                                                                                                       |
| `params`        | Paramètres du compte (`params/account`).                                                                                                                                                    |

## Architecture par domaine (`domains/`)

`domains/` sépare la logique métier front (types, hooks de data fetching, petits helpers) du rendu, qui reste dans `app/` ou `components/`. Chaque dossier de domaine correspond à un sous-système du produit (`investment`, `coupon`, `bankroll`, `formation`, `audit`, `adjustment`, `ml`, `risk`, …) et suit une structure commune :

- `types/` — types TypeScript du domaine (ex. `domains/investment/types/investment.ts` définit `InvestmentView`, `InvestmentChannel`, `InvestmentPick`).
- `use-cases/` — hooks de data fetching/mutation, un fichier par cas d'usage. Exemple : `domains/investment/use-cases/use-investment-picks.ts` encapsule un `useQuery` avec `queryKey: ["investments", date, view, channel]` et appelle `clientApiRequest`.
- `helpers/` (quand présent) — fonctions pures propres au domaine, ex. `domains/coupon/helpers/coupon-class.ts`, `domains/fixture/helpers/`.
- `context/` (quand présent) — contextes React partagés à l'échelle du domaine, ex. `domains/auth/context/`, `domains/bet-slip/context/`.
- `server/` (quand présent) — code exécuté uniquement côté serveur, ex. `domains/formation/server/formation-content.ts` qui lit les fichiers markdown de formation sur disque.

Aucun domaine n'importe de JSX : le rendu reste toujours dans `app/dashboard/<section>/components/` ou dans `components/` partagé. C'est ce découpage qui permet au pattern de page client (ci-dessous) de rester mince.

## Pattern de page client (`*-page-client.tsx`)

Conformément à la règle du dépôt, chaque page qui dépasse un ou deux composants internes extrait ses sous-composants dans un dossier `components/` collocalisé, et le fichier `*-page-client.tsx` ne garde que le data fetching, le routing/état d'URL et le layout de haut niveau.

Exemple concret : `app/dashboard/investment/components/investment-page-client.tsx`.

- Il lit l'état depuis l'URL (`useSearchParams`, `date`, `view`, `channel`) et expose une fonction `navigateTo` qui pousse un nouvel état via `router.push`.
- Il appelle le hook de domaine `useInvestmentPicks` (`domains/investment/use-cases/use-investment-picks.ts`) pour le data fetching.
- Il ne définit aucun sous-composant de présentation : `InvestmentChannelFilter`, `InvestmentFixtureCard` et `InvestmentViewToggle` sont importés depuis le dossier `components/` sibling.
- La logique d'affichage partagée (formatage, regroupement par match) vit dans `app/dashboard/investment/components/investment-constants.ts` — pas de JSX, pas de `"use client"` — avec des fonctions comme `formatPct`, `formatRoi`, `groupPicksByFixture` et la constante d'ordre d'affichage `CHANNEL_FILTER_ORDER`.

Un second exemple avec table : `app/dashboard/audit/components/league-breakdown.tsx` isole entièrement la définition des colonnes TanStack (`ColumnDef<AuditLeagueRow>[]`) et le rendu `DataTable`, avec la logique de bascule d'activation d'une ligue déléguée au hook `useUpdateCompetitionActive` du domaine `audit`.

## Contenu markdown servi (`content/*.md`)

Le glossaire, l'aide et la formation sont du contenu éditorial versionné en markdown dans `apps/web/content/`, jamais dans une base de données. Le mécanisme, illustré par `app/dashboard/glossaire/page.tsx` :

1. Une fonction serveur asynchrone lit le fichier avec `node:fs` (`fs.readFile`) depuis `path.join(process.cwd(), "content", "glossaire-evcore.md")`.
2. Le `page.tsx` est un Server Component `async` : il attend le contenu (`await loadGlossary()`) avant de rendre — pas de fetch client, pas de route API dédiée pour ce contenu statique.
3. `getMarkdownToc(content)` (exporté par `components/markdown-article.tsx`) extrait la table des matières à partir des titres de niveau 2 (`##`) pour peupler la navigation latérale.
4. `<MarkdownArticle content={content} />` fait le rendu final.

`components/markdown-article.tsx` est un **parseur markdown maison**, pas `remark`/MDX : il supporte titres `#` à `####` (un seul niveau, sans imbrication), paragraphes, listes à puces ou numérotées à un seul niveau, tableaux `|...|`, blocs de code ` ``` `, citations `> ` et séparateurs `---`. En inline : `**gras**`, `` `code` `` et `[texte](lien)` — un lien externe (`http...`) est volontairement dégradé en texte brut, avec le commentaire dans le code : « External URLs rendered as plain text — LLM output is untrusted ». Le composant accepte une prop `variant` (`"article"` ou `"chat"`) qui change uniquement le style de rendu, pas le parsing.

Même mécanisme pour `app/dashboard/help/page.tsx` (lit `content/help-leagues.md`) et pour la formation, où `domains/formation/server/formation-content.ts` lit un dossier entier (`content/formation/`) avec un frontmatter maison parsé à la main (pas de librairie type `gray-matter`), et résout le chemin de contenu avec un fallback entre exécution locale et exécution monorepo (`DEFAULT_CONTENT_ROOT` vs `MONOREPO_CONTENT_ROOT`).

## Internationalisation

- `i18n.ts` (racine de `apps/web`) configure `next-intl` via `getRequestConfig` : la locale est lue depuis le cookie `NEXT_LOCALE` (posé par `proxy.ts`, voir plus bas), avec `fr` comme `defaultLocale` et repli si la valeur du cookie n'est pas dans `locales: ["fr", "en"]`.
- Les traductions vivent dans `messages/fr.json` et `messages/en.json`, un objet unique avec des clés de premier niveau par section produit (`nav`, `decisions`, `investment`, `coupons`, `formation`, `audit`, `performance`, `bankrollPage`, `betSlips`, `subscriptions`, `common`, `table`, `theme`, `auth`, …). Les pages consomment ces clés via `useTranslations("investment")` côté client ou `getTranslations("formation")` côté serveur (ex. `generateMetadata` dans `app/dashboard/formation/[slug]/page.tsx`).
- Règle héritée de `CLAUDE.md` : les identifiants de canaux et codes internes (`DRAW`, `SAFE`, `BTTS`, `DOUBLE_CHANCE`, …) restent en anglais partout, y compris dans une UI traduite en français — seuls les libellés affichés à l'utilisateur sont traduits, jamais la valeur de l'enum elle-même. `domains/investment/types/investment.ts` définit par exemple `InvestmentChannel` avec des valeurs anglaises fixes, indépendantes de la locale d'affichage.

## `proxy.ts` — le middleware Next.js

Particularité du repo : le middleware Next.js s'appelle `proxy.ts` et non `middleware.ts`. Son rôle, tel qu'observé dans le code (racine de `apps/web`) :

- **Authentification** : il lit le cookie de session et appelle `${BACKEND_URL}/auth/me` pour résoudre la session (`getSession`). Sans cookie ou sur une réponse non-`ok`, la session est `null`.
- **Garde de routing** :
  - une route `/auth/*` avec session active redirige vers `/dashboard` ;
  - une route `/dashboard/*` sans session redirige vers `/auth/login` ;
  - les routes admin-only (`/dashboard/audit`, `/dashboard/glossaire`) redirigent vers `/dashboard` si `session.user.role !== "ADMIN"`.
- **Résolution de locale** : si le cookie `NEXT_LOCALE` est absent, il est déduit de l'en-tête `Accept-Language` (`en` si celui-ci commence par `en`, sinon `fr` par défaut) et posé sur la réponse — c'est ce cookie que `i18n.ts` relit ensuite.
- Le `matcher` exporté limite l'exécution du middleware à `/auth/:path*` et `/dashboard/:path*`.

Le contrôle de rôle `ADMIN` pour les autres sections réservées (`engine`, `ml`, `reports`, `users`) n'est **pas** fait dans `proxy.ts` mais directement dans chaque `page.tsx` via `getCurrentSession()` (`domains/auth/use-cases/get-current-session.ts`) suivi d'un `redirect("/dashboard")` — `proxy.ts` ne couvre donc que `audit` et `glossaire` comme garde-fou admin au niveau middleware.

## Conventions de composants shadcn observées

- Tokens sémantiques systématiques : `bg-panel`, `bg-panel-strong`, `bg-secondary`, `border-border`, `text-muted-foreground`, `text-accent`, `bg-accent-soft` — jamais de couleur Tailwind brute (`slate-500`, `blue-600`) dans les composants inspectés.
- `gap-*` généralisé pour l'espacement flex/grid (`flex flex-col gap-3`, `grid grid-cols-2 gap-2`) plutôt que `space-y-*`/`space-x-*`, conformément à la règle du dépôt.
- Composition plutôt que réécriture : `DataTable` (le wrapper `@evcore/ui` autour de TanStack Table) est appelé avec une prop `mobileCard` pour fournir le rendu carte mobile sans dupliquer les données ou la logique de tri — un seul modèle de colonnes pilote les deux rendus, desktop et mobile.
