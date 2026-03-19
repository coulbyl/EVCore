# EVCore — TODO

> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)
> Blocs 1–6 terminés (voir archives). Phase 2 moteur validée.

---

## Web — ce qui reste

### Écran Audit (`/audit`)

Shell vide. Objectif : équivalent web de `db-stats.ts`, orienté opérateur.

**Backend**
- [ ] Endpoint `GET /audit/fixtures?date=` — fixtures du jour avec par fixture : ligue, équipes, statut, `BET`/`NO_BET`, `deterministicScore`, meilleur candidat, raison rejet si `NO_BET`
- [ ] Exposer les signaux de diagnostic : `hasOdds`, `lineMovement`, `h2hScore`, `congestionScore`, `lambdaFloorHit`
- [ ] Endpoint `GET /audit/overview` — snapshot DB global : counts fixtures/bets/modelRuns/coupons, breakdown par ligue, zero-xG audit, coupon eligibility

**Frontend**
- [ ] Sélecteur de date (défaut : aujourd'hui)
- [ ] Table fixtures avec colonnes : ligue · équipes · statut · décision · score · pick candidat · raison rejet
- [ ] Section snapshot DB (counts + breakdown ligue) — reprendre structure `db-stats`
- [ ] Signaux de diagnostic visibles par fixture (expandable row ou side panel)
- [ ] Logs d'analyse lisibles (pas de JSON brut)

### Divers

- [ ] `/coupons/[id]` — page dédiée pour un coupon (deep link, partage)
- [ ] Filtres URL-driven (`searchParams`) sur Coupons et Audit
- [ ] Lint/typecheck/tests dédiés `apps/web`
