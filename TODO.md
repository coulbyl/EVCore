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
