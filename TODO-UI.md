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
- [ ] Shadcn/ui initialisé dans `packages/ui`
- [ ] `theme.css` converti vers des tokens stables light-first
- [ ] Primitifs indispensables ajoutés : `Input`, `Select`, `Checkbox`, `Switch`, `Tabs`, `Tooltip`, `Popover`, `Separator`, `Skeleton`
- [ ] Exports `@evcore/ui` remis au propre

**P0-B — Composites partagés**
- [ ] `DatePicker` + `DateRangePicker`
- [ ] `FilterBar` + filtres enfants dans `@evcore/ui`
- [ ] `DataTable` dans `@evcore/ui`
- [ ] `ResponsiveGrid` dans `@evcore/ui`

**P0-C — Conventions & consolidation**
- [ ] Arborescence de composants clarifiée
- [ ] Doublons supprimés (`date-field.tsx`, `count-card.tsx` / `stat-card.tsx`, `info-tooltip.tsx`)
- [ ] `COMPONENTS.md` rédigé
- [ ] Règles responsive formalisées et utilisées comme check de review

**P0-D — Infra globale**
- [ ] Dark mode posé au niveau des tokens + `ThemeProvider`
- [ ] i18n `next-intl` posée au niveau app/layout/middleware/messages
- [ ] Tous les composants `@evcore/ui` validés sans couleurs hardcodées ni chaînes non externalisées

**P0-E — Consommation de la fondation**
- [ ] Migration charts bankroll/performance
- [ ] Migration filtres fixtures/bankroll/bet-slips
- [ ] Migration tables fixtures/diagnostic/audit
- [ ] Construction de `/dashboard/params/account` comme première page qui consomme thème + langue + préférences

**Definition of done de P0 :**
- [ ] Les pages critiques utilisent les primitives communes au lieu de variantes locales
- [ ] Les composants UI passent en light/dark
- [ ] Les chaînes UI nouvelles passent par i18n
- [ ] Les vues clés sont testées à `375px`, `768px`, `1280px`

---

### P0.1 — Adopter shadcn/ui comme base de `@evcore/ui`

shadcn/ui copie les composants directement dans la codebase (pas de dépendance externe à maintenir), basé sur Radix UI + Tailwind déjà présents. On personnalise ensuite avec les tokens EVCore.

**Installation & configuration :**

- [ ] Initialiser shadcn/ui dans `packages/ui` (`pnpm dlx shadcn@latest init`)
- [ ] Configurer `components.json` : pointer vers `packages/ui/src/components`, alias `@evcore/ui`
- [ ] Mettre à jour `packages/ui/src/styles/theme.css` : remplacer les variables CSS actuelles par le système de tokens shadcn (HSL), en conservant la palette EVCore (slate, emerald, teal accent)
- [ ] Vérifier que Tailwind 4 est compatible avec le système de variables shadcn (adapter si nécessaire)

**Primitifs à ajouter via shadcn :**

- [ ] `Input` — champs texte, search
- [ ] `Select` — dropdown simple (Radix Select)
- [ ] `Combobox` — select avec recherche (Command + Popover)
- [ ] `Checkbox` + `RadioGroup` — formulaires
- [ ] `Switch` — toggles
- [ ] `Tabs` — navigation par onglets
- [ ] `Tooltip` — info au survol (remplace `info-tooltip.tsx` actuel)
- [ ] `Popover` — popovers génériques
- [ ] `Separator` — lignes de séparation
- [ ] `Skeleton` — états de chargement (remplace les spinners ad hoc)
- [ ] `Sheet` — drawer latéral (complémente Vaul déjà présent)
- [ ] `Calendar` + `DatePicker` — remplace `date-field.tsx` custom
- [ ] `DateRangePicker` — sélecteur de plage (bankroll, bet-slips, performance)

**Re-exporter proprement :**

- [ ] Mettre à jour `packages/ui/src/index.ts` pour exporter tous les nouveaux composants
- [ ] S'assurer que les composants existants (Badge, Button, Card, EmptyState…) sont harmonisés avec le nouveau système de tokens — ajuster si nécessaire, ne pas casser l'API publique

---

### P0.2 — Recharts : système de charts unifié

Remplacer le SVG custom et poser la base pour tous les graphes futurs (ROI curve, reliability diagram, feature bars, weight evolution).

**Installation :**

- [ ] Ajouter `recharts` dans `apps/web/package.json`
- [ ] Créer `apps/web/components/charts/` (wrappers EVCore au-dessus de Recharts, côté app — pas dans `@evcore/ui` car Recharts n'appartient pas au design system partagé)

**Composants de base à créer :**

- [ ] `<EvAreaChart>` — courbe avec aire remplie (bankroll trend, ROI curve)
  - Props : `data`, `xKey`, `yKey`, `color`, `height`, `formatY?`, `formatTooltip?`
  - Responsive via `<ResponsiveContainer>`
- [ ] `<EvBarChart>` — barres verticales ou horizontales (win/loss, features breakdown)
  - Props : `data`, `xKey`, `bars: { key, color, label }[]`
- [ ] `<EvLineChart>` — lignes multiples (comparaison canaux, évolution poids)
  - Props : `data`, `xKey`, `lines: { key, color, label }[]`
- [ ] `<EvRadialBar>` — jauge circulaire (Brier Score, hit rate)
  - Props : `value`, `max`, `color`, `label`
- [ ] `<EvScatterChart>` — nuage de points (reliability diagram : proba estimée vs fréquence réelle)

**Migration :**

- [ ] Remplacer `BankrollTrendChart` (SVG custom dans `bankroll-page-client.tsx`) par `<EvAreaChart>`
- [ ] Remplacer le bar chart win/loss dans `performance-card.tsx` par `<EvBarChart>`

**Conventions de style :**

- [ ] Définir une palette de couleurs chart EVCore : utiliser les tokens CSS vars pour que les charts respectent le thème
- [ ] Tooltip unifié : même style sur tous les charts (fond blanc, border slate, police tabular)
- [ ] Axes : labels en `text-[0.62rem] uppercase tracking` pour cohérence avec le reste de l'app

---

### P0.3 — FilterBar : composant de filtres unifié

Aujourd'hui chaque page réinvente ses filtres (`fixtures-filters.tsx`, date pickers inline dans bankroll, etc.). Un seul composant, trois comportements selon le breakpoint.

**Comportement responsive :**

- **Mobile** (`< sm`) : bouton "Filtres (N)" → bottom sheet Vaul avec tous les filtres, bouton "Appliquer"
- **Tablet** (`sm → lg`) : barre scrollable horizontale avec chips
- **Desktop** (`≥ lg`) : barre inline complète, toujours visible

**Composant `<FilterBar>` :**

- [ ] Créer `packages/ui/src/components/filter-bar.tsx`
- [ ] Props : `filters: FilterDef[]`, `value: FilterState`, `onChange: (FilterState) => void`, `onReset`
- [ ] Type `FilterDef` : `{ key, label, type: 'select' | 'date' | 'daterange' | 'multiselect' | 'toggle' , options?: ... }`
- [ ] Afficher les filtres actifs comme chips cliquables avec croix de reset individuel
- [ ] Chip "Réinitialiser tout" si au moins un filtre actif
- [ ] Compteur de filtres actifs sur le bouton mobile

**Composants fils :**

- [ ] `<FilterSelect>` — wrappeur Select shadcn avec label
- [ ] `<FilterDatePicker>` — wrappeur DatePicker shadcn
- [ ] `<FilterDateRange>` — deux DatePickers liés (from / to)
- [ ] `<FilterMultiSelect>` — Combobox à sélection multiple avec chips

**Migration :**

- [ ] Remplacer `fixtures-filters.tsx` par `<FilterBar>`
- [ ] Remplacer les date pickers inline de `bankroll-page-client.tsx` par `<FilterDateRange>`
- [ ] Remplacer le filtre date/type de `bet-slips` par `<FilterBar>`

---

### P0.4 — DataTable : composant de table unifié

Les tables actuelles sont du CSS custom avec sticky columns gérées manuellement et des breakpoints fragiles. Un composant `<DataTable>` basé sur TanStack Table (même famille que TanStack Query déjà utilisé).

**Installation :**

- [ ] Ajouter `@tanstack/react-table` dans `apps/web/package.json`

**Composant `<DataTable>` :**

- [ ] Créer `packages/ui/src/components/data-table.tsx`
- [ ] Support tri par colonne (clic header)
- [ ] Support colonnes sticky (premier / dernières colonnes)
- [ ] Support colonnes masquées selon breakpoint (ex : masquer "Qualité" sur mobile)
- [ ] Support ligne expandable (remplace le pattern détail-panel actuel dans fixtures)
- [ ] Support pagination optionnelle
- [ ] Empty state intégré (passe `emptyState?: ReactNode`)
- [ ] Skeleton de chargement intégré (N lignes grises pendant le fetch)
- [ ] Responsive : sur mobile, fallback en card-list si `mobileCard` prop fourni

**Migration :**

- [ ] Migrer `fixtures-table.tsx` vers `<DataTable>`
- [ ] Migrer `diagnostic-table` dans `fixture-diagnostics.tsx` vers `<DataTable>`
- [ ] Migrer les tables d'audit (`bets-breakdown.tsx`, `league-breakdown.tsx`) vers `<DataTable>`

---

### P0.5 — Consolidation des composants

Clarifier quoi va où et supprimer les doublons.

**Convention finale :**

| Où | Quoi |
|---|---|
| `packages/ui/src/components/` | Primitifs purs + composites génériques sans logique métier, réutilisables partout (Button, Badge, Input, DatePicker, FilterBar, DataTable, ResponsiveGrid…) |
| `apps/web/components/` | Composants app génériques avec logique EVCore mais sans dépendance à une feature (AppShell, BetSlipDrawer, Notification bell…) |
| `apps/web/app/dashboard/[feature]/components/` | Composants spécifiques à une feature (FixtureDiagnostics, BankrollTrendChart…) |

**Tâches :**

- [ ] Déplacer `table-card.tsx` dans `@evcore/ui` (c'est un primitif)
- [ ] Déplacer `info-tooltip.tsx` dans `@evcore/ui` (remplacer par le `Tooltip` shadcn)
- [ ] Déplacer `fixture-status-badge.tsx` dans `apps/web/components/` (logique métier, pas un primitif)
- [ ] Supprimer `date-field.tsx` une fois le `DatePicker` shadcn en place
- [ ] Auditer `count-card.tsx` (audit) vs `stat-card.tsx` (@evcore/ui) : fusionner en un seul `StatCard`
- [ ] Documenter la convention dans un `COMPONENTS.md` dans `packages/ui/`

---

### P0.6 — Conventions responsive

Établir des règles claires applicables à toutes les pages (P1–P8 inclus).

- [ ] Définir les 4 breakpoints officiels EVCore dans `theme.css` : `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- [ ] Créer un composant `<ResponsiveGrid>` dans `@evcore/ui` : `cols` prop avec valeurs par breakpoint (ex: `cols={{ base: 1, sm: 2, lg: 3 }}`)
- [ ] Règle : toute page doit être testée à 375px (mobile), 768px (tablet), 1280px (desktop) avant d'être considérée terminée
- [ ] Règle : les drawers bottom sheet (Vaul) sont la seule interface de détail sur mobile — pas de panels latéraux en dessous de `lg`

---

### P0.7 — Dark mode

Le dark mode est une décision de design system, pas une feature page — il faut le poser en P0 car il structure tous les tokens CSS. Avec Tailwind 4 + shadcn/ui, il repose entièrement sur les variables CSS et la classe `.dark` sur `<html>`.

**Architecture :**

- [ ] Configurer Tailwind 4 en mode `class` pour le dark mode (`darkMode: 'class'` dans la config)
- [ ] Définir les variables CSS dark dans `packages/ui/src/styles/theme.css` : chaque token a une valeur light et une valeur dark (ex : `--background`, `--foreground`, `--border`, `--panel-strong`…)
- [ ] Créer un `ThemeProvider` dans `@evcore/ui` : wrappeur `next-themes` qui gère la persistance du thème (localStorage + SSR sans flash)
- [ ] Ajouter `next-themes` dans `apps/web/package.json`
- [ ] Intégrer le `ThemeProvider` dans le root layout (`apps/web/app/layout.tsx`)
- [ ] Vérifier que tous les composants `@evcore/ui` existants respectent les variables CSS (pas de couleurs hardcodées en Tailwind `bg-white`, `text-slate-900` → remplacer par `bg-background`, `text-foreground`)
- [ ] Vérifier les charts Recharts (P0.2) : les tooltips et axes doivent aussi switcher

**Préférence utilisateur (Account settings) :**

- [ ] Ajouter un toggle "Thème" dans `/dashboard/params/account` : Clair / Sombre / Système
- [ ] Persister la préférence en base (`User.theme: 'light' | 'dark' | 'system'`) — pas seulement en localStorage, pour que la préférence se retrouve sur tous les appareils
- [ ] Endpoint backend : `PATCH /auth/me` avec `{ theme }` (à ajouter)

---

### P0.8 — Internationalisation FR / EN (`next-intl`)

L'app est entièrement en français aujourd'hui. Poser l'infra i18n maintenant évite une migration douloureuse plus tard. `next-intl` est le choix naturel pour Next.js App Router — premier support des Server Components.

**Installation & configuration :**

- [ ] Ajouter `next-intl` dans `apps/web/package.json`
- [ ] Créer la structure de fichiers de traduction : `apps/web/messages/fr.json` + `apps/web/messages/en.json`
- [ ] Configurer `i18n.ts` et le plugin `next-intl` dans `next.config.ts`
- [ ] Configurer le middleware next-intl pour la détection de locale (cookie user > Accept-Language header > défaut FR)
- [ ] Wrapper le root layout avec `NextIntlClientProvider`

**Migration des chaînes :**

- [ ] Extraire toutes les chaînes UI hardcodées vers `fr.json` (labels, messages d'erreur, empty states, titres de page)
- [ ] Créer `en.json` en miroir avec les traductions anglaises
- [ ] Priorité de migration : composants `@evcore/ui` d'abord (Badge tones, EmptyState, Button), puis pages dans l'ordre P1→P8

**Préférence utilisateur (Account settings) :**

- [ ] Ajouter un sélecteur "Langue" dans `/dashboard/params/account` : Français / English
- [ ] Persister la préférence en base (`User.locale: 'fr' | 'en'`)
- [ ] Endpoint backend : `PATCH /auth/me` avec `{ locale }` (même endpoint que le thème)
- [ ] Au login, lire `User.locale` depuis la session et positionner le cookie next-intl en conséquence

---

### P0.9 — Page Account settings (sortir du placeholder)

La page `/dashboard/params/account` est actuellement un placeholder "À venir". C'est le point d'entrée naturel pour P0.7 et P0.8. À construire en même temps.

- [ ] Section **Apparence** : toggle thème Clair / Sombre / Système (P0.7)
- [ ] Section **Langue** : sélecteur FR / EN (P0.8)
- [ ] Section **Notifications** : quels types recevoir par email (ROI_ALERT, WEEKLY_REPORT, MARKET_SUSPENSION…) — préférences persistées en base
- [ ] Section **Compte** : affichage email, username, bouton "Modifier le mot de passe"
- [ ] Section **Bankroll** : unité de stake par défaut, devise d'affichage
- [ ] Appel unique `PATCH /auth/me` pour sauvegarder toutes les préférences

---

## P1 — Identité visuelle des 3 canaux

Les trois canaux coexistent dans une seule ligne de tableau sans identité propre. Refactoring visuel pour que chaque canal soit reconnaissable partout dans l'app.

**Palette à fixer :**
- Canal EV → Amber/Or
- Canal Sécurité → Teal/Vert
- Canal Confiance → Indigo/Bleu

**Tâches :**

- [ ] Définir les tokens couleur des 3 canaux dans le design system (`@evcore/ui`)
- [ ] Refactoriser la page Fixtures : remplacer les 3 colonnes "Decision / SV / Prediction" par 3 badges colorés distincts sur chaque ligne
- [ ] Refactoriser le Dashboard :
  - [ ] Remplacer la "Predictions Card" générique par 3 "Canal Cards" side-by-side, chacune avec ses métriques propres
  - [ ] Canal EV : ROI moyen, EV moyen, paris en cours
  - [ ] Canal Sécurité : taux de réussite, stake total engagé
  - [ ] Canal Confiance : hit rate, calibration error (Brier Score)
- [ ] Appliquer les badges de canal partout (Bet Slips, Bankroll transactions, Notifications)

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

La page `/dashboard/aide` actuelle est un fichier markdown brut (`aide-ligues.md`) rendu tel quel. Trop technique, trop dense, aucune entrée pédagogique pour un user qui débute.

Objectif : transformer ça en un vrai centre de formation avec articles, vidéos, progression et niveaux de difficulté. Remplacer la route `/dashboard/aide` ou la faire coexister.

---

### Structure de contenu proposée

**5 catégories :**
| Catégorie | Contenu |
|---|---|
| **Les bases** | Qu'est-ce que l'EV, les cotes, la probabilité, la value |
| **Les 3 canaux EVCore** | Comment lire un pick EV / Sécurité / Confiance, différences, cas d'usage |
| **Bankroll & discipline** | Gestion en unités, drawdown normal, psychologie long terme |
| **Guide par ligue** | Contenu actuel `aide-ligues.md` restructuré par ligue |
| **Comment utiliser l'app** | Walkthrough des pages : fixtures, coupons, bankroll, diagnostic |

---

### Tâches

**Infrastructure contenu :**
- [ ] Définir le format des fichiers de contenu : MDX avec frontmatter (`title`, `category`, `difficulty: beginner|intermediate|advanced`, `readTime`, `videoUrl?`, `thumbnail?`, `slug`)
- [ ] Créer la structure de dossiers : `content/formation/articles/` + `content/formation/videos/`
- [ ] Migrer le contenu de `aide-ligues.md` en articles individuels par ligue dans ce nouveau format
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
