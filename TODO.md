# EVCore — TODO

## Prochaine session — Tuning promotion de ligues

Référence backtest actuel : **R6 — 468 bets, +15.7% ROI, +73.46u ← record**

### Priorité 1 — Promotions validées ✅

#### `PL` → Very Good ✅ (R6)

- Floor HOME 3.0 → 0 HOME, 19b DRAW pur +37.6% ROI +7.15u

#### `CH` → Good ✅ (R6)

- Floor HOME 5.0 → 0 HOME, 13b DRAW+AWAY+UNDER +16.8% ROI +2.18u

### Priorité 2 — Analysées, aucun levier actionnable

#### `LL` → Very Good (bloqué)

- 19b +33.4% ROI — signal propre, volume naturellement limité par marché efficient
- Threshold 0.55 testé/rejeté (R5) : fixtures [0.55-0.58) → faux EV [3.0-4.99] (-4u net)
- Probability gate HOME 0.45 : 58 rejetés à -9.7% ROI — correctement bloqués
- **Conclusion** : LL est au maximum de ce que le modèle peut extraire. Aucun levier sans dégradation.

#### `SP2` → Good

- 13b +12.8% ROI — niche HOME <2.0 propre
- Threshold 0.62 filtre 91% des fixtures (1022/1126) — signal rare mais propre
- [2.00+] correctement bloqué (-33% à -100%). Aucune poche HOME [2.0-2.5) actionnable.
- **Conclusion** : laisser en l'état, attendre volume naturel avec plus de saisons.

### Surveillance — Conclusions d'analyse

#### `J1` — signal AWAY confirmé multi-saisons ✅

- AWAY 6b, 4W/2L sur **3 saisons distinctes** (2023, 2024, 2025) — signal systématique, pas de chance
- Sans biggest win (+2.42u) : encore +3.95u sur 5b (+79% ROI)
- 244 AWAY rejetés par `prob<lim` : +0.9% ROI — trop faible pour assouplir le gate
- HOME 50b -0.6% : neutre structurel, pas de bucket toxique isolé
- **Conclusion** : J1 correctement calibré. Volume AWAY limité par nature (gate prob<lim). Good tier validé.
  Pour Very Good, attendre que le volume AWAY augmente naturellement sur saisons futures.

#### `MX1` — signal sub-2.0 insuffisant

- 7b <2.0 à +39.3% ROI — N trop faible, variance pure
- **Conclusion** : attendre N ≥ 20 bets dans ce bucket avant tout patch

---

## Classement des ligues (audit 2026-04-05 R6 — 468 bets, ROI +15.7%, profit +73.46u) ← record

> R4 : 473 bets, +14.9%, +70.54u
> Delta R6 : PL HOME floor 3.0 (+0.92u), CH HOME floor 5.0 (+2.00u), LL threshold revert 0.58
> R6 = nouveau record absolu

### Very Good — Épines dorsales

- `EL2` — 189b, +13.9% ROI, +26.29u. Colonne vertébrale, sélection 11.8%.
  AWAY 84b +20.4% très solide, HOME 104b +9.7% contributeur régulier
- `EL1` — 40b, +26.8% ROI, +10.71u. AWAY 20b +45.6%, HOME 19b +2.3%
- `L1` — 21b, +36.8% ROI, +7.73u. Meilleur ROI absolu. HOME 19b +39.1%
- `PL` — 19b, +37.6% ROI, +7.15u. ⬆ promu R6. DRAW pur window [5.0–5.50). 0 HOME (floor 3.0)

### Good — Contributeurs fiables

- `LL` — 19b, +33.4% ROI, +6.34u. HOME 18b +21.9%, UNDER 1b +240% (outlier)
- `J1` — 56b, +10.8% ROI, +6.05u. AWAY 6b +106% ROI — signal multi-saisons confirmé (4W/2L sur 2023/2024/2025). HOME 50b neutre (-0.6%). Good tier validé.
- `D2` — 15b, +26.6% ROI, +3.99u. AWAY 14b +7.4%, DRAW 1b +295% (outlier)
- `F2` — 38b, +5.3% ROI, +2.03u. HOME 36b +11.2% moteur
- `CH` — 13b, +16.8% ROI, +2.18u. ⬆ promu R6. DRAW 8b +19.3%, AWAY 3b +18%, UNDER 2b +5%. 0 HOME (floor 5.0)

### Medium — Positifs mais fragiles

- `SP2` — 13b, +12.8% ROI, +1.66u. HOME 11b +13.5% fenêtre <2.0. ⬆ Good si volume augmente

### Low — Signaux faibles ou instables

- `POR` — 4b, +8.0% ROI, +0.32u. N=4, bruit pur
- `MX1` — 26b, +0.0% ROI, +0.01u. HOME only (AWAY suspendu). Break-even structurel
- `SA` — 7b, -3.7% ROI, -0.26u. N trop faible
- `BL1` — 3b, -1.0% ROI, -0.03u. N=3 non significatif

### Red — Exclus ou négatifs structurels

- `ERD` — 5b, -14.4% ROI, -0.72u. Pas de sub-segment rentable identifié
- `I2` — 0b (floor 2.50 bloque tout HOME, aucun AWAY/DRAW candidat). Reprendre audit à ≥ 50 bets réels

---

## Patches validés

- Suppression dépendance stricte `snapshotAt <= scheduledAt/cutoff`
- `J1` débloquée après alignement odds/backtest
- `D2` : assouplissement AWAY + durcissement HOME via floor d'odds
- `PL` : DRAW window [5.0–5.50) validée — 19b +37.6%
- `ERD` : lambda 1.75 — correction Poisson
- `I2` (audit 2026-04-05, 5 itérations)
  - lambda 1.56, per-league HA factor [1.02, 0.98]
  - probability gate HOME ≥ 0.50 + EV soft cap 0.35
  - floor HOME 2.50 → bloque la totalité des bets HOME (bucket [2.0–2.49] toxique à -54.6%)
  - I2 ne génère que des candidats HOME — floor et gate produisent le même résultat (0 bets)

---

## Guide de référence

- `docs/league-calibration-audit.md` — méthodologie complète d'audit par ligue
