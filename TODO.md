# EVCore — TODO

## Règle migrations DB

- L'agent ne doit **pas** créer de migration Prisma
- Les migrations sont créées manuellement par l'utilisateur
- Pour travailler sans erreurs de types Prisma, l'agent peut utiliser uniquement `db:generate`

## UI IMPROVEMENT (WEB)

Amélioration UX/UI du dashboard web.
Remplacement des coupons par des fixtures individuelles.
Migration vers une architecture domain-based.

---

## Phase 1 — Fondations ✅

### `apps/web/lib/`

- [x] `date.ts` — `todayIso`, `formatTime`, `formatDate`, `formatDateLong`, `isoToDate` (date-fns)

### `apps/web/constants/`

- [x] `time-slots.ts` — 5 créneaux horaires (Matin / Midi / Après-midi / Soirée / Nuit)
- [x] `competitions.ts` — 22 compétitions statiques (source de vérité : packages/db/src/seed.ts)

### `apps/web/domains/fixture/`

- [x] `types/fixture.ts` — `FixtureRow`, `FixtureModelRun`, `FixtureFilters` + types filtres
- [x] `constants/filters.ts` — `DECISION_OPTIONS`, `STATUS_OPTIONS`
- [x] `helpers/fixture.ts` — `toFixturePanel`, `formatScore`, `formatKickoff`
- [x] `use-cases/get-fixtures.ts` — appelle `GET /fixture`, tout filtrage/tri délégué au backend

### `apps/backend/src/modules/fixture/` (ajouts)

- [x] `fixture-scoring.controller.ts` — `GET /fixture` avec 5 query params
- [x] `fixture-scoring.service.ts` — requête Prisma + filtres decision/timeSlot + tri fiabilité
- [x] `dto/fixture-scoring-query.dto.ts` — validation class-validator

### `apps/backend/src/modules/audit/` (mis à jour)

- [x] Filtres `decision`, `status`, `competition`, `timeSlot` ajoutés à `GET /audit/fixtures`
- [x] Tri par fiabilité (BET EV desc → NO_BET finalScore desc)

---

## Phase 2 — Page `/fixtures` ✅

- [x] `fixtures/page.tsx` — Server Component, lit searchParams, fetch, assemble
- [x] `fixtures/components/fixtures-header-client.tsx` — refresh via router.refresh()
- [x] `fixtures/components/fixtures-filters.tsx` — date, compétition, décision, statut, créneau (scroll horizontal mobile)
- [x] `fixtures/components/fixtures-table.tsx` — cards mobile + table desktop, drawer Vaul + side panel
- [x] `components/app-shell.tsx` — route `/fixtures` ajoutée dans la nav

---

## Phase 3 — Dashboard ✅

- [x] Retirer la section `RecentCouponsCard`
- [x] Ajouter un filtre date optionnel (simple `<input type="date">`) sur la section "Performance globale"
- [x] Backend : `getSummaryData` refactorisé en options object (max-params), `settledBets` filtré par `pnlDateRange`
- [x] `fetchDashboardSummary(pnlDate?)` — param `?pnlDate=` passé au backend
- [x] `useDashboardSummary(pnlDate?)` — clé de cache isolée par date

---

## Phase 4 — Refactor architecture (domain-based)

Migration de tout le code existant.

### Domaines à créer

```
domains/
  dashboard/
    types/        ✅ domains/dashboard/types/dashboard.ts
    use-cases/    ✅ domains/dashboard/use-cases/get-dashboard-summary.ts
    helpers/      ✅ domains/dashboard/helpers/*
  audit/          ✅
    types/        ✅ domains/audit/types/audit.ts
    use-cases/    ✅ domains/audit/use-cases/get-audit-overview.ts
  glossary/
    types/

shared/
  components/     ← depuis components/ (app-shell, app-page-header, table-card, etc.)
  hooks/          ← depuis hooks/use-mobile.ts
```

### Pages à décomposer

- [x] `audit/page.tsx` → `audit/components/` (audit-overview-section, league-breakdown, bets-breakdown, count-card)
- [x] `page.tsx` (dashboard) → extraire dans `(dashboard)/components/` (performance-card, kpi-cards, pipeline-status, active-alerts)

### Nettoyage types

- [x] Supprimer `AuditFixtureRow` de `types/audit.ts`
- [x] Supprimer `types/audit.ts` (migré dans `domains/audit/types/`)
- [x] Supprimer `types/dashboard.ts` une fois migré dans `domains/`

### Imports

- [x] Mettre à jour tous les imports après migration dashboard

---

## Phase 5 — Nettoyage

- [x] Supprimer `app/(dashboard)/coupons/`
- [x] Supprimer `app/(public)/coupons/`
- [x] Vider `app/(public)/` — garder le dossier, ajouter `page.tsx` placeholder (future landing)
- [x] Supprimer hooks orphelins : `use-coupons-by-period.ts`, `use-coupon-by-id.ts`
- [x] Supprimer `helpers/coupon.ts`
- [x] Supprimer composant coupon mort : `recent-coupons-card.tsx`
- [ ] Revoir `coupon-detail.tsx` avant suppression / découpage final

---

## Phase 6 — Panier de bets simples utilisateur

La notion de `coupon` disparaît d'EVCore.
À la place, on introduit un **panier de bets simples** construit manuellement par l'utilisateur depuis la page `fixtures`.

### Objectif produit

- L'utilisateur parcourt les fixtures scorées
- Il peut ajouter des bets proposés dans un panier
- Le panier contient uniquement des **bets simples** (pas de combiné)
- L'utilisateur définit une **mise unitaire** appliquée à chaque bet du panier
- L'utilisateur peut définir des **overrides de mise** par bet avant validation
- Exemple : 10 bets sélectionnés, mise unitaire = `4000`, donc `4000` sur chaque bet

### Domaine à créer

```
domains/
  bet-slip/
    types/
    use-cases/
    helpers/
```

### Modèle métier cible

- `Bet` reste l'unité métier centrale produite par le betting engine
- le **panier de préparation** sert de formulaire de création de slip
- tant que le panier n'est pas soumis, l'utilisateur peut le modifier librement
- le panier de préparation vit côté web en `localStorage`
- si le `localStorage` est perdu avant validation, le draft est perdu
- `BetSlip` devient l'objet final créé au submit
- un `BetSlip` créé est **immuable**
- un `BetSlip` contient uniquement des **bets simples**
- un utilisateur peut créer **plusieurs** `BetSlip`
- un `Bet` ne peut pas être dupliqué dans plusieurs slips du même utilisateur

### Brouillon vs objet final

- [ ] Définir le modèle de panier de préparation (`draft`) côté produit
- [x] Le draft n'est pas persisté côté backend : `localStorage` uniquement
- [ ] Transformer le draft en `BetSlip` immuable au submit
- [ ] Geler la composition et les mises après création du `BetSlip`

### Types à prévoir

- [ ] `BetSlipItem`
- [ ] `BetSlip`
- [ ] `BetSlipStake`

### Use-cases à prévoir

- [ ] `add-pick-to-slip`
- [ ] `remove-pick-from-slip`
- [ ] `update-slip-stake`
- [ ] `clear-slip`

### UI à prévoir

- [ ] Ajouter une action "ajouter au panier" depuis `fixtures`
- [ ] Ajouter un panneau / drawer `bet-slip`
- [ ] Afficher la liste des bets sélectionnés
- [ ] Permettre la définition d'une mise unitaire
- [ ] Permettre les overrides de mise par bet avant validation
- [ ] Afficher le total de bets sélectionnés
- [ ] Ajouter une page `mes bet-slips`
- [ ] Ajouter une page détail `bet-slips/[id]`
- [ ] Ajouter l'accès aux bet-slips dans la navigation
- [ ] Permettre la gestion de plusieurs slips utilisateur
- [ ] Ajouter une action de validation / création du `BetSlip` depuis le panier

### Refactor / nettoyage lié

- [ ] Renommer / découper `coupon-detail.tsx` en primitives réutilisables orientées `fixture` / `bet`
- [ ] Supprimer le vocabulaire `coupon` restant dans l'UI et les labels
- [ ] Éviter toute réintroduction de logique de combiné

---

## Phase 7 — Backend auth + hard delete coupon + data model bet slip

La disparition du concept `coupon` touche aussi le backend.
Le modèle cible est :

- authentification centralisée dans `apps/backend`
- `User` + `Session` côté base de données
- `BetSlip` lié à un `User`
- `Bet` conservé comme entité principale issue du betting engine
- suppression forte (`hard delete`) du modèle `coupon`, sans perdre les données métier importantes portées par `Bet`

### Référence d'architecture

S'inspirer du modèle `user` / `auth` de `~/lab/fne-flash-ci` :

- backend NestJS = autorité unique d'auth
- sessions opaques stockées côté serveur
- cookie `httpOnly`
- pas de JWT applicatif pour le web
- `User` + `Session` en base

### Data model à introduire

- [x] Ajouter `User`
- [x] Ajouter `Session`
- [x] Ajouter `BetSlip`
- [x] Ajouter `BetSlipItem`
- [x] Lier `BetSlip` à `User`
- [x] Lier les `Bet` aux `BetSlip` via `BetSlipItem`
- [x] Permettre un override de mise par item de slip
- [x] Garantir qu'un `Bet` ne peut pas apparaître dans plusieurs slips d'un même utilisateur
- [x] Pas de modèle `draft` backend en V1
- [x] Ajouter `username` unique sur `User`
- [x] Ajouter `bio` optionnelle sur `User`

### Auth backend à introduire

- [x] Créer un module `auth/` dans `apps/backend`
- [x] Implémenter login / logout / session courante
- [x] Stocker les sessions en base
- [x] Utiliser un cookie `httpOnly`
- [x] Ajouter guards / décorateurs backend pour les routes protégées
- [ ] Préparer l'arrivée des permissions / rôles utilisateur

### Backend coupon à supprimer

- [x] Supprimer `modules/coupon/*`
- [x] Retirer `CouponModule` de `app.module.ts`
- [x] Supprimer le scheduler / worker de génération coupon
- [x] Supprimer les endpoints backend `/coupon`
- [x] Supprimer les constantes `coupon.constants.ts`

### Flux backend à simplifier

- [x] Retirer `CouponService` de `adjustment.service.ts`
- [x] Retirer le settlement coupon de `pending-bets-settlement.worker.ts`
- [x] Garder uniquement : sync fixture → settlement bets → calibration

### Dashboard / audit backend à refactorer

- [x] Supprimer `couponSnapshots` du dashboard backend
- [x] Supprimer `recentCoupons` / `latestCoupon` du dashboard repository
- [x] Supprimer `couponId` des opportunités backend si plus de diagnostic coupon
- [x] Retirer `coupon-worker` des worker statuses dashboard
- [x] Supprimer `couponsTotal` / `couponsByStatus` de l'overview audit
- [ ] Remplacer ces métriques par des métriques orientées bets / slips

### Notifications / mails à nettoyer

- [x] Supprimer `sendDailyCoupon`
- [x] Supprimer `sendCouponResult`
- [x] Supprimer `sendNoBetToday` (retiré avec le domaine coupon)
- [ ] Supprimer les templates email liés aux coupons (`renderDailyCoupon` dans `@evcore/transactional`)
- [x] Nettoyer les `NotificationType` obsolètes liés aux coupons (`DAILY_COUPON`, `NO_BET_TODAY`, `COUPON_RESULT`)

### DB / Prisma / migrations

- [x] Supprimer `DailyCoupon`
- [x] Supprimer `CouponLeg`
- [x] Supprimer les relations coupon depuis `Bet`
- [x] Nettoyer les colonnes et index coupon-centric
- [x] Revoir les commentaires métier de `qualityScore`
- [x] Écrire une migration Prisma de suppression forte du modèle coupon

### Scripts / backtest / dette technique

- [x] Supprimer la simulation coupon dans `backtest.service.ts`
- [ ] Nettoyer les scripts DB qui lisent encore `daily_coupon` / `coupon_leg`
- [x] Nettoyer les tests backend liés au domaine coupon (341 tests passants)

---

## Ordre d'exécution

```
Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ✅ → Phase 5 (1 item restant) → Phase 6 → Phase 7 (quasi complet — reste transactional + métriques + scripts DB)
```

---

## Notes

- Tous les filtres sont server-side (searchParams Next.js, pas de useState pour les filtres)
- Un composant = un fichier
- `page.tsx` = assemblage uniquement, pas de logique
- `apps/web/constants/` pour les constantes partagées entre domaines
- `constants/` dans chaque domaine si constantes spécifiques au domaine
- La route `(public)` est conservée pour la future landing page
- `packages/ui` est conservé tel quel (shadcn sera intégré plus tard)
- **Jamais de helpers date inline** dans les composants ou use-cases → toujours passer par `lib/date.ts` (date-fns)
- `GET /fixture` (fixture module) → page fixtures / `GET /audit/fixtures` (audit module) → page audit
- EVCore n'a plus de notion de coupon combiné : à terme, l'objet utilisateur devient un **panier de bets simples**
- L'authentification future doit être centralisée dans `apps/backend` avec sessions opaques serveur

### PWA / Mobile-first (critique)

- L'app est une **PWA installable** — toute UI doit être pensée mobile en premier
- Pas de hover-only interactions, pas de tooltips desktop-only
- Les filtres de la page fixtures doivent être accessibles sur petit écran (scroll horizontal)
- La table fixtures sur mobile = cards empilées, pas de tableau à colonnes multiples
- Le side panel de détail fixture = bottom drawer sur mobile (Vaul), side panel sur desktop
- Touch targets minimum 44px
- Pas de layout qui suppose une souris
