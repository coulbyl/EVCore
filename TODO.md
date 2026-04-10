# EVCore — TODO

## Safe Value — Couche secondaire de sélection

### Contexte

Les coupons EV pur (P=35-45%) ont un taux de passage < 18% sur 6 legs.
L'idée : ajouter un canal parallèle `SAFE` ciblant des picks haute probabilité (P ≥ 68%),
sans remplacer le flux EV existant.

Rapport d'analyse : [ANALYSE_SAFE_VALUE.md](ANALYSE_SAFE_VALUE.md)

---

### Checklist d'implémentation

#### Backend

- [x] `CouponTier.SAFE` ajouté au schéma Prisma
- [x] `isSafeValue Boolean @default(false)` ajouté au modèle `Bet`
- [x] Migration DB exécutée (faite manuellement)
- [x] Constantes `SAFE_VALUE_*` dans `ev.constants.ts`
- [x] `SAFE_COUPON_MAX_LEGS = 2` dans `coupon.constants.ts`
- [x] `selectSafeValuePick()` dans `BettingEngineService`
- [x] `analyzeFixture()` génère un bet `isSafeValue: true` avec pickKey `sv:...`
- [x] `findEligibleSafeValueBetsForCoupon()` dans `CouponRepository`
- [x] `findEligibleBetsForCoupon()` filtre `isSafeValue: false`
- [x] `generateCouponWindow()` génère le coupon SAFE après les coupons EV
- [x] `sendDailyCoupon()` supporte le tier `'SAFE'` (NotificationService + MailService)

#### Email (`@evcore/transactional`)

- [x] `DailyCouponProps.tier` inclut `"SAFE"`
- [x] Badge SAFE vert dans `daily-coupon.tsx` (`TIER_STYLES`)

#### Web (`apps/web`)

- [x] `CouponTier` dans `helpers/coupon.ts` inclut `"SAFE"`
- [x] `couponTierLabel()` gère `"SAFE"`
- [x] `couponTierBadgeClass()` badge vert (`border-emerald-200 bg-emerald-50 text-emerald-700`)

#### Tests

- [x] Mock `findEligibleSafeValueBetsForCoupon` ajouté dans `coupon.service.spec.ts`
- [x] Tests unitaires pour `selectSafeValuePick()` dans `betting-engine.service.spec.ts`
- [x] Tests unitaires pour la génération du coupon SAFE dans `coupon.service.spec.ts`

#### Qualité

- [x] `pnpm --filter backend lint` ✅
- [x] `pnpm --filter backend typecheck` ✅
- [x] `pnpm --filter backend test` ✅ (360 tests)
- [x] `pnpm --filter web typecheck` ✅

---

### À faire ensuite

- [x] Backtest sur les coupons SAFE : mesurer taux de passage réel (cible ≥ 40%)
- [ ] Monitorer en prod : comparer ROI coupon SAFE vs coupon EV sur 4 semaines

---

### Résultats backtest SAFE (10 avril 2026)

3 saisons, toutes compétitions confondues (`includeInBacktest: true`), pooling cross-compétitions par date UTC (miroir prod) :

| Métrique                      | Résultat  | Cible        |
| ----------------------------- | --------- | ------------ |
| Picks placés                  | 165       | —            |
| Win rate                      | 67.9%     | ≥ 68%        |
| ROI                           | +2.77%    | ≥ 0%         |
| Jours avec coupon (≥ 2 picks) | 36 / 115  | —            |
| **Coupon win rate**           | **41.7%** | **≥ 40% ✅** |

**Points de vigilance :**

- UEL (1 saison) : 4 picks, win rate 25%, ROI -64.8% — faible volume, à surveiller
- UECL (2 saisons) : 12 picks, win rate 37.5–50%, ROI négatif — picks home sur groupes hétérogènes
- Championship : 17 picks sur 2 saisons, ROI légèrement négatif (-5%)
- La plupart des lignes < 5 picks → non significatif statistiquement

---

### Double Chance — Tentative abandonnée (10 avril 2026)

**Problème rencontré :** ajout des marchés `1X`, `X2`, `12` au canal SAFE via dérivation des cotes 1X2.

**Résultat backtest :**

- Volume : 165 → 2 052 picks (×12)
- Win rate : 67.9% → 71.2% ✅
- ROI : **+2.77% → -2.57%** ❌
- Coupon win rate : 41.7% → 53.6% ✅

**Cause racine :** les cotes DC sont dérivées comme `1 / (1/homeOdds + 1/drawOdds)`. La marge bookmaker des cotes 1X2 est ainsi **héritée et doublée** dans les cotes DC. Résultat : EV théorique ≈ 0 = EV réel légèrement négatif de façon systématique. Avg odds = 1.365, break-even à 73.3% de win rate — inatteignable.

**Bonne solution (Phase 2) :** fetcher les vraies cotes Double Chance directement depuis API-Football (market id séparé). L'EV serait alors calculé sur des cotes authentiques sans vig accumulé, et le marché pourrait offrir de vraie valeur.

- [ ] **Phase 2** : intégrer les cotes DC réelles dans `FullOddsSnapshot` via ETL odds (API-Football), puis réactiver `Market.DOUBLE_CHANCE` dans `safeValueMarkets`
