# EVCore — TODO Phase 2

> Plan de travail courant. Source de vérité détaillée : [ROADMAP.md](ROADMAP.md)
> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)

---

## Blocs terminés ✅

| Bloc | Contenu | Tests |
| ---- | ------- | ----- |
| Bloc 1 | Odds live (odds-live-sync), ETL multi-ligue, multi-compétitions CSV | 184 |
| Bloc 2 | ETL hardening, pipeline live validé prod, Kelly fractionnelle (`KELLY_ENABLED`) | 200 |
| Bloc 3 | Daily Coupon Generator (COMBO_WHITELIST, CouponService, CouponWorker, shadow scoring, line movement) | 204 |

---

## Bloc 4 — Shadow Data Collection + auto-activation *(suivant)*

### Shadow services (données collectées, scores non intégrés au moteur)

- [ ] ETL worker `injuries-sync`
  - Appel `/injuries?fixture=:id` pour chaque fixture SCHEDULED post-fixtures-sync
  - Stockage dans `ModelRun.features.shadow_injuries` (count blessés clés par équipe)
  - Zod schema + tests unitaires worker
- [ ] `H2HService`
  - 5 dernières confrontations directes depuis fixtures DB (pas d'appel API)
  - Score H2H : ratio victoires côté favori, loggé en `shadow_h2h`
  - `FEATURE_FLAGS.SCORING.H2H = false` (shadow seulement)
- [ ] `CongestionService`
  - Jours depuis dernier match + nombre de fixtures dans les 4 prochains jours
  - Score congestion normalisé, loggé en `shadow_congestion`
  - `FEATURE_FLAGS.SCORING.CONGESTION = false` (shadow seulement)

### Boucle d'auto-activation

- [ ] `AdjustmentService.computeShadowCorrelations()` — corrélation Spearman entre chaque `shadow_*` et les outcomes réels sur les 50+ derniers bets settlés
- [ ] Auto-activation si |rho| > 0.15 : `FEATURE_FLAGS.SCORING.<feature> = true`, `AdjustmentProposal` appliqué automatiquement
- [ ] Rollback via `POST /adjustment/:id/rollback` (existant)
- [ ] Tests unitaires corrélation Spearman (cas limites : < 50 bets, rho faible, rho fort)

---

## Bloc 5 — Coupon settlement + résultats live

- [ ] `CouponService.settleExpiredCoupons(date)` — settle les DailyCoupon PENDING dont tous les bets sont WON/LOST/VOID
  - `DailyCoupon.status` → WON (tous WON), LOST (≥ 1 LOST), SETTLED (VOID uniquement)
  - Déclenché post `AdjustmentService.settleAndCheck()` ou par cron séparé
- [ ] `NotificationService.sendCouponResult(couponId)` — email récap résultat coupon
- [ ] Endpoint `POST /coupon/:id/settle` (manuel, pour tests en prod)
- [ ] Tests unitaires `settleExpiredCoupons`

---

## Bloc 6 — Suite Phase 2

- [ ] **Marché Mi-temps/Fin de match** (HT/FT combo, nouveau bet type)
- [ ] **OpenClaw** (LLM delta ≤ 30%, Zod-validated, temperature 0) — après validation Bloc 3 en prod (≥ 30 jours de coupons)
- [ ] **Grafana** dashboards (ROI, Brier Score, drawdown, qualityScore distribution)
- [ ] **TimescaleDB** (odds snapshots haute fréquence, remplacement OddsSnapshot Postgres)
- [ ] **Multi-bookmakers** (Betclic, Unibet)

---

## Suivi

- [x] Bloc 1 terminé
- [x] Bloc 2 terminé
- [x] Bloc 3 terminé
- [ ] Bloc 4 en cours
- [ ] Bloc 5 à faire
- [ ] Bloc 6 à faire
- [x] ROADMAP.md synchronisée (2 mars 2026)
