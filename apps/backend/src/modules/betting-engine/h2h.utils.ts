// docs/h2h-service-v2-plan.md §4 — scope large : le signal H2H (validé sur
// P(favori gagne) uniquement, backtest-h2h-brier-gain.ts) est appliqué en
// ajustant lambdaHome/lambdaAway avant le calcul des marchés Poisson, plutôt
// qu'en corrigeant une seule probabilité isolément. Comme tous les marchés
// dérivés (1X2, BTTS, O/U, clean sheet, win-to-nil, ...) sont des marginales
// de la même distribution jointe, cet ajustement les corrige tous de façon
// cohérente en une seule fois.
//
// Vérifié empiriquement (backtest-h2h-lambda-adjustment-all-markets.ts,
// 2026-07-23, gamma=0.20 appris sur train, n=5167 validation) : le 1X2
// favori s'améliore (Brier -0.0016) et 6/7 marchés dérivés s'améliorent
// aussi ; seul BTTS se dégrade marginalement (Brier +0.0004).
const H2H_NEUTRAL = 0.5;
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5;

export type LambdaPair = { home: number; away: number };

type AdjustLambdaForH2HInput = {
  lambda: LambdaPair;
  favoriteIsHome: boolean;
  h2hScore: number;
  gamma: number;
};

export function adjustLambdaForH2H(input: AdjustLambdaForH2HInput): LambdaPair {
  const { lambda, favoriteIsHome, h2hScore, gamma } = input;
  const signal = h2hScore - H2H_NEUTRAL;
  const favorFactor = 1 + gamma * signal;
  const underdogFactor = 1 - gamma * signal;

  const home = favoriteIsHome
    ? lambda.home * favorFactor
    : lambda.home * underdogFactor;
  const away = favoriteIsHome
    ? lambda.away * underdogFactor
    : lambda.away * favorFactor;

  return {
    home: clamp(home, LAMBDA_MIN, LAMBDA_MAX),
    away: clamp(away, LAMBDA_MIN, LAMBDA_MAX),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
