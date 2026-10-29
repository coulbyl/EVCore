/**
 * L'issue d'un pari, d'un coupon ou d'une journée, telle qu'un écran la
 * montre.
 *
 * - `won`, `lost` : réglé.
 * - `void` : remboursé (match reporté, nul sur un « remboursé si nul »).
 * - `pending` : pas encore réglé (match en cours ou de nuit).
 * - `none` : rien à régler ce jour-là (le produit s'est abstenu).
 */
export type Outcome = "won" | "lost" | "void" | "pending" | "none";

/** Une issue réglée ou en attente, sans le jour vide. */
export type SettledOutcome = Exclude<Outcome, "none">;
