# EVCore — TODO

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

- [ ] Supprimer `app/(dashboard)/coupons/`
- [ ] Supprimer `app/(public)/coupons/`
- [ ] Vider `app/(public)/` — garder le dossier, ajouter `page.tsx` placeholder (future landing)
- [ ] Supprimer hooks orphelins : `use-coupons-by-period.ts`, `use-coupon-by-id.ts`
- [ ] Supprimer `helpers/coupon.ts`
- [ ] Supprimer composants coupons : `coupon-detail.tsx`, `recent-coupons-card.tsx`

---

## Ordre d'exécution

```
Phase 1 ✅ → Phase 2 → Phase 3 → Phase 4 → Phase 5
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

### PWA / Mobile-first (critique)

- L'app est une **PWA installable** — toute UI doit être pensée mobile en premier
- Pas de hover-only interactions, pas de tooltips desktop-only
- Les filtres de la page fixtures doivent être accessibles sur petit écran (scroll horizontal)
- La table fixtures sur mobile = cards empilées, pas de tableau à colonnes multiples
- Le side panel de détail fixture = bottom drawer sur mobile (Vaul), side panel sur desktop
- Touch targets minimum 44px
- Pas de layout qui suppose une souris
