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
- [~] **10 — Composants partagés** (header, modals, drawers, page.tsx in /ui, filterBar) — _en cours_
- [x] **Light mode** — tokens sidebar `:root`, body gradient, ev-grid-glow, WC2026 banner, landing next-themes

---

## 0 — Fondations ✅ (déjà livré)

- [x] Tokens bento dans `theme.css` (`--gap-bento`, `--radius-bento`, `--shadow-bento-*`)
- [x] `@utility bento-grid` avec responsive intégré
- [x] `@utility bento-cell`, `bento-cell-interactive`, `bento-skeleton`, `bento-rows`
- [x] Dark mode via `html.dark` — aucun override manuel nécessaire

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
- [x] Variante par canal : bord gauche `4px solid var(--canal-*)` — implémenté dans `canal-cards.tsx`
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

- [x] pipeline-status : indicateurs `success`/`warning`/`danger`
- [x] active-alerts : cellule scrollable, badge sévérité, empty state

### `components/competition-ranking.tsx` + `user-leaderboard.tsx` ✅

- [x] Placés dans bento-grid `col-span-6` chacun (operator + admin)
- [x] Avatar `32px` + rang numéroté + accent item #1

---

## 4 — Pages données ✅ _(breakpoints xl: → lg:, useIsMobile CSS supprimé)_

### `picks/page.tsx` + `picks-page-client.tsx` ✅

- [x] `useIsMobile` : uniquement comportemental (drawer vs panel) — aucun switch CSS → pas de changement nécessaire
- [ ] Filtres sticky en haut : canal, ligue, date ← design enhancement
- [x] `pick-card.tsx` : bord gauche canal, odds `font-mono`, badge EV — déjà implémenté

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

- [~] Sections : Overview · Backtest · Calibration · Weights · Competition (partiellement implémentées)
- [~] Navigation par ancre (scroll-spy) desktop, tabs mobile (tabs présents, scroll-spy absent)

### `performance/components/overview-section.tsx`

- [~] KPIs : ROI global, win rate, EV moyen — cellules présentes, pas de graphique ROI dans le temps
- [ ] Graphique ROI dans le temps : cellule `4×2` — nécessite endpoint backend `/performance/roi-history`

### `performance/components/backtest-section.tsx`

- [x] Tableau de résultats + filtre par canal
- [ ] Ligne totaux en bas, sticky si > 10 lignes

### `performance/components/calibration-section.tsx`

- [~] Graphique calibration : composant présent, contenu à vérifier
- [x] Indicateur de drift : `warning` sur dégradation du Brier Score

### `performance/components/weights-timeline-section.tsx`

- [x] Timeline horizontale des ajustements (fichier implémenté)

### `audit/page.tsx`

- [x] Grille bento : compteurs haut, détails bas
- [x] `count-card.tsx` : cellule `1×1` avec grand chiffre
- [x] `bets-breakdown.tsx` : donut ou bar chart par canal
- [x] `league-breakdown.tsx` : table triable (DataTable présent)

### `bankroll/page.tsx` + `bankroll-page-client.tsx`

- [~] Solde actuel : cellule hero `3×1` (StatCard présent, pas de cellule `3×1` explicite)
- [x] Historique dépôts/retraits : liste chronologique (DataTable avec transactions filtrées)
- [x] `deposit-dialog.tsx` : input montant avec validation
- [x] Graphique évolution bankroll : `4×2` (EvAreaChart avec projection)

### `investment/page.tsx` + `investment-page-client.tsx`

- [x] Empty/loading/error states : couverture cohérente sur la page

---

## 6 — Pages contenu

### `formation/page.tsx` + `formation-page-client.tsx`

- [x] Grille de catégories : `bento-cell-interactive` par catégorie
- [x] Progression globale : barre de progression dans le header
- [x] Récemment consultés : rangée horizontale scrollable

### `formation/[category]/page.tsx` + `formation-category-shell.tsx`

- [ ] `formation-chapters.tsx` : liste ordonnée avec état de complétion
- [ ] Complété : icône `CheckCircle` en `success`

### `formation/[category]/[slug]/page.tsx`

- [x] Breadcrumb en haut (`Formation / [Catégorie] / [Titre]`)
- [ ] Layout lecture : contenu centré `max-w-3xl`, sidebar progrès desktop
- [x] `formation-video-player.tsx` : ratio 16/9 fixe, responsive (`aspect-video`)
- [x] Navigation précédent / suivant en bas (déjà implémenté)

### `glossaire/page.tsx`

- [x] Index alphabétique sticky gauche desktop + select mobile (`GlossaireMobileSelect`)
- [ ] Cards de termes : `bento-cell` avec terme `text-lg font-semibold` + définition
- [x] Recherche inline en haut

### `help/page.tsx`

- [ ] Accordéon par catégorie de question
- [x] Recherche plein-texte en haut
- [x] Contact support : CTA en bas

### `wc2026/page.tsx`

- [x] Grille bento de groupes / matchs
- [ ] Cellule par match : équipes + cote + canal recommandé — nécessite fixtures WC live + odds
- [ ] Filtre par phase (groupes, huitièmes…) — activable quand les KO débutent (5 juillet 2026)

---

## 7 — Admin

### `users/page.tsx` + `users-page-client.tsx`

- [x] Table TanStack : tri, filtres, pagination
- [x] Mobile : cards au lieu de lignes (`mobileCard` prop)
- [~] Actions par ligne : menu `...` (role change + reset présents, edit/delete absents)
- [x] Recherche + filtre rôle en haut

### `announcements/page.tsx` + `announcements-admin-page-client.tsx`

- [x] Liste d'annonces avec statut (publiée / brouillon)
- [x] Drawer d'édition : titre, contenu, lien, expiration
- [x] Mobile : drawer bottom fullscreen

---

## 8 — Paramètres

### `params/account/page.tsx`

- [x] Layout 2 colonnes : nav sections gauche, contenu droite (desktop)
- [x] `profile-hero-section.tsx` : avatar, nom, rôle — en haut

### `params/account/components/avatar-section.tsx`

- [x] Upload : bouton présent
- [x] Preview : avatar `80px` rond, token `--border`

### `params/account/components/appearance-section.tsx`

- [x] Toggle light / dark / système (RadioGroup avec 3 options)

### `params/account/components/security-section.tsx`

- [x] Résumé état : MFA activé/désactivé
- [x] Lien vers `/dashboard/params/account/security`

### `params/account/security/page.tsx` + `security-setup-form.tsx`

- [ ] Étapes : état actuel → configuration → validation
- [x] QR code : fond blanc forcé même en dark (`bg-white p-3` dans `totp-setup-flow.tsx`)
- [ ] Codes backup : grille 2×5, style `font-mono` — nécessite endpoint backend

### Sections restantes account

- [x] `language-section.tsx` : select langue + preview format date
- [x] `notifications-section.tsx` : toggles par type
- [x] `bankroll-preferences-section.tsx` : mise par défaut, unité
- [x] `badges-section.tsx` : grille de badges obtenus/à débloquer

---

## 9 — Notifications ✅

### `notifications/page.tsx` + `notifications-page-client.tsx`

- [x] Liste : icône type + message + timestamp relatif
- [x] Non-lues en haut, badge count dans le header
- [x] Marquer tout comme lu : bouton discret haut-droite
- [x] Groupement par jour
- [x] Empty state : icône `BellOff` + "Tout est à jour"
- [x] Mobile : items tap-friendly (`min-h-[56px]`)

---

## 10 — Composants partagés

### Sidebar

- [x] Items nav : icône + label, actif = `bg-accent-soft text-accent` (`--sidebar-accent` → `var(--accent-soft)`, `--sidebar-accent-foreground` → `var(--accent)`)
- [x] Badge count sur items (notifications) — `app-shell.tsx` + `page-shell.tsx`
- [x] Bas : avatar utilisateur + lien settings (`account-button.tsx`)

### Header mobile

- [x] Titre page courant centré — prop `pageTitle` dans `page-shell.tsx` + `app-shell.tsx`
- [x] Icône hamburger gauche → sidebar drawer (`SidebarTrigger`)
- [x] Icône notifications droite avec badge (`NotificationBell`)

### Modals / Dialogs

- [x] Visuellement `bento-cell` — `settle-fixture-dialog.tsx` + `deposit-dialog.tsx`
- [x] Header : titre + bouton fermer
- [x] Footer : actions primaires à droite

### Drawers

- [x] Mobile : bottom drawer (90vh max — `max-h-[92dvh]`)
- [x] Desktop : side drawer (440px fixe — `w-[440px]`)

### Tables TanStack

- [x] Pagination : `< 1 2 3 >` avec info "X sur Y résultats"
- [x] Fallback mobile : cards (`mobileCard` prop)

### Empty states (global)

- [x] Icône Lucide + message — `competition-ranking`, `user-leaderboard`, `predictions-card`, picks, coupons, bankroll
- [ ] Jamais de texte `"N/A"` ou `"-"` seul

### Loading states (global)

- [x] `bento-skeleton` — `competition-ranking`, `user-leaderboard`, skeletons dans operator client, investment
- [~] Couvrir toutes les autres cellules bento (picks et coupons utilisent spinner, pas bento-skeleton)
- [ ] Durée minimum 300ms (évite le flash)
- [ ] Pas de spinner pleine page sauf navigation initiale

### Erreurs (global)

- [x] Inline `danger` + retry — `competition-ranking`, `user-leaderboard`, bankroll, picks
- [x] Couvrir toutes les autres cellules bento (audit et investment)
- [ ] Pas de toast seul pour les erreurs critiques

### Page 404

- [x] `not-found.tsx` : layout centré, icône + message + lien retour dashboard
- [x] Cohérent avec les tokens bento (pas de page blanche générique Next.js)

---

## Règles transverses — checklist avant chaque merge

- [ ] Aucune valeur hex brute dans un `.tsx` ou `.css`
- [ ] Aucun `dark:` prefix — tout passe par les tokens CSS
- [ ] Chaque page : empty state ET loading state définis
- [ ] `prefers-reduced-motion` testé : aucune animation ne bloque l'usage
- [ ] Testé sur : **375px** (iPhone SE) · **768px** (iPad) · **1280px** (laptop) · **1920px** (TV)
