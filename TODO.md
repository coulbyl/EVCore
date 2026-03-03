# EVCore — TODO Phase 2

> Plan de travail courant. Source de vérité détaillée : [ROADMAP.md](ROADMAP.md)
> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)

---

## Blocs terminés ✅

| Bloc   | Contenu                                                                                              | Tests |
| ------ | ---------------------------------------------------------------------------------------------------- | ----- |
| Bloc 1 | Odds live (odds-live-sync), ETL multi-ligue, multi-compétitions CSV                                  | 184   |
| Bloc 2 | ETL hardening, pipeline live validé prod, Kelly fractionnelle (`KELLY_ENABLED`)                      | 200   |
| Bloc 3 | Daily Coupon Generator (COMBO_WHITELIST, CouponService, CouponWorker, shadow scoring, line movement) | 204   |

---

## Bloc 4 — Shadow Data Collection + auto-activation _(suivant)_

### Shadow services (données collectées, scores non intégrés au moteur)

- [x] ETL worker `injuries-sync`
  - Appel `/injuries?fixture=:id` pour chaque fixture SCHEDULED post-fixtures-sync
  - Stockage dans `ModelRun.features.shadow_injuries` (count blessés clés par équipe)
  - Zod schema + tests unitaires worker
- [x] `H2HService`
  - 5 dernières confrontations directes depuis fixtures DB (pas d'appel API)
  - Score H2H : ratio victoires côté favori, loggé en `shadow_h2h`
  - `FEATURE_FLAGS.SCORING.H2H = false` (shadow seulement)
- [x] `CongestionService`
  - Jours depuis dernier match + nombre de fixtures dans les 4 prochains jours
  - Score congestion normalisé, loggé en `shadow_congestion`
  - `FEATURE_FLAGS.SCORING.CONGESTION = false` (shadow seulement)

### Boucle d'auto-activation

- [x] `AdjustmentService.computeShadowCorrelations()` — corrélation Spearman entre chaque `shadow_*` et les outcomes réels sur les 50+ derniers bets settlés
- [x] Auto-activation si |rho| > 0.15 : `FEATURE_FLAGS.SCORING.<feature> = true`, `AdjustmentProposal` appliqué automatiquement
- [ ] Rollback via `POST /adjustment/:id/rollback` (existant)
- [x] Tests unitaires corrélation Spearman (cas limites : < 50 bets, rho faible, rho fort)

---

## Bloc 5 — Coupon settlement + résultats live

- [x] `CouponService.settleExpiredCoupons(date)` — settle les DailyCoupon PENDING dont tous les bets sont WON/LOST/VOID
  - `DailyCoupon.status` → WON (tous WON), LOST (≥ 1 LOST), SETTLED (VOID uniquement)
  - Déclenché post `AdjustmentService.settleAndCheck()` ou par cron séparé
- [x] `NotificationService.sendCouponResult(couponId)` — email récap résultat coupon
- [x] Endpoint `POST /coupon/:id/settle` (manuel, pour tests en prod)
- [x] Tests unitaires `settleExpiredCoupons`

---

## Bloc 6 — Suite Phase 2

- [x] **Marché Mi-temps/Fin de match** (HT/FT combo, nouveau bet type)
  - [x] Fondations backend HT/FT: `Market.HALF_TIME_FULL_TIME`, scores mi-temps (`homeHtScore/awayHtScore`), settlement HT/FT
  - [x] Probas HT/FT dérivées du modèle Poisson (`htft` sur 9 issues)
  - [x] Ingestion odds live HT/FT (`Half Time / Full Time`) + persistance `OddsSnapshot`
  - [x] Sélection EV/qualityScore étendue au marché HT/FT
- [x] **Stabilité first prod (sans TimescaleDB)**
  - [x] Cleanup automatique `OddsSnapshot` (job ETL `odds-snapshot-retention`, rétention configurable)
  - [x] Coupon multi-jours (fenêtre 1-3 jours) pour combiner 2-3 journées de matchs
  - [x] Tuning rate-limit/quota API-Football (estimation appels/jour + alerte de budget au boot)
- [~] **Activation 10 ligues (A + B)**
  - [x] Vague 1 active: `PL`, `SA`, `LL`, `BL1`, `L1`
  - [ ] Vague 2 à activer: `CH`, `I2`, `SP2`
  - [ ] Vague 3 à activer: `D2`, `F2`
  - [ ] Validation post-vague: ETL success rate, couverture odds, quota API, délai coupon
- [ ] **OpenClaw** — `STAND-BY POST-PROD` (voir `OPENCLAW.md`)
  - Activation après 30+ jours prod stables, d'abord en shadow mode
  - Contraintes: delta ≤ 30%, validation Zod stricte, temperature 0, fallback déterministe
- [ ] **Grafana** — `STAND-BY POST-PROD` (voir `GRAFANA.md`)
  - Activation quand le monitoring manuel (logs/SQL) n'est plus suffisant
- [ ] **TimescaleDB** (odds snapshots haute fréquence, remplacement OddsSnapshot Postgres)
- [ ] **Multi-bookmakers** (Betclic, Unibet)

---

## Suivi

- [x] Bloc 1 terminé
- [x] Bloc 2 terminé
- [x] Bloc 3 terminé
- [ ] Bloc 4 en cours
- [x] Bloc 5 terminé
- [ ] Bloc 6 en cours
- [x] ROADMAP.md synchronisée (3 mars 2026)
