# TODO-UI — EVCore Web

Référence : audit frontend + backend du 2026-04-25.
Trois canaux actifs : **Canal EV** (betting-engine), **Canal Sécurité** (safe value), **Canal Confiance** (prediction).

---

## P0 — Fondations : design system, charts, filtres, table

Travail structurant à faire **avant** toute nouvelle feature UI. Tout le reste (P1–P8) en dépend. L'état actuel :

- `@evcore/ui` contient 9 composants seulement — aucun primitif form (Input, Select, Checkbox…)
- Zéro librairie de charts — la `BankrollTrendChart` est du SVG custom fait à la main
- Composants éparpillés dans 6 dossiers différents sans convention claire
- Chaque page réinvente son propre système de filtres
- Les tables sont du CSS custom avec sticky columns manuelles

**Décision de périmètre :**

- `@evcore/ui` héberge les **primitifs partagés** et les **composants composites génériques** réutilisables dans plusieurs apps/pages : `Button`, `Input`, `DatePicker`, `FilterBar`, `DataTable`, `ResponsiveGrid`, `ThemeProvider`
- `apps/web/components/` héberge les wrappers **spécifiques à l'app web** ou dépendants d'une librairie non partagée : charts Recharts, AppShell, NotificationBell, BetSlipDrawer
- `apps/web/app/dashboard/[feature]/components/` héberge les composants **spécifiques à une feature**

---

### Ordre d'implémentation recommandé

Objectif : garder toute l'ambition de P0, mais l'exécuter dans un ordre qui évite les retours arrière.

**P0-A — Base design system**

- [x] Shadcn/ui initialisé dans `packages/ui`
- [x] `theme.css` converti vers des tokens stables light-first
- [x] Primitifs indispensables ajoutés : `Input`, `Select`, `Checkbox`, `Switch`, `Tabs`, `Tooltip`, `Popover`, `Separator`, `Skeleton`, `RadioGroup`, `Sheet`, `Command`, `Calendar`
- [x] Exports `@evcore/ui` remis au propre

**P0-B — Composites partagés**

- [x] `DatePicker` + `DateRangePicker`
- [x] `FilterBar` + filtres enfants dans `@evcore/ui`
- [x] `DataTable` dans `@evcore/ui` (TanStack Table)
- [x] `ResponsiveGrid` dans `@evcore/ui`

**P0-C — Conventions & consolidation**

- [x] Arborescence de composants clarifiée
- [x] Doublons supprimés (`count-card.tsx` fusionné dans `StatCard`, `TableCard` migré dans `@evcore/ui`)
- [x] `COMPONENTS.md` rédigé
- [x] Règles responsive formalisées et utilisées comme check de review

**P0-D — Infra globale**

- [x] Dark mode posé au niveau des tokens + `ThemeProvider` (next-themes, `.dark` class, `suppressHydrationWarning`)
- [x] i18n `next-intl` posée au niveau app/layout/proxy/messages (`proxy.ts`, `NextIntlClientProvider`, `fr.json`/`en.json`)
- [x] Tous les composants `@evcore/ui` validés sans couleurs hardcodées (scan text-slate-\*, bg-emerald-\*, space-y-\* → 0 résultats) — chaînes non externalisées dans les pages : suivi en P0.8

**P0-E — Consommation de la fondation**

- [x] Migration charts bankroll (`BankrollTrendChart` SVG → `EvAreaChart`)
- [x] Migration filtres fixtures (`fixtures-filters.tsx` → `FilterBar`)
- [x] Migration table fixtures (`fixtures-table.tsx` → `DataTable`)
- [x] Migration filtres bankroll → `FilterBar`, table transactions → `DataTable`
- [x] Migration filtres bet-slips → `FilterBar`, résumé période → `StatCard compact ×3`
- [x] Migration audit : `bets-breakdown` → `TableCard + StatList`, `league-breakdown` → `DataTable + ProgressBar`
- [x] Migration `fixture-diagnostics.tsx` → `DataTable` + `StatCard compact × 4` dans `ResponsiveGrid`, EV formatté `+14.7%`
- [x] Construction de `/dashboard/params/account` (Apparence, Langue, placeholders Notifications/Bankroll)

**Definition of done de P0 :**

- [x] Les pages critiques utilisent les primitives communes au lieu de variantes locales
- [x] Les composants UI passent en light/dark
- [x] Les chaînes UI nouvelles passent par i18n (clés `common`, `nav`, `auth`, `account`, `theme`, `locale`)
- [x] Les vues clés sont testées à `375px`, `768px`, `1280px` (Playwright — `pnpm --filter web e2e`, 16/16 ✅)

---

### P0.1 — Adopter shadcn/ui comme base de `@evcore/ui`

shadcn/ui copie les composants directement dans la codebase (pas de dépendance externe à maintenir), basé sur Radix UI + Tailwind déjà présents. On personnalise ensuite avec les tokens EVCore.

**Installation & configuration :**

- [x] Initialiser shadcn/ui dans `packages/ui` (`pnpm dlx shadcn@latest init`)
- [x] Configurer `components.json` : pointer vers `packages/ui/src/components`, alias `@evcore/ui`
- [x] Mettre à jour `packages/ui/src/styles/theme.css` : tokens light + dark complets (palette EVCore slate/teal)
- [x] Tailwind 4 compatible avec le système de variables shadcn

**Primitifs ajoutés via shadcn CLI :**

- [x] `Input`
- [x] `Select`
- [x] `Combobox` (Command + Popover, composite manuel)
- [x] `Checkbox` + `RadioGroup`
- [x] `Switch`
- [x] `Tabs`
- [x] `Tooltip`
- [x] `Popover`
- [x] `Separator`
- [x] `Skeleton`
- [x] `Sheet`
- [x] `DropdownMenu`
- [x] `Avatar`
- [x] `Empty`
- [x] `Sidebar`
- [x] `Calendar` + `DatePicker` / `DateRangePicker` (composite manuel sur shadcn Calendar)

**Nouveaux composants génériques ajoutés :**

- [x] `ProgressBar` — valeur/max, tons auto via `thresholds` (success/warning/danger)
- [x] `StatList` — liste clé/valeur avec tons (positive/negative/warning/neutral)
- [x] `StatCard` étendu — prop `icon`, couleurs hardcodées → tokens sémantiques
- [x] `TableCard` — `subtitle` rendu optionnel

**Re-exporté proprement :**

- [x] `packages/ui/src/index.ts` exporte tous les composants (26 exports)
- [x] Règle appliquée : zéro classe de design hors de `@evcore/ui` dans les pages et features

---

### P0.2 — Recharts : système de charts unifié

Remplacer le SVG custom et poser la base pour tous les graphes futurs (ROI curve, reliability diagram, feature bars, weight evolution).

**Installation :**

- [x] `recharts` ajouté (catalog + `apps/web/package.json`)
- [x] `apps/web/components/charts/` créé (wrappers EVCore spécifiques à l'app)

**Composants créés :**

- [x] `<EvAreaChart>` — courbe avec aire remplie (`data`, `xKey`, `yKey`, `color`, `height`, `formatY?`, `gradientId?`)
- [x] `<EvBarChart>` — barres horizontales/verticales (`data`, `xKey`, `bars: BarDef[]`, `layout?`)
- [ ] `<EvLineChart>` — lignes multiples
- [ ] `<EvRadialBar>` — jauge circulaire
- [ ] `<EvScatterChart>` — nuage de points (reliability diagram)

**Migration :**

- [x] `BankrollTrendChart` (SVG custom) → `<EvAreaChart>`
- [ ] Bar chart win/loss dans `performance-card.tsx` → `<EvBarChart>`

**Conventions de style :**

- [ ] Palette de couleurs chart EVCore via tokens CSS vars
- [ ] Tooltip unifié
- [ ] Axes : labels `text-[0.62rem] uppercase tracking`

---

### P0.3 — FilterBar : composant de filtres unifié

Aujourd'hui chaque page réinvente ses filtres (`fixtures-filters.tsx`, date pickers inline dans bankroll, etc.). Un seul composant, trois comportements selon le breakpoint.

**Comportement responsive :**

- **Mobile** (`< sm`) : bouton "Filtres (N)" → bottom sheet Vaul avec tous les filtres, bouton "Appliquer"
- **Tablet** (`sm → lg`) : barre scrollable horizontale avec chips
- **Desktop** (`≥ lg`) : barre inline complète, toujours visible

**Composant `<FilterBar>` :**

- [x] `packages/ui/src/components/filter-bar.tsx` créé
- [x] Props : `filters: FilterDef[]`, `value: FilterState`, `onChange`, `onReset`
- [x] `FilterDef` : union discriminée `select | multiselect | date | daterange | toggle`
- [x] Chips cliquables avec reset individuel
- [x] Chip "Réinitialiser tout" si filtre actif
- [x] Compteur de filtres actifs sur le bouton mobile
- [x] Responsive : Sheet bottom (mobile) / chips scrollables (tablet) / barre inline (desktop)

**Composants fils (intégrés dans filter-bar.tsx) :**

- [x] `FilterSelect`, `FilterDatePicker`, `FilterDateRange`, `FilterMultiSelect`, `FilterToggle`

**Migration :**

- [x] `fixtures-filters.tsx` → `FilterBar`
- [x] `bankroll-page-client.tsx` → `FilterBar` (from/to/type)
- [x] `bet-slip-list-page-client.tsx` → `FilterBar` (type/from/to)

---

### P0.4 — DataTable : composant de table unifié

Les tables actuelles sont du CSS custom avec sticky columns gérées manuellement et des breakpoints fragiles. Un composant `<DataTable>` basé sur TanStack Table (même famille que TanStack Query déjà utilisé).

**Installation :**

- [x] `@tanstack/react-table` ajouté (catalog + packages)

**Composant `<DataTable>` :**

- [x] `packages/ui/src/components/data-table.tsx` créé (sur shadcn `table` primitive + TanStack Table)
- [x] Tri par colonne (clic header)
- [x] Colonnes sticky
- [x] Colonnes masquées via `columnVisibility` prop
- [x] Lignes expandables (`getRowCanExpand` + `renderSubRow`)
- [x] Pagination optionnelle
- [x] Empty state intégré (`emptyState?: ReactNode`)
- [x] Skeleton de chargement intégré (`isLoading`, `loadingRows`)
- [x] Responsive : fallback card-list via `mobileCard` prop

**Migration :**

- [x] `fixtures-table.tsx` → `DataTable`
- [x] `league-breakdown.tsx` → `DataTable(mobileCard)` + `ProgressBar`
- [x] `bets-breakdown.tsx` → `TableCard + StatList` (panneaux stats, pas de table)
- [x] `fixture-diagnostics.tsx` → `DataTable` (candidatePicks + evaluatedPicks)

---

### P0.5 — Consolidation des composants

Clarifier quoi va où et supprimer les doublons.

**Convention finale :**

| Où                                             | Quoi                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/`                  | Primitifs purs + composites génériques sans logique métier, réutilisables partout (Button, Badge, Input, DatePicker, FilterBar, DataTable, ResponsiveGrid…) |
| `apps/web/components/`                         | Composants app génériques avec logique EVCore mais sans dépendance à une feature (AppShell, BetSlipDrawer, Notification bell…)                              |
| `apps/web/app/dashboard/[feature]/components/` | Composants spécifiques à une feature (FixtureDiagnostics, BankrollTrendChart…)                                                                              |

**Tâches :**

- [x] `table-card.tsx` migré dans `@evcore/ui`
- [x] `info-tooltip.tsx` remplacé par `Tooltip` shadcn (composant supprimé)
- [x] `fixture-status-badge.tsx` déplacé dans `apps/web/components/` (vérifié, aucun import cassé)
- [x] `date-field.tsx` supprimé (remplacé par `DatePicker` shadcn)
- [x] `count-card.tsx` fusionné dans `StatCard` (audit page utilise `StatCard` directement)
- [x] `COMPONENTS.md` rédigé dans `packages/ui/`

---

### P0.6 — Conventions responsive

Établir des règles claires applicables à toutes les pages (P1–P8 inclus).

- [x] Breakpoints Tailwind 4 : `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- [x] `<ResponsiveGrid>` dans `@evcore/ui` (`cols` par breakpoint, `gap` variant)
- [x] Règle formalisée : toute page testée à 375px / 768px / 1280px avant d'être considérée terminée
- [x] Règle : drawers Vaul uniquement comme interface de détail sur mobile

---

### P0.7 — Dark mode

Le dark mode est une décision de design system, pas une feature page — il faut le poser en P0 car il structure tous les tokens CSS. Avec Tailwind 4 + shadcn/ui, il repose entièrement sur les variables CSS et la classe `.dark` sur `<html>`.

**Architecture :**

- [x] Tailwind 4 configuré en mode `class` pour le dark mode
- [x] Variables CSS dark dans `packages/ui/src/styles/theme.css` (tous les tokens : `--background`, `--foreground`, `--border`, `--panel`, `--panel-strong`, `--accent`…)
- [x] `ThemeProvider` dans `@evcore/ui` (wrappeur `next-themes`, `attribute="class"`, `enableSystem`)
- [x] `next-themes` ajouté au catalog + `apps/web`
- [x] `ThemeProvider` intégré dans le root layout via `Providers` + `suppressHydrationWarning` sur `<html>`
- [x] Audit complet des composants `@evcore/ui` : couleurs hardcodées Tailwind restantes à remplacer
- [ ] Charts Recharts : tooltips et axes en mode dark

**Préférence utilisateur (Account settings) :**

- [x] Toggle "Thème" dans `/dashboard/params/account` : Clair / Sombre / Système (RadioGroup card visuel)
- [ ] Persister en base (`User.theme`) — actuellement localStorage uniquement
- [ ] Endpoint backend : `PATCH /auth/me` avec `{ theme }`

---

### P0.8 — Internationalisation FR / EN (`next-intl`)

L'app est entièrement en français aujourd'hui. Poser l'infra i18n maintenant évite une migration douloureuse plus tard. `next-intl` est le choix naturel pour Next.js App Router — premier support des Server Components.

**Installation & configuration :**

- [x] `next-intl` ajouté (catalog + `apps/web`)
- [x] `apps/web/messages/fr.json` + `apps/web/messages/en.json` créés (clés : `common`, `nav`, `filters`, `table`, `theme`, `locale`, `auth`, `account`)
- [x] `apps/web/i18n.ts` configuré (cookie-based, `getRequestConfig`)
- [x] `withNextIntl` dans `next.config.js`
- [x] `proxy.ts` (Next.js 16, remplace `middleware.ts` deprecated) : détection locale via `Accept-Language` header → cookie `NEXT_LOCALE`
- [x] Root layout wrappé avec `NextIntlClientProvider` (async Server Component, `getLocale()` + `getMessages()`)

**Migration des chaînes :**

- [ ] Extraire toutes les chaînes UI hardcodées restantes vers `fr.json` (pages dashboard, messages d'erreur, empty states)
- [x] `en.json` créé en miroir pour les clés de base
- [ ] Migration pages dans l'ordre P1→P8

**Préférence utilisateur (Account settings) :**

- [x] Sélecteur "Langue" dans `/dashboard/params/account` (RadioGroup FR/EN, `useOptimistic`, cookie + `router.refresh()`)
- [ ] Persister en base (`User.locale`)
- [ ] Endpoint backend : `PATCH /auth/me` avec `{ locale, theme }`
- [ ] Au login, lire `User.locale` et positionner le cookie en conséquence

---

### P0.9 — Page Account settings (sortir du placeholder)

La page `/dashboard/params/account` est actuellement un placeholder "À venir". C'est le point d'entrée naturel pour P0.7 et P0.8. À construire en même temps.

- [x] Section **Apparence** : RadioGroup card (Clair / Sombre / Système), `useTheme`, i18n
- [x] Section **Langue** : RadioGroup (FR / EN), `useOptimistic` + cookie + `router.refresh()`
- [ ] Section **Notifications** : préférences par type (ROI_ALERT, WEEKLY_REPORT…)
- [ ] Section **Compte** : email, username, "Modifier le mot de passe"
- [ ] Section **Bankroll** : unité de stake, devise d'affichage
- [ ] Endpoint `PATCH /auth/me` + persistance en base (thème + locale)

---

## P1 — Identité visuelle des 3 canaux

Les trois canaux coexistent dans une seule ligne de tableau sans identité propre. Refactoring visuel pour que chaque canal soit reconnaissable partout dans l'app.

**Palette à fixer :**

- Canal EV → Amber/Or
- Canal Sécurité → Teal/Vert
- Canal Confiance → Indigo/Bleu

**Tâches :**

- [x] Définir les tokens couleur des 3 canaux dans le design system (`@evcore/ui`) — `theme.css` light + dark, `@theme inline`
- [x] Refactoriser la page Fixtures : `DecisionBadge` EV amber, `SVBadge` SV teal, `PredictionBadge` Conf indigo (inline styles via tokens canal)
- [x] Refactoriser le Dashboard :
  - [x] Remplacer la "Predictions Card" générique par 3 "Canal Cards" side-by-side (`canal-cards.tsx`)
  - [x] Canal EV : ROI, paris réglés, réussite (depuis `PnlSummary`)
  - [x] Canal Sécurité : Net (unités), paris réglés, gagnés
  - [x] Canal Confiance : hit rate du jour + 30 jours (`usePredictions` + `usePredictionStats`)
- [x] Devise EUR + formatage compact mobile : `formatCurrency(v, compact?)` + `formatSignedCurrency` dans `helpers/number.ts`, appliqués sur Bet Slips (list + detail panel) et Bankroll
- [x] Badges canal sur Bet Slips (detail panel — badge EV/SV par sélection) et Bankroll transactions (colonne + mobile card) — `CanalBadge` composant partagé extrait dans `components/canal-badge.tsx`; `canal` exposé via `BetSlipItemView` + `BankrollTransaction` (backend : `Bet.isSafeValue` → `canal`, migration Prisma `add_bet_bankroll_relation`)

---

## P2 — Page "Picks du jour" (`/dashboard/picks`)

Page centrale de l'expérience quotidienne. Le dashboard actuel est trop dense. Cette page doit être l'écran vers lequel l'utilisateur revient chaque matin.

**Données disponibles :**

- `GET /fixture?date=today` → picks EV + SV + status
- `GET /predictions?date=today` → picks Canal Confiance
- `ModelRun.features` → contribution de chaque facteur par pick

**Tâches :**

- [ ] Créer la route `/dashboard/picks`
- [ ] Brief du matin : nombre de picks par canal pour aujourd'hui, statut global (BET / NO_BET / en attente)
- [ ] Pick cards par canal, tri chronologique par heure de match
- [ ] Section expandable "Pourquoi ce pick ?" sur chaque card :
  - [ ] Barre de contribution des 4 facteurs (`forme_recente`, `xg`, `performance_dom_ext`, `volatilite_ligue`) depuis `ModelRun.features`
  - [ ] Probabilité estimée vs cote disponible
  - [ ] EV affiché clairement
- [ ] Statut en temps réel post-match : résultat correct / incorrect avec polling (interval 60s)
- [ ] Ajouter le lien "Picks du jour" dans la navigation principale

---

## P3 — Page Performance (`/dashboard/performance`)

Transparence totale sur les 3 modèles. C'est l'argument de confiance de l'app — montrer que le système est mesurable et calibré.

**Données disponibles :**

- `GET /risk/report/weekly` → ROI + Brier Score
- `GET /dashboard/competition-stats` → ROI par compétition + canal
- `GET /adjustment` → historique AdjustmentProposals (poids actuels + proposés + dates)
- `POST /backtest` → résultats complets par saison (jamais affichés dans l'UI)

**Tâches :**

- [ ] Créer la route `/dashboard/performance`
- [ ] Section "Vue d'ensemble" :
  - [ ] ROI global par canal (EV / Sécurité / Confiance) sur période glissante
  - [ ] Sélecteur de période (7j / 30j / saison)
- [ ] Section "Calibration" :
  - [ ] Reliability diagram interactif par canal (axe X = proba estimée, axe Y = fréquence réelle)
  - [ ] Brier Score actuel avec tendance (flèche haut/bas vs semaine précédente)
- [ ] Section "ROI par compétition × canal" :
  - [ ] Table avec filtre par canal, données depuis `competition-stats`
  - [ ] Highlights : meilleure et pire compétition
- [ ] Section "Évolution des poids" :
  - [ ] Timeline des `AdjustmentProposal` appliqués
  - [ ] Graphe linéaire montrant l'évolution de chaque poids au fil du temps
  - [ ] Badge "auto-appliqué" vs "rollback"
- [ ] Section "Résultats backtest" :
  - [ ] Afficher les sorties du module `/backtest` : ROI simulé, win rate, max drawdown, Brier Score par saison
  - [ ] Comparaison Canal EV vs Canal Sécurité sur les mêmes données historiques

---

## P4 — Gamification (discipline & progression)

Récompenser les bonnes métriques (calibration, patience, volume statistiquement significatif) et non le court terme.

**Données disponibles :**

- `prediction.correct` → séquences de prédictions correctes
- Count settled bets par user (bankroll transactions + bet slips)
- Drawdown calculable depuis bankroll transactions

**Tâches :**

- [ ] Système de badges :
  - [ ] **Milestones volume** : 50 / 150 / 300 paris réglés (seuils de significativité statistique du modèle)
  - [ ] **Hit streak** (Canal Confiance) : N prédictions correctes consécutives
  - [ ] **Patience** : traverser un drawdown ≥ 10% sans override
  - [ ] **Calibré** : Brier Score < 0.20 sur 50+ prédictions
- [ ] Afficher les badges sur le profil utilisateur et le leaderboard
- [ ] Enrichir le leaderboard :
  - [ ] Ajouter colonne "Badges"
  - [ ] Ajouter delta ROI vs semaine précédente (+0.3% ↑)
  - [ ] Conserver le podium top 3 existant
- [ ] Weekly brief narratif (email + in-app) :
  - [ ] Phrase générée côté backend résumant la semaine : picks, ROI, Brier Score, meilleure compétition
  - [ ] Afficher le brief dans le dashboard le lundi matin
- [ ] **Avatars utilisateur** (style Netflix) :
  - [ ] Créer une bibliothèque d'avatars illustrés thématiques (football, stats, maths — pas de photos)
  - [ ] Sélecteur d'avatar sur la page compte : grille de choix, aperçu en temps réel
  - [ ] Deux catégories : avatars disponibles dès le départ + avatars verrouillés (débloqués via badges)
    - [ ] Milestone 50 paris → débloque un avatar
    - [ ] Milestone 150 paris → débloque un avatar
    - [ ] Hit streak Canal Confiance → débloque un avatar
    - [ ] Brier Score < 0.20 → débloque un avatar "Calibré"
  - [ ] Avatar affiché sur le leaderboard à côté du username
  - [ ] Indicateur visuel sur les avatars verrouillés (cadenas + condition de déblocage)

---

## P5 — Centre de notifications (`/dashboard/notifications`)

`/notifications` est une API paginée avec 7 types d'alertes. Actuellement limitée à 3 entrées dans le dashboard.

**Types disponibles :** `ROI_ALERT`, `MARKET_SUSPENSION`, `BRIER_ALERT`, `WEEKLY_REPORT`, `ETL_FAILURE`, `WEIGHT_ADJUSTMENT`, `XG_UNAVAILABLE_REPORT`

**Tâches :**

- [ ] Ajouter icône cloche dans la navigation avec badge de count non-lu
- [ ] Créer la page `/dashboard/notifications` :
  - [ ] Liste paginée de toutes les notifications
  - [ ] Filtre par type
  - [ ] Marquer tout comme lu / marquer individuellement
  - [ ] Différenciation visuelle par sévérité (critique / haute / normale)
- [ ] Sur le dashboard, remplacer la liste de 3 alertes par un composant "Dernières alertes" avec lien "Voir tout →"

---

## P6 — Quick wins visuels

Améliorations rapides sans nouvelle page ni nouvelle API.

- [ ] **Feature breakdown sur les pick cards** : afficher une barre horizontale de contribution des 4 facteurs depuis `ModelRun.features` — données déjà en DB, jamais affichées
- [ ] **Bankroll — projection 30 jours** : ajouter une ligne pointillée sur le trend chart indiquant la trajectoire actuelle (calcul client-side depuis transactions)
- [ ] **Bankroll — stats de période** : afficher ROI de la période sélectionnée directement sous le sélecteur de dates
- [ ] **Fixtures — preset filters** : ajouter des raccourcis "Picks EV du jour", "Picks SV du jour", "Matchs en cours" au-dessus du tableau de filtres
- [ ] **Page compte** : compléter les quick wins non couverts par P0.9
  - [ ] Ajouter le fuseau horaire si non traité dans la première version P0.9

---

## P7 — Refonte UX du diagnostic de fixture (`fixture-diagnostics.tsx`)

Le composant actuel est lisible pour un admin/dev mais opaque pour un user lambda. Problèmes identifiés :

- `λ Dom.` / `λ Ext.` : paramètres Poisson incompréhensibles sans formation statistique
- "Valeur" affiché en décimal brut (`0.147`) plutôt qu'en pourcentage (`+14.7%`)
- "Qualité" (`qualityScore = EV × deterministicScore`) : métrique interne sans explication
- Deux tables séparées "Sélections candidates" / "Sélections évaluées" : distinction confuse pour un user
- Les `ModelRun.features` (forme, xG, dom/ext, volatilité) sont disponibles en base mais **absents du composant** — c'est pourtant la meilleure façon d'expliquer un pick
- Aucune hiérarchie visuelle : tout a le même poids

**Tâches :**

- [ ] **Section "Entrées modèle" → renommer et simplifier**
  - [ ] Remplacer `λ Dom.` / `λ Ext.` par une phrase lisible : "Le modèle prédit ~1.8 buts dom. · ~0.9 buts ext."
  - [ ] Garder "Prob. estimée" et "Buts attendus" tels quels (compréhensibles)

- [ ] **Ajouter la section "Pourquoi ce pick ?" avec les features**
  - [ ] Afficher les 4 facteurs depuis `ModelRun.features` : `forme_recente`, `xg`, `performance_dom_ext`, `volatilite_ligue`
  - [ ] Une barre de progression horizontale par facteur (score 0–1 → largeur visuelle)
  - [ ] Label lisible par facteur : "Forme récente", "Expected Goals (xG)", "Avantage dom./ext.", "Stabilité de la ligue"
  - [ ] Code couleur : vert si le facteur favorise le pick, ambre si neutre, rose si défavorable

- [ ] **Fusionner ou hiérarchiser les deux tables**
  - [ ] Option A : une seule table "Tous les marchés" avec colonne Statut (Viable / Écarté)
  - [ ] Option B : conserver deux tables mais ajouter une phrase d'intro explicative : "Le modèle a analysé N marchés. X ont passé tous les filtres."
  - [ ] Choisir l'option en fonction du feedback utilisateur

- [ ] **Formater "Valeur" (EV) en pourcentage signé**
  - [ ] `0.147` → `+14.7%` (emerald), `-0.05` → `-5.0%` (rose)
  - [ ] Même chose pour "Qualité" si conservé

- [ ] **Masquer ou réduire "Qualité" pour les users lambda**
  - [ ] Envisager de ne l'afficher qu'en mode "Détail technique" (toggle visible par les admins)

- [ ] **Raisons de rejet : améliorer la lisibilité**
  - [ ] Ajouter une icône par type de raison (🔒 marché suspendu, 📉 valeur insuffisante, 🎯 probabilité trop faible…)
  - [ ] Optionnel : tooltip avec une explication courte au survol

- [ ] **Hiérarchie visuelle générale**
  - [ ] Le pick retenu (celui avec `decision: BET`) doit être mis en avant visuellement en haut du diagnostic, pas noyé dans la table
  - [ ] Les picks "Viable" dans la table évaluée doivent se distinguer clairement des picks "Rejeté" (fond légèrement coloré sur la ligne ?)

---

## P8 — Centre de formation (`/dashboard/formation`)

La page code `/dashboard/help` actuelle (libellé utilisateur : `Aide`) est un fichier markdown brut (`help-leagues.md`) rendu tel quel. Trop technique, trop dense, aucune entrée pédagogique pour un user qui débute.

Objectif : transformer ça en un vrai centre de formation avec articles, vidéos, progression et niveaux de difficulté. Remplacer la route `/dashboard/help` ou la faire coexister.

---

### Structure de contenu proposée

**5 catégories :**
| Catégorie | Contenu |
|---|---|
| **Les bases** | Qu'est-ce que l'EV, les cotes, la probabilité, la value |
| **Les 3 canaux EVCore** | Comment lire un pick EV / Sécurité / Confiance, différences, cas d'usage |
| **Bankroll & discipline** | Gestion en unités, drawdown normal, psychologie long terme |
| **Guide par ligue** | Contenu actuel `help-leagues.md` restructuré par ligue |
| **Comment utiliser l'app** | Walkthrough des pages : fixtures, coupons, bankroll, diagnostic |

---

### Tâches

**Infrastructure contenu :**

- [ ] Définir le format des fichiers de contenu : MDX avec frontmatter (`title`, `category`, `difficulty: beginner|intermediate|advanced`, `readTime`, `videoUrl?`, `thumbnail?`, `slug`)
- [ ] Créer la structure de dossiers : `content/formation/articles/` + `content/formation/videos/`
- [ ] Migrer le contenu de `help-leagues.md` en articles individuels par ligue dans ce nouveau format
- [ ] Créer les premiers articles "Les bases" (EV, probabilité, cotes) — contenu rédactionnel à écrire

**Page d'accueil Formation (`/dashboard/formation`) :**

- [ ] Hero : titre + courte description ("Comprenez chaque pick, maîtrisez le système")
- [ ] Grille de cards par catégorie avec icône, nombre d'articles, badge "Nouveau" si contenu récent
- [ ] Section "Recommandé pour vous" : 2–3 articles selon le niveau et ce que l'utilisateur n'a pas encore lu
- [ ] Barre de progression globale : "X / Y articles lus"

**Page article (`/dashboard/formation/articles/[slug]`) :**

- [ ] Rendu MDX avec syntaxe enrichie (callouts, tableaux stylés, encadrés "À retenir")
- [ ] Indicateur de temps de lecture estimé
- [ ] Badge niveau (Débutant / Intermédiaire / Avancé)
- [ ] Navigation "Article précédent / suivant" dans la même catégorie
- [ ] Bouton "Marquer comme lu" (persisté en localStorage ou en base)

**Page vidéo (`/dashboard/formation/videos/[slug]`) :**

- [ ] Lecteur vidéo embarqué (YouTube iframe ou vidéo hébergée)
- [ ] Description + chapitres cliquables (timestamps)
- [ ] Articles liés en dessous

**Système de progression :**

- [ ] Tracking des articles lus et vidéos vues (localStorage en phase 1, table `UserProgress` en base pour phase 2)
- [ ] Indicateur de progression par catégorie (3/5 articles lus)
- [ ] Badge "Diplômé" débloqué quand toutes les bases sont lues — lié au système de badges P4

**Recherche :**

- [ ] Barre de recherche full-text sur les titres et contenus des articles

---

## Backlog / Phase 2

Idées validées mais dépendantes d'un volume de données suffisant ou d'une Phase 2 backend.

- [ ] **Override log** : permettre à l'utilisateur de noter son désaccord avec un NO_BET, puis afficher a posteriori "le modèle avait raison X fois sur Y overrides"
- [ ] **Annual recap** (style Spotify Wrapped) : carte de performance annuelle partageable
- [ ] **Comparaison bookmakers** : si plusieurs bookmakers dans les odds snapshots (Phase 2)
- [ ] **Mode "replay" d'un ModelRun** : reconstruire visuellement n'importe quel pick passé depuis ses features

---
