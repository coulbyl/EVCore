# EVCore UI — Refonte Bento Design System

> **Objectif** : Appliquer le Bento design system (grille, tokens, responsivité) à toutes les pages.
> Design : épuré, hiérarchique, sans surcharge. Chaque pixel doit avoir une raison d'être.
>
> **Stack** : Tailwind v4 · shadcn new-york · CSS variables · `bento-grid` / `bento-cell-interactive`
>
> **Tokens** : toujours `bg-panel`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.
> Ne jamais utiliser de valeurs hex brutes ni `dark:` overrides manuels pour les couleurs de surfaces.

---

## Breakpoints de référence

| Nom | Largeur | Grille bento | Gap |
|---|---|---|---|
| Mobile | `< 640px` | 2 colonnes | 8px |
| Tablet | `640–1023px` | 6 colonnes | 10px |
| Desktop | `1024–1439px` | 12 colonnes | 12px |
| Wide | `1440–1919px` | 12 colonnes + marges auto | 12px |
| TV | `≥ 1920px` | 12 colonnes, `max-w-[1800px] mx-auto`, base `text-lg` | 16px |

---

## Statut global

- [ ] **0 — Fondations** (tokens + utilities)
- [ ] **1 — Layouts globaux**
- [ ] **2 — Auth flow**
- [ ] **3 — Dashboard home**
- [ ] **4 — Pages données** (picks, coupons, bet slips, summary)
- [ ] **5 — Pages analytics** (performance, audit, bankroll, investment)
- [ ] **6 — Pages contenu** (formation, glossaire, help, WC2026)
- [ ] **7 — Admin** (users, announcements)
- [ ] **8 — Paramètres** (account, security)
- [ ] **9 — Notifications**
- [ ] **10 — Composants partagés** (sidebar, header, modals, drawers)

---

## 0 — Fondations ✅ (déjà livré)

- [x] Tokens bento dans `theme.css` (`--gap-bento`, `--radius-bento`, `--shadow-bento-*`)
- [x] `@utility bento-grid` avec responsive intégré
- [x] `@utility bento-cell`, `bento-cell-interactive`, `bento-skeleton`, `bento-rows`
- [x] Dark mode via `html.dark` — aucun override manuel nécessaire
- [x] `bento-skill.md` mis à jour avec tokens EVCore

---

## 1 — Layouts globaux

### `app/layout.tsx` (root)
- [ ] Font Inter chargée via `next/font` — `font-sans` sur `<body>`
- [ ] JetBrains Mono chargée — `font-mono` disponible globalement
- [ ] `<body>` : background via token `--background`, pas de styles inline
- [ ] TV : pas de scaling automatique non maîtrisé

### `app/(public)/layout.tsx`
- [ ] Centrage vertical + horizontal du contenu auth
- [ ] Background utilisant les tokens (`--background`)
- [ ] Responsive : plein écran mobile, carte centrée tablet+

### `app/dashboard/layout.tsx`
- [ ] Sidebar : masquée sur mobile (drawer), visible tablet+, fixe desktop
- [ ] Header mobile : hamburger + titre de page courant
- [ ] Contenu principal : `overflow-y-auto` mobile, scroll interne desktop
- [ ] TV : sidebar légèrement plus large (`w-72`), contenu `max-w-[1800px] mx-auto`
- [ ] Transitions sidebar open/close : `150ms ease-out`

---

## 2 — Auth flow

### Landing `(public)/page.tsx`
- [ ] Grille bento 2 cellules : hero (texte + CTA) + visuel produit
- [ ] Mobile : cellules empilées, hero full-width
- [ ] Tokens : `bg-panel-strong`, `text-foreground`, `text-muted-foreground`
- [ ] CTA : bouton `bg-accent text-accent-foreground`

### `auth/components/auth-shell.tsx`
- [ ] Carte centrée avec `bento-cell`, padding `24px`
- [ ] Logo EVCore au-dessus de la carte
- [ ] Mobile : carte full-width, pas de border-radius aux bords (< 380px)

### `auth/login/page.tsx` + `login-form.tsx`
- [ ] Inputs : `--input` background, `--ring` focus
- [ ] Label au-dessus de chaque input (jamais placeholder seul comme label)
- [ ] Bouton submit : `w-full`, `bg-accent`
- [ ] Lien "Mot de passe oublié" : `text-muted-foreground text-sm`
- [ ] État loading : spinner dans le bouton, inputs `disabled`
- [ ] État erreur : message sous le champ avec `text-danger` + icône `AlertCircle`

### `auth/register/page.tsx` + `register-form.tsx`
- [ ] Même shell que login
- [ ] Validation inline : feedback immédiat après `blur`

### `auth/forgot-password/page.tsx` + `forgot-password-form.tsx`
- [ ] Étape 1 : email input + bouton
- [ ] Étape 2 (confirmation) : message de succès avec icône `MailCheck`
- [ ] Retour vers login : lien `text-sm text-muted-foreground`

### `auth/forgot-password/totp/page.tsx` + form
- [ ] Input TOTP : 6 chiffres, `font-mono text-2xl text-center`
- [ ] Erreur : bordure `danger` + message

### `auth/reset-password/page.tsx` + form
- [ ] Indicateur de force du mot de passe (barre : `danger` → `warning` → `success`)
- [ ] Confirmation password : validation de correspondance en temps réel

### `auth/verify/page.tsx` + flows (email, totp-setup, choice)
- [ ] Étapes claires avec indicateur de progression
- [ ] QR code TOTP : centré, `200×200px`, fond blanc forcé même en dark
- [ ] Codes backup : style `font-mono bg-panel p-3 rounded-md`

---

## 3 — Dashboard home

### `dashboard/page.tsx`
- [ ] Grille bento principale : `bento-grid bento-rows`
- [ ] Layout desktop recommandé :
  ```
  [KPI EV 2×1] [KPI SV 2×1] [KPI Conf 1×1] [KPI BTTS 1×1] [KPI Nul 1×1]
  [Weekly Brief 4×2]         [Pipeline Status 2×1] [Active Alerts 2×1]
  [Channel Perf Table 6×2]   [Competition Ranking 3×1] [Predictions 3×1]
  ```
- [ ] Mobile : toutes cellules `col-span-2` (full-width), ordre par importance

### `components/kpi-cards.tsx` + `dashboard-kpi-card.tsx`
- [ ] Variante par canal : bord gauche `4px solid var(--canal-*)`
- [ ] Nombre principal : `text-2xl font-bold tabular-nums`
- [ ] Delta : `kpi-delta.tsx` avec ▲/▼ + token `success`/`danger`
- [ ] `bento-cell-interactive` si cliquable vers la page canal

### `components/weekly-brief.tsx`
- [ ] Cellule `2×2` minimum
- [ ] Header : date de la semaine + badge statut
- [ ] Body : liste des events avec icônes

### `components/pipeline-status.tsx`
- [ ] Indicateurs de statut : `success`/`warning`/`danger`
- [ ] Toujours icône + label — jamais texte seul pour le statut

### `components/active-alerts.tsx`
- [ ] Cellule scrollable si > 3 alertes
- [ ] Badge par sévérité : `danger` > `warning` > info
- [ ] Empty state : icône `BellOff` + "Aucune alerte active"

### `components/canal-cards.tsx`
- [ ] Une cellule par canal avec couleur identitaire `--canal-*`
- [ ] Fond subtil `--canal-*-soft`
- [ ] Responsive : 2 cols mobile, 3 cols tablet, 5 cols desktop

### `components/channel-performance-table.tsx`
- [ ] Table → cards sur mobile (TanStack Table avec fallback responsive)
- [ ] En-têtes sticky sur desktop
- [ ] Alternance de lignes : `bg-panel` / `bg-panel-strong`

### `components/competition-ranking.tsx` + `user-leaderboard.tsx`
- [ ] Liste ordonnée avec rang numéroté
- [ ] Avatar `32px` + nom + métrique
- [ ] Item #1 : accent visuel subtil (`bg-accent-soft`)

### `components/predictions-card.tsx` + `performance-card.tsx`
- [ ] Sparkline ou mini-chart si données disponibles
- [ ] Fallback texte si pas de données

---

## 4 — Pages données

### `picks/page.tsx` + `picks-page-client.tsx`
- [ ] Filtres sticky en haut : canal, ligue, date
- [ ] Grille de picks : `bento-grid` avec `pick-card.tsx` en `2×1` ou `3×1`
- [ ] `pick-card.tsx` : bord gauche canal, odds en `font-mono`, badge EV
- [ ] Mobile : 1 pick par ligne (full-width)
- [ ] Empty state : "Aucun pick pour cette sélection"

### `coupons/page.tsx` + `coupons-page-client.tsx`
- [ ] Vue liste desktop / vue cards mobile
- [ ] Status badge : `success` (gagné), `danger` (perdu), `warning` (en cours)
- [ ] Détail coupon : drawer mobile, panel latéral desktop
- [ ] Filtres : date range + status

### `bet-slips/page.tsx` + `bet-slip-list-page-client.tsx`
- [ ] Liste avec `bento-cell` par slip
- [ ] `bet-slip-detail-panel.tsx` : panel droite desktop, drawer bottom mobile
- [ ] Statut : badge coloré + timestamp
- [ ] Actions : visibles sur hover desktop, bouton dédié mobile

### `summary/page.tsx` + `summary-page-client.tsx`
- [ ] Bento résumé : KPI haut, graphiques milieu, tableau bas
- [ ] Sélecteur de période : tabs (7j / 30j / 90j / tout)
- [ ] Export : bouton discret `text-muted-foreground` en haut à droite

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
- [ ] Badge count sur items (notifications, picks du jour)
- [ ] Bas : avatar utilisateur + lien settings

### Header mobile
- [ ] Titre page courant centré
- [ ] Icône hamburger gauche → sidebar drawer
- [ ] Icône notifications droite avec badge

### Modals / Dialogs
- [ ] Visuellement `bento-cell` (même radius, même ombre)
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
- [ ] Toujours : icône Lucide 48px (`text-muted-foreground`) + message + action optionnelle
- [ ] Jamais de texte `"N/A"` ou `"-"` seul

### Loading states (global)
- [ ] `bento-skeleton` sur chaque cellule en attente
- [ ] Durée minimum 300ms (évite le flash)
- [ ] Pas de spinner pleine page sauf navigation initiale

### Erreurs (global)
- [ ] Inline dans la cellule : bordure `danger`, message + retry
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
