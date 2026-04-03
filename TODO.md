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
   const rawHome = (homeXgFor * awayXgAgainst) / leagueAvg
   // Après
   const rawHome =
     (LAMBDA_SHRINKAGE_FACTOR * (homeXgFor * awayXgAgainst)) / leagueAvg +
     (1 - LAMBDA_SHRINKAGE_FACTOR) * leagueAvg
   ```
3. Mettre à jour les tests unitaires `betting-engine.service.spec.ts` (valeurs λ changent)
4. Relancer `POST /etl/sync/backtest` et comparer ROI / Brier avant/après
5. Ajuster α si nécessaire (tester 0.65, 0.70, 0.75)

**Références**

- `apps/backend/src/modules/betting-engine/betting-engine.service.ts:1574` — `deriveLambdas()`
- `apps/backend/src/modules/betting-engine/ev.constants.ts` — constantes moteur
- Backtest baseline : Brier=0.636, CalError=5.12%, ROI=-10.7% (287 bets, 2026-04-03)

BONUS ANALYSE DE GOOGLE MODE IA:

C'est une excellente analyse. Passer d'un simple clamping (qui ne fait que couper la tête des outliers sans corriger la pente) à un Bayesian shrinkage (qui redresse toute la distribution vers la moyenne) est mathématiquement beaucoup plus sain pour un modèle de Dixon-Coles.
Le problème du produit

est qu'il part du principe que les deux forces s'additionnent de manière multiplicative sans friction, ce qui surestime systématiquement les scores fleuves dans les ligues volatiles (comme la League Two).
Pourquoi l'approche

est pertinente :
Réduction du Brier Score : En ramenant les
extrêmes vers la moyenne, tu réduis l'erreur quadratique sur les scores improbables (ex: un 4-3 prédit qui finit en 1-1).
Gestion de la variance : Le shrinkage agit comme un régulateur de bruit. Plus les données de rolling
sont volatiles, plus le besoin de "tirer" vers la constante de ligue est fort.
Préservation du signal : Contrairement à un cap à 2.5, le shrinkage conserve la hiérarchie. Un match avec un
brut de 5.0 restera plus élevé qu'un match à 3.0, mais dans des proportions physiquement réalistes pour du football.
Quelques points de vigilance pour ton implémentation :
Le choix de la cible : Dans ta formule α _ raw + (1 - α) _ leagueAvg, tu utilises leagueAvg comme point d'ancrage. Assure-toi que leagueAvg est bien représentatif de la tendance centrale des buts marqués (souvent autour de 1.2 - 1.4). Si la ligue est très prolifique, le shrinkage sera moins punitif.
L'asymétrie Home/Away : N'oublie pas d'appliquer le shrinkage avant les multiplicateurs HOME_ADVANTAGE ou de vérifier si ces constantes ne doivent pas être ajustées. Si tu shrinkes les valeurs brutes, l'impact du multiplicateur final sera mécaniquement réduit.
Le test de sensibilité : Si tu lances le backtest, regarde spécifiquement le Yield par tranche de
. Si ton ROI devient positif sur les
entre 1.8 et 2.4 (ton ancienne "zone rouge"), c'est que

est dans le vrai.
Recommandation technique :
Je suggère d'implémenter LAMBDA_SHRINKAGE_FACTOR directement. C'est une modification "low-risk, high-reward" qui stabilise ton moteur de Value Betting.
