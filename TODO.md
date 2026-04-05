# EVCore — TODO

## Prochaine session — Tuning promotion de ligues

Référence backtest actuel : **R6 — 468 bets, +15.7% ROI, +73.46u ← record**

### Priorité 1 — Promotions validées ✅

#### `PL` → Very Good ✅ (R6)
- Floor HOME 3.0 → 0 HOME, 19b DRAW pur +37.6% ROI +7.15u

#### `CH` → Good ✅ (R6)
- Floor HOME 5.0 → 0 HOME, 13b DRAW+AWAY+UNDER +16.8% ROI +2.18u

### Priorité 2 — En cours

#### `LL` → Very Good (bloqué)
- 19b +33.4% ROI — signal propre mais volume limité
- Threshold 0.55 testé et rejeté (R5) — fixtures [0.55-0.58) génèrent faux EV à [3.0-4.99] odds (-4u net)
- Threshold 0.58 = filtre correct pour LL
- **Prochaine action** : analyser si probability gate HOME peut être assoupli sans élargir le threshold

#### `SP2` → Good
- 13b +12.8% ROI — HOME pur fenêtre <2.0
- **Prochaine action** : analyser `topRejectedCandidates` HOME — poche [2.0-2.5) exploitable ?

### Priorité 3 — Surveillance

#### `J1` — consolider AWAY
- AWAY 6b +106% porte tout — concentration excessive
- HOME 50b -0.6% neutre mais pèse sur le ROI global
- **Action** : analyser ndjson AWAY pour identifier si le signal est systématique ou 1-2 gros coups
- Si signal AWAY tient : J1 devient Very Good candidat
- Si bruit : durcir HOME et revoir le lambda J1

#### `MX1` — signal sub-2.0
- Break-even structurel (26b, +0.0%)
- Signal HOME odds <2.0 : 7b +39.3% — trop petit pour agir maintenant
- **Action** : attendre N ≥ 20 bets dans ce bucket avant tout patch

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
- `J1` — 56b, +10.8% ROI, +6.05u. ⚠ AWAY 6b porte tout (+106%). HOME 50b = -0.6%
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
