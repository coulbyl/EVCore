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

## Classement des ligues (audit 2026-04-04 — 486 bets, ROI +13.9%)

### Very Good — Épines dorsales

- `EL2` — 189b, +13.9% ROI, +26.29 profit. Colonne vertébrale, sélection 11.8%
- `EL1` — 40b, +26.8% ROI, +10.71 profit. Win rate 50%, AWAY très solide
- `L1` — 21b, +36.8% ROI, +7.73 profit. Meilleur ROI, win rate 57%

### Good — Contributeurs fiables

- `J1` — 56b, +10.8% ROI, +6.05 profit. Meilleur volume hors EL, AWAY exceptionnel
- `LL` — 30b, +18.8% ROI, +5.63 profit. HOME discipliné
- `D2` — 15b, +26.6% ROI, +3.99 profit. Excellent post-patch, surveiller le volume

### Medium — Positifs mais fragiles

- `F2` — 38b, +5.3% ROI. HOME solide (+11.2%), DRAW/AWAY drainent
- `CH` — 27b, +4.4% ROI. DRAW porte tout, HOME plombe encore
- `SP2` — 12b, +4.0% ROI. Niche : fenêtre odds [1.50–1.95] uniquement
- `BL1` — 7b, +31.4% ROI. ROI flatteur, N=7 non significatif statistiquement

### Low — Signaux faibles ou instables

- `PL` — 9b, +19.3% ROI. Trompe-l'œil : 1 DRAW à 3.91 porte tout. HOME 8b = -14.6%.
  PL DRAW non débloqué (odds_above_cap bloque > 4.0, sim ROI +17% sur 164 cas rejetés)
- `MX1` — 26b, +0.04% ROI. Neutre. HOME flat, AWAY suspendu
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
