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
