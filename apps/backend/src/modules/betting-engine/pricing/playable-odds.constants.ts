/**
 * Books où les utilisateurs misent réellement (2026-10-18 : 1xBet et Betclic).
 * Betclic n'est pas servi par API-Football dans notre relevé ; 1xBet l'est,
 * sur 95 % des rencontres. La « cote jouable » d'un choix est son prix chez
 * le premier de ces books qui le cote, sinon le plus bas de tous les books
 * relevés — le pire cas, celui que l'utilisateur découvrira sinon au moment
 * de miser.
 *
 * Pourquoi : notre prix de référence vient de Bet365 et Pinnacle, les plus
 * généreux des neuf books ; sur les cotes courtes le moins bon est 5 % en
 * dessous, et un 1,14 affiché devient 1,07 chez l'opérateur, sous son
 * minimum de 1,10 (docs/audits/2026-10-18/COTES-JOUABLES.md).
 */
export const OPERATOR_BOOKMAKERS: readonly string[] = ['1xBet'];

/** Minimum de cote accepté par les books des utilisateurs. */
export const OPERATOR_MIN_ODDS = 1.1;
