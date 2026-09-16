// Règlement du handicap asiatique.
//
// Ce marché ne se règle pas en gagné/perdu. Trois familles de lignes :
//
//   - ligne entière (-1, 0, +2) : si le score corrigé est nul, la mise est
//     REMBOURSÉE. C'est le « push », qui n'existe pas au 1X2.
//   - demi-ligne (-0.5, +1.5) : gagné ou perdu, jamais de remboursement.
//   - quart de ligne (-0.25, +0.75) : la mise est SCINDÉE en deux moitiés sur
//     les deux lignes adjacentes. Une moitié peut gagner pendant que l'autre
//     est remboursée.
//
// Traiter un quart de ligne comme une demi-ligne fausse le résultat dans une
// direction systématique, et traiter une ligne entière sans remboursement
// gonfle les pertes. Sur un marché dont la marge est justement l'objet de la
// mesure, l'un ou l'autre suffit à inventer ou effacer l'edge cherché.

/** Part de la mise récupérée, cote comprise. 1 = remboursement sec. */
export type SettlementReturn = number;

export type AsianHandicapBet = {
  /** Côté pris. La ligne est toujours exprimée du point de vue du domicile. */
  pick: "HOME" | "AWAY";
  /** Handicap appliqué au domicile, tel que servi par l'API. */
  line: number;
  /** Cote décimale obtenue. */
  odds: number;
  homeScore: number;
  awayScore: number;
};

/** Règle une ligne entière ou demie. Renvoie 1 pour un remboursement. */
function settleSingleLine(margin: number, odds: number): SettlementReturn {
  if (margin > 0) return odds;
  if (margin === 0) return 1;
  return 0;
}

/**
 * Retour d'une mise de 1 sur un handicap asiatique.
 *
 * 0 = perte sèche, 1 = remboursement, `odds` = gain plein. Un quart de ligne
 * peut rendre une valeur intermédiaire, par exemple `(odds + 1) / 2` quand une
 * moitié gagne et l'autre est remboursée.
 */
export function settleAsianHandicap(bet: AsianHandicapBet): SettlementReturn {
  const { pick, line, odds, homeScore, awayScore } = bet;
  if (!Number.isFinite(odds) || odds <= 1) return 0;

  // Le handicap est donné côté domicile : l'extérieur prend le signe opposé.
  const applied = pick === "HOME" ? line : -line;
  const diff =
    pick === "HOME" ? homeScore - awayScore : awayScore - homeScore;
  const margin = diff + applied;

  // Quart de ligne : la mise se scinde sur les deux lignes adjacentes.
  const quarter = Math.abs(applied * 4) % 2 === 1;
  if (quarter) {
    const lower = margin - 0.25;
    const upper = margin + 0.25;
    return (settleSingleLine(lower, odds) + settleSingleLine(upper, odds)) / 2;
  }
  return settleSingleLine(margin, odds);
}

/**
 * Probabilité de gain « pleine » d'une jambe, remboursements exclus du
 * dénominateur.
 *
 * Sert à comparer un handicap asiatique à un marché binaire : une ligne qui
 * rembourse souvent n'est pas comparable telle quelle à un over/under, et
 * mélanger les deux fausserait toute mesure de calibration.
 */
export function isPushableLine(line: number): boolean {
  return Number.isInteger(line) || Math.abs(line * 4) % 2 === 1;
}
