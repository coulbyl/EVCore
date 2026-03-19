# EVCore — TODO

> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)
> Blocs 1–6 terminés (voir archives). Phase 2 moteur validée.

---

## Web — ce qui reste

### Coupons ✅
- [x] Composants réutilisables (`coupon-detail.tsx`) avec logos équipes
- [x] RecentCouponsCard drawer utilise les composants partagés
- [x] `formatPickForDisplay` — bare UNDER/OVER corrigé
- [x] Suppression section Historique (placeholder vide)
- [x] Aside "Détail coupon" full height
- [x] Labels PENDING intelligents (PLANIFIÉ / EN COURS / EN ATTENTE) basés sur `fixtureStatus`

### Dashboard ✅
- [x] P&L redesign (3 stat cards + barre win/loss)
- [x] OpportunitiesTable : colonnes Marché/Décision supprimées, logos, CopyPick
- [x] FixtureDetailPanel : redesign complet (bet-slip card, metric grid HoverCard)
- [x] Layout : pipeline + alertes déplacés dans l'aside
- [x] `FixtureStatusBadge` affiché dans OpportunitiesTable

### Helpers ✅
- [x] `helpers/coupon.ts` — tous les helpers purs coupon/selection (labels, badges, dots)
- [x] `helpers/fixture.ts` — `fixtureStatusLabel` + `fixtureStatusBadgeClass`
- [x] Tous les callers importent directement depuis `helpers/` (pas de re-exports)

### Écran Audit (`/audit`) ✅
- [x] Endpoint `GET /audit/fixtures?date=`
- [x] Endpoint `GET /audit/overview`
- [x] Sélecteur de date (défaut : aujourd'hui)
- [x] Table fixtures avec colonnes : ligue · équipes · statut · décision · score · pick · cotes
- [x] Section snapshot DB (counts + breakdown ligue + bets/coupons par statut)
- [ ] Exposer signaux de diagnostic : `hasOdds`, `lineMovement`, `h2hScore`, `congestionScore`, `lambdaFloorHit`
- [ ] Signaux visibles par fixture (expandable row ou side panel)

### Divers

- [ ] `/coupons/[id]` — page dédiée pour un coupon (deep link, partage)
- [ ] Filtres URL-driven (`searchParams`) sur Coupons et Audit
- [ ] Lint/typecheck/tests dédiés `apps/web`
