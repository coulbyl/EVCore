# Plan — backtest de calibration historique des nouveaux marchés (sans cotes)

> Complément à `docs/new-markets-safe-value-backtest.md`. Ce document couvre
> une question différente et **exécutable dès maintenant**, sans attendre
> l'accumulation de cotes forward : le modèle est-il **bien calibré** sur
> les 10 nouveaux marchés (DRAW_NO_BET, TEAM_TOTAL_HOME/AWAY,
> CLEAN_SHEET_HOME/AWAY, WIN_TO_NIL_HOME/AWAY, TO_WIN_EITHER_HALF,
> RESULT_TOTAL_GOALS, RESULT_BTTS) ?

---

## 1. L'idée

On n'a pas de cotes historiques pour ces marchés (voir
`docs/new-markets-safe-value-backtest.md` §2), donc pas de backtest ROI/EV
classique possible tout de suite. **Mais la calibration ne dépend pas des
cotes** — seulement de deux choses qu'on a déjà en base depuis 3+ saisons :

1. La probabilité que le modèle aurait annoncée pour chaque marché (calculable
   rétroactivement depuis les `TeamStats` de l'époque).
2. Le résultat réel du marché (calculable depuis le score FT/HT déjà en base).

Comparer les deux sur des milliers de fixtures historiques donne un vrai
signal — Brier score, calibration error, hit rate par tranche de
probabilité — **avant même d'avoir une seule cote sur ces marchés**. C'est
d'ailleurs un prérequis plus fondamental que le ROI : un marché mal calibré
(le modèle dit 70% mais le taux réel est 55%) ne vaut pas la peine d'être
creusé pour SAFE/VALUE une fois les cotes disponibles, quel que soit le ROI
apparent à court terme.

## 2. Pourquoi c'est faisable

- `computePoissonMarkets`/`deriveMarketsFromPoisson`
  (`packages/analysis-core/src/probability/poisson.ts`) calculent déjà
  `dnbHome/Away`, `teamTotalHome/Away`, `cleanSheetHome/Away`,
  `winToNilHome/Away`, `winEitherHalfHome/Away`, `resultTotalGoals`,
  `resultBtts` — purement à partir de `lambdaHome`/`lambdaAway`, aucune
  dépendance aux cotes.
- `TeamStats` (table `team_stats`) est déjà **point-in-time** — une ligne
  par équipe par `afterFixtureId`, pas un simple "dernier snapshot". On peut
  donc reconstituer les stats "telles qu'elles étaient" juste avant chaque
  fixture historique, sans fuite d'information (même garde-fou que
  `CalibrationService` : _"Point-in-time guard: only fixtures whose result
  was known before the cutoff"_).
- Les scores réels (FT + HT) sont déjà en base pour toutes les fixtures
  terminées → on peut calculer rétroactivement l'issue de chacun des 10
  marchés.
- **Précédent direct** : `packages/db/scripts/fri-goal-model-audit.ts` fait
  déjà exactement ce genre de replay historique (charge les fixtures
  terminées, recalcule un modèle de buts, score contre BTTS/Over 2.5/total
  buts réels, écrit un rapport) — même méthode, marchés différents.

## 3. Ce que ça mesure — et ce que ça ne mesure pas

| Mesuré                                                             | Pas mesuré (bloqué sans cotes réelles)                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Brier score par marché/pick/ligue                                  | EV                                                                       |
| Calibration error (proba prédite par tranche vs taux réel observé) | ROI                                                                      |
| Hit rate observé vs proba moyenne prédite                          | Cote minimale jouable                                                    |
| Volume disponible par marché/ligue                                 | Décision d'activation SAFE (nécessite un ROI, pas juste une calibration) |

Résultat attendu : un tri des 10 marchés — lesquels ont une calibration
saine (le modèle sait ce qu'il dit) vs lesquels dérivent nettement, **avant**
d'investir du temps à attendre des cotes forward dessus.

## 4. Issue réelle par marché (depuis les scores déjà en base)

| Marché                | Formule proba (déjà dans `computePoissonMarkets`) | Issue réelle depuis les scores                                                                         |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DRAW_NO_BET           | `dnbHome`/`dnbAway`                               | `homeScore > awayScore` / `awayScore > homeScore` (push si nul, exclu de l'échantillon)                |
| TEAM_TOTAL_HOME/AWAY  | `teamTotalHome`/`teamTotalAway` (par ligne)       | `homeScore`/`awayScore` comparé à la ligne                                                             |
| CLEAN_SHEET_HOME/AWAY | `cleanSheetHome`/`cleanSheetAway`                 | `awayScore === 0` / `homeScore === 0`                                                                  |
| WIN_TO_NIL_HOME/AWAY  | `winToNilHome`/`winToNilAway`                     | équipe gagne ET adversaire à 0                                                                         |
| TO_WIN_EITHER_HALF    | `winEitherHalfHome`/`winEitherHalfAway`           | équipe mène à la mi-temps OU marque plus de buts en 2e période (nécessite `homeHtScore`/`awayHtScore`) |
| RESULT_TOTAL_GOALS    | `resultTotalGoals` (pick composé)                 | résultat FT + total buts vs ligne                                                                      |
| RESULT_BTTS           | `resultBtts` (pick composé)                       | résultat FT + BTTS                                                                                     |

## 5. Plan d'exécution

### Script `packages/db/scripts/backtest-new-markets-calibration.ts`

1. **Ajouter `@evcore/analysis-core` comme dépendance de `packages/db`**
   (absent aujourd'hui — vérifié : aucun script `packages/db/scripts/*.ts`
   n'importe le noyau pur actuellement, ils réimplémentent leur propre
   logique comme `fri-goal-model-audit.ts`). Réutiliser les vraies fonctions
   de prod plutôt que les réimplémenter évite une dérive entre le script et
   le moteur réel — critique ici puisque le but est de tester _le modèle
   actuel_, pas une approximation.
2. Pour chaque fixture terminée (3+ saisons, comme le backtest MVP
   d'origine) :
   a. Récupérer le dernier `TeamStats` de chaque équipe avec
   `afterFixture.scheduledAt < fixture.scheduledAt` — même garde-fou
   cold-start que la prod (`BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS = 5`,
   skip si moins de 5 matchs antérieurs).
   b. `deriveLambdas` → `computePoissonMarkets` (+ `rebalanceThreeWayProbabilities`/
   `shrinkOverUnderProbabilities` comme en prod, pour rester fidèle au
   pipeline réel) → probabilités des 10 marchés.
   c. Calculer l'issue réelle de chaque marché depuis `homeScore`/`awayScore`
   (+ `homeHtScore`/`awayHtScore` pour `TO_WIN_EITHER_HALF`).
   d. Stocker (proba prédite, issue réelle) par marché/pick/ligue.
3. Agréger par (marché × pick × ligue) et par tranche de probabilité :
   Brier score, calibration error (même méthode que `calibrationError()`
   dans `backtest.report.ts`), hit rate observé vs proba moyenne prédite,
   volume.
4. Écrire un rapport texte dans `packages/db/reports/` (même pattern que les
   scripts `db:audit:*`/`db:backtest:*` existants).

## 6. Limitations à anticiper

- `TO_WIN_EITHER_HALF` a besoin des scores mi-temps — pas toutes les
  fixtures historiques n'en ont (confirmé lors du calibrage
  CLEAN_SHEET/WIN_EITHER_HALF : la couverture HT est bonne sur les grandes
  ligues actives mais plus faible sur certaines compétitions anciennes) →
  échantillon plus réduit sur ce marché spécifiquement.
- Rejouer 3+ saisons sur 60+ ligues avec un lookup `TeamStats` point-in-time
  par fixture peut être lent — prévoir un traitement par ligue plutôt qu'un
  run monolithique, avec logs de progression (pattern des scripts
  `db:audit:*` existants).
- `rebalanceThreeWayProbabilities`/`shrinkOverUnderProbabilities` utilisent
  la config **actuelle** par ligue (`getLeagueThreeWayEmpiricalBlendWeight`,
  etc.), pas une config historique reconstituée point-in-time — c'est
  acceptable pour un premier passage (on teste "le modèle d'aujourd'hui sur
  l'historique", pas "le modèle tel qu'il était à chaque époque"), mais à
  noter comme simplification si les résultats surprennent.

## 7. Prochaines étapes

- [ ] Écrire le script (`backtest-new-markets-calibration.ts`)
- [ ] Ajouter `@evcore/analysis-core` aux dépendances de `packages/db`
- [ ] Lancer sur 1-2 ligues à fort volume d'abord (validation rapide de la
      mécanique) avant un run complet toutes ligues
- [ ] Lire les résultats, identifier les marchés bien calibrés vs ceux qui
      dérivent
- [ ] Faire le lien avec `docs/new-markets-safe-value-backtest.md` : les
      marchés bien calibrés ici sont les candidats prioritaires une fois les
      cotes forward disponibles pour le vrai backtest ROI/SAFE
