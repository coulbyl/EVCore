# EVCore UI — Refonte Bento Design System

> **Objectif** : Appliquer le Bento design system (grille, tokens, responsivité) à toutes les pages.
> Design : épuré, hiérarchique, sans surcharge. Chaque pixel doit avoir une raison d'être.
>
> **Stack** : Tailwind v4 · shadcn new-york · CSS variables · `bento-grid` / `bento-cell-interactive`
>
> **Tokens** : toujours `bg-panel`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.
> Ne jamais utiliser de valeurs hex brutes ni `dark:` overrides manuels pour les couleurs de surfaces.
>
> **Règle `useIsMobile`** : à chaque page ou composant touché, supprimer tout `useIsMobile` utilisé pour switcher des classes.
> Remplacer par des classes Tailwind responsive (`sm:`, `md:`, `lg:`).
> Pour le texte conditionnel : `<span className="sm:hidden">court</span><span className="hidden sm:inline">long</span>`.
> Pour les grilles : `grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]`.
> `useIsMobile` reste acceptable uniquement pour la logique comportementale (ex. ouvrir un Drawer vs Sheet).

---

## Breakpoints de référence

| Nom     | Largeur       | Grille bento                                          | Gap  |
| ------- | ------------- | ----------------------------------------------------- | ---- |
| Mobile  | `< 640px`     | 2 colonnes                                            | 8px  |
| Tablet  | `640–1023px`  | 6 colonnes                                            | 10px |
| Desktop | `1024–1439px` | 12 colonnes                                           | 12px |
| Wide    | `1440–1919px` | 12 colonnes + marges auto                             | 12px |
| TV      | `≥ 1920px`    | 12 colonnes, `max-w-[1800px] mx-auto`, base `text-lg` | 16px |

---

## Statut global

- [x] **0 — Fondations** (tokens + utilities)
- [x] **1 — Layouts globaux**
- [x] **2 — Auth flow**
- [x] **3 — Dashboard home** _(bento-grid wired operator + admin, CSS-first migration complète)_
- [x] **4 — Pages données** _(breakpoints xl: → lg:, useIsMobile CSS supprimé)_
- [x] **5 — Pages analytics** _(breakpoints xl: → lg:, useIsMobile CSS supprimé)_
- [x] **6 — Pages contenu** (formation, glossaire, help, WC2026)
- [x] **7 — Admin** (users, announcements)
- [x] **8 — Paramètres** (account tabs — Profil · Apparence · Langue · Sécurité · Notifications · Bankroll · Badges)
- [x] **9 — Notifications**
- [ ] **10 — Composants partagés** (header, modals, drawers, page.tsx in /ui, filterBar) — _en cours_
- [x] **Light mode** — tokens sidebar `:root`, body gradient, ev-grid-glow, WC2026 banner, landing next-themes

---

## 0 — Fondations ✅ (déjà livré)

- [x] Tokens bento dans `theme.css` (`--gap-bento`, `--radius-bento`, `--shadow-bento-*`)
- [x] `@utility bento-grid` avec responsive intégré
- [x] `@utility bento-cell`, `bento-cell-interactive`, `bento-skeleton`, `bento-rows`
- [x] Dark mode via `html.dark` — aucun override manuel nécessaire
- [x] `bento-skill.md` mis à jour avec tokens EVCore

---

## 1 — Layouts globaux ✅

### `app/layout.tsx` (root)

- [x] Fonts Geist Sans + Mono chargées via `next/font/local`
- [x] `font-sans antialiased` sur `<body>`
- [x] `font-sans` / `font-mono` enregistrés dans `@theme inline` via `globals.css`
- [x] `@utility bento-*` disponibles globalement via `@import '@evcore/ui/globals.css'`

### `app/(public)/layout.tsx`

- [x] `h-dvh overflow-y-auto scrollbar-dark` — scroll naturel, pas de débordement

### `app/dashboard/layout.tsx` + `page-shell.tsx`

- [x] Sidebar : drawer mobile (offcanvas), fixe desktop via `SidebarProvider`
- [x] Header : sticky, `bg-panel-strong/90 backdrop-blur`, tokens corrects
- [x] Nav mobile : bottom bar fixe avec tokens `bg-panel-strong`
- [x] TV : `2xl:max-w-[1800px] 2xl:mx-auto` sur le wrapper du contenu principal
- [x] `SidebarTrigger` visible jusqu'à `lg:` (corrige tablettes Samsung/Surface) + style panel
- [x] Icônes sidebar (desktop + mobile bottom bar) : `text-accent`
- [x] `use-mobile.ts` (ui) : `MOBILE_BREAKPOINT` = 1024px pour Sheet vs inline sidebar correct

### `components/account-button.tsx`

- [x] Icônes menu compte : `text-accent`
- [x] Hover items : `focus:bg-accent/8 focus:text-foreground` (aligné sidebar)

---

## 2 — Auth flow ✅

### Landing `(public)/page.tsx` ✅

- [x] Hero split : texte + CTA gauche, `HeroPreview` (mock dashboard) droite à `lg:`
- [x] Mobile : hero full-width empilé, preview masqué
- [x] Données réelles backtest : SV 74.3%, CONF 60.7%, BB 64.0%, 5 578 picks / 105 saisons
- [x] Header fixed unifié : strip WC2026 + nav dans un `<header>` avec `bg-background` (pas de saignement)
- [x] Canaux bento : 3 cards avec métriques réelles, glow par canal
- [x] Features grid asymétrique : `lg:col-span-7` / `lg:col-span-5`
- [x] Steps : `sm:grid-cols-3` avec ligne connecteur
- [x] CTA : shadow glow `rgba(15,118,110,0.35)` sur bouton primaire

### `auth/components/auth-shell.tsx` ✅

- [x] Layout `md:grid-cols-2` — aside visible à `md:`, form respirant
- [x] Aside : features avec icônes dans `size-8 bg-accent/10 rounded-lg`
- [x] Mobile : form plein écran sans carte, pas de border-radius aux bords

### `auth/login/page.tsx` + `login-form.tsx` ✅

- [x] Inputs `h-11`, labels au-dessus, erreur `bg-destructive/8 border-destructive/20`
- [x] Bouton submit `h-11 w-full`, état loading géré

### `auth/register/page.tsx` + `register-form.tsx` ✅

- [x] 2-col grid `sm:grid-cols-2` pour email+username, fullName+password
- [x] Validation inline `mode: "onTouched"`

### `auth/forgot-password/page.tsx` + `forgot-password-form.tsx` ✅

- [x] Succès : card `bg-success/8 border-success/25` avec `MailCheck`
- [x] Retour login en lien `text-accent`

### `auth/forgot-password/totp/page.tsx` + form ✅

- [x] Passwords empilés (pas de 2-col dans le panel étroit)
- [x] Erreur bordure + message

### `auth/reset-password/page.tsx` + form ✅

- [x] Passwords empilés, validation correspondance en temps réel

### `auth/verify/page.tsx` + flows (email, totp-setup, choice) ✅

- [x] `verify-choice-form.tsx` : boutons bento avec icône `size-8 bg-accent/10`
- [x] `email-verify-flow.tsx` : input `h-12 tracking-[0.5em]`
- [x] `totp-setup-flow.tsx` : QR code `bg-white p-3 rounded-xl border` (fond blanc forcé dark)

---

## 3 — Dashboard home ✅

### `dashboard/page.tsx` (operator + admin clients) ✅

- [x] Grille `bento-grid` câblée dans `dashboard-page-client-operator.tsx` et `dashboard-page-client-admin.tsx`
- [x] Layout desktop : `col-span-7` OperatorPerformanceCard + `col-span-5` PredictionsCard, `col-span-12` CanalCards, `col-span-6` CompetitionRanking + `col-span-6` UserLeaderboard
- [x] Mobile : toutes cellules `col-span-2` (full-width)
- [x] `dashboard-shared-section.tsx` : supprimé — hooks et composants déplacés dans les clients directs
- [x] WeeklyBrief placé au-dessus du bento-grid (gère la condition lundi en interne)

### `components/kpi-cards.tsx` + `dashboard-kpi-card.tsx` ✅

- [x] CSS grid responsive : `grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]`
- [x] `dashboard-kpi-card.tsx` : prop `compact` supprimée, toujours responsive
- [x] `kpi-delta.tsx` : ▲/▼ avec `text-success`/`text-destructive`, `sm:` classes
- [x] `stat-card.tsx` (ui) : `compact=false` responsive via `sm:`, `compact=true` toujours compact
- [ ] Variante par canal : bord gauche `4px solid var(--canal-*)` ← à faire (Bloc 10)
- [ ] `bento-cell-interactive` si cliquable vers la page canal ← à faire (Bloc 10)

### `components/canal-cards.tsx` ✅

- [x] Bord gauche accent : `border-l-[3px]` avec `borderLeftColor: s.color`
- [x] Fond subtil `--canal-*-soft` via `style={{ background: s.soft }}`
- [x] Responsive : `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (breakpoint `lg:` aligné bento)

### `components/predictions-card.tsx` + `operator-performance-card.tsx` ✅

- [x] `performance-card.tsx` : migration CSS-first (suppression `useIsMobile`, `sm:` classes)
- [x] `operator-performance-card.tsx` : texte conditionnel `sm:hidden`/`hidden sm:inline`
- [x] PredictionsCard + ChannelPerformanceTable : placés dans bento-grid (operator + admin)
- [ ] Sparkline ou mini-chart si données disponibles ← à faire (Bloc 10)

### `components/pipeline-status.tsx` + `active-alerts.tsx`

- [ ] pipeline-status : indicateurs `success`/`warning`/`danger` ← à faire (Bloc 10)
- [ ] active-alerts : cellule scrollable, badge sévérité, empty state ← à faire (Bloc 10)

### `components/competition-ranking.tsx` + `user-leaderboard.tsx` ✅

- [x] Placés dans bento-grid `col-span-6` chacun (operator + admin)
- [ ] Avatar `32px` + rang numéroté + accent item #1 ← design enhancement (Bloc 10)

---

## 4 — Pages données ✅ _(breakpoints xl: → lg:, useIsMobile CSS supprimé)_

### `picks/page.tsx` + `picks-page-client.tsx` ✅

- [x] `useIsMobile` : uniquement comportemental (drawer vs panel) — aucun switch CSS → pas de changement nécessaire
- [ ] Filtres sticky en haut : canal, ligue, date ← design enhancement
- [ ] `pick-card.tsx` : bord gauche canal, odds `font-mono`, badge EV ← design enhancement

### `coupons/page.tsx` + `coupons-page-client.tsx` ✅

- [x] `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (was `xl:grid-cols-3`)
- [ ] Détail coupon drawer / panel latéral ← design enhancement

### `bet-slips/page.tsx` + `bet-slip-list-page-client.tsx` ✅

- [x] Split panel desktop : `lg:grid lg:grid-cols-[3fr_2fr] lg:gap-5` (was `xl:`)
- [x] `lg:hidden` sur la vue mobile empilée (was `xl:hidden`)
- [x] Cards grid : `sm:grid-cols-2 lg:grid-cols-1` (was `xl:grid-cols-1`)
- [x] `bet-slip-detail-panel.tsx` : panel droite desktop, drawer bottom mobile — déjà en place

### `summary/page.tsx` + `summary-page-client.tsx` ✅

- [x] `compact={isMobile}` supprimé sur les 4 StatCards — responsive CSS-first via `sm:`
- [x] `useIsMobile` conservé pour `SimulationDrawer` direction (comportemental)
- [ ] Export + sélecteur de période tabs ← design enhancement

---

## 5 — Pages analytics

### `performance/page.tsx`

- [ ] Sections : Overview · Backtest · Calibration · Weights · Competition
- [ ] Navigation par ancre (scroll-spy) desktop, tabs mobile
- [ ] Chaque section : `bento-cell` avec header + contenu

### `performance/components/overview-section.tsx`

- [ ] KPIs : ROI global, win rate, EV moyen — cellules `1×1`
- [ ] Graphique ROI dans le temps : cellule `4×2`

### `performance/components/backtest-section.tsx`

- [ ] Tableau de résultats + filtre par canal
- [ ] Ligne totaux en bas, sticky si > 10 lignes

### `performance/components/calibration-section.tsx`

- [ ] Graphique calibration : probabilité prédite vs réelle
- [ ] Indicateur de drift : `warning` si > seuil

### `performance/components/weights-timeline-section.tsx`

- [ ] Timeline horizontale des ajustements
- [ ] Tooltip sur chaque point avec détail

### `audit/page.tsx`

- [ ] Grille bento : compteurs haut, détails bas
- [ ] `count-card.tsx` : cellule `1×1` avec grand chiffre
- [ ] `bets-breakdown.tsx` : donut ou bar chart par canal
- [ ] `league-breakdown.tsx` : table triable

### `bankroll/page.tsx` + `bankroll-page-client.tsx`

- [ ] Solde actuel : cellule hero `3×1`
- [ ] Historique dépôts/retraits : liste chronologique
- [ ] `deposit-dialog.tsx` : input montant avec validation
- [ ] Graphique évolution bankroll : `4×2`

### `investment/page.tsx` + `investment-page-client.tsx`

- [ ] Vue portefeuille : allocation par canal (graphique)
- [ ] Tableau des positions
- [ ] Mobile : graphique full-width, tableau scrollable horizontalement

---

## 6 — Pages contenu

### `formation/page.tsx` + `formation-page-client.tsx`

- [ ] Grille de catégories : `bento-cell-interactive` par catégorie
- [ ] Progression globale : barre de progression dans le header
- [ ] Récemment consultés : rangée horizontale scrollable

### `formation/[category]/page.tsx` + `formation-category-shell.tsx`

- [ ] Breadcrumb en haut
- [ ] `formation-chapters.tsx` : liste ordonnée avec état de complétion
- [ ] Complété : icône `CheckCircle` en `success`

### `formation/[category]/[slug]/page.tsx`

- [ ] Layout lecture : contenu centré `max-w-3xl`, sidebar progrès desktop
- [ ] `formation-video-player.tsx` : ratio 16/9 fixe, responsive
- [ ] Navigation précédent / suivant en bas

### `glossaire/page.tsx`

- [ ] Index alphabétique sticky gauche desktop, select mobile
- [ ] Cards de termes : `bento-cell` avec terme `text-lg font-semibold` + définition
- [ ] Recherche inline en haut

### `help/page.tsx`

- [ ] Accordéon par catégorie de question
- [ ] Recherche plein-texte en haut
- [ ] Contact support : CTA en bas

### `wc2026/page.tsx`

- [ ] Grille bento de groupes / matchs
- [ ] Cellule par match : équipes + cote + canal recommandé
- [ ] Filtre par phase (groupes, huitièmes…)

---

## 7 — Admin

### `users/page.tsx` + `users-page-client.tsx`

- [ ] Table TanStack : tri, filtres, pagination
- [ ] Mobile : cards au lieu de lignes
- [ ] Actions par ligne : menu `...` (éditer, suspendre, supprimer)
- [ ] Recherche + filtre rôle en haut

### `announcements/page.tsx` + `announcements-admin-page-client.tsx`

- [ ] Liste d'annonces avec statut (publiée / brouillon / archivée)
- [ ] Drawer d'édition : titre, contenu, type, audience, date publication
- [ ] Mobile : drawer bottom fullscreen

---

## 8 — Paramètres

### `params/account/page.tsx`

- [ ] Layout 2 colonnes : nav sections gauche, contenu droite (desktop)
- [ ] Mobile : sections empilées
- [ ] `profile-hero-section.tsx` : avatar, nom, rôle — en haut

### `params/account/components/avatar-section.tsx`

- [ ] Upload : drag & drop + bouton
- [ ] Preview : `64px` rond, token `--border`

### `params/account/components/appearance-section.tsx`

- [ ] Toggle light / dark / système
- [ ] Preview mini du thème sélectionné

### `params/account/components/security-section.tsx`

- [ ] Résumé état : MFA activé/désactivé, date dernière connexion
- [ ] Lien vers `/dashboard/params/account/security`

### `params/account/security/page.tsx` + `security-setup-form.tsx`

- [ ] Étapes : état actuel → configuration → validation
- [ ] QR code : fond blanc forcé même en dark
- [ ] Codes backup : grille 2×5, style `font-mono`

### Sections restantes account

- [ ] `language-section.tsx` : select langue + preview format date
- [ ] `notifications-section.tsx` : toggles par type
- [ ] `bankroll-preferences-section.tsx` : mise par défaut, unité
- [ ] `badges-section.tsx` : grille de badges obtenus/à débloquer

---

## 9 — Notifications

### `notifications/page.tsx` + `notifications-page-client.tsx`

- [ ] Liste : icône type + message + timestamp relatif
- [ ] Non-lues en haut, badge count dans le header
- [ ] Marquer tout comme lu : bouton discret haut-droite
- [ ] Groupement par jour
- [ ] Empty state : icône `BellOff` + "Tout est à jour"
- [ ] Mobile : items tap-friendly (`min-h-[56px]`)

---

## 10 — Composants partagés

### Sidebar

- [ ] Items nav : icône + label, actif = `bg-accent-soft text-accent`
- [x] Badge count sur items (notifications) — `app-shell.tsx` + `page-shell.tsx`
- [ ] Bas : avatar utilisateur + lien settings

### Header mobile

- [x] Titre page courant centré — prop `pageTitle` dans `page-shell.tsx` + `app-shell.tsx`
- [ ] Icône hamburger gauche → sidebar drawer
- [ ] Icône notifications droite avec badge

### Modals / Dialogs

- [x] Visuellement `bento-cell` — `settle-fixture-dialog.tsx` + `deposit-dialog.tsx`
- [ ] Header : titre + bouton fermer
- [ ] Footer : actions primaires à droite

### Drawers

- [ ] Mobile : bottom drawer (90vh max)
- [ ] Desktop : side drawer (440px fixe)
- [ ] Overlay : `bg-black/40 backdrop-blur-sm`

### Tables TanStack

- [ ] En-tête sticky
- [ ] Tri : icône ↑↓ dans les colonnes
- [ ] Pagination : `< 1 2 3 >` avec info "X sur Y résultats"
- [ ] Fallback mobile : cards

### Empty states (global)

- [x] Icône Lucide + message — `competition-ranking`, `user-leaderboard`, `predictions-card`
- [ ] Couvrir toutes les autres cellules bento (picks, coupons, audit…)
- [ ] Jamais de texte `"N/A"` ou `"-"` seul

### Loading states (global)

- [x] `bento-skeleton` — `competition-ranking`, `user-leaderboard`, skeletons dans operator client
- [ ] Couvrir toutes les autres cellules bento
- [ ] Durée minimum 300ms (évite le flash)
- [ ] Pas de spinner pleine page sauf navigation initiale

### Erreurs (global)

- [x] Inline `danger` + retry — `competition-ranking`, `user-leaderboard`
- [ ] Couvrir toutes les autres cellules bento
- [ ] Pas de toast seul pour les erreurs critiques

---

## Règles transverses — checklist avant chaque merge

- [ ] Aucune valeur hex brute dans un `.tsx` ou `.css`
- [ ] Aucun `dark:` prefix — tout passe par les tokens CSS
- [ ] Textes tronqués : `title` ou `Tooltip` présent
- [ ] Éléments interactifs : état `focus-visible` défini
- [ ] Images : `alt` approprié sur toutes
- [ ] Chaque page : empty state ET loading state définis
- [ ] `prefers-reduced-motion` testé : aucune animation ne bloque l'usage
- [ ] Testé sur : **375px** (iPhone SE) · **768px** (iPad) · **1280px** (laptop) · **1920px** (TV)
