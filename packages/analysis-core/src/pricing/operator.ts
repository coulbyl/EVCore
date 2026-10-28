/**
 * Le bookmaker des joueurs (2026-10-18 : 1xBet ; Betclic n'est pas servi par
 * API-Football). Partagé par le backend et le vantage-worker, qui en avaient
 * chacun une copie jusqu'au 2026-10-29.
 */
export const OPERATOR_BOOKMAKERS: readonly string[] = ["1xBet"];

/** Minimum de cote accepté par les books des joueurs. */
export const OPERATOR_MIN_ODDS = 1.1;

/**
 * Marge médiane de 1xBet par marché, sur ses groupes d'issues complets,
 * dernière cote d'avant-match, 2 435 matchs du 13/09 au 24/10
 * (docs/audits/2026-10-29/MARGES-1XBET.md). Sert quand le groupe d'un choix
 * n'est pas complet chez 1xBet : on suppose alors le coût habituel.
 */
export const TYPICAL_OPERATOR_MARGIN: Readonly<Record<string, number>> = {
  ONE_X_TWO: 0.07,
  DOUBLE_CHANCE: 0.071,
  BTTS: 0.08,
  TEAM_TOTAL_HOME: 0.087,
  TEAM_TOTAL_AWAY: 0.087,
  OVER_UNDER_HT: 0.089,
  FIRST_HALF_WINNER: 0.101,
  OVER_UNDER: 0.103,
  HALF_TIME_FULL_TIME: 0.213,
};

/** Au-delà des marchés mesurés : le plus cher des marchés courants. */
export const DEFAULT_OPERATOR_MARGIN = 0.103;

/** Marge payée chez 1xBet : la mesurée, sinon la typique du marché. */
export function operatorMarginOrTypical(
  market: string,
  operatorMargin: number | null | undefined,
): number {
  return (
    operatorMargin ?? TYPICAL_OPERATOR_MARGIN[market] ?? DEFAULT_OPERATOR_MARGIN
  );
}
