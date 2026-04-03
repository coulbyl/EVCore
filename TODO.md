# EVCore — TODO

## Lambda shrinkage — calibration du moteur Poisson

**Contexte**
Backtest all-seasons (19 saisons, 287 bets) : ROI -10.7%, calibration error 5.12%.
Les lambdas Poisson sont trop extrêmes (ex. Bradford λV1=3.02 → 1 but réel).
La formule `(xgFor × xgAgainst) / leagueAvg` multiplie les extrêmes sans les modérer.

**Ce qu'il faut faire**

1. Ajouter `LAMBDA_SHRINKAGE_FACTOR = 0.70` dans `ev.constants.ts`
2. Modifier `deriveLambdas()` dans `betting-engine.service.ts` :
   ```ts
   // Avant
   const rawHome = (homeXgFor * awayXgAgainst) / leagueAvg;
   // Après
   const rawHome =
     LAMBDA_SHRINKAGE_FACTOR * (homeXgFor * awayXgAgainst) / leagueAvg +
     (1 - LAMBDA_SHRINKAGE_FACTOR) * leagueAvg;
   ```
3. Mettre à jour les tests unitaires `betting-engine.service.spec.ts` (valeurs λ changent)
4. Relancer `POST /etl/sync/backtest` et comparer ROI / Brier avant/après
5. Ajuster α si nécessaire (tester 0.65, 0.70, 0.75)

**Références**
- `apps/backend/src/modules/betting-engine/betting-engine.service.ts:1574` — `deriveLambdas()`
- `apps/backend/src/modules/betting-engine/ev.constants.ts` — constantes moteur
- Backtest baseline : Brier=0.636, CalError=5.12%, ROI=-10.7% (287 bets, 2026-04-03)
