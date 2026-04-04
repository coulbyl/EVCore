# EVCore — TODO

## Fait aujourd'hui

- Odds CSV import stabilisé sur les ligues principales et secondaires.
- Support ajouté pour les ligues `extra` de `football-data.co.uk` :
  - `J1` via `new/JPN.csv`
  - `MX1` via `new/MEX.csv`
- Parser dédié ajouté pour les CSV `extra leagues`.
- Mapping d'alias renforcé pour les équipes CSV sur :
  - `J1`, `MX1`, `L1`, `LL`, `EL1`, `EL2`, `F2`, `POR`, `SP2`, `D2`, `ERD`
- Matching de fixtures renforcé :
  - accents / ASCII
  - ponctuation
  - `name` vs `shortName`
  - préfixes de club (`RKC Waalwijk` vs `Waalwijk`)
- Zéros bookmaker dans les CSV tolérés quand la ligne reste exploitable.

## À faire demain

- Relancer le `stats sync` sur les ligues incomplètes, quota API-Football terminé aujourd'hui.

### Priorité 1

- `PL`
- `LL`
- `CH`
- `D2`

### Priorité 2

- `EL1`
- `EL2`
- `L1`
- `F2`

## Objectif après relance

- Améliorer la couverture xG sur les ligues encore incomplètes.
- Re-générer `packages/db/reports/db-stats.txt`.
- Vérifier que le périmètre backtest reste propre après le refresh stats.

## Classement des ligues (audit 2026-04-04 R3 — 505 bets, ROI +14.4%, profit +72.62)

> R2 : 482 bets, +14.2%, +68.38 profit
> Delta : +23 bets, +4.24 profit, +0.2pp ROI
> Changement principal : PL DRAW window [5.0, 5.50) validée — 24b +29.8% ROI +7.15 profit

### Very Good — Épines dorsales

- `EL2` — 189b, +13.9% ROI, +26.29 profit. Colonne vertébrale, sélection 11.8%.
  AWAY 84b +20.4% très solide, HOME 104b +9.7% contributeur régulier
- `EL1` — 40b, +26.8% ROI, +10.71 profit. AWAY 20b +45.6%, HOME 19b +2.3% (EV window [0.15–0.25] tenu)
- `L1` — 21b, +36.8% ROI, +7.73 profit. Meilleur ROI. HOME 19b +39.1% sur odds 2.0–2.99

### Good — Contributeurs fiables

- `PL` — 32b, +18.7% ROI, +5.98 profit. ↑ depuis Low (9b +19.3% R1).
  DRAW 24b +29.8% window [5.0–5.50) — segment propre. HOME 8b = -14.6% (inchangé, accepté)
- `J1` — 56b, +10.8% ROI, +6.05 profit. ⚠ AWAY 6b porte tout (+106% ROI). HOME 50b = -0.6%. Surveiller la dépendance AWAY
- `LL` — 30b, +18.8% ROI, +5.63 profit. HOME exclusif, discipliné
- `D2` — 15b, +26.6% ROI, +3.99 profit. AWAY 14b +7.4%, DRAW 1b +295% (outlier). Surveiller le volume
- `CH` — 23b, +9.5% ROI, +2.17 profit. DRAW 16b +22.1% moteur principal.
  HOME 2b -100% (soft cap 0.35 actif), AWAY 3b +18%

### Medium — Positifs mais fragiles

- `F2` — 38b, +5.3% ROI, +2.03 profit. HOME 36b +11.2% réel moteur. DRAW/AWAY drainent (1b chacun = -100%)
- `SP2` — 12b, +4.0% ROI, +0.48 profit. Niche : HOME fenêtre odds [1.50–1.95] uniquement (11b, +13.5%)
- `BL1` — 7b, +31.4% ROI, +2.20 profit. ROI flatteur, N=7 non significatif statistiquement

### Low — Signaux faibles ou instables

- `MX1` — 26b, +0.04% ROI, +0.01 profit. HOME only (AWAY suspendu). Signal <2.0 : 7b +39.3% (non significatif)
- `SA` — 7b, -3.7% ROI. N trop faible, surveiller
- `POR` — 4b, +8.0% ROI. N=4, bruit pur

### Red — Exclus ou négatifs structurels

- `ERD` — 5b, -14.4% ROI. Pas de sub-segment rentable identifié
- `I2` — 0b, suspendu (threshold 0.75). Reprendre à N ≥ 50 bets HOME

## Ligues déjà assez propres pour backtest

- `J1`
- `MX1`
- `POR`
- `SA`
- `I2`
- `ERD`
- `PL`
- `BL1`
- `SP2`

## Vérification après sync

- Contrôler les ratios `xG (done/fin)` dans `packages/db/reports/db-stats.txt`
- Vérifier qu'il n'y a pas de nouvelle explosion de `noFixture`
- Relancer un backtest uniquement après validation du rapport

## Reprise tuning backtest

- Garder la logique backtest alignée avec le `betting engine` :
  - analyse des rejets sur tous les marchés, pas seulement `ONE_X_TWO`
  - utiliser les `topRejectedCandidates` avec `result` et `profit` simulés

### Pistes chirurgicales identifiées

- `I2`
  - `ONE_X_TWO|HOME` placé reste très toxique
  - `AWAY` rejeté ne montre pas de poche rentable claire
  - prochaine action : durcir fortement ou exclure temporairement `I2` sur `ONE_X_TWO|HOME`

- `MX1`
  - `ONE_X_TWO|AWAY` placé est toxique
  - `ONE_X_TWO|HOME` rejeté par `ev_below_threshold` / `probability_too_low` montre une légère valeur
  - prochaine action : durcir `AWAY`, assouplir légèrement `HOME`

- `CH`
  - `ONE_X_TWO|DRAW` fonctionne
  - `ONE_X_TWO|HOME` et `ONE_X_TWO|AWAY` restent mauvais
  - `OVER_UNDER|UNDER` est légèrement positif mais faible volume
  - prochaine action : préserver `DRAW` et `UNDER`, durcir `HOME` et `AWAY`

- `SP2`
  - `ONE_X_TWO|HOME` placé est mauvais
  - `HOME` rejeté par `odds_below_floor` est positif
  - `DRAW` rejeté par `ev_below_threshold` mérite revue
  - prochaine action : tester une fenêtre plus précise sur `HOME` court et revoir le cas `DRAW`

### Patches déjà validés

- suppression de la dépendance stricte à `snapshotAt <= scheduledAt/cutoff`
- `J1` débloquée et profitable après alignement odds/backtest
- `D2`
  - assouplissement validé sur `ONE_X_TWO|AWAY` via `probability_too_low`
  - durcissement validé sur `ONE_X_TWO|HOME` via floor d'odds
